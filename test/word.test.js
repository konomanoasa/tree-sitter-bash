import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { grammars } from "../scripts/tree-sitter.js";
import {
  applyEdit,
  assertEditRoundTrip,
  createParser,
  parseNodes,
} from "./support/parser.js";

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

for (const grammar of grammars) {
  describe(grammar.name, () => {
    let parser;
    before(() => {
      parser = createParser(grammar);
    });
    after(() => {
      parser?.close();
    });
    const extglob = grammar.name.includes("extglob");
    const nodes = (source) => parseNodes(parser, source);
    test("literal words preserve structure when edited into quotes, expansions and patterns", () => {
      const replacements = [
        { insert: 'a"aa"a', type: "double_quoted", text: '"aa"' },
        { insert: `aa\${x}a`, type: "parameter_expansion", text: `\${x}` },
        { insert: "a{b,c}d", type: "brace_expansion", text: "{b,c}" },
        { insert: "a[bc]d", type: "pattern_bracket_source", text: "[bc]" },
        { insert: "a<(:)d", type: "process_substitution", text: "<(:)" },
        { insert: "~user", type: "tilde_expansion", text: "~user" },
      ];
      if (extglob) {
        replacements.push({
          insert: "a@(b|c)d",
          type: "extglob_pattern",
          text: "@(b|c)",
        });
      }
      for (const seed of ["aaaa\n", "echo aaaa\n"]) {
        for (const { insert, type, text } of replacements) {
          assert.deepEqual(
            nodes(seed.replace("aaaa", insert))
              .filter((node) => node.type === type)
              .map((node) => node.text),
            [text],
            insert,
          );
          assertEditRoundTrip(parser, {
            seed,
            remove: "aaaa",
            insert,
            valid: true,
          });
        }
      }
    });
    if (grammar.name === "bash_extglob") {
      test("a line continuation at the end of input becomes a trailing backslash", () => {
        assertEditRoundTrip(parser, {
          seed: "echo a\\\nb\n",
          remove: "\nb\n",
          insert: "",
          valid: true,
        });
      });

      for (const { name, prefixes, source, types, expected } of [
        {
          name: "array types and values leave subscript interpretation unresolved",
          prefixes: [
            "declare -a a\n",
            "declare -A a\n",
            "declare -i a\n",
            "declare -n a=other\n",
            "a=other\n",
          ],
          source: `: "\${a[x+1]}" $((a[x+1]))\n`,
          types: [
            "array_reference",
            "arithmetic_array_reference",
            "arithmetic_candidate_binary_expression",
          ],
          expected: [
            ["array_reference", "a[x+1]"],
            ["arithmetic_candidate_binary_expression", "x+1"],
            ["arithmetic_array_reference", "a[x+1]"],
            ["arithmetic_candidate_binary_expression", "x+1"],
          ],
        },
        {
          name: "replacement settings preserve ampersand source and quoting",
          prefixes: [
            "shopt -s patsub_replacement\n",
            "shopt -u patsub_replacement\n",
          ],
          source: `: "\${x/a/&}" "\${x/a/\\&}" "\${x/a/"&"}"\n`,
          types: ["parameter_word", "escaped_character", "double_quote_text"],
          expected: [
            ["parameter_word", "&"],
            ["parameter_word", "\\&"],
            ["escaped_character", "\\&"],
            ["parameter_word", '"&"'],
            ["double_quote_text", "&"],
          ],
        },
        {
          name: "expansion settings retain brace and pattern candidates",
          prefixes: [
            "set -B +f; shopt -s globstar nocaseglob globasciiranges\n",
            "set +B -f; shopt -u globstar nocaseglob globasciiranges\n",
          ],
          source: ": {a,b} **/[a-z]\n",
          types: [
            "brace_expansion",
            "pattern_star_source",
            "pattern_bracket_source",
          ],
          expected: [
            ["brace_expansion", "{a,b}"],
            ["pattern_star_source", "*"],
            ["pattern_star_source", "*"],
            ["pattern_bracket_source", "[a-z]"],
          ],
        },
        {
          name: "translation settings retain untranslated locale quote source",
          prefixes: [
            "shopt -s noexpand_translation\n",
            "shopt -u noexpand_translation\n",
          ],
          source: ': $"$x"\n',
          types: ["locale_quoted", "parameter_expansion"],
          expected: [
            ["locale_quoted", '$"$x"'],
            ["parameter_expansion", "$x"],
          ],
        },
        {
          name: "extglob syntax follows the fixed enabled parsing condition",
          prefixes: ["shopt -s extglob\n", "shopt -u extglob\n"],
          source: ": @(a|b)\n",
          types: ["extglob_pattern", "extglob_alternative"],
          expected: [
            ["extglob_pattern", "@(a|b)"],
            ["extglob_alternative", "a"],
            ["extglob_alternative", "b"],
          ],
        },
        {
          name: "extquote boundaries follow the fixed enabled parsing condition",
          prefixes: ["shopt -s extquote\n", "shopt -u extquote\n"],
          source: `: "\${x:-$'}'}" "\${x:-$"$v"}"\n`,
          types: ["dollar_single_quoted", "locale_quoted"],
          expected: [
            ["dollar_single_quoted", "$'}'"],
            ["locale_quoted", '$"$v"'],
          ],
        },
        {
          name: "keyword settings do not resolve argument words into assignments",
          prefixes: ["set -k\n", "set +k\n"],
          source: ": x=$value\n",
          types: ["word", "assignment_word", "parameter_expansion"],
          expected: [
            ["word", ":"],
            ["word", "x=$value"],
            ["parameter_expansion", "$value"],
          ],
        },
      ]) {
        test(name, () => {
          let previous;
          for (const prefix of prefixes) {
            const offset = Buffer.byteLength(prefix);
            const actual = nodes(prefix + source)
              .filter(({ start }) => start >= offset)
              .map(({ start, end, ...node }) => ({
                ...node,
                start: start - offset,
                end: end - offset,
              }));
            assert.deepEqual(
              actual
                .filter(({ type }) => types.includes(type))
                .map(({ type, text }) => [type, text]),
              expected,
              prefix,
            );
            if (previous !== undefined)
              assert.deepEqual(actual, previous, prefix);
            previous = actual;
          }
        });
      }

      test("quoted parameter dollar quotes preserve source before expansion-time rescanning", () => {
        const actual = nodes(`: "\${x:-$'\${y}'}" "\${x:-$'a}b'}"\n`);
        assert.deepEqual(
          actual
            .filter(({ type }) =>
              [
                "parameter_expansion",
                "dollar_single_quoted",
                "dollar_single_quote_text",
              ].includes(type),
            )
            .map(({ type, text }) => [type, text]),
          [
            ["parameter_expansion", `\${x:-$'\${y}'}`],
            ["dollar_single_quoted", `$'\${y}'`],
            ["dollar_single_quote_text", `\${y}`],
            ["parameter_expansion", `\${x:-$'a}b'}`],
            ["dollar_single_quoted", "$'a}b'"],
            ["dollar_single_quote_text", "a}b"],
          ],
        );
      });

      test("ERE groups and alternatives extend a word starting with closing brackets", () => {
        for (const expression of [
          "]](a)",
          "]]\\\n(a)",
          "]]()",
          "]]|x",
          "]]||x",
        ]) {
          const actual = nodes(`[[ x =~ ${expression} ]]\n`);
          assert.deepEqual(
            actual
              .filter(({ type }) => type === "regex_operand")
              .map(({ text }) => text),
            [expression],
          );
        }
      });

      test("an unfinished numeric spelling is a single source fragment", () => {
        const actual = nodes("echo $((0x$y)) $((0xg))\n");
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "arithmetic_source_fragment")
            .map(({ text }) => text),
          ["0x", "0xg"],
        );
        assert.equal(
          actual.filter(({ type }) => type === "arithmetic_number").length,
          0,
        );
        assert.equal(
          actual.filter(({ type }) => type === "command_substitution").length,
          0,
        );
      });

      test("arithmetic source retains every operator without imposing precedence", () => {
        const expression =
          "0x$y + - ! ~ = += -= *= /= %= <<= >>= &= ^= |= ? : || && | ^ & == != <= >= < > << >> * / % ** , ++ --";
        for (const source of [
          `echo $((${expression}))\n`,
          `((${expression}))\n`,
          `for ((${expression};0;)); do :; done\n`,
        ]) {
          const actual = nodes(source);
          assert.deepEqual(
            actual
              .filter(({ type }) => type === "arithmetic_operator")
              .map(({ text }) => text),
            [
              "+",
              "-",
              "!",
              "~",
              "=",
              "+=",
              "-=",
              "*=",
              "/=",
              "%=",
              "<<=",
              ">>=",
              "&=",
              "^=",
              "|=",
              "?",
              ":",
              "||",
              "&&",
              "|",
              "^",
              "&",
              "==",
              "!=",
              "<=",
              ">=",
              "<",
              ">",
              "<<",
              ">>",
              "*",
              "/",
              "%",
              "**",
              ",",
              "++",
              "--",
            ],
          );
          assert.equal(
            actual.filter(({ type }) => type === "arithmetic_source_expression")
              .length,
            1,
          );
          assert.equal(
            actual.filter(({ type }) => type === "arithmetic_binary_expression")
              .length,
            0,
          );
        }
      });

      test("arithmetic source uses the longest operator across line continuations", () => {
        const actual = nodes(
          "echo $((0x$y +++ --- **= <<<= +\\\n= &\\\n& >\\\n>\\\n=))\n",
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "arithmetic_operator")
            .map(({ text }) => text),
          [
            "++",
            "+",
            "--",
            "-",
            "**",
            "=",
            "<<",
            "<=",
            "+\\\n=",
            "&\\\n&",
            ">\\\n>\\\n=",
          ],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "line_continuation")
            .map(({ text }) => text),
          ["\\", "\\", "\\", "\\"],
        );
      });

      test("arithmetic source preserves ANSI-C and locale quotes without evaluating them", () => {
        const actual = nodes("echo $(( $'a\\'日' + $\"$x\" ))\n");
        assert.deepEqual(
          actual
            .filter(({ type }) =>
              ["dollar_single_quoted", "locale_quoted"].includes(type),
            )
            .map(({ type, text }) => [type, text]),
          [
            ["dollar_single_quoted", "$'a\\'日'"],
            ["locale_quoted", '$"$x"'],
          ],
        );
        assert.ok(
          actual.some(
            ({ type, field }) =>
              type === "arithmetic_source_expression" && field === "expression",
          ),
        );
        assert.equal(
          actual.find(({ type }) => type === "dollar_single_quote_escape")
            ?.text,
          "\\'",
        );
        assert.equal(
          actual.find(({ type }) => type === "parameter_expansion")?.text,
          "$x",
        );
        assert.equal(
          actual.filter(({ type }) => type === "arithmetic_number").length,
          0,
        );
      });

      test("an escaped ANSI-C quote keeps the arithmetic command boundary", () => {
        const actual = nodes("(( $'a\\'b' )); printf AFTER\n");
        assert.equal(
          actual.find(({ type }) => type === "arithmetic_command")?.text,
          "(( $'a\\'b' ))",
        );
        assert.equal(
          actual.find(({ type }) => type === "dollar_single_quoted")?.text,
          "$'a\\'b'",
        );
        assert.ok(!actual.some(({ type }) => type === "subshell"));
      });

      test("a dollar separated from arithmetic quoting remains a source fragment", () => {
        const actual = nodes("echo $(( $\n'1' + $ ))\n");
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "arithmetic_source_fragment")
            .map(({ text }) => text),
          ["$", "$"],
        );
        assert.equal(
          actual.find(({ type }) => type === "single_quoted")?.text,
          "'1'",
        );
        assert.ok(!actual.some(({ type }) => type === "dollar_single_quoted"));
      });

      test("continued arithmetic quote prefixes preserve Unicode source ranges", () => {
        const source = "echo $(( $\\\n'日' + $\\\n\"本\" ))\n";
        const actual = nodes(source);
        assert.deepEqual(
          actual
            .filter(({ type }) =>
              ["dollar_single_quoted", "locale_quoted"].includes(type),
            )
            .map(({ text }) => text),
          ["$\\\n'日'", '$\\\n"本"'],
        );
        const first = Buffer.from(source).indexOf("\\"),
          second = Buffer.from(source).lastIndexOf("\\");
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "line_continuation")
            .map(({ start, end, text }) => [start, end, text]),
          [
            [first, first + 1, "\\"],
            [second, second + 1, "\\"],
          ],
        );
      });

      for (const { name, body, cases } of [
        { name: "timed case", body: "time case x in x) :;; esac", cases: 1 },
        {
          name: "timing options",
          body: "time -p -- case x in x) :;; esac",
          cases: 1,
        },
        {
          name: "unnamed coprocess",
          body: "coproc case x in x) :;; esac",
          cases: 1,
        },
        {
          name: "quoted coprocess name",
          body: 'coproc "worker" case x in x) :;; esac',
          cases: 1,
        },
        {
          name: "function without parentheses",
          body: "function f { case x in x) :;; esac; }",
          cases: 1,
        },
        {
          name: "reserved spelling in a function name",
          body: "function case { case x in x) :;; esac; }",
          cases: 1,
        },
        { name: "array element", body: "a=(case)", cases: 0 },
        {
          name: "declaration array element",
          body: "declare a=(case)",
          cases: 0,
        },
        { name: "array comment", body: "a=(x # ) }\ny)", cases: 0 },
        { name: "array bracket word", body: "a=([)])", cases: 0 },
        { name: "array element subscript", body: "a=([)]=x)", cases: 0 },
        {
          name: "process substitution in an array",
          body: "a=(<(case x in x) :;; esac))",
          cases: 1,
        },
        { name: "assignment prefix", body: "a=1 case", cases: 0 },
        { name: "redirect prefix", body: ">out case", cases: 0 },
        {
          name: "coprocess redirect",
          body: "coproc worker >out case",
          cases: 0,
        },
        {
          name: "coprocess assignment",
          body: "coproc worker x=y case",
          cases: 0,
        },
        { name: "timed assignment subscript", body: "time a[)]=1 :", cases: 0 },
        {
          name: "coprocess assignment subscript",
          body: "coproc worker a[)]=x",
          cases: 0,
        },
        { name: "command after a pipe", body: ": | time case", cases: 0 },
        {
          name: "simple coprocess arguments",
          body: "coproc worker time case",
          cases: 0,
        },
        {
          name: "ordinary command arguments",
          body: ": time -p case",
          cases: 0,
        },
        { name: "extglob leading hash", body: ": @(#|a)", cases: 0 },
        { name: "extglob alternative hash", body: ": @(a|#)", cases: 0 },
        {
          name: "extglob case pattern",
          body: "case x in @(a|#)) :;; esac",
          cases: 1,
        },
        {
          name: "process substitution command",
          body: "<(printf x) case",
          cases: 0,
        },
        {
          name: "process substitution argument",
          body: ": <(printf x) case",
          cases: 0,
        },
        { name: "combined redirection", body: ": &>out case", cases: 0 },
        {
          name: "combined append redirection",
          body: ": &>>out case",
          cases: 0,
        },
        {
          name: "command after a combined pipe",
          body: ": |& time case",
          cases: 0,
        },
      ]) {
        test(`substitution lookahead preserves brace structure around ${name}`, () => {
          const word = `{a,$(${body})}`;
          const actual = nodes(`: ${word}\n`);
          assert.deepEqual(
            actual
              .filter(({ type }) => type === "brace_expansion")
              .map(({ text }) => text),
            [word],
          );
          assert.equal(
            actual.filter(({ type }) => type === "case_clause").length,
            cases,
          );
        });
      }

      for (const prefix of ["time ", "coproc ", "coproc worker ", ": | "]) {
        test(`braced substitution tracks group closing braces after ${prefix.trim()}`, () => {
          const words = [" ", "| "].map(
            (opener) => `{a,\${${opener}${prefix}{ :; }; }}`,
          );
          const actual = nodes(
            `${words.map((word) => `: ${word}`).join("\n")}\n`,
          );
          assert.deepEqual(
            actual
              .filter(({ type }) => type === "brace_expansion")
              .map(({ text }) => text),
            words,
          );
          assert.deepEqual(
            actual
              .filter(({ type }) => type === "brace_group")
              .map(({ text }) => text),
            ["{ :; }", "{ :; }"],
          );
        });
      }

      for (const condition of [
        "x == }",
        "x < y && -n }",
        "( x == } )",
        'x == "]]"',
        "x == ]]suffix",
        "x == <(case x in x) :;; esac)",
        "x =~ (]]|})",
        "x =~ (} ]] )",
        "( # ) ]]\nx == } )",
      ]) {
        test(`conditional lookahead retains enclosing braces for ${condition}`, () => {
          const word = `{a,\${ [[ ${condition} ]]; }}`;
          const actual = nodes(`: ${word}\n`);
          assert.deepEqual(
            actual
              .filter(({ type }) => type === "brace_expansion")
              .map(({ text }) => text),
            [word],
          );
          assert.deepEqual(
            actual
              .filter(({ type }) => type === "conditional_command")
              .map(({ text }) => text),
            [`[[ ${condition} ]]`],
          );
        });
      }

      for (const parameter of [
        "x[0]#'\"'",
        "!x#'\"'",
        "x/'\"'",
        "x/y/'\"'",
        "x^'\"'",
        "x,'\"'",
        "x['\"']#'}'",
        "x[\\}]#'\"'",
        "#x['\"']",
      ]) {
        test(`quoted parameter lookahead preserves braces around ${parameter}`, () => {
          const expansion = `\${${parameter}}`;
          const word = `{a,"${expansion}"}`;
          const actual = nodes(`: ${word}\n`);
          assert.deepEqual(
            actual
              .filter(({ type }) => type === "brace_expansion")
              .map(({ text }) => text),
            [word],
          );
          assert.deepEqual(
            actual
              .filter(({ type }) => type === "parameter_expansion")
              .map(({ text }) => text),
            [expansion],
          );
        });
      }

      test("parameter replacement and substring operands retain separate fields", () => {
        const actual = nodes(`echo \${x//[a/]/日} \${x:(a?b:c):2}\n`);
        assert.deepEqual(
          actual
            .filter(({ field }) =>
              ["pattern", "replacement", "offset", "length"].includes(field),
            )
            .map(({ field, text }) => [field, text]),
          [
            ["pattern", "[a"],
            ["replacement", "]/日"],
            ["offset", "(a?b:c)"],
            ["length", "2"],
          ],
        );
      });

      test("substring operands share arithmetic precedence and conditional fields", () => {
        const actual = nodes(`: "\${s: (n > 0 ? 1 : 0):2}"\n`);
        assert.deepEqual(
          actual
            .filter(({ type }) =>
              [
                "substring_source",
                "parenthesized_arithmetic",
                "arithmetic_conditional_expression",
                "arithmetic_binary_expression",
                "arithmetic_variable",
                "arithmetic_operator",
                "arithmetic_number",
              ].includes(type),
            )
            .map(({ type, field, text }) => [type, field, text]),
          [
            ["substring_source", "offset", " (n > 0 ? 1 : 0)"],
            ["parenthesized_arithmetic", undefined, "(n > 0 ? 1 : 0)"],
            [
              "arithmetic_conditional_expression",
              "expression",
              "n > 0 ? 1 : 0",
            ],
            ["arithmetic_binary_expression", "condition", "n > 0"],
            ["arithmetic_variable", "left", "n"],
            ["arithmetic_operator", "operator", ">"],
            ["arithmetic_number", "right", "0"],
            ["arithmetic_operator", "operator", "?"],
            ["arithmetic_number", "consequence", "1"],
            ["arithmetic_operator", "operator", ":"],
            ["arithmetic_number", "alternative", "0"],
            ["substring_source", "length", "2"],
            ["arithmetic_number", undefined, "2"],
          ],
        );
      });

      test("substring source keeps incomplete lexemes and each operand's known structure", () => {
        const actual = nodes(`: \${s:0x$y:2+3*4} \${s:(x y)+08: a["1:2"] }\n`);
        assert.deepEqual(
          actual
            .filter(({ type }) =>
              [
                "arithmetic_source_fragment",
                "parenthesized_arithmetic_source",
                "arithmetic_binary_expression",
                "arithmetic_array_reference",
                "arithmetic_operator",
              ].includes(type),
            )
            .map(({ type, text }) => [type, text]),
          [
            ["arithmetic_source_fragment", "0x"],
            ["arithmetic_binary_expression", "2+3*4"],
            ["arithmetic_operator", "+"],
            ["arithmetic_binary_expression", "3*4"],
            ["arithmetic_operator", "*"],
            ["parenthesized_arithmetic_source", "(x y)"],
            ["arithmetic_operator", "+"],
            ["arithmetic_source_fragment", "08"],
            ["arithmetic_array_reference", 'a["1:2"]'],
          ],
        );
        assert.deepEqual(
          actual
            .filter(({ field }) => field === "offset" || field === "length")
            .map(({ field, text }) => [field, text]),
          [
            ["offset", "0x$y"],
            ["length", "2+3*4"],
            ["offset", "(x y)+08"],
            ["length", ' a["1:2"] '],
          ],
        );
      });

      test("substring fields distinguish absent operands from whitespace source", () => {
        const actual = nodes(`: \${x:} \${x::} \${x: \t: \n}\n`);
        assert.deepEqual(
          actual
            .filter(({ field }) => field === "offset" || field === "length")
            .map(({ field, text }) => [field, text]),
          [
            ["offset", " \t"],
            ["length", " \n"],
          ],
        );
      });

      test("substring operands retain source without requiring valid arithmetic", () => {
        const actual = nodes(`: \${x:1?2} \${x:(1} \${x:1)} \${x:0:1:2}\n`);
        assert.deepEqual(
          actual
            .filter(({ field }) => field === "offset" || field === "length")
            .map(({ field, text }) => [field, text]),
          [
            ["offset", "1?2"],
            ["offset", "(1"],
            ["offset", "1)"],
            ["offset", "0"],
            ["length", "1:2"],
          ],
        );
      });

      for (const [source, expected] of [
        [
          "1?2:3:4",
          [
            ["offset", "1?2:3"],
            ["length", "4"],
          ],
        ],
        [
          "1?0?2:3:4:2",
          [
            ["offset", "1?0?2:3:4"],
            ["length", "2"],
          ],
        ],
        [
          "1?(2?3:4):5:2",
          [
            ["offset", "1?(2?3:4):5"],
            ["length", "2"],
          ],
        ],
        [
          "(1?2):3",
          [
            ["offset", "(1?2)"],
            ["length", "3"],
          ],
        ],
        [
          "a[1:2]",
          [
            ["offset", "a[1"],
            ["length", "2]"],
          ],
        ],
        [
          "a[(1:2)]:3",
          [
            ["offset", "a[(1:2)]"],
            ["length", "3"],
          ],
        ],
        [
          'a["1:2"]:3',
          [
            ["offset", 'a["1:2"]'],
            ["length", "3"],
          ],
        ],
        [
          "1\\:2:3",
          [
            ["offset", "1\\:2"],
            ["length", "3"],
          ],
        ],
        [":1:2", [["length", "1:2"]]],
        ["1?2:3", [["offset", "1?2:3"]]],
      ]) {
        test(`substring source boundaries follow literal spelling in ${source}`, () => {
          const actual = nodes(`: \${x:${source}}\n`);
          assert.deepEqual(
            actual
              .filter(({ field }) => field === "offset" || field === "length")
              .map(({ field, text }) => [field, text]),
            expected,
          );
        });
      }

      test("substring boundaries resume outside quoted and nested expansion sources", () => {
        const actual = nodes(
          `: "\${x:1?\${n:-2}:$(printf 3):a["1:2"]}" \${x:(\${y:1?2:3:4}):\`printf 2\`}\n`,
        );
        assert.deepEqual(
          actual
            .filter(({ field }) => field === "offset" || field === "length")
            .map(({ field, text }) => [field, text]),
          [
            ["offset", `1?\${n:-2}:$(printf 3)`],
            ["length", 'a["1:2"]'],
            ["offset", `(\${y:1?2:3:4})`],
            ["offset", "1?2:3"],
            ["length", "4"],
            ["length", "`printf 2`"],
          ],
        );
      });

      test("nested parameter operators preserve each enclosing word boundary", () => {
        const actual = nodes(
          `: \${x:-\${y:0:1}:suffix} \${x:-\${y/a/b}/suffix} \${x/\${y:-a\\/b}/"\${z:-c}d"}\n`,
        );
        assert.deepEqual(
          actual
            .filter(({ field }) =>
              ["word", "pattern", "replacement"].includes(field),
            )
            .map(({ field, text }) => [field, text]),
          [
            ["word", `\${y:0:1}:suffix`],
            ["word", `\${y/a/b}/suffix`],
            ["pattern", "a"],
            ["replacement", "b"],
            ["pattern", `\${y:-a\\/b}`],
            ["word", "a\\/b"],
            ["replacement", `"\${z:-c}d"`],
            ["word", "c"],
          ],
        );
      });

      test("substring source preserves continued Unicode ranges around its separator", () => {
        const source = `: "\${x:(1?\${n:-2}:3)\\\n:\\\n\${y:-日\\\n本:5}}"\n`;
        const actual = nodes(source);
        assert.deepEqual(
          actual
            .filter(({ field }) => field === "offset" || field === "length")
            .map(({ field, text, start, end }) => [field, text, start, end]),
          [
            ["offset", `(1?\${n:-2}:3)\\\n`, 7, 22],
            ["length", `\${y:-日\\\n本:5}`, 25, 41],
          ],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "line_continuation")
            .map(({ start, end, text }) => [start, end, text]),
          [
            [20, 21, "\\"],
            [23, 24, "\\"],
            [33, 34, "\\"],
          ],
        );
        assert.equal(
          actual.find(({ type }) => type === "double_quote_text")?.text,
          "2",
        );
        assert.ok(
          actual.some(
            ({ type, text }) =>
              type === "double_quote_text" && text === "日\\\n本:5",
          ),
        );
      });

      test("array subscripts retain type-neutral source in both expansion contexts", () => {
        const actual = nodes(`echo \${a[x+y]} $((a[x+y]+1))\n`);
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "subscript_source")
            .map(({ text }) => text),
          ["x+y", "x+y"],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "arithmetic_binary_expression")
            .map(({ text }) => text),
          ["a[x+y]+1"],
        );
      });

      test("array and substring sources preserve Bash dollar quotes", () => {
        const actual = nodes(
          `a[$"key"]=x; echo "\${a[$"key"]}" \${x:$'1':$"2"}\n`,
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "locale_quoted")
            .map(({ text }) => text),
          ['$"key"', '$"key"', '$"2"'],
        );
        assert.deepEqual(
          actual
            .filter(({ field }) => field === "offset" || field === "length")
            .map(({ field, text }) => [field, text]),
          [
            ["offset", "$'1'"],
            ["length", '$"2"'],
          ],
        );
      });

      test("subscript parentheses distinguish unmatched source from arithmetic candidates", () => {
        const actual = nodes(
          `a[(]=x; a[)]+=y; declare -A a=([)(]=z); echo "\${a[(key)]}" $((a[(key)]+1))\n`,
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "subscript_text")
            .map(({ text }) => text),
          ["(", ")", ")", "("],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "parenthesized_arithmetic_candidate")
            .map(({ text }) => text),
          ["(key)", "(key)"],
        );
        assert.deepEqual(
          actual
            .filter(({ field }) => field === "subscript")
            .map(({ text }) => text),
          ["[(]", "[)]", "[)(]", "[(key)]", "[(key)]"],
        );
        assert.equal(
          actual.find(({ type }) => type === "arithmetic_binary_expression")
            ?.text,
          "a[(key)]+1",
        );
      });

      test("subscripts keep nested brackets quotes expansions and physical source ranges", () => {
        const source = `a[(日\\\n本[)]"("\${p}$(printf ")"))]=x\n`;
        const actual = nodes(source);
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "subscript_text")
            .map(({ text }) => text),
          ["日", "本", ")"],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) =>
              [
                "double_quoted",
                "parameter_expansion",
                "command_substitution",
              ].includes(type),
            )
            .map(({ type, text }) => [type, text]),
          [
            ["double_quoted", '"("'],
            ["parameter_expansion", `\${p}`],
            ["command_substitution", '$(printf ")")'],
            ["double_quoted", '")"'],
          ],
        );
        const subscript = actual.find(({ type }) => type === "array_subscript");
        assert.ok(subscript);
        assert.equal(subscript.start, 1);
        assert.equal(
          subscript.end,
          Buffer.byteLength(source.slice(0, source.indexOf("=x"))),
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "line_continuation")
            .map(({ text }) => text),
          ["\\"],
        );
      });

      test("nested substitutions and coprocess arguments retain unmatched subscript parentheses", () => {
        const actual = nodes(
          "a[$(coproc worker b[ ) ]=x c=(1))]=y; echo $(a[(]=x)\n",
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "assignment_word")
            .map(({ field, text }) => [field, text]),
          [
            ["assignment", "a[$(coproc worker b[ ) ]=x c=(1))]=y"],
            ["argument", "b[ ) ]=x"],
            ["argument", "c=(1)"],
            ["assignment", "a[(]=x"],
          ],
        );
      });

      test("arithmetic boundaries take precedence over crossing subscript spellings", () => {
        const actual = nodes(
          "echo $((a[(]+1))) $((a[)(]+1)); ((a[(]+1)); echo $((a[$((1+2))]+1))\n",
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "arithmetic_source_expression")
            .map(({ text }) => text),
          ["a[(]+1)"],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "command_substitution")
            .map(({ text }) => text),
          ["$((a[)(]+1))"],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "subshell")
            .map(({ text }) => text),
          ["(a[)(]+1)", "((a[(]+1))", "(a[(]+1)"],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "arithmetic_array_reference")
            .map(({ text }) => text),
          ["a[$((1+2))]"],
        );
        for (const source of [
          "echo $((a[(]+1))\n",
          "echo $((a[)]+1))\n",
          "((a[(((]+1))\n",
          "for ((i=a[(];;)); do :; done\n",
          "declare a[)]=x\n",
          "a[(=x\n",
        ])
          assert.equal(parser.parse(source, {}).status, 1, source);
      });

      for (const [pattern, expectedPattern, replacement] of [
        ["[a/]/X", "[a", "]/X"],
        ["[a\\/]/X", "[a\\/]", "X"],
        ['[a"/"]/X', '[a"/"]', "X"],
        [`[a\${p:-/}]/X`, `[a\${p:-/}]`, "X"],
        ["@(a/b)/X", "@(a", "b)/X"],
        ["@(a[)]b)/X", "@(a[)]b)", "X"],
        ["@(a[)/X", "@(a[)", "X"],
      ]) {
        test(`parameter replacement respects source boundaries in ${pattern}`, () => {
          const actual = nodes(`echo \${x/${pattern}}; echo next\n`);
          assert.deepEqual(
            actual
              .filter(
                ({ field }) => field === "pattern" || field === "replacement",
              )
              .map(({ field, text }) => [field, text]),
            [
              ["pattern", expectedPattern],
              ["replacement", replacement],
            ],
          );
        });
      }

      test("unterminated parameter extglobs remain source within their expansion", () => {
        const actual = nodes(
          `echo \${x#@(a} \${x:-@(b} \${x/a/@(c}; echo next\n`,
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "parameter_expansion")
            .map(({ text }) => text),
          [`\${x#@(a}`, `\${x:-@(b}`, `\${x/a/@(c}`],
        );
        assert.equal(
          actual.filter(({ type }) => type === "extglob_pattern").length,
          0,
        );
      });

      test("brace alternatives retain process substitutions across continuations", () => {
        const source = ": pre{日,<\\\n(printf 'x,}'),>(:)}post\n";
        const actual = nodes(source);
        assert.equal(
          actual.find(({ type }) => type === "brace_expansion")?.text,
          "{日,<\\\n(printf 'x,}'),>(:)}",
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "brace_alternative")
            .map(({ field, text }) => [field, text]),
          [
            ["alternative", "日"],
            ["alternative", "<\\\n(printf 'x,}')"],
            ["alternative", ">(:)"],
          ],
        );
        const continuation = Buffer.from(source).indexOf("\\");
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "line_continuation")
            .map(({ start, end, text }) => [start, end, text]),
          [[continuation, continuation + 1, "\\"]],
        );
      });

      test("process substitution contents do not complete surrounding brace candidates", () => {
        for (const source of [
          ": {<(printf 'a,b}')}\n",
          ": {<(:)},x\n",
          ": {a,<(:)\n",
          ": {a,<out}\n",
          ': "{a,<(:)}"\n',
        ]) {
          assert.ok(
            !nodes(source).some(({ type }) => type === "brace_expansion"),
            source,
          );
        }
      });

      test("brace separators split crossing bracket and extglob source", () => {
        const actual = nodes(
          ": {[a,b]} {[a,b],c} {@(a,b)} {@(a,b},c) @({a,b),c}\n",
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "brace_alternative")
            .map(({ text }) => text),
          [
            "[a",
            "b]",
            "[a",
            "b]",
            "c",
            "@(a",
            "b)",
            "@(a",
            "b",
            "a",
            "b)",
            "c",
          ],
        );
        assert.deepEqual(
          actual
            .filter(
              ({ type, field }) => type === "word" && field === "argument",
            )
            .map(({ text }) => text),
          ["{[a,b]}", "{[a,b],c}", "{@(a,b)}", "{@(a,b},c)", "@({a,b),c}"],
        );
        assert.ok(
          !actual.some(({ type }) =>
            ["pattern_bracket_source", "extglob_pattern"].includes(type),
          ),
        );
      });

      test("nested braces retain bracket member range endpoint and class fields", () => {
        const actual = nodes(
          ": [{a,b}] @({a,b}) [{a,b}-z] [a-{b,c}] [[:pre{upper,lower}post:]]\n",
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "brace_expansion")
            .map(({ field, text }) => [field, text]),
          [
            ["member", "{a,b}"],
            [undefined, "{a,b}"],
            ["start", "{a,b}"],
            ["end", "{b,c}"],
            ["content", "{upper,lower}"],
          ],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "pattern_bracket_range_source")
            .map(({ text }) => text),
          ["{a,b}-z", "a-{b,c}"],
        );
      });

      test("quotes escapes substitutions and nested braces protect their own separators", () => {
        const actual = nodes(
          ': {a,[b\\,c]} {a,@("b,c"|d)} {a,@($(printf x,y)|c)} {a,@({x,y}|z)}\n',
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "extglob_pattern")
            .map(({ text }) => text),
          ['@("b,c"|d)', "@($(printf x,y)|c)", "@({x,y}|z)"],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "pattern_bracket_source")
            .map(({ text }) => text),
          ["[b\\,c]"],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "brace_alternative")
            .map(({ text }) => text),
          [
            "a",
            "[b\\,c]",
            "a",
            '@("b,c"|d)',
            "a",
            "@($(printf x,y)|c)",
            "a",
            "@({x,y}|z)",
            "x",
            "y",
          ],
        );
      });

      test("brace source inside patterns respects the enclosing word mode", () => {
        const actual = nodes(
          `x=[{a,b}]; case @({a,b}) in [{a,b}]) :;; esac; [[ x == @({a,b}) ]]; : \${v/@({a,b\\})/x}\n`,
        );
        assert.ok(!actual.some(({ type }) => type === "brace_expansion"));
        assert.equal(
          actual.filter(({ type }) => type === "extglob_pattern").length,
          3,
        );
      });

      test("brace crossings flatten an extglob while balanced nested groups survive", () => {
        const actual = nodes(": @(({a,b),c}) @({(a,b},c)) @(({a,b}))\n");
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "extglob_pattern")
            .map(({ text }) => text),
          ["@(({a,b}))"],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "brace_expansion")
            .map(({ text }) => text),
          ["{a,b),c}", "{(a,b}", "{a,b}"],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "extglob_group")
            .map(({ text }) => text),
          ["({a,b})"],
        );
      });

      test("crossing extglobs inside bracket payloads retain brace ownership", () => {
        const actual = nodes(
          "a=([@({a,b),c}] [[:@({a,b),c}:]] [[.@({a,b),c}.]] [[=@({a,b),c}=]])\n",
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "brace_expansion")
            .map(({ field, text }) => [field, text]),
          [
            ["member", "{a,b),c}"],
            ["content", "{a,b),c}"],
            ["value", "{a,b),c}"],
            ["value", "{a,b),c}"],
          ],
        );
        assert.ok(!actual.some(({ type }) => type === "extglob_pattern"));
      });

      test("extglob literal runs preserve process substitutions and tilde payload slashes", () => {
        const actual = nodes(": @(a<(:)|b) ~@(a/b|c)/d {a,@(b<(:)|c)}\n");
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "process_substitution")
            .map(({ text }) => text),
          ["<(:)", "<(:)"],
        );
        assert.equal(
          actual.find(({ type }) => type === "tilde_expansion")?.text,
          "~@(a/b|c)",
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "extglob_pattern")
            .map(({ text }) => text),
          ["@(a<(:)|b)", "@(a/b|c)", "@(b<(:)|c)"],
        );
      });

      test("brace alternatives retain lexical word extents across pattern boundaries", () => {
        const actual = nodes(
          ": @({日,本 c}) {@(a,b},c) next; a=([{a,b c}]); a[b[c d] e] tail\n",
        );
        assert.deepEqual(
          actual.filter(({ type }) => type === "word").map(({ text }) => text),
          [
            ":",
            "@({日,本 c})",
            "{@(a,b},c)",
            "next",
            "[{a,b c}]",
            "a[b[c d] e]",
            "tail",
          ],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "brace_alternative")
            .map(({ text }) => text),
          ["日", "本 c", "@(a", "b", "a", "b c"],
        );
      });

      test("brace sequences expose endpoints and increments without evaluation", () => {
        const actual = nodes("echo pre{01..09..2}post {x} {1..x}\n");
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "brace_expansion")
            .map(({ text }) => text),
          ["{01..09..2}"],
        );
        assert.deepEqual(
          actual
            .filter(
              ({ type }) =>
                type === "brace_endpoint" || type === "brace_increment",
            )
            .map(({ field, text }) => [field, text]),
          [
            ["start", "01"],
            ["end", "09"],
            ["increment", "2"],
          ],
        );
      });

      test("quoted pattern spelling and parameter values remain literal", () => {
        const actual = nodes(
          `echo "@(a|b)" "{a,b}" "\${x:-@(a|b)}" "\${x:-<(echo hi)}"\n`,
        );
        assert.equal(
          actual.filter(({ type }) =>
            [
              "extglob_pattern",
              "brace_expansion",
              "process_substitution",
            ].includes(type),
          ).length,
          0,
        );
      });

      test("tilde classification includes assignment-shaped arguments", () => {
        const actual = nodes("echo a=~:~/bin ~-2 literal:~\n");
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "tilde_expansion")
            .map(({ text }) => text),
          ["~", "~", "~-2"],
        );
        assert.equal(
          actual.filter(({ type }) => type === "assignment_word").length,
          0,
        );
      });

      test("extglob lexical boundaries reject a bracket-hidden closing parenthesis", () => {
        const result = parser.parse("echo @([)])\n", {});
        assert.equal(result.status, 1);
      });

      test("case selectors and patterns retain literal brace spelling", () => {
        const actual = nodes("case {a,b} in {a,b}|@(x|y)) echo {c,d};; esac\n");
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "brace_expansion")
            .map(({ text }) => text),
          ["{c,d}"],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "extglob_pattern")
            .map(({ text }) => text),
          ["@(x|y)"],
        );
      });

      test("append assignments retain the same tilde boundary as equals", () => {
        const actual = nodes("x+=~ a[0]+=~user\n");
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "tilde_expansion")
            .map(({ text }) => text),
          ["~", "~user"],
        );
      });

      test("ERE hierarchy owns static repetition, intervals and code point leaves", () => {
        const actual = nodes("[[ x =~ ^(ab|cd)+[[:digit:]a-z]{2,4}?日.$ ]]\n");
        const texts = (type) =>
          actual.filter((node) => node.type === type).map(({ text }) => text);
        assert.deepEqual(texts("ordinary_character"), [
          "a",
          "b",
          "c",
          "d",
          "日",
        ]);
        assert.deepEqual(texts("ere_dupl_symbol"), ["+", "{2,4}?"]);
        assert.deepEqual(texts("repetition_modifier"), ["?"]);
        assert.deepEqual(texts("class_name"), ["digit"]);
        assert.deepEqual(texts("range_expression"), ["a-z"]);
        assert.deepEqual(texts("ere_expression"), [
          "^",
          "(ab|cd)+",
          "a",
          "b",
          "c",
          "d",
          "[[:digit:]a-z]{2,4}?",
          "日",
          ".",
          "$",
        ]);
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "duplication_count")
            .map(({ field, text }) => [field, text]),
          [
            ["minimum", "2"],
            ["maximum", "4"],
          ],
        );
        assert.deepEqual(
          actual
            .filter(({ field }) => field === "operand")
            .map(({ text }) => text),
          [],
        );
      });

      test("opaque ERE source and following repetitions are not single atoms", () => {
        const source = `[[ x =~ "ab"+\${part}+\\.+ ]]\n`;
        const actual = nodes(source);
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "regex_source_expression")
            .map(({ text }) => text),
          [`"ab"+\${part}+\\.+`],
        );
        assert.equal(
          actual.filter(({ field }) => field === "operand").length,
          0,
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "ere_dupl_symbol")
            .map(({ text }) => text),
          ["+", "+", "+"],
        );
        assert.equal(
          actual.find(({ type }) => type === "escaped_character")?.text,
          "\\.",
        );
      });

      test("ERE groups, brackets and interval payloads retain embedded Bash source", () => {
        const actual = nodes(`[[ x =~ (a|\${part})+[a-z\${part}]{\${n}} ]]\n`);
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "ere_expression")
            .map(({ text }) => text),
          [`(a|\${part})+`, "a", `[a-z\${part}]{\${n}}`],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "range_expression")
            .map(({ text }) => text),
          ["a-z"],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "parameter_expansion")
            .map(({ text }) => text),
          [`\${part}`, `\${part}`, `\${n}`],
        );
        assert.deepEqual(
          actual
            .filter(({ field }) => field === "minimum")
            .map(({ type, text }) => [type, text]),
          [["regex_source_expression", `\${n}`]],
        );
        assert.equal(
          actual.filter(({ type }) => type === "duplication_count").length,
          0,
        );
      });

      test("ERE delimiter probes preserve process substitution payloads", () => {
        const actual = nodes(
          '[[ x =~ [a<(printf "]")][[.b>((printf c)).]]{<(printf 1)} ]]\n',
        );
        const texts = (type) =>
          actual.filter((node) => node.type === type).map(({ text }) => text);
        assert.deepEqual(texts("bracket_expression"), [
          '[a<(printf "]")]',
          "[[.b>((printf c)).]]",
        ]);
        assert.deepEqual(texts("collating_symbol"), ["[.b>((printf c)).]"]);
        assert.deepEqual(texts("ere_dupl_symbol"), ["{<(printf 1)}"]);
        assert.deepEqual(texts("process_substitution"), [
          '<(printf "]")',
          ">((printf c))",
          "<(printf 1)",
        ]);
        assert.deepEqual(texts("regex_source_fragment"), []);
      });

      test("ERE ordinary characters retain individual UTF-8 source ranges", () => {
        const actual = nodes("[[ x =~ 日本🙂日 ]]\n");
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "ordinary_character")
            .map(({ start, end, text }) => [start, end, text]),
          [
            [8, 11, "日"],
            [11, 14, "本"],
            [14, 18, "🙂"],
            [18, 21, "日"],
          ],
        );
      });

      test("ERE line continuations retain count, class name and delimiter ranges", () => {
        const actual = nodes("[[ x =~ [[:di\\\ngit:]]{1\\\n2,3}?\\\n$ ]]\n");
        assert.equal(
          actual.find(({ type }) => type === "class_name")?.text,
          "di\\\ngit",
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "duplication_count")
            .map(({ text }) => text),
          ["1\\\n2", "3"],
        );
        assert.equal(
          actual.filter(({ type }) => type === "line_continuation").length,
          3,
        );
        assert.ok(
          actual
            .filter(({ type }) => type === "line_continuation")
            .every(({ text }) => text === "\\"),
        );
      });

      for (const [name, pattern] of [
        ["unclosed bracket", "[a-z"],
        ["unclosed interval", "a{2"],
        ["empty alternative", "a|"],
        ["adjacent alternatives", "a||b"],
        ["shared range endpoint", "[a-c-e]"],
        ["class as range endpoint", "[[:alpha:]-z]"],
        ["bracket ending a lexical group", "([a)]b"],
        ["bracket starting a lexical group", "[a(]b)"],
        ["empty collating symbol", "[[..]]"],
        ["empty character class", "[[:]]"],
      ]) {
        test(`ERE ${name} stays shell source and ends before the next command`, () => {
          const actual = nodes(`[[ x =~ ${pattern} ]]; echo next\n`);
          assert.equal(
            actual.find(({ type }) => type === "regex_operand")?.text,
            pattern,
          );
          assert.deepEqual(
            actual
              .filter(({ type, field }) => type === "word" && field === "name")
              .map(({ text }) => text),
            ["echo"],
          );
        });
      }

      test("ERE groups remain structured immediately after opaque source", () => {
        const actual = nodes(`[[ x =~ "\${p}"(a|b)+\${q}(c) ]]\n`);
        assert.equal(
          actual.filter(({ field }) => field === "operand").length,
          0,
        );
        assert.deepEqual(
          actual
            .filter(
              ({ type, text }) =>
                type === "ere_expression" && text.startsWith("("),
            )
            .map(({ text }) => text),
          ["(a|b)+", "(c)"],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "ordinary_character")
            .map(({ text }) => text),
          ["a", "b", "c"],
        );
      });

      for (const endpoint of [
        `\${p}`,
        '"z"',
        "'z'",
        "\\z",
        "$(echo z)",
        "<(echo z)",
        "$'z'",
        '$"z"',
      ]) {
        test(`ERE range boundaries retain ${endpoint} without inventing a collating element`, () => {
          const actual = nodes(`[[ s =~ [a-${endpoint}b-c] ]]; echo next\n`);
          assert.deepEqual(
            actual
              .filter(({ type }) => type === "range_expression")
              .map(({ text }) => text),
            ["b-c"],
          );
          assert.deepEqual(
            actual
              .filter(({ type }) => type === "regex_source_fragment")
              .map(({ text }) => text),
            ["-"],
          );
          assert.equal(
            actual.find(({ type }) => type === "bracket_expression")?.text,
            `[a-${endpoint}b-c]`,
          );
          assert.ok(
            actual.some(
              ({ field, text }) => field === "name" && text === "echo",
            ),
          );
        });
      }

      for (const [name, pattern, singles, multiples, meta, fragments] of [
        [
          "Unicode payloads count code points",
          "[[.é.][=日=][.é日.]]",
          ["é", "日"],
          ["é日"],
          [],
          [],
        ],
        [
          "collating meta characters retain their classification",
          "[[.-.][.].][.^.]]",
          ["^"],
          [],
          ["-", "]"],
          [],
        ],
        [
          "equivalence meta characters remain unclassified source",
          "[[=-=][=]=]]",
          [],
          [],
          [],
          ["-", "]"],
        ],
        [
          "nonmatching compound terminators remain payload",
          "[[.=].][=.]=]]",
          [],
          ["=]", ".]"],
          [],
          [],
        ],
      ]) {
        test(`ERE ${name}`, () => {
          const actual = nodes(`[[ x =~ ${pattern} ]]; echo next\n`);
          const texts = (type) =>
            actual.filter((node) => node.type === type).map(({ text }) => text);
          assert.deepEqual(texts("collating_element_single"), singles);
          assert.deepEqual(texts("collating_element_multi"), multiples);
          assert.deepEqual(texts("meta_character"), meta);
          assert.deepEqual(texts("regex_source_fragment"), fragments);
          assert.deepEqual(
            actual
              .filter(({ field, type }) => field === "name" && type === "word")
              .map(({ text }) => text),
            ["echo"],
          );
        });
      }

      for (const entry of [
        {
          name: "a setting command disables extglob without changing parse conditions",
          seed: "shopt -s extglob\n: @(a|b)\n",
          remove: "-s",
          insert: "-u",
          valid: true,
        },
        {
          name: "a setting command disables extquote without changing quote boundaries",
          seed: `shopt -s extquote\n: "\${x:-$'}'}"\n`,
          remove: "-s",
          insert: "-u",
          valid: true,
        },
        {
          name: "a quoted pattern parameter gains an array subscript",
          seed: `: {a,"\${x#'"'}"}\n`,
          remove: "${x#",
          insert: "${x[0]#",
          valid: true,
        },
        {
          name: "a quoted parameter changes pattern removal to replacement",
          seed: `: {a,"\${x#'"'}"}\n`,
          remove: "${x#",
          insert: "${x/y/",
          valid: true,
        },
        {
          name: "a conditional regex group gains conditional closing characters",
          seed: `: {a,\${ [[ x =~ (a|b) ]]; }}\n`,
          remove: "a|b",
          insert: "]]|}",
          valid: true,
        },
        {
          name: "a group inside a braced substitution gains timing",
          seed: `: {a,\${ { :; }; }}\n`,
          remove: "${ {",
          insert: "${ time {",
          valid: true,
        },
        {
          name: "an extglob gains a literal hash in a brace substitution",
          seed: ": {a,$(: @(a|b))}\n",
          remove: "a|b",
          insert: "a|#",
          valid: true,
        },
        {
          name: "a process substitution argument changes direction inside a brace",
          seed: ": {a,$(: <(:) case)}\n",
          remove: "<(",
          insert: ">(",
          valid: true,
        },
        {
          name: "an arithmetic shift followed by a newline preserves the enclosing brace",
          seed: ": {a,$( ((1 << 2)); : )}\n",
          remove: "; ",
          insert: "\n",
          valid: true,
        },
        {
          name: "a nested extglob gains a brace within a previously brace-free word",
          seed: ": @(@(x)|y)\n",
          remove: "x",
          insert: "{a,b}",
          valid: true,
        },
        {
          name: "an escaped bracket comma becomes a brace separator",
          seed: ": {a,[日\\,本]}\n",
          remove: "\\,",
          insert: ",",
          valid: true,
        },
        {
          name: "an extglob crossing a brace gains a protected comma",
          seed: ": {@(a,b)} tail\n",
          remove: ",",
          insert: "\\,",
          valid: true,
        },
        {
          name: "a brace crossing an extglob becomes nested",
          seed: ": @({a,b),c}\n",
          remove: "),c}",
          insert: ",c})",
          valid: true,
        },
        {
          name: "a nested brace loses its closing delimiter",
          seed: ": [{a,b}]\n",
          remove: "}",
          insert: "",
          valid: true,
        },
        {
          name: "a brace within an extglob gains a continued opener",
          seed: ": @({日,本 c})\n",
          remove: "@(",
          insert: "@\\\n(",
          valid: true,
        },
        {
          name: "a brace within an array word retains a control character",
          seed: "a=([{a,b c}])\n",
          remove: "b c",
          insert: "b|c",
          valid: true,
        },
        {
          name: "an extglob around a brace loses its lexical close",
          seed: ": @({a,b c})\n",
          remove: ")",
          insert: "",
          valid: false,
        },
        {
          name: "a brace alternative process substitution changes direction",
          seed: ": {a,<(printf 日)}\n",
          remove: "<",
          insert: ">",
          valid: true,
        },
        {
          name: "a brace close is lost after a complete process substitution",
          seed: ": pre{a,>(:)}post\n",
          remove: "}",
          insert: "",
          valid: true,
        },
        {
          name: "a brace alternative process substitution gains a continued opener",
          seed: ": {a,<(printf x)}\n",
          remove: "<(",
          insert: "<\\\n(",
          valid: true,
        },
        {
          name: "a brace alternative process substitution loses its close",
          seed: ": {a,<(printf x)}\n",
          remove: ")}",
          insert: "}",
          valid: false,
        },
        {
          name: "an arithmetic single quote becomes ANSI-C quoting",
          seed: "echo $(( '1' ))\n",
          remove: "'1'",
          insert: "$'1'",
          valid: true,
        },
        {
          name: "an arithmetic double quote becomes locale quoting",
          seed: '(( "1" )); echo after\n',
          remove: '"1"',
          insert: '$"1"',
          valid: true,
        },
        {
          name: "an arithmetic ANSI-C escaped quote is lost then repaired",
          seed: "echo $(( $'a\\'b' ))\n",
          remove: "\\'",
          insert: "'",
          valid: false,
        },
        {
          name: "an arithmetic quote prefix gains a physical continuation",
          seed: "echo $(( $'日' ))\n",
          remove: "$'",
          insert: "$\\\n'",
          valid: true,
        },
        {
          name: "an arithmetic quote prefix gains separating whitespace",
          seed: "echo $(( $'1' ))\n",
          remove: "$'",
          insert: "$\n'",
          valid: true,
        },
        {
          name: "a parameter subscript gains unmatched parentheses around expansion",
          seed: `echo \${a[key]}\n`,
          remove: "key",
          insert: `)\${p}(`,
          valid: true,
        },
        {
          name: "an arithmetic array reference becomes a command substitution",
          seed: "echo $((a[()]+1))\n",
          remove: "()",
          insert: ")(",
          valid: true,
        },
        {
          name: "a subshell becomes arithmetic source with a crossing bracket",
          seed: "((a[(]+1))\n",
          remove: "+1))",
          insert: "+1)))",
          valid: true,
        },
        {
          name: "an arithmetic subscript loses a required lexical parenthesis",
          seed: "echo $((a[(key)]+1))\n",
          remove: "key)",
          insert: "key",
          valid: false,
        },
        {
          name: "ERE range endpoint becomes a parameter expansion",
          seed: "[[ x =~ [a-zb-c] ]]\n",
          remove: "z",
          insert: `\${p}`,
          valid: true,
        },
        {
          name: "ERE range endpoint becomes a quoted word",
          seed: "[[ x =~ [a-zb-c] ]]\n",
          remove: "z",
          insert: '"z"',
          valid: true,
        },
        {
          name: "ERE bracket member becomes a process substitution",
          seed: "[[ x =~ [ab]{2} ]]\n",
          remove: "b",
          insert: '<(printf "]")',
          valid: true,
        },
        {
          name: "ERE interval payload becomes a process substitution",
          seed: "[[ x =~ a{2} ]]\n",
          remove: "2",
          insert: "<(printf 2)",
          valid: true,
        },
        {
          name: "ERE quote replaces a static repetition operand",
          seed: "[[ x =~ ab+ ]]\n",
          remove: "ab",
          insert: '"ab"',
          valid: true,
        },
        {
          name: "ERE expansion splits a static branch",
          seed: "[[ x =~ ^ab[[:digit:]]+$ ]]\n",
          remove: "ab",
          insert: `a\${p}b`,
          valid: true,
        },
        {
          name: "ERE bracket close becomes valid shell source",
          seed: "[[ x =~ [a-z] ]]\n",
          remove: "z]",
          insert: "z",
          valid: true,
        },
        {
          name: "ERE interval count becomes opaque",
          seed: "[[ x =~ a{2,4} ]]\n",
          remove: "2",
          insert: `\${n}`,
          valid: true,
        },
        {
          name: "ERE interval close is removed and restored",
          seed: "[[ x =~ a{2,4} ]]\n",
          remove: "4}",
          insert: "4",
          valid: true,
        },
        {
          name: "ERE alternation loses a branch",
          seed: "[[ x =~ (a|b) ]]\n",
          remove: "|b",
          insert: "|",
          valid: true,
        },
        {
          name: "ERE range changes to a shared endpoint source",
          seed: "[[ x =~ [a-c] ]]\n",
          remove: "a-c",
          insert: "a-c-e",
          valid: true,
        },
        {
          name: "ERE bracket gains a lexical parenthesis pair",
          seed: "[[ x =~ [ab] ]]\n",
          remove: "ab",
          insert: "()",
          valid: true,
        },
        {
          name: "ERE parenthesis crosses a bracket boundary",
          seed: "[[ x =~ (ab) ]]\n",
          remove: "ab",
          insert: "[a)]b(",
          valid: true,
        },
        {
          name: "ERE class name gains a continuation",
          seed: "[[ x =~ [[:digit:]] ]]\n",
          remove: "digit",
          insert: "di\\\ngit",
          valid: true,
        },
        {
          name: "ERE source quote close is repaired",
          seed: '[[ x =~ "ab"+ ]]\n',
          remove: 'ab"',
          insert: "ab",
          valid: false,
        },
        {
          name: "ERE opaque command substitution is repaired",
          seed: "[[ x =~ ^$(printf a)$ ]]\n",
          remove: "a)",
          insert: "a",
          valid: false,
        },
        {
          name: "ERE switches nested condition operands",
          seed: "[[ x =~ $( [[ y =~ (a|b) ]] ) ]]\n",
          remove: "a|b",
          insert: "[a-z]",
          valid: true,
        },
        {
          name: "ERE group keeps closing bracket spelling within its operand",
          seed: "[[ x =~ ]](a) ]]\n",
          remove: "]](a)",
          insert: "]]|a",
          valid: true,
        },
        {
          name: "conditional regex close is repaired",
          seed: "[[ x =~ (a|b) ]]\n",
          remove: ")",
          insert: "",
          valid: false,
        },
        {
          name: "locale quotation becomes ordinary quotation",
          seed: 'echo $"hello $name"\n',
          remove: '$"',
          insert: '"',
          valid: true,
        },
        {
          name: "ANSI-C Unicode escape loses closing quote",
          seed: "echo $'\\u3042'\n",
          remove: "3042'",
          insert: "3042",
          valid: false,
        },
        {
          name: "brace alternatives become literal source",
          seed: "echo {a,b}\n",
          remove: ",",
          insert: "-",
          valid: true,
        },
        {
          name: "brace sequence becomes mixed endpoint literal",
          seed: "echo {1..3}\n",
          remove: "3",
          insert: "x",
          valid: true,
        },
        {
          name: "brace sequence increment changes",
          seed: "echo {1..9..2}\n",
          remove: "2",
          insert: "3",
          valid: true,
        },
        {
          name: "nested brace close is removed and repaired",
          seed: "echo {a,{b,c}}\n",
          remove: "c}}",
          insert: "c}",
          valid: true,
        },
        {
          name: "extglob operator changes",
          seed: "echo @(a|+(b|c))\n",
          remove: "@",
          insert: "!",
          valid: true,
        },
        {
          name: "extglob alternative separator is quoted",
          seed: "echo @(a|b)\n",
          remove: "|",
          insert: "\\|",
          valid: true,
        },
        {
          name: "extglob close is lost and repaired",
          seed: "echo @(a|b)\n",
          remove: ")",
          insert: "",
          valid: false,
        },
        {
          name: "plain group inside extglob is edited",
          seed: "echo @(a(b|c))\n",
          remove: "b",
          insert: "d",
          valid: true,
        },
        {
          name: "process substitution direction changes",
          seed: "cat <(echo hi)\n",
          remove: "<",
          insert: ">",
          valid: true,
        },
        {
          name: "process substitution loses its close",
          seed: "cat <(echo hi)\n",
          remove: ")",
          insert: "",
          valid: false,
        },
        {
          name: "current shell substitution becomes reply substitution",
          seed: `echo \${ printf hi; }\n`,
          remove: `\${ `,
          insert: `\${| `,
          valid: true,
        },
        {
          name: "current shell substitution becomes a parameter",
          seed: `echo \${ printf hi; }\n`,
          remove: " printf hi; ",
          insert: "value",
          valid: true,
        },
        {
          name: "current shell substitution loses its terminator",
          seed: `echo \${ printf hi; }\n`,
          remove: ";",
          insert: "",
          valid: false,
        },
        {
          name: "empty current shell substitution gains a command",
          seed: `echo \${ }\n`,
          remove: `\${ }`,
          insert: `\${ printf hi; }`,
          valid: true,
        },
        {
          name: "indirection becomes a direct parameter",
          seed: `echo \${!value}\n`,
          remove: "!",
          insert: "",
          valid: true,
        },
        {
          name: "substring offset changes from structured arithmetic to source",
          seed: `: "\${s: (n > 0 ? 1 : 0):2}"\n`,
          remove: ">",
          insert: " ",
          valid: true,
        },
        {
          name: "substring incomplete number becomes a structured hexadecimal operand",
          seed: `: \${s:0x:2+3}\n`,
          remove: "0x",
          insert: "0x1",
          valid: true,
        },
        {
          name: "substring length gains a source operand beside a complete group",
          seed: `: \${s:1:(a+2)*3}\n`,
          remove: "*",
          insert: " ",
          valid: true,
        },
        {
          name: "substring becomes a default-value expansion",
          seed: `echo \${x:2}\n`,
          remove: ":2",
          insert: ":-2",
          valid: true,
        },
        {
          name: "substring conditional colon becomes its field separator",
          seed: `: "\${x:1?\${n:-2}:3:4}"\n`,
          remove: "1?",
          insert: "1+",
          valid: true,
        },
        {
          name: "substring group loses its close while retaining source",
          seed: `: \${x:(1?2):3}\n`,
          remove: ")",
          insert: "",
          valid: true,
        },
        {
          name: "substring subscript loses quotes protecting its colon",
          seed: `: \${x:a["1:2"]:3}\n`,
          remove: '"1:2"',
          insert: "1:2",
          valid: true,
        },
        {
          name: "nested replacement loses its enclosing close",
          seed: `: \${x/\${y:-a\\/b}/"\${z:-c}d"}; : after\n`,
          remove: 'd"}',
          insert: 'd"',
          valid: false,
        },
        {
          name: "nested substring changes to a replacement inside a default word",
          seed: `: \${x:-\${y:1:2}:suffix}\n`,
          remove: "y:1:2",
          insert: "y/a/b",
          valid: true,
        },
        {
          name: "backquote substring length gains another source colon",
          seed: `: \`printf '%s' \${x:1?2:3:4}\`\n`,
          remove: ":4}",
          insert: ":4:5}",
          valid: true,
        },
        {
          name: "replacement switches between first and all matches",
          seed: `echo \${x/a/b}\n`,
          remove: "x/",
          insert: "x//",
          valid: true,
        },
        {
          name: "replacement pattern gains an escaped slash",
          seed: `echo \${x//a/b}\n`,
          remove: "a/b",
          insert: "a\\/c/b",
          valid: true,
        },
        {
          name: "parameter transform changes",
          seed: `echo \${x@Q}\n`,
          remove: "Q",
          insert: "U",
          valid: true,
        },
        {
          name: "array subscript quote changes",
          seed: `echo \${a["x+y"]}\n`,
          remove: '"x+y"',
          insert: "x+y",
          valid: true,
        },
        {
          name: "array subscript loses its close",
          seed: `echo \${a[x+y]}\n`,
          remove: "]",
          insert: "",
          valid: false,
        },
        {
          name: "arithmetic multiplication becomes exponentiation",
          seed: "echo $((2*3+1))\n",
          remove: "2*3",
          insert: "2**3",
          valid: true,
        },
        {
          name: "arithmetic update changes from prefix to postfix",
          seed: "echo $((++a+1))\n",
          remove: "++a",
          insert: "a++",
          valid: true,
        },
        {
          name: "base constant becomes an evaluation error",
          seed: "echo $((2#10+1))\n",
          remove: "2#10",
          insert: "2#20",
          valid: true,
        },
        {
          name: "arithmetic array subscript gains substitution",
          seed: "echo $((a[x]+1))\n",
          remove: "[x]",
          insert: "[$(echo 1)]",
          valid: true,
        },
        {
          name: "assignment argument loses tilde position",
          seed: "echo a=~:~/bin\n",
          remove: "a=",
          insert: "a-",
          valid: true,
        },
        {
          name: "structured arithmetic becomes source fragments",
          seed: "echo $((1+2))\n",
          remove: "1+2",
          insert: "0x$y",
          valid: true,
        },
        {
          name: "an assignment operator switches between structured and source arithmetic",
          seed: "echo $((x<<\\\n=1))\n",
          remove: "x",
          insert: "0x$y",
          valid: true,
        },
        {
          name: "arithmetic becomes a subshell substitution",
          seed: "echo $((printf hi))\n",
          remove: "hi)",
          insert: "hi);:",
          valid: true,
        },
        {
          name: "arithmetic closing parenthesis is lost then repaired",
          seed: "echo $((1+2))\n",
          remove: "))",
          insert: ")",
          valid: false,
        },
        {
          name: "arithmetic evaluation error retains expansion",
          seed: "echo $((x=1))\n",
          remove: "x=1",
          insert: "(x)=1",
          valid: true,
        },
        {
          name: "double quote is lost then repaired",
          seed: 'echo "hello $x"\n',
          remove: '"hello',
          insert: "hello",
          valid: false,
        },
        {
          name: "parameter brace is lost then repaired",
          seed: `echo \${x:-yes}\n`,
          remove: "}",
          insert: "",
          valid: false,
        },
        {
          name: "substitution closing parenthesis is lost then repaired",
          seed: "echo $(printf ok)\n",
          remove: ")",
          insert: "",
          valid: false,
        },
        {
          name: "backquote is lost then repaired",
          seed: "echo `printf ok`\n",
          remove: "ok`",
          insert: "ok",
          valid: false,
        },
        {
          name: "word gains a line continuation",
          seed: "echo hello\n",
          remove: "echo",
          insert: "ec\\\nho",
          valid: true,
        },
        {
          name: "bracket range grows without sharing endpoints",
          seed: "echo [a-c]\n",
          remove: "a-c",
          insert: "a-c-e",
          valid: true,
        },
      ]) {
        test(entry.name, () => assertEditRoundTrip(parser, entry));
      }
    }

    test("parameter closing braces are not protected by an unquoted subscript", () => {
      for (const source of [
        `: \${x[}]}\n`,
        `: "\${x[}]}"\n`,
        `: {a,"\${x[}]#'"'}"}\n`,
      ]) {
        assert.equal(parser.parse(source, {}).status, 1, source);
        const repair = {
          byte: source.indexOf("[}") + 1,
          deleteBytes: 0,
          insert: "\\",
        };
        const fresh = parser.parse(applyEdit(source, repair), {});
        assert.equal(fresh.status, 0, fresh.output);
        assert.equal(
          parser.parse(source, { edits: [repair] }).tree,
          fresh.tree,
        );
      }
      for (const subscript of [
        "' } '",
        '"}"',
        "\\}",
        "$(printf '}')",
        `\${y:-'}'}`,
        "a['}']",
      ]) {
        const source = `: "\${x[${subscript}]}"\n`;
        assert.equal(parser.parse(source, {}).status, 0, source);
      }
    });

    test("name enumeration retains arbitrary prefix source without classifying it as a variable", () => {
      for (const prefix of [
        "x",
        "x.y",
        ".x",
        "x y",
        "x[",
        "x[@]",
        "x\\ y",
        "x' y'",
        `x\${y}`,
        "x$(printf x)",
        "x$((1+2))",
        "x' } '",
        'x" } "',
        "x`printf x`",
        "x\\}",
        "x\\\ny",
      ]) {
        for (const operator of ["@", "*"]) {
          const source = `: \${!${prefix}${operator}} "\${!${prefix}${operator}}"\n`;
          const nodes = parseNodes(parser, source);
          assert.deepEqual(
            nodes
              .filter(({ type }) => type === "parameter_name_prefix")
              .map(({ field, text }) => [field, text]),
            [
              ["prefix", prefix],
              ["prefix", prefix],
            ],
          );
          assert.deepEqual(
            nodes
              .filter(({ type }) => type === "parameter_names_operator")
              .map(({ text }) => text),
            [operator, operator],
          );
          const edit = {
            byte: source.indexOf(prefix),
            deleteBytes: 1,
            insert: "z",
          };
          const fresh = parser.parse(applyEdit(source, edit), {});
          assert.equal(
            parser.parse(source, { edits: [edit] }).tree,
            fresh.tree,
          );
        }
      }
      const nodes = parseNodes(
        parser,
        `: \${!x} \${!x[@]} \${!x:-y@} \${!x#y*} \${!@}\n`,
      );
      assert.equal(
        nodes.filter(({ type }) => type === "parameter_name_prefix").length,
        0,
      );
      for (const prefix of ["x", "x.y", "x[0]"]) {
        const source = `: \${!${prefix}@}\n`;
        const original = parser.parse(source, {});
        const remove = {
          byte: source.indexOf("@"),
          deleteBytes: 1,
          insert: "",
        };
        const fresh = parser.parse(applyEdit(source, remove), {});
        const edited = parser.parse(source, { edits: [remove] });
        if (fresh.status === 0) assert.equal(edited.tree, fresh.tree);
        const restore = { ...remove, deleteBytes: 0, insert: "@" };
        assert.equal(
          parser.parse(source, { edits: [remove, restore] }).tree,
          original.tree,
        );
      }
    });

    test("dollar-prefixed extglobs retain lexical patterns in word contexts", () => {
      for (const operator of ["@", "?", "*", "!", "+"]) {
        const pattern = `${operator}(a|b)`;
        for (const [name, source, enabled] of [
          ["argument", `: $${pattern}\n`, extglob],
          ["assignment", `v=$${pattern}\n`, extglob],
          ["case selector", `case $${pattern} in a) :;; esac\n`, extglob],
          ["case pattern", `case a in $${pattern}) :;; esac\n`, extglob],
          ["delimiter", `cat <<$${pattern}\nbody\n$${pattern}\n`, extglob],
          ["nested command", `: $(: $${pattern})\n`, extglob],
          ["nested pattern", `: @(c|$${pattern})\n`, extglob],
          ["brace alternative", `: {x,$${pattern}}\n`, extglob],
          ["conditional pattern", `[[ a == $${pattern} ]]\n`, true],
          ["conditional nested command", `[[ a == $(: $${pattern}) ]]\n`, true],
          ["parameter value", `: \${v:-$${pattern}}\n`, true],
          ["parameter pattern", `: \${v#$${pattern}}\n`, true],
        ]) {
          const result = parser.parse(source, {});
          assert.equal(
            result.status,
            enabled ? 0 : 1,
            `${name}\n${result.output}`,
          );
          if (!enabled) continue;
          const nodes = parseNodes(parser, source);
          assert.ok(
            nodes.some(
              (node) =>
                node.type === "extglob_pattern" && node.text === pattern,
            ),
            name,
          );
          assert.ok(
            nodes.some((node) => node.type === "literal" && node.text === "$"),
            name,
          );
          assert.equal(
            nodes.some((node) => node.type === "special_parameter"),
            false,
            name,
          );
        }
      }
      for (const source of [': "$@(a|b)"\n', ': "$?(a|b)"\n']) {
        const nodes = parseNodes(parser, source);
        assert.equal(
          nodes.some((node) => node.type === "extglob_pattern"),
          false,
        );
        assert.equal(
          nodes.filter((node) => node.type === "special_parameter").length,
          1,
        );
      }
      const escaped = parseNodes(parser, ": $\\@\\(a\\)\n");
      assert.equal(
        escaped.some((node) => node.type === "extglob_pattern"),
        false,
      );
      assert.equal(
        escaped.some((node) => node.type === "special_parameter"),
        false,
      );
    });

    test("editing a dollar-prefixed extglob switches to command substitution and back", () => {
      const source = extglob ? ": $@(a|b)\n" : "[[ a == $@(a|b) ]]\n";
      const options = { arguments: ["-c"] };
      const remove = { byte: source.indexOf("@"), deleteBytes: 1, insert: "" };
      const restore = { byte: remove.byte, deleteBytes: 0, insert: "@" };
      const original = parser.parse(source, options);
      const fresh = parser.parse(applyEdit(source, remove), options);
      const incremental = parser.parse(source, { ...options, edits: [remove] });
      assert.equal(original.status, 0, original.output);
      assert.equal(fresh.status, 0, fresh.output);
      assert.equal(incremental.status, 0, incremental.output);
      assert.equal(incremental.tree, fresh.tree);
      const repaired = parser.parse(source, {
        ...options,
        edits: [remove, restore],
      });
      assert.equal(repaired.status, 0, repaired.output);
      assert.equal(repaired.tree, original.tree);
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
