import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTreeSitter, grammars, root } from "../../scripts/tree-sitter.js";
import { sourceNodes } from "./cst.js";

const parseTimeoutMs = 30_000;

export function createParser(
  grammar = grammars.find(({ name }) => name === "bash_extglob") ?? grammars[0],
) {
  const runner = createTreeSitter();
  const library = join(
    runner.directory,
    `${grammar.name}.${process.platform === "win32" ? "dll" : "so"}`,
  );
  const built = runner.run([
    "build",
    "--output",
    library,
    join(root, grammar.path),
  ]);
  assert.ifError(built.error);
  assert.equal(built.status, 0, built.stdout + built.stderr);
  let sequence = 0;
  return {
    close: runner.close,
    parse(source, options) {
      const { edits = [], arguments: extra = [] } = options;
      const file = join(runner.directory, `${sequence++}.${grammar.name}`);
      writeFileSync(file, source);
      const result = runner.run(
        [
          "parse",
          "--lib-path",
          library,
          "--lang-name",
          grammar.name,
          ...extra,
          ...edits.flatMap(({ byte, deleteBytes, insert }) => [
            "--edits",
            `${byte} ${deleteBytes} ${insert}`,
          ]),
          "--",
          file,
        ],
        { timeout: parseTimeoutMs },
      );
      assert.ifError(result.error);
      assert.ok(result.status === 0 || result.status === 1, result.stderr);
      return {
        status: result.status,
        debugOutput: result.stderr,
        output: result.stdout,
        tree: result.stdout.split(`${file}\t`)[0].trimEnd(),
      };
    },
  };
}

export function applyEdit(source, { byte, deleteBytes, insert }) {
  const bytes = Buffer.from(source);
  assert.ok(byte >= 0 && byte + deleteBytes <= bytes.length);
  return Buffer.concat([
    bytes.subarray(0, byte),
    Buffer.from(insert),
    bytes.subarray(byte + deleteBytes),
  ]).toString();
}

export function parseNodes(parser, source) {
  const result = parser.parse(source, { arguments: ["-c"] });
  assert.equal(result.status, 0, result.output);
  return sourceNodes(result.tree, source).map(
    ({ type, field, start, end, text }) => ({ type, field, start, end, text }),
  );
}

export function assertEditRoundTrip(parser, { seed, remove, insert, valid }) {
  const index = seed.indexOf(remove);
  assert.ok(index >= 0);
  const edit = {
    byte: Buffer.byteLength(seed.slice(0, index)),
    deleteBytes: Buffer.byteLength(remove),
    insert,
  };
  const undo = {
    byte: edit.byte,
    deleteBytes: Buffer.byteLength(insert),
    insert: remove,
  };
  const changed = applyEdit(seed, edit);
  assert.equal(applyEdit(changed, undo), seed);
  const options = { arguments: ["-c"] };
  const original = parser.parse(seed, options);
  assert.equal(original.status, 0, original.output);
  const fresh = parser.parse(changed, options);
  assert.equal(fresh.status, valid ? 0 : 1, fresh.output);
  assert.equal(parser.parse(changed, options).tree, fresh.tree);
  const incremental = parser.parse(seed, { ...options, edits: [edit] });
  if (valid) {
    assert.equal(incremental.status, 0, incremental.output);
    assert.equal(incremental.tree, fresh.tree);
  }
  const repaired = parser.parse(seed, { ...options, edits: [edit, undo] });
  assert.equal(repaired.status, 0, repaired.output);
  assert.equal(repaired.tree, original.tree);
}
