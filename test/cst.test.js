import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { grammars } from "../scripts/tree-sitter.js";
import { nodeIdentity, parseCst, sourceNodes } from "./support/cst.js";
import {
  assertEditRoundTrip,
  createParser,
  parseNodes,
} from "./support/parser.js";

test("CST parsing ignores multiline source display fragments", () => {
  const output = [
    "0:0 - 2:0   program",
    "0:0 - 1:1     single_quote_content `a",
    "1:0 - 1:1       `b`",
  ].join("\n");
  assert.deepEqual(
    parseCst(output).map(({ content }) => content),
    ["program", "single_quote_content `a"],
  );
});

test("CST identity retains fields and Unicode separators without treating literal bullets as recovery", () => {
  const output = [
    "0:0 - 0:12   program",
    "0:0 - 0:12     word: literal `a\u2028b\u2029c•`",
    "0:0 - 0:12    •ERROR",
  ].join("\n");
  const entries = parseCst(output);
  assert.deepEqual(entries.map(nodeIdentity), [
    { field: undefined, type: "program", recovery: false },
    { field: "word", type: "literal", recovery: false },
    { field: undefined, type: "ERROR", recovery: true },
  ]);
  assert.deepEqual(
    entries.map(({ depth }) => depth),
    [3, 5, 5],
  );
});

test("CST source ranges use original UTF-8 byte offsets across physical lines", () => {
  const output = [
    "0:0 - 1:2   program",
    "0:2 - 0:6     word: literal `🙂`",
    "1:0 - 1:2     literal `é`",
  ].join("\n");
  assert.deepEqual(
    sourceNodes(output, "é🙂\né").map(({ field, type, start, end, text }) => [
      field,
      type,
      start,
      end,
      text,
    ]),
    [
      [undefined, "program", 0, 9, "é🙂\né"],
      ["word", "literal", 2, 6, "🙂"],
      [undefined, "literal", 7, 9, "é"],
    ],
  );
});

test("CST source ranges reject missing rows, overflowing columns and reversed bounds", () => {
  for (const [range, message] of [
    ["2:0 - 2:0", "point exceeds source"],
    ["0:0 - 0:3", "column exceeds source"],
    ["1:0 - 1:5", "column exceeds source"],
    ["1:4 - 1:0", "reversed source range"],
  ]) {
    assert.throws(
      () => sourceNodes(`${range}   literal`, "é\n🙂"),
      new RegExp(message),
      range,
    );
  }
});

