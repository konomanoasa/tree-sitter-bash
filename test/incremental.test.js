import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { grammars } from "../scripts/tree-sitter.js";
import { applyEdit, createParser } from "./support/parser.js";

for (const grammar of grammars) {
  describe(grammar.name, () => {
    let parser;
    before(() => {
      parser = createParser(grammar);
    });
    after(() => {
      parser?.close();
    });
    test("NUL edits and restoration preserve fresh parsing after token boundaries change", () => {
      for (const source of [
        "i\0f :; then :; fi\n",
        ": \\\0x\n",
        ": a\\\0\nb\n",
        "cat <<END\nE\0ND\n",
        ": $\0{v}\n",
      ]) {
        const byte = Buffer.byteLength(source.slice(0, source.indexOf("\0")));
        const options = { arguments: ["-c"] };
        const remove = { byte, deleteBytes: 1, insert: "" };
        const fresh = parser.parse(applyEdit(source, remove), options);
        const incremental = parser.parse(source, {
          ...options,
          edits: [remove],
        });
        assert.equal(fresh.status, 0, fresh.output);
        assert.equal(incremental.status, 0, incremental.output);
        assert.equal(incremental.tree, fresh.tree);
        const replace = { byte, deleteBytes: 1, insert: "z" };
        const repaired = parser.parse(source, {
          ...options,
          edits: [replace, remove],
        });
        assert.equal(repaired.status, 0, repaired.output);
        assert.equal(repaired.tree, fresh.tree);
      }
    });
  });
}
