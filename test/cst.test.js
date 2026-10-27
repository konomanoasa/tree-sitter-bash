import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { grammars, root } from "../scripts/tree-sitter.js";
import {
  cstFingerprint,
  namedStructure,
  nodeIdentity,
  parseCst,
  sourceNodes,
} from "./support/cst.js";
import { createParser, parseNodes } from "./support/parser.js";

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

test("CST comparisons preserve structure and fields independently of continuation ownership", () => {
  const original = [
    "0:0 - 1:1   program",
    "0:0 - 1:1     name: word",
    "0:0 - 0:1       literal `a`",
    "0:1 - 0:2       line_continuation `\\\\`",
    "1:0 - 1:1       argument: literal `b`",
    '1:1 - 1:1      •MISSING ";"',
  ].join("\n");
  const relocated = original.replace(
    "       line_continuation",
    "     line_continuation",
  );
  assert.equal(cstFingerprint(original), cstFingerprint(relocated));
  for (const changed of [
    original.replace("argument:", "name:"),
    original.replace("       argument:", "     argument:"),
    original.replace("1:0 - 1:1", "1:0 - 1:0"),
    original.replace('MISSING ";"', 'MISSING ")"'),
    original.replace("0:1 - 0:2", "0:1 - 0:1"),
  ]) {
    assert.notEqual(cstFingerprint(original), cstFingerprint(changed));
  }
  const normal = original.split("\n").slice(0, -1).join("\n");
  assert.equal(
    namedStructure(normal, true),
    "(program name: (word (literal) argument: (literal)))",
  );
  assert.equal(
    namedStructure(normal, false),
    "(program (word (literal) (literal)))",
  );
});

function corpusCases() {
  const directory = join(root, "test", "corpus");
  const header = "==================\n";
  const separator = "\n------------------\n";
  return readdirSync(directory)
    .sort()
    .flatMap((file) => {
      const parts = readFileSync(join(directory, file), "utf8").split(header);
      assert.equal(parts.shift(), "", file);
      assert.equal(parts.length % 2, 0, file);
      const cases = [];
      for (let index = 0; index < parts.length; index += 2) {
        const [name, ...attributes] = parts[index].trimEnd().split("\n");
        const languages = [];
        for (const attribute of attributes) {
          const language = attribute.match(/^:language\(([a-z_]+)\)$/)?.[1];
          if (language) languages.push(language);
          else assert.ok(attribute === ":cst" || attribute === ":error", name);
        }
        const end = parts[index + 1].indexOf(separator);
        assert.notEqual(end, -1, name);
        cases.push({
          name: `${file}: ${name}`,
          source: parts[index + 1].slice(0, end),
          languages,
          status: attributes.includes(":error") ? 1 : 0,
        });
      }
      return cases;
    });
}

