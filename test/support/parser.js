import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTreeSitter, grammars, root } from "../../scripts/tree-sitter.js";

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
        { timeout: 30_000 },
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
  const bytes = Buffer.from(source);
  const starts = [0];
  for (let index = 0; index < bytes.length; index++) {
    if (bytes[index] === 10) starts.push(index + 1);
  }
  return result.tree.split("\n").flatMap((line) => {
    const match = line.match(/^([0-9]+):([0-9]+) +- +([0-9]+):([0-9]+) +(.*)$/);
    if (match === null) return [];
    const description = match[5].replace(/^•/, "");
    const field = description.match(/^([a-z_]+): (.*)$/);
    const type = (field?.[2] ?? description).split(" ")[0];
    const start = starts[Number(match[1])] + Number(match[2]);
    const end = starts[Number(match[3])] + Number(match[4]);
    assert.ok(start <= end && end <= bytes.length, line);
    return [
      {
        type,
        field: field?.[1],
        start,
        end,
        text: bytes.subarray(start, end).toString(),
      },
    ];
  });
}
