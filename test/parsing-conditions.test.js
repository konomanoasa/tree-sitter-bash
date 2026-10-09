import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { grammars } from "../scripts/tree-sitter.js";
import { applyEdit, createParser, parseNodes } from "./support/parser.js";

const cases = [
  {
    name: "ordinary argument",
    source: ": @(a|b)",
    extglob: true,
    pattern: "@(a|b)",
  },
  {
    name: "assignment value",
    source: "x=@(a|b)",
    extglob: true,
    pattern: "@(a|b)",
  },
  {
    name: "case pattern",
    source: "case a in @(a|b)) :;; esac",
    extglob: true,
    pattern: "@(a|b)",
  },
  {
    name: "case selector",
    source: "case @(a|b) in a) :;; esac",
    extglob: true,
    pattern: "@(a|b)",
  },
  {
    name: "conditional left operand",
    source: "[[ @(a|b) == a ]]",
    extglob: true,
    pattern: "@(a|b)",
  },
  {
    name: "conditional unary operand",
    source: "[[ -n @(a|b) ]]",
    extglob: true,
    pattern: "@(a|b)",
  },
  {
    name: "conditional match operand",
    source: "[[ a == @(a|b) ]]",
    pattern: "@(a|b)",
  },
  {
    name: "conditional not-match operand",
    source: "[[ a != @(a|b) ]]",
    pattern: "@(a|b)",
  },
  {
    name: "conditional equals operand",
    source: "[[ a = @(a|b) ]]",
    pattern: "@(a|b)",
  },
  {
    name: "quoted pattern stays quoted",
    source: '[[ a == "@(a|b)" ]]',
    pattern: null,
  },
  {
    name: "parameter value candidate",
    source: `: \${x:-@(a|b)}`,
    pattern: "@(a|b)",
  },
  {
    name: "parameter removal candidate",
    source: `: \${x#@(a|b)}`,
    pattern: "@(a|b)",
  },
  {
    name: "parameter replacement candidate",
    source: `: \${x/@(a|b)/v}`,
    pattern: "@(a|b)",
  },
  {
    name: "parameter replacement value candidate",
    source: `: \${x/a/@(a|b)}`,
    pattern: "@(a|b)",
  },
  {
    name: "subscript stays unresolved",
    source: `: \${a[@(a|b)]}`,
    pattern: null,
  },
  {
    name: "adjacent function parentheses",
    source: "@() { :; }",
    extglob: false,
    pattern: null,
  },
  {
    name: "separated function parentheses",
    source: "@ () { :; }",
    pattern: null,
  },
  {
    name: "command substitution",
    source: ": $(: @(a|b))",
    extglob: true,
    pattern: "@(a|b)",
  },
  {
    name: "quoted command substitution",
    source: ': "$(: @(a|b))"',
    extglob: true,
    pattern: "@(a|b)",
  },
  {
    name: "current shell substitution",
    source: `: \${ : @(a|b); }`,
    extglob: true,
    pattern: "@(a|b)",
  },
  {
    name: "process substitution",
    source: ": <(: @(a|b))",
    extglob: true,
    pattern: "@(a|b)",
  },
  {
    name: "conditional RHS command substitution",
    source: "[[ a == $(: @(a|b)) ]]",
    pattern: "@(a|b)",
  },
  {
    name: "conditional RHS quoted substitution",
    source: '[[ a == "$(: @(a|b))" ]]',
    pattern: "@(a|b)",
  },
  {
    name: "conditional RHS current shell substitution",
    source: `[[ a == \${ : @(a|b); } ]]`,
    pattern: "@(a|b)",
  },
  {
    name: "conditional RHS process substitution",
    source: "[[ a == <(: @(a|b)) ]]",
    pattern: "@(a|b)",
  },
  {
    name: "regex does not enable nested extglob",
    source: "[[ a =~ $(: @(a|b)) ]]",
    extglob: true,
    pattern: "@(a|b)",
  },
  {
    name: "conditional pattern condition ends with its word",
    source: "[[ a == @(a|b) ]]; : @(a|b)",
    extglob: true,
    pattern: "@(a|b)",
  },
  {
    name: "conditional left word does not consume the enclosing pattern condition",
    source: "[[ a == $([[ x == x ]]; : @(a|b)) ]]",
    pattern: "@(a|b)",
  },
  {
    name: "here delimiter",
    source: ": <<@(a|b)\nbody\n@(a|b)\n",
    extglob: true,
    pattern: "@(a|b)",
  },
  {
    name: "here delimiter in conditional RHS",
    source: "[[ a == $(: <<@(a|b)\nbody\n@(a|b)\n) ]]",
    pattern: "@(a|b)",
  },
  {
    name: "brace and extglob source",
    source: ": {a,@(b|c)}",
    extglob: true,
    pattern: "@(b|c)",
    brace: true,
  },
  {
    name: "brace lookahead preserves a conditional RHS delimiter",
    source: ": {x,$([[ a == $( : <<@(a|b)\n@(a|b)\n) ]])}",
    pattern: "@(a|b)",
    brace: true,
  },
  {
    name: "arithmetic lookahead preserves a conditional RHS delimiter",
    source: ": {x,$([[ a == $(( $( : <<@(a|b)\n@(a|b)\n) )) ]])}",
    pattern: "@(a|b)",
    brace: true,
  },
  {
    name: "brace lookahead preserves disabled extglob function syntax",
    source: ": {x,$(@() { :; }; @)}",
    extglob: false,
    pattern: null,
    brace: true,
  },
];

