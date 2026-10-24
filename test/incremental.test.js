import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { grammars } from "../scripts/tree-sitter.js";
import {
  applyEdit,
  assertEditRoundTrip,
  createParser,
} from "./support/parser.js";

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
    for (const entry of [
      {
        name: "empty conditions in nested function bodies",
        seed:
          "echo BEFORE\nouter() {\nmiddle() {\ninner() {\n" +
          "if\n:; then :;\nfi\n}\n}\n}\necho AFTER\n",
        remove: ":; then :;\n",
        insert: "",
        valid: false,
      },
      {
        name: "function keywords with comment, newline and continuation headers",
        seed:
          "echo BEFORE\nfunction outer # header\n{\n" +
          "function middle ( )\n{\nfunction inner() \\\n{\n" +
          "if\n:; then :;\nfi\n}\n}\n}\necho AFTER\n",
        remove: ":; then :;\n",
        insert: "",
        valid: false,
      },
      {
        name: "nested arithmetic for bodies with semicolon and newline headers",
        seed:
          "echo BEFORE\nfor ((i=0;i<3;i++)); do\n" +
          "for ((j=0;j<3;j++))\n\ndo\n" +
          "for ((k=0;k<3;k++)) # header\ndo\n" +
          "if\n:; then :;\nfi\ndone\ndone\ndone\necho AFTER\n",
        remove: ":; then :;\n",
        insert: "",
        valid: false,
      },
      {
        name: "nested arithmetic for brace bodies",
        seed:
          "echo BEFORE\nfor ((;;)) {\nfor ((;;)) {\nfor ((;;)) {\n" +
          `echo \${x:-w}\n}\n}\n}\necho AFTER\n`,
        remove: "}\n}\n}\n}\n",
        insert: "",
        valid: false,
      },
      {
        name: "missing parameter and body closers in mixed functions and arithmetic for",
        seed:
          "echo BEFORE\nfunction outer() # header\n{\n" +
          "for ((i=0;i<3;i++)); do\ninner()\n{\n" +
          `echo \${x:-w}\n}\ndone\n}\necho AFTER\n`,
        remove: "}\n}\ndone\n}\n",
        insert: "",
        valid: false,
      },
      {
        name: "an extra closer after a complete arithmetic for header",
        seed: "echo BEFORE\nfor ((x;y;z)); do :; done\necho AFTER\n",
        remove: "((x;y;z))",
        insert: "((x;y;z)))",
        valid: false,
      },
      {
        name: "arithmetic for body separators change to commented linebreaks",
        seed: "for ((;;)); do :; done\n",
        remove: "; do",
        insert: "\n# body\n do",
        valid: true,
      },
      {
        name: "function header comments change to continuations",
        seed: "function f ( ) # header\n{ :; }\n",
        remove: "# header\n",
        insert: "\\\n",
        valid: true,
      },
    ]) {
      test(`${entry.name}: repairs restore the fresh CST`, () => {
        assertEditRoundTrip(parser, entry);
      });
    }
    test("closing blanks retain list ownership when nearby commands are edited", () => {
      for (const entry of [
        { seed: "echo a ", remove: "a ", insert: "a b " },
        { seed: "echo a\n ", remove: "\n ", insert: " b\n " },
        { seed: "{ a; }\n", remove: "a; ", insert: "a b; " },
        { seed: "{ a;\n }\n", remove: "a;\n ", insert: "a b;\n " },
        { seed: "( a )\n", remove: "a ", insert: "a b " },
        { seed: "echo $( a )\n", remove: "a ", insert: "a b " },
        { seed: "echo ` a `\n", remove: "a ", insert: "a b " },
        { seed: "if a; then b; fi\n", remove: "b; ", insert: "b c; " },
        { seed: "echo $(a \\\n)\n", remove: "a ", insert: "a b " },
        { seed: "{ a; \0}\n", remove: "a; ", insert: "a b; " },
      ]) {
        assertEditRoundTrip(parser, { ...entry, valid: true });
      }
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