const examples = corpusCases();

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
    test("syntax lists expose one owner field and required repeated elements", () => {
      const definitions = JSON.parse(
        readFileSync(join(root, grammar.path, "src/node-types.json"), "utf8"),
      );
      for (const { type, field, element, owners } of [
        {
          type: "word_list",
          field: "word",
          element: "word",
          owners: [
            ["for_clause", "words"],
            ["select_clause", "words"],
          ],
        },
        {
          type: "case_list",
          field: "item",
          element: "case_item",
          owners: [["case_clause", "items"]],
        },
        {
          type: "redirect_list",
          field: "redirect",
          element: "io_redirect",
          owners: [
            ["command", "redirects"],
            ["function_body", "redirects"],
            ["coproc", "redirects"],
          ],
        },
      ]) {
        const definition = definitions.find(
          (node) => node.type === type && node.named,
        );
        assert.deepEqual(definition?.fields, {
          [field]: {
            multiple: true,
            required: true,
            types: [{ type: element, named: true }],
          },
        });
        assert.equal(definition?.children, undefined);
        for (const [owner, ownerField] of owners) {
          const parent = definitions.find(
            (node) => node.type === owner && node.named,
          );
          assert.deepEqual(parent?.fields[ownerField], {
            multiple: false,
            required: false,
            types: [{ type, named: true }],
          });
          assert.equal(parent?.fields[field], undefined);
          assert.equal(parent?.fields.terminated, undefined);
        }
      }
    });
    test("arithmetic for metadata requires its header children", () => {
      const definitions = JSON.parse(
        readFileSync(join(root, grammar.path, "src/node-types.json"), "utf8"),
      );
      assert.equal(
        definitions.find(
          ({ type, named }) => type === "arithmetic_for_clause" && named,
        )?.children?.required,
        true,
      );
    });
    for (const { name, source, languages, status } of examples) {
      if (languages.length && !languages.includes(grammar.name)) continue;
      test(`${name}: source ranges and fresh determinism`, () => {
        const options = { arguments: ["-c"] };
        const first = parser.parse(source, options);
        const actual = sourceNodes(first.tree, source);
        assert.notEqual(actual.length, 0);
        assert.equal(actual[0].recovery, status !== 0, first.output);
        assert.equal(actual[0].end, Buffer.byteLength(source));
        const repeated = parser.parse(source, options);
        assert.equal(repeated.status, first.status);
        assert.equal(repeated.tree, first.tree);
      });
    }
    for (const { name, source, languages, expected, continuations } of [
      {
        name: "command-name brackets retain quoted expanded and continued source",
        source: 'a["x y"$p$(printf x)日本\\\n ]suffix tail\n',
        languages: ["bash_default", "bash_extglob"],
        expected:
          "(program (complete_commands (complete_command (list (and_or (pipeline (pipe_sequence (command (simple_command (word (literal) (pattern_bracket_source (pattern_bracket_members_source (double_quoted (double_quote_text)) (parameter_expansion (variable_name)) (command_substitution (command_substitution_body (complete_commands (complete_command (list (and_or (pipeline (pipe_sequence (command (simple_command (word (literal)) (word (literal)))))))))))) (pattern_bracket_character_source) (pattern_bracket_character_source) (pattern_bracket_character_source))) (literal)) (word (literal))))))))) (newline_list)))",
        continuations: ["0:26-0:27"],
      },
      {
        name: "logical continuation commands",
        source: "fu\\\nnction f() { ((x+\\\n+)); }; ti\\\nme -p f |\\\n& cat\n",
        languages: ["bash_default", "bash_extglob"],
        expected:
          "(program (complete_commands (complete_command (list (and_or (pipeline (pipe_sequence (command (function_definition (function_keyword) (function_name) (function_body (compound_command (brace_group (compound_list (term (and_or (pipeline (pipe_sequence (command (compound_command (arithmetic_command (arithmetic_update_expression (arithmetic_variable) (arithmetic_operator)))))))) (separator (separator_op)))))))))))) (separator_op) (and_or (pipeline (timing (time_keyword) (time_option)) (pipe_sequence (command (simple_command (word (literal)))) (pipe_and) (command (simple_command (word (literal))))))))) (newline_list)))",
        continuations: ["0:2-0:3", "1:17-1:18", "2:10-2:11", "3:9-3:10"],
      },
      {
        name: "arithmetic for crossing delimiters survive nested substitution and continuation",
        source:
          "\necho $(for ((a[日\\\n本;x;y])); do :; done)\nfor (((x;$(for ((a[x;y;z])); do :; done);z))); do :; done\n",
        languages: ["bash_default", "bash_extglob"],
        expected:
          "(program (linebreak (newline_list)) (complete_commands (complete_command (list (and_or (pipeline (pipe_sequence (command (simple_command (word (literal)) (word (command_substitution (command_substitution_body (complete_commands (complete_command (list (and_or (pipeline (pipe_sequence (command (compound_command (arithmetic_for_clause (for_keyword) (arithmetic_for_open) (arithmetic_source_expression (arithmetic_variable) (arithmetic_source_fragment) (arithmetic_source_fragment) (arithmetic_source_fragment)) (arithmetic_variable) (arithmetic_source_expression (arithmetic_variable) (arithmetic_source_fragment)) (do_group (do_keyword) (compound_list (term (and_or (pipeline (pipe_sequence (command (simple_command (word (literal))))))) (separator (separator_op)))) (done_keyword))))))))))))))))))))) (newline_list) (complete_command (list (and_or (pipeline (pipe_sequence (command (compound_command (arithmetic_for_clause (for_keyword) (arithmetic_for_open) (arithmetic_source_expression (arithmetic_source_fragment) (arithmetic_variable)) (command_substitution (command_substitution_body (complete_commands (complete_command (list (and_or (pipeline (pipe_sequence (command (compound_command (arithmetic_for_clause (for_keyword) (arithmetic_for_open) (arithmetic_source_expression (arithmetic_variable) (arithmetic_source_fragment) (arithmetic_variable)) (arithmetic_variable) (arithmetic_source_expression (arithmetic_variable) (arithmetic_source_fragment)) (do_group (do_keyword) (compound_list (term (and_or (pipeline (pipe_sequence (command (simple_command (word (literal))))))) (separator (separator_op)))) (done_keyword))))))))))))) (arithmetic_source_expression (arithmetic_variable) (arithmetic_source_fragment)) (do_group (do_keyword) (compound_list (term (and_or (pipeline (pipe_sequence (command (simple_command (word (literal))))))) (separator (separator_op)))) (done_keyword)))))))))) (newline_list)))",
        continuations: ["1:18-1:19"],
      },
      {
        name: "line continuations join words and operators",
        source: "ec\\\nho a\\\nb |\\\n| echo c\n",
        languages: ["bash_default", "bash_extglob"],
        expected:
          "(program commands: (complete_commands command: (complete_command body: (list and_or: (and_or pipeline: (pipeline (pipe_sequence command: (command body: (simple_command name: (word (literal)) argument: (word (literal)))))) operator: (or_if) pipeline: (pipeline (pipe_sequence command: (command body: (simple_command name: (word (literal)) argument: (word (literal))))))))) separator: (newline_list)))",
        continuations: ["0:2-0:3", "1:4-1:5", "2:3-2:4"],
      },
      {
        name: "arithmetic operator continuations",
        source: "echo $((2*\\\n*3)) $((a+\\\n+))\n",
        languages: ["bash_default", "bash_extglob"],
        expected:
          "(program (complete_commands (complete_command (list (and_or (pipeline (pipe_sequence (command (simple_command (word (literal)) (word (arithmetic_expansion (arithmetic_binary_expression (arithmetic_number) (arithmetic_operator) (arithmetic_number)))) (word (arithmetic_expansion (arithmetic_update_expression (arithmetic_variable) (arithmetic_operator))))))))))) (newline_list)))",
        continuations: ["0:10-0:11", "1:10-1:11"],
      },
      {
        name: "boundary continuations",
        source: `echo @\\\n(a|b) <\\\n(echo hi) $\\\n"x" {1.\\\n.3} \${x/\\\n/a/b}\n`,
        languages: ["bash_extglob"],
        expected:
          "(program (complete_commands (complete_command (list (and_or (pipeline (pipe_sequence (command (simple_command (word (literal)) (word (extglob_pattern (extglob_operator) (extglob_alternative (literal)) (extglob_alternative (literal)))) (word (process_substitution (command_substitution_body (complete_commands (complete_command (list (and_or (pipeline (pipe_sequence (command (simple_command (word (literal)) (word (literal))))))))))))) (word (locale_quoted (double_quote_text))) (word (brace_expansion (brace_sequence (brace_endpoint) (brace_sequence_separator) (brace_endpoint)))) (word (parameter_expansion (variable_name) (parameter_replacement (parameter_replacement_operator) (parameter_pattern (literal)) (parameter_replacement_separator) (parameter_word (literal)))))))))))) (newline_list)))",
        continuations: [
          "0:6-0:7",
          "1:7-1:8",
          "2:11-2:12",
          "3:7-3:8",
          "4:8-4:9",
        ],
      },
      {
        name: "subscript quotations expansions and nested brackets keep source",
        source: `a[(日\\\n本[)]"("\${p}$(printf ")"))]=x\n`,
        languages: ["bash_default", "bash_extglob"],
        expected:
          "(program (complete_commands (complete_command (list (and_or (pipeline (pipe_sequence (command (simple_command (assignment_word (variable_name) (array_subscript (subscript_source (arithmetic_candidate_source_expression (parenthesized_arithmetic_candidate_source (subscript_text) (subscript_text) (array_subscript (subscript_source (arithmetic_candidate_source_expression (subscript_text)))) (double_quoted (double_quote_text)) (parameter_expansion (variable_name)) (command_substitution (command_substitution_body (complete_commands (complete_command (list (and_or (pipeline (pipe_sequence (command (simple_command (word (literal)) (word (double_quoted (double_quote_text))))))))))))))))) (assignment_value (literal)))))))))) (newline_list)))",
        continuations: ["0:6-0:7"],
      },
      {
        name: "array word boundaries retain nested substitutions and continuations",
        source: '\na=(["x y"$p$(b=([x y]); printf z)日本\\\n ]suffix)\n',
        languages: ["bash_default", "bash_extglob"],
        expected:
          "(program (linebreak (newline_list)) (complete_commands (complete_command (list (and_or (pipeline (pipe_sequence (command (simple_command (assignment_word (variable_name) (array_assignment (word (pattern_bracket_source (pattern_bracket_members_source (double_quoted (double_quote_text)) (parameter_expansion (variable_name)) (command_substitution (command_substitution_body (complete_commands (complete_command (list (and_or (pipeline (pipe_sequence (command (simple_command (assignment_word (variable_name) (array_assignment (word (pattern_bracket_source (pattern_bracket_members_source (pattern_bracket_character_source) (pattern_bracket_character_source) (pattern_bracket_character_source))))))))))) (separator_op) (and_or (pipeline (pipe_sequence (command (simple_command (word (literal)) (word (literal)))))))))))) (pattern_bracket_character_source) (pattern_bracket_character_source) (pattern_bracket_character_source))) (literal))))))))))) (newline_list)))",
        continuations: ["1:39-1:40"],
      },
      {
        name: "escaped newline before delimiter terminates Bash here document",
        source: "cat <<EOF\nbody\n\\\nEOF\necho after\n",
        languages: ["bash_default", "bash_extglob"],
        expected:
          "(program commands: (complete_commands command: (complete_command body: (list and_or: (and_or pipeline: (pipeline (pipe_sequence command: (command body: (simple_command name: (word (literal)) redirect: (io_redirect body: (io_here operator: (dless) end: (here_end word: (word (literal)))))))))))) separator: (newline_list (here_document_sequence line_end: (here_document_line_end) document: (here_document body: (here_document_body (here_document_text)) end: (here_document_end (here_document_end_text))))) command: (complete_command body: (list and_or: (and_or pipeline: (pipeline (pipe_sequence command: (command body: (simple_command name: (word (literal)) argument: (word (literal))))))))) separator: (newline_list)))",
        continuations: ["2:0-2:1"],
      },
      {
        name: "escaped newline inside delimiter terminates Bash here document",
        source: "cat <<EOF\nbody\nE\\\nOF\necho after\n",
        languages: ["bash_default", "bash_extglob"],
        expected:
          "(program commands: (complete_commands command: (complete_command body: (list and_or: (and_or pipeline: (pipeline (pipe_sequence command: (command body: (simple_command name: (word (literal)) redirect: (io_redirect body: (io_here operator: (dless) end: (here_end word: (word (literal)))))))))))) separator: (newline_list (here_document_sequence line_end: (here_document_line_end) document: (here_document body: (here_document_body (here_document_text)) end: (here_document_end (here_document_end_text))))) command: (complete_command body: (list and_or: (and_or pipeline: (pipeline (pipe_sequence command: (command body: (simple_command name: (word (literal)) argument: (word (literal))))))))) separator: (newline_list)))",
        continuations: ["2:1-2:2"],
      },
      {
        name: "continued variable descriptor owns its name before a here document",
        source: "cat {f\\\nd}<<EOF\nbody\nEOF\n",
        languages: ["bash_default", "bash_extglob"],
        expected:
          "(program commands: (complete_commands command: (complete_command body: (list and_or: (and_or pipeline: (pipeline (pipe_sequence command: (command body: (simple_command name: (word (literal)) redirect: (io_redirect number: (io_variable name: (variable_name)) body: (io_here operator: (dless) end: (here_end word: (word (literal)))))))))))) separator: (newline_list (here_document_sequence line_end: (here_document_line_end) document: (here_document body: (here_document_body (here_document_text)) end: (here_document_end (here_document_end_text)))))))",
        continuations: ["0:6-0:7"],
      },
      {
        name: "ERE continuations retain original source within class and count",
        source: "[[ x =~ [[:di\\\ngit:]]{1\\\n2,3}?\\\n$ ]]\n",
        languages: ["bash_default", "bash_extglob"],
        expected:
          "(program (complete_commands (complete_command (list (and_or (pipeline (pipe_sequence (command (compound_command (conditional_command (conditional_open) (conditional_binary_expression (word (literal)) (conditional_regex_operator) (regex_operand (extended_reg_exp (ere_branch (ere_expression (one_char_or_coll_elem_ere (bracket_expression (matching_list (bracket_list (follow_list (expression_term (single_expression (character_class (class_name))))))))) (ere_dupl_symbol (duplication_count) (duplication_count) (repetition_modifier))) (ere_expression))))) (conditional_close))))))))) (newline_list)))",
        continuations: ["0:13-0:14", "1:8-1:9", "2:5-2:6"],
      },
    ]) {
      if (!languages.includes(grammar.name)) continue;
      test(name, () => {
        const result = parser.parse(source, { arguments: ["-c"] });
        assert.equal(result.status, 0, result.output);
        const actual = sourceNodes(result.tree, source);
        assert.equal(actual[0].end, Buffer.byteLength(source));
        assert.equal(
          namedStructure(result.tree, expected.includes(": ")),
          expected,
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "line_continuation")
            .map(({ range }) => range),
          continuations,
        );
      });
    }
    if (grammar.name === "bash_extglob") {
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
          source: ": $\0[1\0+2]\n",
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
          source: "#\0x\n",
          type: "comment_text",
          spelling: "#\0x",
          start: 0,
        },
        {
          source: ": a #\0b\n: `#\0c\n`\n",
          type: "comment_text",
          spelling: "#\0b",
          start: 4,
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