const delimiterCases = [
  {
    name: "delimiter-quoted-value",
    word: `"\${x:-$'ab'}"`,
    disabled: `\${x:-$'ab'}`,
    enabled: `\${x:-ab}`,
  },
  {
    name: "delimiter-unquoted-value",
    word: `\${x:-$'ab'}`,
    disabled: `\${x:-'ab'}`,
    enabled: `\${x:-'ab'}`,
  },
  {
    name: "delimiter-quoted-pattern",
    word: `"\${x#$'ab'}"`,
    disabled: `\${x#'ab'}`,
    enabled: `\${x#'ab'}`,
  },
  {
    name: "delimiter-quoted-subscript",
    word: `"\${a[$'ab']}"`,
    disabled: `\${a[$'ab']}`,
    enabled: `\${a[ab]}`,
  },
  {
    name: "delimiter-quoted-substring",
    word: `"\${x:$'0'}"`,
    disabled: `\${x:$'0'}`,
    enabled: `\${x:0}`,
  },
  {
    name: "delimiter-nested-pattern",
    word: `"\${x:-\${y#$'ab'}}"`,
    disabled: `\${x:-\${y#'ab'}}`,
    enabled: `\${x:-\${y#'ab'}}`,
  },
  {
    name: "delimiter-nested-value",
    word: `"\${x#\${y:-$'ab'}}"`,
    disabled: `\${x#\${y:-$'ab'}}`,
    enabled: `\${x#\${y:-ab}}`,
  },
  {
    name: "delimiter-replacement",
    word: `"\${x/a/$'ab'}"`,
    disabled: `\${x/a/'ab'}`,
    enabled: `\${x/a/'ab'}`,
  },
  {
    name: "delimiter-locale-value",
    word: `"\${x:-$"ab"}"`,
    disabled: `\${x:-$ab}`,
    enabled: `\${x:-ab}`,
  },
  {
    name: "delimiter-locale-subscript",
    word: `"\${a[$"ab"]}"`,
    disabled: `\${a[$ab]}`,
    enabled: `\${a[ab]}`,
  },
  {
    name: "delimiter-ansi-inner-quote",
    word: `"\${x:-$'a\\"b'}"`,
    disabled: `\${x:-$'a"b'}`,
    enabled: `\${x:-ab}`,
  },
  {
    name: "delimiter-ansi-inner-escape",
    word: `"\${x:-$'a\\tb'}"`,
    disabled: `\${x:-$'a\\tb'}`,
    enabled: `\${x:-a\tb}`,
  },
  {
    name: "delimiter-ansi-backslash",
    word: `"\${x:-$'a\\\\b'}"`,
    disabled: `\${x:-$'a\\b'}`,
    enabled: `\${x:-a\\b}`,
  },
  {
    name: "delimiter-ansi-brace",
    word: `"\${x:-$'a}b'}"`,
    disabled: `\${x:-$'a}b'}`,
    enabled: `\${x:-a}b}`,
  },
  {
    name: "delimiter-ordinary-ansi",
    word: "$'ab'",
    disabled: "ab",
    enabled: "ab",
  },
  {
    name: "delimiter-ordinary-locale",
    word: '$"ab"',
    disabled: "ab",
    enabled: "ab",
  },
  {
    name: "delimiter-nested-command",
    word: `"$(printf \${x:-$'ab'})"`,
    disabled: `$(printf \${x:-$'ab'})`,
    enabled: `$(printf \${x:-ab})`,
  },
  {
    name: "delimiter-combined-conditions",
    word: `@("\${x:-$'ab'}"|c)`,
    disabled: `@("\${x:-$'ab'}"|c)`,
    enabled: `@("\${x:-ab}"|c)`,
    extglob: true,
  },
];

