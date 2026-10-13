import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { grammars } from "../scripts/tree-sitter.js";
import { sourceNodes } from "./support/cst.js";
import { assertEditRoundTrip, createParser } from "./support/parser.js";

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
      ...[
        `declare x=\${bad!word}`,
        `declare x={a,\${bad!word}}`,
        `declare x[{0,1}]=\${bad!word}`,
      ].map((declaration) => [declaration, `${declaration}\n`]),
      ...[`\${x!value}`, `\${#x:-word}`].map((parameter) => [
        `${parameter} in a substitution`,
        `echo "$(echo ${parameter})"\n`,
      ]),
      ...[
        `\${x!"word"}`,
        `\${x!'word'}`,
        `\${x!$'word'}`,
        `\${x!$(echo "value)}`,
      ].map((parameter) => [
        `${parameter} in a here document`,
        `cat <<END\n${parameter}\nEND\n`,
      ]),
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
