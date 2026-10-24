import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { grammars } from "../scripts/tree-sitter.js";
import { cstFingerprint, sourceNodes } from "./support/cst.js";
import {
  applyEdit,
  assertEditRoundTrip,
  createParser,
} from "./support/parser.js";

function assertCommandsOutsideErrors(nodes, labels, output) {
  const errors = nodes.filter((node) => node.type === "ERROR");
  for (const label of labels) {
    const command = nodes.find(
      (node) => node.type === "simple_command" && node.text === `echo ${label}`,
    );
    assert.ok(command, output);
    assert.ok(
      errors.every(
        (error) => error.end <= command.start || error.start >= command.end,
      ),
      output,
    );
  }
}

for (const grammar of grammars) {
  describe(grammar.name, () => {
    let parser;
    before(() => {
      parser = createParser(grammar);
    });
    after(() => {
      parser?.close();
    });

    for (const { name, prefix, depth, tail } of [
      { name: "while headers", prefix: "while :; do\n", depth: 4, tail: ")\n" },
      { name: "until headers", prefix: "until :; do\n", depth: 4, tail: ")\n" },
      ...["for", "select"].flatMap((keyword) => [
        {
          name: `${keyword} headers before an extra closer`,
          prefix: `${keyword} x in a; do\n`,
          depth: 5,
          tail: ")\n",
        },
        {
          name: `${keyword} headers before an unfinished parameter`,
          prefix: `${keyword} x in a; do\n`,
          depth: 3,
          tail: "echo ${x:-w\n",
        },
        {
          name: `${keyword} headers without a separator before an unfinished parameter`,
          prefix: `${keyword} x do\n`,
          depth: 3,
          tail: "echo ${x:-w\n",
        },
      ]),
      { name: "assignment headers", prefix: 'x="$(\n', depth: 4, tail: ")\n" },
      {
        name: "here-document sequence headers",
        prefix: "cat <<END\n$(\n",
        depth: 2,
        tail: "echo ${x:-w\n",
      },
      {
        name: "word prefixes",
        prefix: 'echo prefix"quoted"$(\n',
        depth: 2,
        tail: "echo ${x:-w\n",
      },
      {
        name: "double-quoted prefixes",
        prefix: 'x="prefix $(\n',
        depth: 2,
        tail: "echo ${x:-w\n",
      },
      ...[
        { name: "assignment headers", prefix: 'x="$(\n', depth: 3 },
        {
          name: "quoted command arguments",
          prefix: 'echo "prefix $(\n',
          depth: 2,
        },
        {
          name: "command substitution arguments",
          prefix: "echo $(\n",
          depth: 2,
        },
        {
          name: "array word arguments",
          prefix: 'x=( prefix"quoted"$(\n',
          depth: 2,
        },
      ].map(({ name, prefix, depth }) => ({
        name: `${name} before an unfinished parameter`,
        prefix,
        depth,
        tail: "echo ${x:-w\n",
      })),
      ...[
        { name: "if headers", prefix: "if :; then\n" },
        { name: "brace groups", prefix: "{\n" },
        { name: "subshells", prefix: "(\n" },
      ].map(({ name, prefix }) => ({
        name: `${name} before an unfinished substitution`,
        prefix,
        depth: 5,
        tail: "echo $(echo INNER\n",
      })),
    ]) {
      test(`${name} preserve the preceding command outside recovery`, () => {
        const source = `echo BEFORE\n${prefix.repeat(depth)}${tail}echo AFTER\necho FINAL\n`;
        const parsed = parser.parse(source, { arguments: ["-c"] });
        const nodes = sourceNodes(parsed.tree, source);
        assert.equal(nodes[0].type, "program", parsed.output);
        assert.equal(nodes[0].recovery, true, parsed.output);
        assertCommandsOutsideErrors(nodes, ["BEFORE"], parsed.output);
        assert.equal(
          parser.parse(source, { arguments: ["-c"] }).tree,
          parsed.tree,
        );
      });
    }

    for (const [name, body] of [
      ...["'E'", "''", "'a\nb'", "'; ) $x'", "'\\'", "$'E'"].map((quote) => [
        `${JSON.stringify(quote)} after an extra closer`,
        `: ) ${quote}\n`,
      ]),
      ["a quote after an incomplete function", "function ) 'E'\n"],
      ["a quote after an incomplete coprocess", "coproc ) 'E'\n"],
      [
        "an incomplete function in a quoted substitution",
        "echo \"$( function ) 'q' )\"\n",
      ],
      [
        "an incomplete coprocess in a quoted substitution",
        "echo \"$( coproc ) 'q' )\"\n",
      ],
      ...[
        `declare x=\${bad!word}`,
        `declare x={a,\${bad!word}}`,
        `declare x[{0,1}]=\${bad!word}`,
      ].map((declaration) => [declaration, `${declaration}\n`]),
      ...[`\${x!value}`, `\${#x:-word}`].map((parameter) => [
        `${parameter} in a substitution`,
        `echo "$(echo ${parameter})"\n`,
      ]),
      ["a quoted parameter", `echo "\${x!'E'}"\n`],
      ["a quoted indirect parameter", `echo "\${!x)'E'}"\n`],
    ]) {
      test(`${name} preserves following commands`, () => {
        const source = `echo BEFORE\n${body}echo AFTER\necho FINAL\n`;
        const parsed = parser.parse(source, { arguments: ["-c"] });
        const nodes = sourceNodes(parsed.tree, source);
        assert.equal(nodes[0].type, "program", parsed.output);
        assert.equal(nodes[0].recovery, true, parsed.output);
        assertCommandsOutsideErrors(
          nodes,
          ["BEFORE", "AFTER", "FINAL"],
          parsed.output,
        );
      });
    }

    for (const [name, owner, body] of [
      ["for body", "for_clause", "for x in a; do ) ; done"],
      ["select body", "select_clause", "select x in a; do ) ; done"],
      ["while body", "while_clause", "while :; do ) ; done"],
      ["until body", "until_clause", "until :; do ) ; done"],
      ["if body", "if_clause", "if :; then ) ; fi"],
      ["brace body", "brace_group", "{ ) ; }"],
      ["subshell body", "subshell", "( ) ; )"],
      ["continued layout", "select_clause", "select x in a; do ) \\\n ; done"],
      [
        "pipeline separator",
        "select_clause",
        "select x in a; do ) | cat; done",
      ],
      ["background separator", "select_clause", "select x in a; do ) & done"],
      [
        "a damaged arithmetic loop command",
        "arithmetic_for_clause",
        "for ((i=0;i<3;i++)); do echo INNER) done",
      ],
    ]) {
      test(`${name} leaves following commands outside the damaged compound`, () => {
        const source = `echo BEFORE\n${body}\necho AFTER\necho FINAL\n`;
        const parsed = parser.parse(source, { arguments: ["-c"] });
        const nodes = sourceNodes(parsed.tree, source);
        assert.equal(parsed.status, 1, parsed.output);
        assertCommandsOutsideErrors(
          nodes,
          [
            "BEFORE",
            "AFTER",
            "FINAL",
            ...(body.includes("echo INNER") ? ["INNER"] : []),
          ],
          parsed.output,
        );
        const after = source.indexOf("echo AFTER");
        assert.ok(
          nodes.every(
            (node) =>
              node.type.replace(/^•+/, "") !== owner || node.end <= after,
          ),
          parsed.output,
        );
      });
    }

    for (const { name, body, ends = [] } of [
      {
        name: "a quoted delimiter before a substitution close",
        body: ": \"$(cat <<'E')\"\nbody\nE\n",
      },
      {
        name: "a continued substitution close",
        body: ': "$(cat <<E\\\n)"\nbody\nE\n',
      },
      {
        name: "a NUL before a substitution close",
        body: ': "$(cat <<E\0)"\nbody\nE\n',
      },
      {
        name: "pending documents in both substitutions",
        body: ': "$(cat <<OUT $(cat <<IN))"\ninner\nIN\nouter\nOUT\n',
      },
      {
        name: "a pending outer document",
        body: ': <<OUT "$(echo $(cat <<IN))"\nouter\nOUT\n',
        ends: ["OUT\n"],
      },
      {
        name: "two pending outer documents",
        body: ': <<OUT1 <<OUT2 "$(echo $(cat <<IN))"\nfirst\nOUT1\nsecond\nOUT2\n',
        ends: ["OUT1\n", "OUT2\n"],
      },
      {
        name: "an active outer document",
        body: "cat <<OUT\n$(echo $(cat <<IN))\ninner\nIN\nOUT\n",
        ends: ["OUT\n"],
      },
      {
        name: "a nested substitution in a backquote",
        body: ": `echo $(echo $(cat <<IN))`\nbody\nIN\n",
      },
      {
        name: "a nested process substitution",
        body: ': "$(echo <(cat <<IN))"\nbody\nIN\n',
      },
      {
        name: "a nested substitution in a parameter",
        body: `: "\${v:-$(echo $(cat <<IN))}"\nbody\nIN\n`,
      },
      {
        name: "a parameter error with pending nested documents",
        body: `: "$(cat <<OUT $(cat <<IN; echo \${x!value}))"\ninner\nIN\nouter\nOUT\n`,
      },
    ]) {
      test(`${name} preserves following commands and surrounding document ends`, () => {
        const source = `echo BEFORE\n${body}echo AFTER\necho FINAL\n`;
        const parsed = parser.parse(source, { arguments: ["-c"] });
        const nodes = sourceNodes(parsed.tree, source);
        assert.equal(parsed.status, 1, parsed.output);
        assertCommandsOutsideErrors(
          nodes,
          ["BEFORE", "AFTER", "FINAL"],
          parsed.output,
        );
        assert.deepEqual(
          nodes
            .filter((node) => node.type === "here_document_end")
            .map(({ start, text }) => [start, text]),
          ends.map((end) => [source.indexOf(`\n${end}`) + 1, end]),
          parsed.output,
        );
      });
    }

    for (const depth of [1, 2, 4, 8]) {
      for (const quoted of depth === 1 ? [false] : [false, true]) {
        test(`${depth} nested ${quoted ? "quoted" : "unquoted"} substitutions retain following commands after body deletion and repair`, () => {
          const prefix = `echo BEFORE\n: "$(${(quoted ? 'echo "$(' : "echo $(").repeat(depth - 1)}cat <<E`;
          const body = "\nbody\nE\n";
          const suffix = `${(quoted ? ')"' : ")").repeat(depth - 1)})"\necho AFTER\n`;
          const source = prefix + body + suffix;
          const options = { arguments: ["-c"] };
          const original = parser.parse(source, options);
          assert.equal(original.status, 0, original.output);
          const remove = {
            byte: Buffer.byteLength(prefix),
            deleteBytes: body.length,
            insert: "",
          };
          const restore = { byte: remove.byte, deleteBytes: 0, insert: body };
          const broken = applyEdit(source, remove);
          for (const parsed of [
            parser.parse(broken, options),
            parser.parse(source, { ...options, edits: [remove] }),
          ]) {
            const nodes = sourceNodes(parsed.tree, broken);
            assert.equal(parsed.status, 1, parsed.output);
            assertCommandsOutsideErrors(
              nodes,
              ["BEFORE", "AFTER"],
              parsed.output,
            );
            assert.ok(
              nodes.every((node) => node.type !== "here_document_end"),
              parsed.output,
            );
          }
          const repaired = parser.parse(source, {
            ...options,
            edits: [remove, restore],
          });
          assert.equal(repaired.status, 0, repaired.output);
          assert.equal(
            cstFingerprint(repaired.tree),
            cstFingerprint(original.tree),
          );
        });
      }
    }

    test("a pending document does not synthesize an outer closing quote", () => {
      const source = 'echo BEFORE\n: "$(cat <<E)\nbody\nE\necho AFTER\n';
      const parsed = parser.parse(source, { arguments: ["-c"] });
      const nodes = sourceNodes(parsed.tree, source);
      assert.equal(parsed.status, 1, parsed.output);
      assertCommandsOutsideErrors(nodes, ["BEFORE"], parsed.output);
      assert.ok(
        nodes.every(
          (node) =>
            node.type !== "simple_command" || node.text !== "echo AFTER",
        ),
        parsed.output,
      );
    });

    test("an unclosed single quote does not turn following lines into commands", () => {
      const source = "echo BEFORE\n: ) 'E\necho AFTER\necho FINAL\n";
      const parsed = parser.parse(source, { arguments: ["-c"] });
      const nodes = sourceNodes(parsed.tree, source);
      assert.equal(parsed.status, 1, parsed.output);
      assertCommandsOutsideErrors(nodes, ["BEFORE"], parsed.output);
      assert.ok(
        nodes.some(
          (node) =>
            node.type === "ERROR" &&
            node.start <= source.indexOf("'") &&
            node.end === source.length,
        ),
        parsed.output,
      );
      assert.ok(
        nodes.every(
          (node) =>
            node.type !== "simple_command" ||
            !["echo AFTER", "echo FINAL"].includes(node.text),
        ),
        parsed.output,
      );
    });

    for (const [name, body, end] of [
      ...[
        `\${x!"word"}`,
        `\${x!'word'}`,
        `\${x!$'word'}`,
        `\${x!$(echo "value)}`,
        `\${x!'word'`,
        `\${x!'word`,
        `\${!x)'word'}`,
        `\${!x)'word'`,
        `\${x:-'word'`,
        `\${x#'word'`,
        `\${x/'word'/z`,
        `\${x:1+'word'`,
        `\${x:1:2+'word'`,
        `\${x!'word'$(echo OK)}`,
      ].map((parameter) => [
        JSON.stringify(parameter),
        `cat <<END\n${parameter}\nEND\n`,
        "END\n",
      ]),
      [
        "indirection followed by a quote and line continuation",
        `x=1 x1=2 xy=3\ncat <<E\n\${!x1)'a'\\\n+[*]}\nE\n`,
        "E\n",
      ],
      [
        "backquote with escaped newlines and an incomplete quote",
        `cat <<E\n\`: ${"\\".repeat(3)}\n\\'; 'g h' ${"\\".repeat(2)}\n$(echo i) # c\`\nE\n`,
        "E\n",
      ],
    ]) {
      test(`${name} preserves the here-document end and following commands`, () => {
        const source = `echo BEFORE\n${body}echo AFTER\necho FINAL\n`;
        const parsed = parser.parse(source, { arguments: ["-c"] });
        const nodes = sourceNodes(parsed.tree, source);
        assert.equal(parsed.status, 1, parsed.output);
        assertCommandsOutsideErrors(
          nodes,
          ["BEFORE", "AFTER", "FINAL"],
          parsed.output,
        );
        assert.deepEqual(
          nodes
            .filter((node) => node.type === "here_document_end")
            .map(({ start, text }) => [start, text]),
          [[source.indexOf(`\n${end}`) + 1, end]],
          parsed.output,
        );
      });
    }

    for (const [name, seed, remove, insert] of [
      ["extra closer before a quote", ": 'E'\n", ": ", ": ) "],
      ["missing quote closer", ": 'E'\n", "E'", "E"],
      ["quoted parameter operator", `echo "\${x:-'E'}"\n`, ":-", "!"],
      ...[
        ["operator", `\${x:-'E'}`, ":-", "!"],
        ["indirection", `\${!x}`, "x", "x)'E'"],
        ["closer", `\${x:-'E'}`, "}", ""],
        ["substring offset", `\${x:1+'q'}`, "}", ""],
        ["substring length", `\${x:1:2+'q'}`, "}", ""],
      ].map(([name, parameter, remove, insert]) => [
        `here-document parameter ${name}`,
        `cat <<END\n${parameter}\nEND\n`,
        remove,
        insert,
      ]),
    ]) {
      test(`${name} returns to the fresh CST after repair`, () => {
        assertEditRoundTrip(parser, {
          seed: `echo BEFORE\n${seed}echo AFTER\n`,
          remove,
          insert,
          valid: false,
        });
      });
    }

    const depth = 3;
    const delimiters = Array.from(
      { length: depth },
      (_, index) => `END${index}`,
    );
    for (const [name, prefix, suffix] of [
      ["while", "while :; do\n", "done\n"],
      ["until", "until :; do\n", "done\n"],
      ["assignment", 'x="$(\n', ')"\n'],
      ["array assignment", 'x[1]+="$(\n', ')"\n'],
      ["word", 'echo prefix"quoted"$(\n', ")\n"],
      ["double quote", `echo "prefix\${x:-a}$(\n`, ')"\n'],
      ["locale quote", `echo $"prefix\${x:-a}$(\n`, ')"\n'],
      ["array word", 'x=( prefix"quoted"$(\n', ") )\n"],
    ]
      .map(([name, prefix, suffix]) => [
        name,
        prefix.repeat(depth),
        suffix.repeat(depth),
      ])
      .concat([
        [
          "here document",
          delimiters.map((end) => `cat <<${end}\n$(\n`).join(""),
          delimiters
            .toReversed()
            .map((end) => `)\n${end}\n`)
            .join(""),
        ],
      ])) {
      test(`${name} nesting returns to the fresh CST after a parameter repair`, () => {
        assertEditRoundTrip(parser, {
          seed: `echo BEFORE\n${prefix}echo \${x:-value}\n${suffix}echo AFTER\n`,
          remove: "value}",
          insert: "value",
          valid: false,
        });
      });
    }
  });
}
