import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { grammars } from "../scripts/tree-sitter.js";
import { applyEdit, createParser } from "./support/parser.js";

import { editingWorkloads, workloads } from "./support/workloads.js";

for (const grammar of grammars) {
  describe(grammar.name, () => {
    let parser;
    before(() => {
      parser = createParser(grammar);
    });
    after(() => {
      parser?.close();
    });
    function checkWorkload(name, source, edit, status = 0, reuse = false) {
      const edits = Array.isArray(edit) ? edit : [edit];
      const edited = edits.reduce(applyEdit, source);
      const fresh = parser.parse(edited, {});
      const incremental = parser.parse(source, {
        edits,
        arguments: reuse ? ["--debug"] : [],
      });
      assert.equal(fresh.status, status, fresh.output);
      assert.equal(incremental.status, status, incremental.output);
      if (status === 0) {
        assert.equal(incremental.tree, fresh.tree, name);
      } else {
        const end = ` - [${edited.split("\n").length - 1}, 0]`;
        for (const result of [fresh, incremental]) {
          assert.ok(result.tree.split("\n")[0].includes(end), result.tree);
        }
      }
      if (reuse)
        assert.match(incremental.debugOutput, /reuse_node symbol:/, name);
    }
    for (const {
      name,
      sizes,
      source: createSource,
      extglobOnly,
      editTarget = "x",
    } of workloads) {
      if (extglobOnly && grammar.name !== "bash") continue;
      test(`${name}: scaled edits preserve fresh trees`, () => {
        for (const size of sizes) {
          const source = createSource(size);
          const index = source.indexOf(editTarget);
          assert.ok(index >= 0);
          checkWorkload(`${name}/${size}`, source, {
            byte: Buffer.byteLength(source.slice(0, index)),
            deleteBytes: 1,
            insert: "y",
          });
        }
      });
    }
    for (const { name, run } of editingWorkloads()) {
      test(name, () => run(checkWorkload));
    }
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