for (const grammar of grammars) {
  describe(grammar.name, () => {
    let parser;
    const extglob = grammar.name.includes("extglob");
    before(() => {
      parser = createParser(grammar);
    });
    after(() => {
      parser.close();
    });

    test("subscript candidates retain arithmetic precedence without resolving array types", () => {
      const source = `a[x+2*3]=v; : "\${a[(i+1)]}"`;
      const nodes = parseNodes(parser, source);
      assert.deepEqual(
        nodes
          .filter(({ type }) => type.includes("arithmetic_candidate"))
          .map(({ type, field, text }) => [type, field, text]),
        [
          ["arithmetic_candidate_binary_expression", "candidate", "x+2*3"],
          ["arithmetic_candidate_variable", "left", "x"],
          ["arithmetic_candidate_operator", "operator", "+"],
          ["arithmetic_candidate_binary_expression", "right", "2*3"],
          ["arithmetic_candidate_number", "left", "2"],
          ["arithmetic_candidate_operator", "operator", "*"],
          ["arithmetic_candidate_number", "right", "3"],
          ["parenthesized_arithmetic_candidate", "candidate", "(i+1)"],
          ["arithmetic_candidate_binary_expression", "expression", "i+1"],
          ["arithmetic_candidate_variable", "left", "i"],
          ["arithmetic_candidate_operator", "operator", "+"],
          ["arithmetic_candidate_number", "right", "1"],
        ],
      );
    });

    test("whole-subscript all-element candidates stay under the neutral source in every context", () => {
      for (const { source, expected } of [
        {
          source: `: "\${a[@]}" "\${a[*]}" "\${#a[@]}" "\${!a[*]}"`,
          expected: ["@", "*", "@", "*"],
        },
        {
          source: "a[@]=v; a=([*]=v); declare -a a[@]=v; declare -A a[*]=v",
          expected: ["@", "*", "@", "*"],
        },
        {
          source: `{a[@]}>out; : "\${a[b[*]]}"; : $((a[@])); for ((a[*];;)); do :; done`,
          expected: ["@", "*", "@", "*"],
        },
        {
          source: `: "\${a[\\\n@\\\n]}" "\${a[\\\n*\\\n]}"`,
          expected: ["@", "*"],
        },
      ]) {
        const nodes = parseNodes(parser, source);
        const candidates = nodes.filter(
          ({ type }) => type === "subscript_all_elements_candidate",
        );
        assert.deepEqual(
          candidates.map(({ text }) => text),
          expected,
          source,
        );
        for (const candidate of candidates) {
          assert.equal(candidate.field, "candidate");
          assert.equal(candidate.end - candidate.start, 1);
          assert.ok(
            nodes.some(
              ({ type, start, end }) =>
                type === "subscript_source" &&
                start <= candidate.start &&
                candidate.end <= end,
            ),
          );
        }
      }
    });

    test("all-element candidates do not trim, unquote, expand, or split other subscript sources", () => {
      for (const subscript of [
        " @",
        "@ ",
        "\t*\n",
        '"@"',
        "'*'",
        "$'@'",
        "\\@",
        "\\*",
        "@x",
        "x@",
        "@+1",
        "*x",
        "**",
        "(*)",
        "2*3",
        "$x",
        `\${x}`,
        "$(printf @)",
      ]) {
        const source = `: "\${a[${subscript}]}"`;
        assert.deepEqual(
          parseNodes(parser, source).filter(
            ({ type }) => type === "subscript_all_elements_candidate",
          ),
          [],
          source,
        );
      }
    });

    test("all-element candidate boundary edits and EOF repairs match fresh parsing", () => {
      const source = `: "\${a[@]}"`;
      const options = { arguments: ["-c"] };
      const original = parser.parse(source, options);
      assert.equal(original.status, 0, original.output);
      for (const edit of [
        { byte: 7, deleteBytes: 1, insert: "*" },
        { byte: 7, deleteBytes: 1, insert: "i" },
        { byte: 7, deleteBytes: 1, insert: "" },
        { byte: 7, deleteBytes: 0, insert: " " },
        { byte: 8, deleteBytes: 0, insert: " " },
        { byte: 8, deleteBytes: 0, insert: "+1" },
        { byte: 8, deleteBytes: 0, insert: "x" },
        { byte: 7, deleteBytes: 0, insert: "\\\n" },
        { byte: 8, deleteBytes: 0, insert: "\\\n" },
        { byte: 8, deleteBytes: 3, insert: "" },
      ]) {
        const edited = applyEdit(source, edit);
        const fresh = parser.parse(edited, options);
        const incremental = parser.parse(source, { ...options, edits: [edit] });
        assert.equal(incremental.status, fresh.status, edited);
        if (fresh.status === 0) assert.equal(incremental.tree, fresh.tree);
        const undo = {
          byte: edit.byte,
          deleteBytes: Buffer.byteLength(edit.insert),
          insert: Buffer.from(source)
            .subarray(edit.byte, edit.byte + edit.deleteBytes)
            .toString(),
        };
        assert.equal(
          parser.parse(source, { ...options, edits: [edit, undo] }).tree,
          original.tree,
        );
      }
    });

    test("subscript candidates share expansions and retain independently neutral nested subscripts", () => {
      const source = `: "\${a[b[)]+$(printf 2)+$((1+2))]}"`;
      const nodes = parseNodes(parser, source);
      assert.deepEqual(
        nodes
          .filter(({ type }) =>
            [
              "array_subscript",
              "arithmetic_candidate_array_reference",
              "subscript_text",
              "command_substitution",
              "arithmetic_expansion",
              "arithmetic_binary_expression",
            ].includes(type),
          )
          .map(({ type, text }) => [type, text]),
        [
          ["array_subscript", "[b[)]+$(printf 2)+$((1+2))]"],
          ["arithmetic_candidate_array_reference", "b[)]"],
          ["array_subscript", "[)]"],
          ["subscript_text", ")"],
          ["command_substitution", "$(printf 2)"],
          ["arithmetic_expansion", "$((1+2))"],
          ["arithmetic_binary_expression", "1+2"],
        ],
      );
    });

    test("incomplete arithmetic retains candidate tokens while blank subscripts have no candidate", () => {
      const nodes = parseNodes(
        parser,
        `: "\${a[x+]}" "\${a[08]}" "\${a[  ]}" "\${a[]}"`,
      );
      assert.deepEqual(
        nodes
          .filter(({ field }) => field === "candidate")
          .map(({ type, text }) => [type, text]),
        [
          ["arithmetic_candidate_source_expression", "x+"],
          ["arithmetic_candidate_source_expression", "08"],
        ],
      );
      assert.deepEqual(
        nodes
          .filter(({ type }) =>
            [
              "arithmetic_candidate_variable",
              "arithmetic_candidate_operator",
              "subscript_text",
            ].includes(type),
          )
          .map(({ type, text }) => [type, text]),
        [
          ["arithmetic_candidate_variable", "x"],
          ["arithmetic_candidate_operator", "+"],
          ["subscript_text", "08"],
        ],
      );
    });

    test("subscript candidate edits and repairs match fresh parsing", () => {
      for (const [before, after] of [
        ["x+1", "x+"],
        ["(x+1)", "(x+1"],
        ["(x+1)", ")x+1("],
        ["b[i]+1", "b[)]+1"],
        ["x+1", '"x+1"'],
        ["x+1", "$(printf 2)+1"],
        ["x+1", "$((1+2))+1"],
        ["x+1", "[x]+1"],
        ["x+1", "x\\\n+1"],
        ["x+1", "日+1"],
        ["x+1", "  "],
        ["x+1", ""],
      ]) {
        const source = `: "\${a[${before}]}"; : tail\n`;
        const edit = {
          byte: 7,
          deleteBytes: Buffer.byteLength(before),
          insert: after,
        };
        const undo = {
          byte: 7,
          deleteBytes: Buffer.byteLength(after),
          insert: before,
        };
        const options = { arguments: ["-c"] };
        const original = parser.parse(source, options);
        const fresh = parser.parse(applyEdit(source, edit), options);
        assert.equal(original.status, 0, original.output);
        assert.equal(fresh.status, 0, fresh.output);
        assert.equal(
          parser.parse(source, { ...options, edits: [edit] }).tree,
          fresh.tree,
        );
        assert.equal(
          parser.parse(source, { ...options, edits: [edit, undo] }).tree,
          original.tree,
        );
      }
    });

    test("fixed quote conditions retain dollar-quote source without rescanning", () => {
      const source = `: $'a\\n' $"x" "\${v:-$'\${p}'}" "\${v:-$"x"}" "\${a[$'0']}" "\${v: $'0'}"`;
      const nodes = parseNodes(parser, source);
      assert.deepEqual(
        nodes
          .filter(({ type }) =>
            ["dollar_single_quoted", "locale_quoted"].includes(type),
          )
          .map(({ type, text }) => [type, text]),
        [
          ["dollar_single_quoted", "$'a\\n'"],
          ["locale_quoted", '$"x"'],
          ["dollar_single_quoted", `$'\${p}'`],
          ["locale_quoted", '$"x"'],
          ["dollar_single_quoted", "$'0'"],
          ["dollar_single_quoted", "$'0'"],
        ],
      );
      assert.ok(
        !nodes.some(
          ({ type, text }) =>
            type === "parameter_expansion" && text === `\${p}`,
        ),
      );
    });

    test("quoted parameter value words preserve single-quoted source boundaries", () => {
      for (const header of [
        "x:-",
        "x-",
        "x:+",
        "x+",
        "x:=",
        "x=",
        "x:?",
        "x?",
        "x[0]:-",
        "!x:-",
        "10:-",
        "@:-",
      ]) {
        const expansion = `\${${header}'"'}`;
        const source = `: {a,"${expansion}"}; : tail\n`;
        const nodes = parseNodes(parser, source);
        assert.deepEqual(
          nodes
            .filter(({ type }) =>
              [
                "brace_expansion",
                "parameter_expansion",
                "single_quoted",
                "single_quote_content",
              ].includes(type),
            )
            .map(({ type, text }) => [type, text]),
          [
            ["brace_expansion", `{a,"${expansion}"}`],
            ["parameter_expansion", expansion],
            ["single_quoted", "'\"'"],
            ["single_quote_content", '"'],
          ],
          source,
        );
      }
    });

    test("single-quoted parameter source retains braces and expansion spellings", () => {
      for (const content of [
        "",
        "a}b",
        `\${y} $(printf Y) \`printf Y\``,
        '\\"',
        "日}😀",
      ]) {
        const expansion = `\${x:-'${content}'}`;
        const source = `: "${expansion}"; : tail\n`;
        const nodes = parseNodes(parser, source);
        assert.deepEqual(
          nodes
            .filter(({ type }) => type === "single_quoted")
            .map(({ text }) => text),
          [`'${content}'`],
        );
        assert.deepEqual(
          nodes
            .filter(({ type }) => type === "single_quote_content")
            .map(({ text }) => text),
          content === "" ? [] : [content],
        );
        assert.deepEqual(
          nodes
            .filter(({ type }) => type === "parameter_expansion")
            .map(({ text }) => text),
          [expansion],
        );
        assert.ok(
          !nodes.some(({ type }) =>
            ["command_substitution", "backquote_substitution"].includes(type),
          ),
        );
      }
    });

    test("quoted parameter single-quote boundaries respect backslash parity", () => {
      const source = `: "\${x:-\\'}"\n`;
      const original = parser.parse(source, { arguments: ["-c"] });
      assert.equal(original.status, 0, original.output);
      for (const { insert, status } of [
        { insert: "", status: 0 },
        { insert: "\\", status: 1 },
        { insert: "\\\\", status: 0 },
        { insert: "\\\\\\", status: 1 },
      ]) {
        const edit = { byte: source.indexOf("\\"), deleteBytes: 0, insert };
        const editedSource = applyEdit(source, edit);
        const fresh = parser.parse(editedSource, { arguments: ["-c"] });
        assert.equal(fresh.status, status, editedSource + fresh.output);
        const edited = parser.parse(source, {
          arguments: ["-c"],
          edits: [edit],
        });
        assert.equal(edited.status, status, edited.output);
        if (status === 0) {
          assert.equal(edited.tree, fresh.tree);
          const nodes = parseNodes(parser, editedSource);
          assert.ok(
            nodes.some(
              ({ type, text }) =>
                type === "double_quote_escape" && text === "\\'",
            ),
          );
          assert.ok(!nodes.some(({ type }) => type === "single_quoted"));
        }
        const restore = {
          byte: edit.byte,
          deleteBytes: Buffer.byteLength(insert),
          insert: "",
        };
        assert.equal(
          parser.parse(editedSource, { arguments: ["-c"], edits: [restore] })
            .tree,
          original.tree,
        );
      }
      const ordinary = parseNodes(parser, ': "\\\'"\n');
      assert.deepEqual(
        ordinary
          .filter(({ type }) => type === "double_quote_text")
          .map(({ text }) => text),
        ["\\'"],
      );
    });

    test("quoted parameter single quotes survive removal and repair", () => {
      for (const { source, openingStatus = 1 } of [
        { source: `: "\${x:-'"'}"\n` },
        { source: `: {a,"\${x:-'"'}"}\n` },
        { source: `: "\${x:-'a}b'}"\n`, openingStatus: 0 },
        { source: `: "\${x:-'日\\\n本'}"\n` },
        { source: `: "\${x:-"\${y:-'"'}"}"\n` },
        { source: `: \`: "\${x:-'"'}"\`\n` },
        { source: `: $((1 + "\${x:-'"'}"))\n` },
      ]) {
        const original = parser.parse(source, { arguments: ["-c"] });
        assert.equal(original.status, 0, original.output);
        for (const offset of [source.indexOf("'"), source.lastIndexOf("'")]) {
          const remove = {
            byte: Buffer.byteLength(source.slice(0, offset)),
            deleteBytes: 1,
            insert: "",
          };
          const brokenSource = applyEdit(source, remove);
          const broken = parser.parse(brokenSource, { arguments: ["-c"] });
          const expectedStatus =
            offset === source.indexOf("'") ? openingStatus : 1;
          assert.equal(
            broken.status,
            expectedStatus,
            brokenSource + broken.output,
          );
          if (expectedStatus === 0) {
            assert.equal(
              parser.parse(source, { arguments: ["-c"], edits: [remove] }).tree,
              broken.tree,
            );
          }
          const restore = { byte: remove.byte, deleteBytes: 0, insert: "'" };
          for (const { seed, edits } of [
            { seed: source, edits: [remove, restore] },
            { seed: brokenSource, edits: [restore] },
          ]) {
            const repaired = parser.parse(seed, { arguments: ["-c"], edits });
            assert.equal(repaired.status, 0, repaired.output);
            assert.equal(repaired.tree, original.tree);
          }
        }
      }
    });

    for (const { name, body, quoted, suffix = "" } of [
      { name: "closing brace argument", body: ": };" },
      { name: "closing brace word prefix", body: ": }x;" },
      { name: "closing brace case pattern", body: "case x in }) :;; esac;" },
      { name: "closing brace redirect operand", body: ": >};" },
      { name: "closing brace inside a group", body: "{ : }; :; };" },
      { name: "opening brace input process prefix", body: "{<(:); :;" },
      { name: "opening brace output process prefix", body: "{>(:); :;" },
      {
        name: "opening brace in a later case pattern",
        body: "case x in x) :;; {) :;; esac;",
      },
      { name: "single quoted double quote", body: ": '\"';", quoted: true },
      { name: "adjacent substitution suffix", body: ":;", suffix: "x" },
    ]) {
      test(`command lookahead boundaries preserve ${name}`, () => {
        for (const [opener, closer, type] of [
          ["$(", ")", "command_substitution"],
          ["${ ", "}", "current_shell_substitution"],
          ["${| ", "}", "reply_substitution"],
        ]) {
          const substitution = `${opener}${body} ${closer}`;
          const word = `{a,${quoted ? `"${substitution}"` : substitution}${suffix}}`;
          const source = `: ${word}\n`;
          const nodes = parseNodes(parser, source);
          assert.deepEqual(
            nodes
              .filter(({ type }) => type === "brace_expansion")
              .map(({ text }) => text),
            [word],
          );
          assert.deepEqual(
            nodes.filter((node) => node.type === type).map(({ text }) => text),
            [substitution],
          );
          const remove = {
            byte: source.indexOf(substitution) + substitution.length - 1,
            deleteBytes: 1,
            insert: "",
          };
          const undo = { byte: remove.byte, deleteBytes: 0, insert: closer };
          const fresh = parser.parse(source, { arguments: ["-c"] });
          assert.equal(
            parser.parse(source, { arguments: ["-c"], edits: [remove, undo] })
              .tree,
            fresh.tree,
          );
        }
      });
    }

    test("braced substitution endings remain fixed across surrounding commands", () => {
      const source = `: {a,\${ : }; }}\n: {a,"\${| : '"'; }"}\n: \${ :; }x; :\n`;
      const nodes = parseNodes(parser, source);
      assert.deepEqual(
        nodes
          .filter(({ type }) =>
            ["current_shell_substitution", "reply_substitution"].includes(type),
          )
          .map(({ type, text }) => [type, text]),
        [
          ["current_shell_substitution", `\${ : }; }`],
          ["reply_substitution", `\${| : '"'; }`],
          ["current_shell_substitution", `\${ :; }`],
        ],
      );
      const remove = {
        byte: source.lastIndexOf("}x"),
        deleteBytes: 1,
        insert: "",
      };
      const restore = { byte: remove.byte, deleteBytes: 0, insert: "}" };
      const repaired = parser.parse(source, {
        arguments: ["-c"],
        edits: [remove, restore],
      });
      assert.equal(repaired.status, 0, repaired.output);
      assert.equal(
        repaired.tree,
        parser.parse(source, { arguments: ["-c"] }).tree,
      );
    });

    test("reserved closing braces cannot become braced substitution commands", () => {
      for (const body of [
        ":; }x; :;",
        "}x;",
        ": && }x;",
        ": | }x;",
        "! }x;",
        "time }x;",
        "coproc }x;",
        "if :; then }x; fi;",
        "while :; do }x; done;",
        "{ :; }x; };",
        "( :; }x; );",
        "case x in x) }x;; esac;",
        "f() { }x; };",
        "$( :; }x; :);",
        '"$( :; }x; :)";',
      ]) {
        for (const opener of ["${ ", "${| "]) {
          const source = `: ${opener}${body} }\n`;
          const fresh = parser.parse(source, { arguments: ["-c"] });
          assert.equal(fresh.status, 1, source + fresh.output);
          const repair = {
            byte: source.indexOf("}x"),
            deleteBytes: 0,
            insert: "\\",
          };
          const expected = parser.parse(applyEdit(source, repair), {
            arguments: ["-c"],
          });
          assert.equal(expected.status, 0, expected.output);
          const repaired = parser.parse(source, {
            arguments: ["-c"],
            edits: [repair],
          });
          assert.equal(repaired.status, 0, repaired.output);
          assert.equal(repaired.tree, expected.tree);
        }
      }
    });

    test("braced substitution context preserves literal closing-brace words", () => {
      for (const source of [
        `: \${ : }x; }\n`,
        `: \${ x=1 }x; }\n`,
        `: \${ >x }x; }\n`,
        `: \${ : >}x; }\n`,
        `: \${ case }x in }x) :;; esac; }\n`,
        `: \${ for x in }x; do :; done; }\n`,
        `: \${ \`}x; :\`; }\n`,
        "{ :; }x; }\n",
      ]) {
        const nodes = parseNodes(parser, source);
        assert.ok(
          nodes.some(({ type, text }) => type === "literal" && text === "}x"),
          source,
        );
      }
    });

    test("empty timing prefixes end only at shell list boundaries", () => {
      for (const timing of ["time", "time -p", "time --", "time -p --"]) {
        for (const [before, after] of [
          ["", ""],
          ["", "\t"],
          ["", ";"],
          ["", "&"],
          ["", " # comment"],
          ["", "\n: next\n"],
          ["", " \\\n;\n"],
          [": `", "`\n"],
          [": $(", "; )\n"],
          [": ${ ", "\n}x\n"],
          [": ${| ", "& }x\n"],
          ["case x in x) ", "\n;; esac\n"],
        ]) {
          const source = `${before}${timing}${after}`;
          const nodes = parseNodes(parser, source);
          assert.deepEqual(
            nodes
              .filter(({ type }) => type === "timing")
              .map(({ text }) => text),
            [timing],
            source,
          );
        }
      }
    });

    test("empty timing prefixes reject missing pipeline and list separators", () => {
      for (const timing of ["time", "time -p", "time --", "time -p --"]) {
        for (const [before, after, insert] of [
          ["", " && :\n", " :"],
          ["", " || :\n", " :"],
          ["", " | :\n", " :"],
          [": `", " && :`\n", " :"],
          ["(", ")\n", ";"],
          [": $(", ")\n", ";"],
          [": ${ ", " }x\n", ";"],
          [": ${| ", " }x\n", ";"],
          ["{ ", " }\n", ";"],
          ["if :; then ", " fi\n", ";"],
          ["while :; do ", " done\n", ";"],
          ["if ", " then :; fi\n", ";"],
          ["while ", " do :; done\n", ";"],
          ["case x in x) ", ";; esac\n", "\n"],
          ["case x in x) ", ";& esac\n", "\n"],
          ["case x in x) ", ";;& esac\n", "\n"],
        ]) {
          const source = `${before}${timing}${after}`;
          const invalid = parser.parse(source, { arguments: ["-c"] });
          assert.equal(invalid.status, 1, source + invalid.output);
          const repair = {
            byte: before.length + timing.length,
            deleteBytes: 0,
            insert,
          };
          const expected = parser.parse(applyEdit(source, repair), {
            arguments: ["-c"],
          });
          assert.equal(expected.status, 0, expected.output);
          const repaired = parser.parse(source, {
            arguments: ["-c"],
            edits: [repair],
          });
          assert.equal(repaired.status, 0, repaired.output);
          assert.equal(repaired.tree, expected.tree);
        }
      }
    });

    test("empty timing and negation preserve backquote end and repeated prefixes", () => {
      for (const { source, timing, negations } of [
        { source: ": `!`\n", timing: [], negations: 1 },
        { source: ": `time -p !`\n", timing: ["time -p"], negations: 1 },
        {
          source: "! time ! time -p --",
          timing: ["time", "time -p --"],
          negations: 2,
        },
        { source: "time >out && :\n", timing: ["time"], negations: 0 },
        { source: "time &>out\n", timing: ["time"], negations: 0 },
        { source: "time -- -p\n", timing: ["time --"], negations: 0 },
        { source: "time -p -p\n", timing: ["time -p"], negations: 0 },
        { source: "time -px\n", timing: ["time"], negations: 0 },
        { source: ": time && :\n", timing: [], negations: 0 },
        { source: "x=1 time && :\n", timing: [], negations: 0 },
      ]) {
        const nodes = parseNodes(parser, source);
        assert.deepEqual(
          nodes.filter(({ type }) => type === "timing").map(({ text }) => text),
          timing,
          source,
        );
        assert.equal(
          nodes.filter(({ type }) => type === "bang").length,
          negations,
          source,
        );
      }
    });

    test("timing prefixes allow adjacent redirections and subshells", () => {
      for (const timing of ["time", "time -p", "time --", "time -p --"]) {
        for (const command of ["<in", ">out", "&>out", "&>>out", "(:)"]) {
          const source = `${timing}${command}`;
          const nodes = parseNodes(parser, source);
          assert.deepEqual(
            nodes
              .filter(({ type }) => type === "timing")
              .map(({ text }) => text),
            [timing],
            source,
          );
          const remove = {
            byte: timing.length,
            deleteBytes: command.length,
            insert: "",
          };
          const empty = parser.parse(source, {
            arguments: ["-c"],
            edits: [remove],
          });
          assert.equal(empty.status, 0, empty.output);
          assert.equal(
            empty.tree,
            parser.parse(timing, { arguments: ["-c"] }).tree,
          );
          const restore = {
            byte: timing.length,
            deleteBytes: 0,
            insert: command,
          };
          assert.equal(
            parser.parse(source, {
              arguments: ["-c"],
              edits: [remove, restore],
            }).tree,
            parser.parse(source, { arguments: ["-c"] }).tree,
          );
        }
      }
    });

    test("process substitution suffixes prevent timing option recognition", () => {
      for (const [before, word, timing] of [
        ["time ", "-p", "time"],
        ["time ", "--", "time"],
        ["time -p ", "--", "time -p"],
        ["time -- ", "-p", "time --"],
        ["time ", "-p\\\n", "time"],
        ["", "time", ""],
      ]) {
        for (const substitution of ["<(:)", ">(:)"]) {
          const source = `${before}${word}${substitution}\n`;
          const nodes = parseNodes(parser, source);
          assert.deepEqual(
            nodes
              .filter(({ type }) => type === "timing")
              .map(({ text }) => text),
            timing === "" ? [] : [timing],
            source,
          );
          assert.ok(
            nodes.some(
              ({ type, text }) =>
                type === "word" && text === word + substitution,
            ),
            source,
          );
          const separate = {
            byte: before.length + word.length,
            deleteBytes: 0,
            insert: " ",
          };
          const expected = parser.parse(applyEdit(source, separate), {
            arguments: ["-c"],
          });
          assert.equal(expected.status, 0, expected.output);
          assert.equal(
            parser.parse(source, {
              arguments: ["-c"],
              edits: [separate],
            }).tree,
            expected.tree,
          );
        }
      }
    });

    test("combined prefix and postfix updates retain arithmetic source", () => {
      for (const expression of ["++x++", "++x--", "--x++", "--x--"]) {
        for (const source of [
          `: $((${expression}))\n`,
          `((${expression}))\n`,
          `for ((${expression};0;)); do :; done\n`,
          `: \${x: ${expression}}\n`,
          `: \${x:0:${expression}}\n`,
        ]) {
          const nodes = parseNodes(parser, source);
          assert.deepEqual(
            nodes
              .filter(({ type }) => type === "arithmetic_source_expression")
              .map(({ text }) => text),
            [expression],
          );
          const remove = {
            byte: source.indexOf(expression),
            deleteBytes: 2,
            insert: "",
          };
          const edited = parser.parse(source, {
            arguments: ["-c"],
            edits: [remove],
          });
          assert.equal(edited.status, 0, edited.output);
          assert.equal(
            edited.tree,
            parser.parse(applyEdit(source, remove), { arguments: ["-c"] }).tree,
          );
          const undo = {
            byte: remove.byte,
            deleteBytes: 0,
            insert: expression.slice(0, 2),
          };
          assert.equal(
            parser.parse(source, { arguments: ["-c"], edits: [remove, undo] })
              .tree,
            parser.parse(source, { arguments: ["-c"] }).tree,
          );
        }
      }
    });

    test("ERE source fragments preserve process substitutions inside groups", () => {
      for (const [pattern, substitution, fragment] of [
        ["([a<(:))", "<(:)", "[a"],
        ["({a>(:)})", ">(:)", "{a"],
        ["([a<\\\n(:))", "<\\\n(:)", "[a"],
      ]) {
        const source = `[[ x =~ ${pattern} ]]; : tail\n`;
        const nodes = parseNodes(parser, source);
        assert.deepEqual(
          nodes
            .filter(({ type }) => type === "process_substitution")
            .map(({ text }) => text),
          [substitution],
        );
        assert.deepEqual(
          nodes
            .filter(({ type }) => type === "regex_source_fragment")
            .map(({ text }) => text),
          [fragment],
        );
        const remove = {
          byte: source.indexOf(substitution),
          deleteBytes: 1,
          insert: "",
        };
        const edited = parser.parse(source, {
          arguments: ["-c"],
          edits: [remove],
        });
        assert.equal(edited.status, 0, edited.output);
        assert.equal(
          edited.tree,
          parser.parse(applyEdit(source, remove), { arguments: ["-c"] }).tree,
        );
        const undo = {
          byte: remove.byte,
          deleteBytes: 0,
          insert: substitution[0],
        };
        assert.equal(
          parser.parse(source, { arguments: ["-c"], edits: [remove, undo] })
            .tree,
          parser.parse(source, { arguments: ["-c"] }).tree,
        );
      }
    });

    for (const entry of cases) {
      test(entry.name, () => {
        const accepted =
          entry.extglob === undefined || entry.extglob === extglob;
        const parsed = parser.parse(entry.source, {});
        assert.equal(parsed.status, accepted ? 0 : 1, parsed.output);
        if (!accepted) return;
        const nodes = parseNodes(parser, entry.source);
        const patterns = nodes.filter(({ type }) => type === "extglob_pattern");
        if (entry.pattern === null) assert.deepEqual(patterns, []);
        else
          assert.ok(
            patterns.some(({ text }) => text === entry.pattern),
            parsed.tree,
          );
        if (entry.brace)
          assert.ok(
            nodes.some(({ type }) => type === "brace_expansion"),
            parsed.tree,
          );
        const at = entry.source.indexOf("(");
        if (at >= 0) {
          const remove = { byte: at, deleteBytes: 1, insert: "" };
          const damaged = applyEdit(entry.source, remove);
          const fresh = parser.parse(damaged, {});
          const edited = parser.parse(entry.source, { edits: [remove] });
          if (fresh.status === 0) assert.equal(edited.tree, fresh.tree);
          const undo = { byte: at, deleteBytes: 0, insert: "(" };
          assert.equal(
            parser.parse(entry.source, { edits: [remove, undo] }).tree,
            parsed.tree,
          );
        }
      });
    }

    for (const entry of delimiterCases) {
      test(entry.name, () => {
        const extquote = !grammar.name.includes("noextquote");
        const end = extquote ? entry.enabled : entry.disabled;
        const source = `: <<${entry.word}\n$body\n${end}\n`;
        if (entry.extglob && !extglob) {
          assert.equal(parser.parse(source, {}).status, 1);
          return;
        }
        const nodes = parseNodes(parser, source);
        assert.deepEqual(
          nodes
            .filter(({ type }) => type === "here_document_end_text")
            .map(({ text }) => text),
          [end],
        );
        assert.deepEqual(
          nodes
            .filter(({ type }) => type === "here_end")
            .map(({ text }) => text),
          [entry.word],
        );
        const nested = `: {a,$(${source})}\n`;
        const nestedNodes = parseNodes(parser, nested);
        assert.ok(nestedNodes.some(({ type }) => type === "brace_expansion"));
        assert.deepEqual(
          nestedNodes
            .filter(({ type }) => type === "here_document_end_text")
            .map(({ text }) => text),
          [end],
        );
        const prefix = "shopt -s extquote\n";
        const seed = prefix + source;
        const edit = { byte: 7, deleteBytes: 1, insert: "u" };
        const original = parser.parse(seed, {});
        const fresh = parser.parse(applyEdit(seed, edit), {});
        const incremental = parser.parse(seed, { edits: [edit] });
        assert.equal(fresh.status, 0);
        assert.equal(incremental.tree, fresh.tree);
        assert.equal(fresh.tree, original.tree);
        const undo = { ...edit, insert: "s" };
        assert.equal(
          parser.parse(seed, { edits: [edit, undo] }).tree,
          original.tree,
        );
        const at = seed.indexOf("$", prefix.length);
        if (at >= 0) {
          const remove = { byte: at, deleteBytes: 1, insert: "" };
          const fresh = parser.parse(applyEdit(seed, remove), {});
          const incremental = parser.parse(seed, { edits: [remove] });
          if (fresh.status === 0) assert.equal(incremental.tree, fresh.tree);
          assert.equal(
            parser.parse(seed, {
              edits: [remove, { ...remove, deleteBytes: 0, insert: "$" }],
            }).tree,
            original.tree,
          );
        }
      });
    }

    test("source setting commands do not switch fixed parsing conditions", () => {
      const source = "shopt -s extglob extquote\n: @(a|b)\n";
      const edit = { byte: 7, deleteBytes: 1, insert: "u" };
      const original = parser.parse(source, {});
      const fresh = parser.parse(applyEdit(source, edit), {});
      assert.equal(original.status, extglob ? 0 : 1);
      assert.equal(fresh.status, original.status);
      assert.equal(fresh.tree, original.tree);
      if (extglob)
        assert.equal(parser.parse(source, { edits: [edit] }).tree, fresh.tree);
    });
  });
}