for (const grammar of grammars) {
  describe(grammar.name, () => {
    let parser;
    before(() => {
      parser = createParser(grammar);
    });
    after(() => {
      parser?.close();
    });
    const nodes = (source) => parseNodes(parser, source);
    if (grammar.name === "bash_extglob") {
      test("Unicode edits use byte offsets", () => {
        assertEditRoundTrip(parser, {
          seed: "echo 日本語\n",
          remove: "本",
          insert: "本é",
          valid: true,
        });
      });

      test("continued names use original byte ranges and retain each backslash once", () => {
        const source = "ec\\\nho $\\\n{name}\n";
        const actual = nodes(source);
        assert.equal(
          actual.find(({ type }) => type === "literal")?.text,
          "ec\\\nho",
        );
        assert.equal(
          actual.find(({ type }) => type === "variable_name")?.text,
          "name",
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "line_continuation")
            .map(({ start, end, text }) => [start, end, text]),
          [
            [2, 3, "\\"],
            [8, 9, "\\"],
          ],
        );
      });

      test("Bash operator nodes have exactly their source spelling", () => {
        const actual = nodes(`echo @(a|b) \${x//a/b} \${x^^} $((a++,--b))\n`);
        assert.deepEqual(
          actual
            .filter(({ type }) =>
              [
                "extglob_operator",
                "parameter_replacement_operator",
                "parameter_case_operator",
                "arithmetic_operator",
              ].includes(type),
            )
            .map(({ text }) => text),
          ["@", "//", "^^", "++", ",", "--"],
        );
        assert.ok(actual.every(({ start, end }) => start < end));
      });

      test("Bash boundaries preserve continued source and Unicode byte ranges", () => {
        const source = `echo 日 @\\\n(a|b) $((2*\\\n*3)) \${x/\\\n/a/字}\n`;
        const bytes = Buffer.from(source);
        const actual = nodes(source);
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "line_continuation")
            .map(({ start }) => start),
          [...bytes.entries()]
            .filter(([index, value]) => value === 92 && bytes[index + 1] === 10)
            .map(([index]) => index),
        );
        assert.deepEqual(
          actual
            .filter(
              ({ type }) =>
                type === "arithmetic_operator" ||
                type === "parameter_replacement_operator",
            )
            .map(({ text }) => text),
          ["*\\\n*", "/\\\n/"],
        );
        assert.equal(
          actual.find(({ field }) => field === "replacement")?.text,
          "字",
        );
      });
    }

    test("NUL between source characters preserves syntax and source ownership", () => {
      for (const source of [
        "if :; then :; fi\n",
        ": a && : b || : c\n",
        `: \${v:-word} $((1+2)) \`: a\`\n`,
        "cat <<END\na\\\nb\nEND\n",
        "cat <<-'END'\n\tbody\n\tEND\n",
        ": ab\\\ncd\n",
        "[[ x == @(a|b) ]]\n",
      ]) {
        const decorated = `\0${Array.from(source).join("\0")}\0`;
        const projection = (nodes) =>
          nodes.map(({ type, field, text }) => ({
            type,
            field,
            text: text.replaceAll("\0", ""),
          }));
        assert.deepEqual(
          projection(parseNodes(parser, decorated)),
          projection(parseNodes(parser, source)),
          JSON.stringify(source),
        );
      }
    });

    test("NUL removal keeps lexical classifications and original source ranges", () => {
      for (const { source, type, spelling, start } of [
        {
          source: "\0: ab\0cd\0\n\0",
          type: "literal",
          spelling: "ab\0cd",
          start: 3,
        },
        {
          source: ": \\\0x\n",
          type: "escaped_character",
          spelling: "\\\0x",
          start: 2,
        },
        {
          source: "i\0f :; then :; fi\n",
          type: "if_keyword",
          spelling: "i\0f",
          start: 0,
        },
        {
          source: ": 'a\0b'\n",
          type: "single_quote_content",
          spelling: "a\0b",
          start: 3,
        },
        {
          source: ': "a\0b"\n',
          type: "double_quote_text",
          spelling: "a\0b",
          start: 3,
        },
        {
          source: ": $'a\0b'\n",
          type: "dollar_single_quote_text",
          spelling: "a\0b",
          start: 4,
        },
        {
          source: ": $'\\0'\n",
          type: "dollar_single_quote_escape",
          spelling: "\\0",
          start: 4,
        },
        {
          source: ": $\0name\n",
          type: "variable_name",
          spelling: "name",
          start: 4,
        },
        {
          source: ": $((1\0+2))\n",
          type: "arithmetic_number",
          spelling: "1",
          start: 5,
        },
        {
          source: ": a\\\0\0\nb\n",
          type: "line_continuation",
          spelling: "\\",
          start: 3,
        },
        {
          source: "cat <<E\0ND\na\0b\nEN\0D\n",
          type: "here_document_end_text",
          spelling: "EN\0D",
          start: 15,
        },
        {
          source: "cat <<-'E\0ND'\n\0\tab\n\tE\0ND\n",
          type: "here_document_end_text",
          spelling: "E\0ND",
          start: 20,
        },
      ]) {
        const nodes = parseNodes(parser, source);
        assert.ok(
          nodes.some(
            (node) =>
              node.type === type &&
              node.text === spelling &&
              node.start === start &&
              node.end === start + Buffer.byteLength(spelling),
          ),
          JSON.stringify({ source, type, spelling, start, nodes }),
        );
      }
      const nulRunBytes = 4096;
      for (const source of [
        "\0",
        "\0".repeat(nulRunBytes),
        ": '\0'\n",
        ": \\\0",
      ]) {
        assert.equal(
          parser.parse(source, {}).status,
          0,
          JSON.stringify(source),
        );
      }
    });
  });
}
