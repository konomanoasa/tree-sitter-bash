import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { grammars } from "../scripts/tree-sitter.js";
import { cstFingerprint, sourceNodes } from "./support/cst.js";
import {
  applyEdit,
  assertEditRoundTrip,
  createParser,
  parseNodes,
} from "./support/parser.js";

for (const grammar of grammars) {
  describe(grammar.name, () => {
    let parser;
    before(() => {
      parser = createParser(grammar);
    });
    after(() => {
      parser?.close();
    });
    const extglob = grammar.name === "bash_extglob";
    const nodes = (source) => parseNodes(parser, source);
    test("syntax list edits preserve owners through empty single and multiple elements", () => {
      for (const [seed, remove, insert] of [
        ["for x in a b; do :; done\n", "a b", ""],
        ["select x in a; do :; done\n", "a;", ";"],
        ["case x in a);; b);; esac\n", "b);;", "b)"],
        ["case x in a);; esac\n", "a);; ", ""],
        ["case x in a) esac\n", "a)", "a);; b)"],
        ["{ :; } >a 2>b\n", ">a 2>b", ""],
        ["f() { :; } >a\n", ">a", ">a 2>b"],
        ["coproc worker { :; } >a 2>b\n", "2>b", ""],
      ]) {
        assertEditRoundTrip(parser, { seed, remove, insert, valid: true });
      }
    });
    test("eval and let argument boundaries survive edits and repair", () => {
      for (const [seed, remove, insert, valid] of [
        ["eval a=(one two) tail\n", "eval", "let", true],
        ["let n=(1 + 2)\n", "let", "eval", true],
        ["eval a=(one)\n", "eval", '"eval"', false],
        ["let a=(one)\n", "let", "builtin let", false],
        ["eval a=(one)\n", "eval", "command eval", false],
        ["eval a=(one)\n", "eval", "ev\\\nal", true],
        ["le\0t a=(one)\n", "a=", "a+=", true],
        ["eval a=(one)\n", "a=", "a+=", true],
        ["eval a=(one)tail next\n", "tail", '"tail"', true],
        ["eval a=(one)\n", "eval ", ">out eval ", true],
        ["let a=(one)\n", "let ", "x=1 let ", true],
        ["eval a=(one)\n", "eval ", "eval >out ", false],
        ["let a=(one)\n", "let ", "let <(echo x) ", false],
        ["eval pre<(echo x) a=(one)\n", "pre", "", false],
        ["eval a=(x#y\n z)\n", "x#y", "#y", true],
        ["eval a=(# c\n one)\n", "# c", '"# c"', true],
        ["eval a=({a, b})\n", " b", " # }\n b", true],
        ["eval a=(x:~user y)\n", " y", " # c\n y", true],
        ["eval a=(one\\\n two)\n", "\\\n", "\n", true],
        ["eval a=(日\0本 two)\n", "日", "山", true],
        ["eval a=($(printf x)) tail\n", "printf x", "eval b=(x)", true],
        ["eval a=([x]=y)\n", "x", " x + 1 ", true],
        ["coproc eval a=(one two)\n", "eval", "let", true],
        ["eval a=(one two)\necho AFTER\n", ")", "", false],
        ["let a=(one two)\necho AFTER\n", "one", ";", false],
      ]) {
        assertEditRoundTrip(parser, { seed, remove, insert, valid });
      }
    });
    for (const entry of [
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
      test(entry.name, () => assertEditRoundTrip(parser, entry));
    }

    test("time remains a command after pipe layout edits and in nested sources", () => {
      for (const [seed, remove, insert] of [
        [": |\ntime x\n", "|", "|&"],
        [": |\ntime x\n", "\n", "\n\n"],
        [": | # c\ntime x\n", "# c\n", "# c\n# d\n"],
        [": |&\\\ntime x\n", "\\\n", "\n"],
        [": |\nti\\\nme x\n", "|", "|&"],
        [": |\0\nti\0me x\n", "|", "|&"],
        [': |&\n"time" x\n', '"time"', "time"],
        [": |&\nx=1 time x\n", "x=1 ", ""],
        [": |&\n>/dev/null time x\n", ">/dev/null ", ""],
        [": |\ntime() { :; }\n", "|", "|&"],
        [": <<E |\n$(time :)\nE\ntime x\n", "|", "|&"],
        [": <<'E' |\nbody\nE\ntime x\n", "|", "|&"],
        [": <<E <<F |\n$(echo x)\nE\nbody\nF\ntime x\n", "|", "|&"],
        [': "$(echo x |\ntime x)"\n', "|", "|&"],
        [": <(echo x |\ntime x)\n", "|", "|&"],
        [`: \${ echo x |\ntime x; }\n`, "|", "|&"],
        [": `echo x |\ntime x`\n", "|", "|&"],
      ]) {
        assertEditRoundTrip(parser, { seed, remove, insert, valid: true });
      }
    });
    test("conditional linebreak edits preserve operands and repair missing syntax", () => {
      for (const [seed, remove, insert, valid] of [
        ["[[ a ]]\n", "a ", "a\n", true],
        ["[[ a\n]]\n", "a\n", "a # comment\n", true],
        ["[[ ! a ]]\n", "a ", "a\n", true],
        ["[[ ( a ) ]]\n", "a ", "a\n", true],
        ["[[ a && b ]]\n", "a ", "a\n", true],
        ["[[ a || b ]]\n", "b ", "b\n", true],
        ["[[ a && b == c ]]\n", "a ", "a\n", true],
        ["[[ a\n&& b ]]\n", "b ", "", false],
        ["[[ a\n]]\necho AFTER\n", "]]", "", false],
        ["[[ a == b ]]\n", "== ", "==\n", false],
        ["[[ a =~ b ]]\n", "=~ ", "=~\n", false],
        ["[[ -n a ]]\n", "-n ", "-n\n", false],
      ]) {
        assertEditRoundTrip(parser, { seed, remove, insert, valid });
      }
    });
    test("time option lookahead survives edits after the options", () => {
      const seed = "time -p --:x\n";
      const edits = [
        { byte: 12, deleteBytes: 1, insert: "" },
        { byte: 10, deleteBytes: 0, insert: " " },
      ];
      const final = edits.reduce(applyEdit, seed);
      assert.equal(final, "time -p -- :x");
      assert.equal(
        nodes(final).filter(({ type }) => type === "time_option").length,
        2,
      );
      const options = { arguments: ["-c"] };
      const fresh = parser.parse(final, options);
      assert.equal(fresh.status, 0, fresh.output);
      const incremental = parser.parse(seed, { ...options, edits });
      assert.equal(incremental.status, 0, incremental.output);
      assert.equal(
        cstFingerprint(incremental.tree),
        cstFingerprint(fresh.tree),
      );
    });
    test("process substitutions in function names preserve their source spelling", () => {
      for (const [source, name] of [
        ["<(:)() { :; }\n", "<(:)"],
        ["function a>(:) { :; }\n", "a>(:)"],
        ["function <(:)z() { :; }\n", "<(:)z"],
        ["a<(:)>(:)=b() { :; }\n", "a<(:)>(:)=b"],
        ["if<(:)() { :; }\n", "if<(:)"],
        ["<(case x in x) :;; esac)() { :; }\n", "<(case x in x) :;; esac)"],
        ["<(cat <(echo x))() { :; }\n", "<(cat <(echo x))"],
        ["<(cat <<E\n)\nE\n)() { :; }\n", "<(cat <<E\n)\nE\n)"],
        ["<\\\n(:)() { :; }\n", "<\\\n(:)"],
      ]) {
        const actual = nodes(source);
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "function_name")
            .map(({ field, text }) => [field, text]),
          [["name", name]],
          source,
        );
        assert.deepEqual(
          actual.filter(({ type }) => type === "process_substitution"),
          [],
          source,
        );
      }
    });

    test("embedded lookahead keeps process substitution function names whole", () => {
      const name = "<(case x in x) :;; esac)";
      const definition = `${name}() { :; }`;
      for (const source of [
        `if false; then ${definition}; fi\n`,
        `: $(${definition}; :)\n`,
        `: "$(${definition}; :)"\n`,
        `: \${x:-$(${definition}; :)}\n`,
        `: {a,$(${definition}; :)}\n`,
        `: <(${definition}; :)\n`,
        `: $((1 + $(${definition}; :)))\n`,
        `: \`${definition}; :\`\n`,
      ]) {
        assert.deepEqual(
          nodes(source)
            .filter(({ type }) => type === "function_name")
            .map(({ text }) => text),
          [name],
          source,
        );
      }
    });

    test("function name process substitutions respect extglob configuration", () => {
      const source =
        "<(:)@(a)() { :; }; @(a)>(:)() { :; }; function a<(:)@(b) { :; }\n";
      if (extglob) {
        assert.deepEqual(
          nodes(source)
            .filter(({ type }) => type === "function_name")
            .map(({ text }) => text),
          ["<(:)@(a)", "@(a)>(:)", "a<(:)@(b)"],
        );
      } else {
        assert.equal(parser.parse(source, {}).status, 1);
      }
    });

    test("process substitution function names stop at shell word boundaries", () => {
      const actual = nodes("<(:)\nx=<(:)\na<(:) word\nf<(:)() { :; } >out\n");
      assert.deepEqual(
        actual
          .filter(({ type }) => type === "function_name")
          .map(({ text }) => text),
        ["f<(:)"],
      );
      assert.deepEqual(
        actual
          .filter(({ type }) => type === "process_substitution")
          .map(({ text }) => text),
        ["<(:)", "<(:)", "<(:)"],
      );
      assert.equal(
        actual.find(({ type }) => type === "function_body")?.text,
        "{ :; } >out",
      );
      for (const source of [
        "< (:)() { :; }\n",
        "<(:) >out () { :; }\n",
        "<(:) extra() { :; }\n",
        "x=<(:)() { :; }\n",
      ]) {
        assert.equal(parser.parse(source, {}).status, 1, source);
      }
    });

    test("process substitution function name edits match fresh parses and repair", () => {
      for (const [seed, remove, insert, valid] of [
        ["run() { :; } >out\n", "run", "a<(:)", true],
        ["<(:)() { :; }\n", "<", ">", true],
        ["<(:)() { :; }\n", ":)", ":", false],
        ["function <(:) { :; }\n", "<(:)", "run", true],
        ["<(case x in x) :;; esac)() { :; }\n", "x)", "x", false],
        ["<\\\n(:)() { :; }\n", "\\\n", " ", false],
        ["<(:)() { :; }\n", "() { :; }", "argument", true],
        ["<(:)() { :; }\n", "<(:)", "<(:)@(a)", extglob],
      ]) {
        assertEditRoundTrip(parser, { seed, remove, insert, valid });
      }
    });

    test("function name quotation and dollar edits reject and repair", () => {
      for (const seed of [
        "print() { :; }\necho AFTER\n",
        "function print { :; }\necho AFTER\n",
        ': "$(print() { :; }; :)"\n',
        ": <(function print() { :; }; :)\n",
      ]) {
        for (const [insert, valid] of [
          ["pri\\nt", false],
          ["pr'int'", false],
          ['pr"int"', false],
          ["pr$int", false],
          ["print$", false],
          ["pri\\\nnt", true],
          ["foo-bar", true],
        ]) {
          assertEditRoundTrip(parser, { seed, remove: "print", insert, valid });
        }
      }
      for (const [seed, remove, insert] of [
        ["pri\0nt() { :; }\n", "nt", "\\nt"],
        ["a[1]() { :; }\n", "1", '"1"'],
        ["a[1]() { :; }\n", "1", "$x"],
        ["<(echo x)() { :; }\n", "x", '"x"'],
        ["<(echo x)() { :; }\n", "x", "$x"],
        ...(extglob
          ? [
              ["@(a)() { :; }\n", "a", '"a"'],
              ["function @(a) { :; }\n", "a", "$x"],
            ]
          : []),
      ]) {
        assertEditRoundTrip(parser, { seed, remove, insert, valid: false });
      }
    });

    test("rejected implicit function names retain source escapes", () => {
      for (const [source, escaped] of [
        ["pri\\nt() { :; }\n", "\\n"],
        ["\\! () { :; }\n", "\\!"],
      ]) {
        const parsed = parser.parse(source, { arguments: ["-c"] });
        assert.equal(parsed.status, 1, parsed.output);
        const actual = sourceNodes(parsed.tree, source);
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "escaped_character")
            .map(({ text }) => text),
          [escaped],
          parsed.output,
        );
        assert.equal(
          actual.some(({ type }) => type === "function_definition"),
          false,
          parsed.output,
        );
      }
    });

    if (grammar.name === "bash_extglob") {
      test("time is a command or function name after a pipe", () => {
        const actual = nodes("time -p : | time : |& ti\\\nme() { :; }\n");
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "timing")
            .map(({ text }) => text),
          ["time -p"],
        );
        assert.deepEqual(
          actual
            .filter(({ type, field }) => type === "word" && field === "name")
            .map(({ text }) => text),
          [":", "time", ":"],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "function_name")
            .map(({ text }) => text),
          ["ti\\\nme"],
        );
      });

      test("conditional words keep adjacent operator and closing spellings", () => {
        for (const word of [
          "x==",
          '"x"=~',
          "a[k]=~",
          "$x]]",
          `\${x}-eq`,
          "$(printf x)]]",
          "<(printf x)==",
          "@(x|y)!=",
          "x\\y-eq",
          "]]<(:)",
        ]) {
          const actual = nodes(`[[ ${word} ]]\n`);
          assert.deepEqual(
            actual
              .filter(({ field }) => field === "condition")
              .map(({ type, text }) => ({ type, text })),
            [{ type: "word", text: word }],
            word,
          );
          assert.equal(
            actual.filter(
              ({ type }) => type === "conditional_binary_expression",
            ).length,
            0,
            word,
          );
        }
        const actual = nodes('[[ -n $x]] && $x]] == "x"=~ && x < y ]]\n');
        assert.deepEqual(
          actual
            .filter(({ field }) => ["operand", "left", "right"].includes(field))
            .filter(
              ({ type }) => type === "word" || type === "conditional_pattern",
            )
            .map(({ type, field, text }) => ({ type, field, text })),
          [
            { type: "word", field: "operand", text: "$x]]" },
            { type: "word", field: "left", text: "$x]]" },
            { type: "conditional_pattern", field: "right", text: '"x"=~' },
            { type: "word", field: "left", text: "x" },
            { type: "word", field: "right", text: "y" },
          ],
        );
      });

      test("conditional word operators require a complete left word", () => {
        for (const word of [
          "x",
          '"x"',
          "a[k]",
          "$x",
          `\${x}`,
          "$(printf x)",
          "@(x|y)",
        ]) {
          for (const operator of ["==", "=~", "-eq"]) {
            const source = `[[ ${word}${operator} y ]]\n`;
            const result = parser.parse(source, {});
            assert.equal(result.status, 1, result.output);
          }
        }
      });

      test("conditional closing words cannot serve as operands", () => {
        for (const prefix of [
          "",
          "-n ",
          "x == ",
          "x != ",
          "x =~ ",
          "x < ",
          "x > ",
          "x -eq ",
          "x -nt ",
        ]) {
          for (const close of ["]]", "]\\\n]"]) {
            const result = parser.parse(`[[ ${prefix}${close} ]]\n`, {});
            assert.equal(result.status, 1, result.output);
          }
          for (const word of ['"]]"', "\\]\\]", "]]x", "]]<(printf x)"]) {
            const source = `[[ ${prefix}${word} ]]\n`;
            const result = parser.parse(source, {});
            assert.equal(result.status, 0, result.output);
          }
        }
      });

      for (const source of [
        "!",
        "! ",
        "!\n",
        "! # comment",
        "!; :\n",
        "! & :\n",
        "! !;\n",
        "f() { !; }\n",
        "if !; then :; fi\n",
        "echo $(!\n)\n",
        `echo \${ !; }\n`,
        "case x in x) !\n;; esac\n",
      ]) {
        test(`empty negation retains its pipeline at ${JSON.stringify(source)}`, () => {
          const actual = nodes(source);
          assert.ok(
            actual.some(
              ({ type, text }) =>
                type === "pipeline" && /^!( *!)*$/.test(text.trim()),
            ),
          );
          assert.ok(
            actual.some(({ type, text }) => type === "bang" && text === "!"),
          );
        });
      }

      for (const boundary of [
        ">out",
        "2>out",
        "&>out",
        "{fd}>out",
        "<<<input",
        "<(echo x)",
        ">(echo x)",
      ]) {
        test(`declaration assignments end at ${boundary}`, () => {
          const actual = nodes(
            `declare a=(one) ${boundary} b=value c+=~/path\n`,
          );
          assert.deepEqual(
            actual
              .filter(({ type }) => type === "assignment_word")
              .map(({ text }) => text),
            ["a=(one)"],
          );
          assert.deepEqual(
            actual
              .filter(({ field }) => field === "argument")
              .map(({ text }) => text),
            boundary.startsWith("<(") || boundary.startsWith(">(")
              ? [boundary, "x", "b=value", "c+=~/path"]
              : ["b=value", "c+=~/path"],
          );
        });
      }

      for (const spelling of [
        "if",
        "then",
        "while",
        "!",
        "{",
        "}",
        "[[",
        "]]",
        "time",
        "function",
        "declare",
        "alias",
      ]) {
        for (const direction of ["<", ">"]) {
          test(`process substitution joined to ${spelling} is part of the command name (${direction})`, () => {
            const name = `${spelling}${direction}(echo x)`;
            const actual = nodes(`${name} a=value\n`);
            assert.equal(
              actual.filter(({ type }) => type === "declaration_name").length,
              0,
            );
            assert.equal(
              actual.filter(({ type }) => type === "assignment_word").length,
              0,
            );
            assert.equal(
              actual.filter(({ type }) => type === "bang").length,
              0,
            );
            assert.ok(
              actual.some(
                ({ type, field, text }) =>
                  type === "word" && field === "name" && text === name,
              ),
            );
          });
        }
      }

      test("command-name subscript source retains quotes expansions and physical ranges", () => {
        const source = 'a["x y"$p$(printf x)日本\\\n ]suffix tail\n';
        const actual = nodes(source);
        assert.deepEqual(
          actual
            .filter(({ type, field }) => type === "word" && field === "name")
            .map(({ text }) => text),
          ['a["x y"$p$(printf x)日本\\\n ]suffix', "printf"],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) =>
              [
                "double_quoted",
                "parameter_expansion",
                "command_substitution",
                "line_continuation",
              ].includes(type),
            )
            .map(({ type, text }) => [type, text]),
          [
            ["double_quoted", '"x y"'],
            ["parameter_expansion", "$p"],
            ["command_substitution", "$(printf x)"],
            ["line_continuation", "\\"],
          ],
        );
      });

      for (const { source, expressions, groups } of [
        {
          source: "for ((a[x;y;z])); do :; done\n",
          expressions: ["a[x", "y", "z]"],
          groups: [],
        },
        {
          source: "for (((x;(y);z))); do :; done\n",
          expressions: ["(x", "(y)", "z)"],
          groups: ["(y)"],
        },
        {
          source: "for ((((x;y);z))); do :; done\n",
          expressions: ["((x", "y)", "z)"],
          groups: [],
        },
        {
          source: "for (((x;(y;z)))); do :; done\n",
          expressions: ["(x", "(y", "z))"],
          groups: [],
        },
        {
          source: "for (((x+(y z);1;z))); do :; done\n",
          expressions: ["(x+(y z)", "1", "z)"],
          groups: ["(y z)"],
        },
        {
          source: "for ((a[日\\\n本;x;y])); do :; done\n",
          expressions: ["a[日\\\n本", "x", "y]"],
          groups: [],
        },
        {
          source: "for ((((x y)(z w);0;))); do :; done\n",
          expressions: ["((x y)(z w)", "0", ")"],
          groups: ["(x y)", "(z w)"],
        },
        {
          source: "for ((((x y);)(z w)(;))); do :; done\n",
          expressions: ["((x y)", ")(z w)(", ")"],
          groups: ["(x y)", "(z w)"],
        },
      ]) {
        test(`arithmetic for separators cross source delimiters in ${JSON.stringify(source)}`, () => {
          const actual = nodes(source);
          assert.deepEqual(
            actual
              .filter(({ field }) =>
                ["initializer", "condition", "update"].includes(field),
              )
              .map(({ field, text }) => [field, text]),
            ["initializer", "condition", "update"].map((field, index) => [
              field,
              expressions[index],
            ]),
          );
          assert.deepEqual(
            actual
              .filter(
                ({ type }) =>
                  type === "parenthesized_arithmetic" ||
                  type === "parenthesized_arithmetic_source",
              )
              .map(({ text }) => text),
            groups,
          );
          assert.equal(
            actual.filter(({ type }) => type === "array_subscript").length,
            0,
          );
        });
      }

      for (const key of [
        '"x;y"',
        "'x;y'",
        "x\\;y",
        "$'x;y'",
        '$"x;y"',
        `\${x:-a;b}`,
        "$(echo x; echo y)",
        "`echo x; echo y`",
        "$((x;y))",
        `\${ echo x; }`,
        `\${| echo x; }`,
      ]) {
        test(`arithmetic for retains protected subscript separators in ${JSON.stringify(key)}`, () => {
          const actual = nodes(`for ((a[${key}];0;)); do :; done\n`);
          assert.deepEqual(
            actual
              .filter(
                ({ field }) => field === "initializer" || field === "condition",
              )
              .map(({ text }) => text),
            [`a[${key}]`, "0"],
          );
          assert.deepEqual(
            actual
              .filter(({ type }) => type === "subscript_source")
              .map(({ text }) => text),
            [key],
          );
        });
      }

      test("array bracket words preserve nested words quotes expansions and physical ranges", () => {
        const outer = '["x y"$p$(b=([x y]); printf z)日本\\\n ]suffix';
        const actual = nodes(`a=(${outer} [key]=value)\n`);
        assert.deepEqual(
          actual
            .filter(({ field }) => field === "element")
            .map(({ type, text }) => [type, text]),
          [
            ["word", outer],
            ["word", "[x y]"],
            ["array_element_assignment", "[key]=value"],
          ],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) =>
              [
                "double_quoted",
                "parameter_expansion",
                "command_substitution",
                "line_continuation",
              ].includes(type),
            )
            .map(({ type, text }) => [type, text]),
          [
            ["double_quoted", '"x y"'],
            ["parameter_expansion", "$p"],
            ["command_substitution", "$(b=([x y]); printf z)"],
            ["line_continuation", "\\"],
          ],
        );
        const element = actual.find(({ field }) => field === "element");
        assert.ok(element);
        assert.equal(element.start, 3);
        assert.equal(element.end, 3 + Buffer.byteLength(outer));
      });

      test("word loops require a separator before braces but allow an adjacent do group", () => {
        for (const [source, body] of [
          ["for x do :; done\n", "do_group"],
          ["select x do :; done\n", "do_group"],
          ["for x; { :; }\n", "brace_group"],
          ["select x\n{ :; }\n", "brace_group"],
          ["for x in a; { :; }\n", "brace_group"],
          ["select x in a\n{ :; }\n", "brace_group"],
          ["for ((;;)) { :; }\n", "brace_group"],
        ]) {
          const actual = nodes(source);
          assert.ok(
            actual.some(({ type, field }) => type === body && field === "body"),
            source,
          );
        }
      });

      test("coprocess names retain source word structure and exact ranges", () => {
        for (const [name, child] of [
          ['"worker"', "double_quoted"],
          ['"$name"', "parameter_expansion"],
          ["worker-name", "literal"],
          ["w\\orker", "escaped_character"],
          ["a[ 日本 ]", "pattern_bracket_source"],
          ["$(printf worker)", "command_substitution"],
          ["<(:)", "process_substitution"],
          ["@(a|b)", "extglob_pattern"],
          ["time", "literal"],
          ["declare", "literal"],
        ]) {
          const source = `coproc ${name} { :; }\n`;
          const actual = nodes(source);
          const word = actual.find(
            ({ type, field }) => type === "word" && field === "name",
          );
          assert.ok(word);
          assert.deepEqual(
            [word.start, word.end, word.text],
            [7, 7 + Buffer.byteLength(name), name],
          );
          assert.ok(
            actual.some(
              ({ type, start, end }) =>
                type === child && start >= word.start && end <= word.end,
            ),
            source,
          );
        }
      });

      test("coprocess pending command words preserve brackets and end assignment recognition", () => {
        for (const { source, arguments: arguments_ } of [
          {
            source: "coproc worker a[ ] x[ ]\n",
            arguments: ["a[ ]", "x[", "]"],
          },
          {
            source: "coproc worker x=y a[ ] a=value\n",
            arguments: ["x=y", "a[ ]", "a=value"],
          },
          {
            source: "coproc worker a[ ]=v b=(1) tail\n",
            arguments: ["a[ ]=v", "b=(1)", "tail"],
          },
          { source: "coproc worker x=y do\n", arguments: ["x=y", "do"] },
          { source: "coproc worker >out a=value\n", arguments: ["a=value"] },
          { source: "coproc worker !(:)\n", arguments: ["!(:)"] },
        ]) {
          assert.deepEqual(
            nodes(source)
              .filter(({ field }) => field === "argument")
              .map(({ text }) => text),
            arguments_,
            source,
          );
        }
      });

      test("numeric descriptor bounds apply after source decoding and leading zeros", () => {
        const longDescriptorDigits = 128;
        for (const { digits, descriptor } of [
          { digits: "2147483647", descriptor: true },
          { digits: "2147483648", descriptor: false },
          { digits: "0002147483647", descriptor: true },
          { digits: "0002147483648", descriptor: false },
          { digits: "0".repeat(longDescriptorDigits), descriptor: true },
          { digits: "9".repeat(longDescriptorDigits), descriptor: false },
        ]) {
          for (const joiner of ["", "\\\n", "\0"]) {
            const spelling = digits.slice(0, 3) + joiner + digits.slice(3);
            const actual = nodes(`: ${spelling}>out\n`);
            assert.equal(
              actual.some(({ type }) => type === "io_number"),
              descriptor,
            );
            const value = actual.find(({ type, field }) =>
              descriptor ? type === "io_number" : field === "argument",
            );
            assert.equal(value?.text, spelling);
          }
        }
      });

      test("array descriptors retain names subscript source and command ownership", () => {
        const actual = nodes('{ :; } {fd["x y"]}>out\n');
        assert.deepEqual(
          actual
            .filter(({ type }) =>
              [
                "io_redirect",
                "io_variable",
                "variable_name",
                "array_subscript",
              ].includes(type),
            )
            .map(({ type, field, start, end, text }) => [
              type,
              field,
              start,
              end,
              text,
            ]),
          [
            ["io_redirect", "redirect", 7, 22, '{fd["x y"]}>out'],
            ["io_variable", "number", 7, 18, '{fd["x y"]}'],
            ["variable_name", "name", 8, 10, "fd"],
            ["array_subscript", "subscript", 10, 17, '["x y"]'],
          ],
        );
        for (const subscript of [
          "0",
          "1/0",
          "'x y'",
          "\\ ",
          "$i",
          `\${i:-x}`,
          "$(printf x)",
          "`printf x`",
          "$((1+2))",
          "[1]",
          "@(x|y)",
          "<(printf x)",
          ">(:)",
        ]) {
          const source = `: {fd[${subscript}]}>out\n`;
          const parsed = nodes(source);
          assert.deepEqual(
            parsed
              .filter(({ type }) => type === "io_variable")
              .map(({ text }) => text),
            [`{fd[${subscript}]}`],
            source,
          );
          assert.deepEqual(
            parsed
              .filter(({ field }) => field === "argument")
              .map(({ text }) => text),
            subscript === "$(printf x)" || subscript === "`printf x`"
              ? ["x"]
              : [],
            source,
          );
        }
      });

      test("combined output operators remain redirects after compound commands", () => {
        for (const command of [
          "{ :; }",
          "(:)",
          "f() { :; }",
          "if :; then :; fi",
          "[[ x ]]",
          "((1))",
        ]) {
          for (const operator of ["&>", "&>>"]) {
            const source = `${command} ${operator}out\n`;
            const actual = nodes(source);
            assert.deepEqual(
              actual
                .filter(({ field }) => field === "redirect")
                .map(({ text }) => text),
              [`${operator}out`],
              source,
            );
            assert.deepEqual(
              actual
                .filter(({ type }) => ["andgreat", "anddgreat"].includes(type))
                .map(({ text }) => text),
              [operator],
              source,
            );
            assert.ok(
              !actual.some(
                ({ type, text }) => type === "separator_op" && text === "&",
              ),
              source,
            );
          }
        }
      });

      test("quoted or separated descriptor spellings remain redirect operands", () => {
        for (const source of [
          ': >"2">out\n',
          ": >2 >out\n",
          ": >'{fd}'>out\n",
          ": >{fd} >out\n",
          ": >2<(printf x)\n",
        ]) {
          assert.deepEqual(
            nodes(source).filter(({ type }) =>
              ["io_number", "io_variable"].includes(type),
            ),
            [],
            source,
          );
        }
      });

      test("variable descriptor leaves retain original ranges across continuations", () => {
        const actual = nodes(": {\\\nf\\\nd\\\n}\\\n>out\n");
        assert.deepEqual(
          actual
            .filter(({ type }) =>
              [
                "io_variable",
                "variable_name",
                '"{"',
                '"}"',
                "line_continuation",
              ].includes(type),
            )
            .map(({ type, field, start, end }) => [
              type,
              field ?? null,
              start,
              end,
            ]),
          [
            ["io_variable", "number", 2, 12],
            ['"{"', null, 2, 3],
            ["line_continuation", null, 3, 4],
            ["variable_name", "name", 5, 9],
            ["line_continuation", null, 6, 7],
            ["line_continuation", null, 9, 10],
            ['"}"', null, 11, 12],
            ["line_continuation", null, 12, 13],
          ],
        );
      });

      test("Bash command delimiters retain continuation slashes exactly once", () => {
        const source =
          "[\\\n[ x =\\\n= y ]\\\n]\nfor (\\\n(;;)) do break; done\n";
        const actual = nodes(source);
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "line_continuation")
            .map(({ start, end }) => [start, end]),
          [...source.matchAll(/\\\n/g)].map(({ index }) => [index, index + 1]),
        );
        assert.ok(actual.every(({ start, end }) => start < end));
      });

      for (const entry of [
        {
          name: "an array declaration changes type without reinterpreting subscripts",
          seed: `declare -a a\n: "\${a[x+1]}" $((a[x+1]))\n`,
          remove: "-a",
          insert: "-A",
          valid: true,
        },
        {
          name: "an array comment gains closing delimiters in a brace substitution",
          seed: ": {a,$(a=(x # note\ny))}\n",
          remove: "note",
          insert: ") }",
          valid: true,
        },
        {
          name: "an array bracket word gains a parenthesis in a brace substitution",
          seed: ": {a,$(a=([x]))}\n",
          remove: "[x]",
          insert: "[)]",
          valid: true,
        },
        {
          name: "a conditional operand becomes a brace substitution closing character",
          seed: `: {a,\${ [[ x == y ]]; }}\n`,
          remove: "== y",
          insert: "== }",
          valid: true,
        },
        {
          name: "an array process substitution gains a case command in a brace",
          seed: ": {a,$(a=(<(:)))}\n",
          remove: "<(:)",
          insert: "<(case x in x) :;; esac)",
          valid: true,
        },
        {
          name: "a command after an assignment prefix gains a reserved spelling",
          seed: ": {a,$(a=1 word)}\n",
          remove: "word",
          insert: "case",
          valid: true,
        },
        {
          name: "an argument becomes a combined redirection inside a brace substitution",
          seed: ": {a,$(: out case)}\n",
          remove: "out",
          insert: "&>out",
          valid: true,
        },
        {
          name: "a case substitution gains timing options inside a brace",
          seed: ": {a,$(case x in x) :;; esac)}\n",
          remove: "$(case",
          insert: "$(time -p -- case",
          valid: true,
        },
        {
          name: "a function in a brace substitution loses optional parentheses",
          seed: ": {a,$(function f() { case x in x) :;; esac; })}\n",
          remove: "f()",
          insert: "f",
          valid: true,
        },
        {
          name: "an array element becomes a reserved spelling within a brace substitution",
          seed: ": {a,$(a=(word))}\n",
          remove: "word",
          insert: "case",
          valid: true,
        },
        {
          name: "an array word gains whitespace inside its leading bracket",
          seed: "a=([xy] tail)\n",
          remove: "xy",
          insert: "x 日本;|<\ny",
          valid: true,
        },
        {
          name: "an array word loses its required leading bracket close",
          seed: "a=([x y] tail)\n",
          remove: "]",
          insert: "",
          valid: false,
        },
        {
          name: "an array word becomes an element assignment",
          seed: "a=([x y] tail)\n",
          remove: "]",
          insert: "]=value",
          valid: true,
        },
        {
          name: "a nested array word changes its serialized lexical bound",
          seed: 'a=(["x y"$p$(b=([x y]); printf z)日本\\\n ]suffix)\n',
          remove: "[x y]",
          insert: "[x;|日本]",
          valid: true,
        },
        {
          name: "a quoted array bracket restores ordinary element boundaries",
          seed: "a=([x y])\n",
          remove: "[",
          insert: "\\[",
          valid: true,
        },
        {
          name: "a redirect after an assignment disables a later compound assignment",
          seed: ">out x=y b=(one)\n",
          remove: ">out x=y",
          insert: "x=y >out",
          valid: false,
        },
        {
          name: "a redirect after an assignment preserves scalar declaration fields",
          seed: "x=y declare a=$v b+=~/p\n",
          remove: "x=y",
          insert: "x=y >out c=z",
          valid: true,
        },
        {
          name: "arithmetic for separates a subscript across its three fields",
          seed: "for ((a[x,y,z];;)); do :; done\n",
          remove: "a[x,y,z];;",
          insert: "a[x;y;z]",
          valid: true,
        },
        {
          name: "arithmetic for gains an extra separator inside a subscript",
          seed: "for ((a[x];;)); do :; done\n",
          remove: "x",
          insert: "x;y",
          valid: false,
        },
        {
          name: "arithmetic for moves a balanced group across a separator",
          seed: "for (((x);(y);z)); do :; done\n",
          remove: "(x);(y);z",
          insert: "(x;(y);z)",
          valid: true,
        },
        {
          name: "arithmetic for quotes a separator while keeping three fields",
          seed: "for ((a[x;y;z])); do :; done\n",
          remove: "a[x;y;z]",
          insert: 'a["x;y"];0;',
          valid: true,
        },
        {
          name: "arithmetic for moves a source group between crossing parentheses",
          seed: "for ((((x y)(z w);0;))); do :; done\n",
          remove: "(z w);0;)",
          insert: ";)(z w)(;)",
          valid: true,
        },
        {
          name: "nested arithmetic for repairs a separator crossing parentheses",
          seed: "echo $(for (((x;y;z))); do :; done)\n",
          remove: "x;y",
          insert: "x,y",
          valid: false,
        },
        {
          name: "an assignment subscript loses a parenthesis while remaining valid",
          seed: "a[(key)]=x\n",
          remove: ")",
          insert: "",
          valid: true,
        },
        {
          name: "a nested coprocess assignment subscript becomes an unmatched close",
          seed: "a[$(coproc worker b[key]=x)]=y\n",
          remove: "key",
          insert: ")",
          valid: true,
        },
        {
          name: "an arithmetic for subscript crosses its expression boundary",
          seed: "for ((i=a[(key)];;)); do :; done\n",
          remove: "key)",
          insert: "key",
          valid: false,
        },
        {
          name: "a coprocess name becomes a quoted expansion",
          seed: "coproc worker { :; }\n",
          remove: "worker",
          insert: 'wo"$name"',
          valid: true,
        },
        {
          name: "a named coprocess becomes a command with an array argument",
          seed: "coproc worker { :; }\n",
          remove: "{ :; }",
          insert: "a=(1)",
          valid: true,
        },
        {
          name: "a coprocess argument becomes a lexical declaration name",
          seed: "coproc worker tail a=value\n",
          remove: "tail",
          insert: "declare",
          valid: true,
        },
        {
          name: "a coprocess command becomes a declaration command",
          seed: "coproc worker a=(1)\n",
          remove: "worker",
          insert: "declare",
          valid: true,
        },
        {
          name: "a coprocess pending command word gains a bracket boundary",
          seed: "coproc worker tail x[ ]\n",
          remove: "tail",
          insert: "a[ 日本 ]",
          valid: true,
        },
        {
          name: "a select brace body gains a word list",
          seed: "select x; { :; }\n",
          remove: "x;",
          insert: "x in a b;",
          valid: true,
        },
        {
          name: "a command-name bracket becomes an ordinary argument",
          seed: "a[ ] tail\n",
          remove: "a[",
          insert: "echo a[",
          valid: true,
        },
        {
          name: "a command-name lexical bracket closes before a later bracket",
          seed: "a[ x ] tail\n",
          remove: "x",
          insert: "x] [y",
          valid: true,
        },
        {
          name: "a command-name bracket gains expansions and physical continuations",
          seed: "a[(x)] suffix\n",
          remove: "x",
          insert: '$p$(printf "]")日本\\\n ',
          valid: true,
        },
        {
          name: "a command name gains an escape",
          seed: "call arg\n",
          remove: "call",
          insert: "\\call",
          valid: true,
        },
        {
          name: "a process substitution prefix stops being pipeline negation",
          seed: "! <(echo x)\n",
          remove: "! ",
          insert: "!",
          valid: true,
        },
        {
          name: "conditional negation becomes an extglob word",
          seed: "[[ ! (x) ]]\n",
          remove: "! ",
          insert: "!",
          valid: true,
        },
        {
          name: "conditional group is added after its reserved word",
          seed: "[[ x ]]\n",
          remove: "x",
          insert: "(x)",
          valid: true,
        },
        {
          name: "negated pipeline becomes empty",
          seed: "! :\n",
          remove: ":",
          insert: "",
          valid: true,
        },
        {
          name: "redirection ends declaration assignment recognition",
          seed: "declare word a=value\n",
          remove: "word",
          insert: ">out",
          valid: true,
        },
        {
          name: "leading process substitution ends declaration assignment recognition",
          seed: "declare word a=value\n",
          remove: "word",
          insert: "<(echo x)",
          valid: true,
        },
        {
          name: "conditional pattern becomes regex",
          seed: "[[ x == @(a|b) ]]\n",
          remove: "==",
          insert: "=~",
          valid: true,
        },
        {
          name: "conditional operator joins a quoted left word",
          seed: '[[ "x" == y ]]\n',
          remove: '"x" ',
          insert: '"x"',
          valid: false,
        },
        {
          name: "conditional pattern suffix becomes a comparison",
          seed: "[[ a[k]=~ ]]\n",
          remove: "]=~",
          insert: "] =~ x",
          valid: true,
        },
        {
          name: "conditional closing spelling joins an expansion",
          seed: "[[ $x ]]\n",
          remove: "$x",
          insert: "$x]]",
          valid: true,
        },
        {
          name: "quoted conditional close becomes a reserved word",
          seed: '[[ x =~ "]]" ]]\n',
          remove: '"]]"',
          insert: "]]",
          valid: false,
        },
        {
          name: "list timing becomes an ordinary pipeline command",
          seed: ":; time :\n",
          remove: ";",
          insert: " |",
          valid: true,
        },
        {
          name: "list negation becomes invalid after a pipe",
          seed: ":; ! :\n",
          remove: ";",
          insert: " |&",
          valid: false,
        },
        {
          name: "conditional operator precedence changes",
          seed: "[[ x || y && z ]]\n",
          remove: "||",
          insert: "&&",
          valid: true,
        },
        {
          name: "conditional comparison becomes one word",
          seed: "[[ x == y ]]\n",
          remove: "x == y",
          insert: "x==y",
          valid: true,
        },
        {
          name: "arithmetic command changes to subshells",
          seed: "((x+1))\n",
          remove: "((x+1))",
          insert: "( (echo x))",
          valid: true,
        },
        {
          name: "arithmetic for inserts omitted initializer",
          seed: "for ((;;)) do break; done\n",
          remove: ";;",
          insert: "i=0;;",
          valid: true,
        },
        {
          name: "array assignment changes subscript source",
          seed: "a[x+y]=one\n",
          remove: "x+y",
          insert: '"key"',
          valid: true,
        },
        {
          name: "array element becomes ordinary word",
          seed: "a=([2]=two)\n",
          remove: "]=two",
          insert: "]",
          valid: true,
        },
        {
          name: "array assignment appends",
          seed: "a=(one)\n",
          remove: "a=",
          insert: "a+=",
          valid: true,
        },
        {
          name: "declaration becomes ordinary command",
          seed: "declare a=(one)\n",
          remove: "declare",
          insert: "echo",
          valid: false,
        },
        {
          name: "declaration changes to alias without losing assignments",
          seed: "declare a=(one) b+=two\n",
          remove: "declare",
          insert: "alias",
          valid: true,
        },
        {
          name: "alias declaration survives a name continuation",
          seed: "alias a=(one)\n",
          remove: "alias",
          insert: "ali\\\nas",
          valid: true,
        },
        {
          name: "quoted alias stops recognizing compound assignments",
          seed: "alias a=(one)\n",
          remove: "alias",
          insert: '"alias"',
          valid: false,
        },
        {
          name: "redirection ends alias compound assignment recognition",
          seed: "alias a=(one)\n",
          remove: "alias ",
          insert: "alias >out ",
          valid: false,
        },
        {
          name: "quoted declaration is repaired",
          seed: "declare a=(one)\n",
          remove: "declare",
          insert: '"declare"',
          valid: false,
        },
        {
          name: "function optional parentheses are added",
          seed: "function f { :; }\n",
          remove: "f ",
          insert: "f() ",
          valid: true,
        },
        {
          name: "function keyword keeps extglob name literal",
          seed: "function @() { :; }\n",
          remove: "function ",
          insert: "",
          valid: false,
        },
        {
          name: "coprocess name is removed",
          seed: "coproc worker { :; }\n",
          remove: "worker ",
          insert: "",
          valid: true,
        },
        {
          name: "time portability option is added",
          seed: "time : |& cat\n",
          remove: "time ",
          insert: "time -p ",
          valid: true,
        },
        {
          name: "pipe stderr becomes ordinary pipe",
          seed: "echo x |& cat\n",
          remove: "|&",
          insert: "|",
          valid: true,
        },
        {
          name: "case retest becomes fallthrough",
          seed: "case x in a) : ;;& b) : ;; esac\n",
          remove: ";;&",
          insert: ";&",
          valid: true,
        },
        {
          name: "variable descriptor becomes literal argument",
          seed: ": {fd}>out\n",
          remove: "}>",
          insert: "} >",
          valid: true,
        },
        {
          name: "array descriptor gains an unquoted word boundary",
          seed: ": {fd[x]}>out\n",
          remove: "[x]",
          insert: "[x y]",
          valid: true,
        },
        {
          name: "array descriptor loses its subscript source",
          seed: ": {fd[x]}>out\n",
          remove: "[x]",
          insert: "[]",
          valid: true,
        },
        {
          name: "array descriptor quoted source changes across a continuation",
          seed: ': {f\\\nd["日\\\n本"]}\\\n>out\n',
          remove: "日\\\n本",
          insert: "x y",
          valid: true,
        },
        {
          name: "descriptor overflow becomes an argument",
          seed: ": 2147483647>out\n",
          remove: "2147483647",
          insert: "2147483648",
          valid: true,
        },
        {
          name: "descriptor overflow after a compound command is repaired",
          seed: "{ :; } 2147483647>out\n",
          remove: "2147483647",
          insert: "0002147483648",
          valid: false,
        },
        {
          name: "numeric descriptor becomes a process substitution word prefix",
          seed: ": 2>out\n",
          remove: ">out",
          insert: ">(:)",
          valid: true,
        },
        {
          name: "variable descriptor becomes a process substitution word prefix",
          seed: ": {fd[0]}>out\n",
          remove: ">out",
          insert: ">(:)",
          valid: true,
        },
        {
          name: "combined output redirect becomes a background separator",
          seed: "{ :; } &>out\n",
          remove: "&>",
          insert: "& >",
          valid: true,
        },
        {
          name: "combined append redirect gains an invalid trailing word",
          seed: "f() { :; } &>>out\n",
          remove: "out",
          insert: "out tail",
          valid: false,
        },
        {
          name: "redirect operand becomes a numeric descriptor",
          seed: ": >2 >out\n",
          remove: "2 ",
          insert: "2",
          valid: false,
        },
        {
          name: "numeric duplication operand gains a continuation before another redirect",
          seed: ": <&23>out\n",
          remove: "23",
          insert: "2\\\n3",
          valid: true,
        },
        {
          name: "numeric duplication operand loses the duplication operator",
          seed: ": >&2>out\n",
          remove: ">&",
          insert: ">",
          valid: false,
        },
        {
          name: "redirect operand becomes an array descriptor",
          seed: ": >{fd[0]} >out\n",
          remove: "} ",
          insert: "}",
          valid: false,
        },
        {
          name: "variable descriptor name changes",
          seed: ": {fd}>out\n",
          remove: "fd",
          insert: "stream",
          valid: true,
        },
        {
          name: "invalid descriptor name becomes an ordinary word",
          seed: ": {fd}>out\n",
          remove: "fd",
          insert: "1fd",
          valid: true,
        },
        {
          name: "quoted descriptor becomes an ordinary word",
          seed: ": {fd}>out\n",
          remove: "{fd}",
          insert: "'{fd}'",
          valid: true,
        },
        {
          name: "variable descriptor closing brace is removed and restored",
          seed: ": {fd}>out\n",
          remove: "}",
          insert: "",
          valid: true,
        },
        {
          name: "variable descriptor name continuation is removed and restored",
          seed: ": {\\\nf\\\nd\\\n}\\\n>out\n",
          remove: "f\\\nd",
          insert: "fd",
          valid: true,
        },
        {
          name: "variable descriptor continuation before redirect is removed and restored",
          seed: ": {fd}\\\n<<EOF\nbody\nEOF\n",
          remove: "}\\\n<",
          insert: "}<",
          valid: true,
        },
        {
          name: "Bash keyword continuation is added",
          seed: "function f { :; }\n",
          remove: "function",
          insert: "fu\\\nnction",
          valid: true,
        },
        {
          name: "assignment becomes a word",
          seed: "x=one echo tail\n",
          remove: "=",
          insert: "-",
          valid: true,
        },
        {
          name: "pipeline becomes an OR list",
          seed: "echo one | cat\n",
          remove: "|",
          insert: "||",
          valid: true,
        },
        {
          name: "function name changes",
          seed: "run() { echo ok; } >log\n",
          remove: "run",
          insert: "execute",
          valid: true,
        },
        {
          name: "case terminator becomes fall through",
          seed: "case x in x) echo yes;; esac\n",
          remove: ";;",
          insert: ";&",
          valid: true,
        },
        {
          name: "redirection descriptor changes",
          seed: "echo x 2>&1\n",
          remove: "2>",
          insert: "3>",
          valid: true,
        },
      ]) {
        test(entry.name, () => assertEditRoundTrip(parser, entry));
      }
    }

    test("command-name brackets stop being assignment candidates after an assignment and redirect", () => {
      for (const command of [
        "a[)]",
        "x=y a[)]",
        ">out a[)]",
        ">out x=y a[)]",
      ]) {
        const source = `${command} arg\n`;
        assert.equal(parser.parse(source, {}).status, 0, source);
      }
      for (const [prefix, suffix] of [
        ["", ""],
        [": $(", ")"],
        [": {a,$(", ")}"],
        [": <(", ")"],
        [": `", "`"],
      ]) {
        const source = `${prefix}x=y >out a[)]${suffix}\n`;
        assert.equal(parser.parse(source, {}).status, 1, source);
        const repair = {
          byte: Buffer.byteLength(prefix),
          deleteBytes: 8,
          insert: ">out x=y",
        };
        const fresh = parser.parse(applyEdit(source, repair), {});
        assert.equal(fresh.status, 0, fresh.output);
        assert.equal(
          parser.parse(source, { edits: [repair] }).tree,
          fresh.tree,
        );
      }
    });

    test("compound assignment closing parentheses require a word boundary", () => {
      for (const source of [
        "x=()0",
        "x=(a)b",
        "x=(a b)c",
        "declare x=()0",
        "p=(a)\\",
      ]) {
        assert.equal(parser.parse(source, {}).status, 1, source);
      }
      for (const source of [
        "x=() 0\n",
        "x=(a) b\n",
        "x=(a b) c\n",
        "declare x=() 0\n",
        "p=(a)\\\n",
      ]) {
        assert.equal(parser.parse(source, {}).status, 0, source);
      }
    });

    test("arithmetic command closers use logical source across a line continuation", () => {
      for (const source of [
        "(( 1 )\\\n)\n",
        "(( )\\\n)\n",
        ": $( ((1 << 2)\\\n) )\n",
      ]) {
        const nodes = parseNodes(parser, source);
        assert.equal(
          nodes.filter(({ type }) => type === "arithmetic_command").length,
          1,
        );
        assert.equal(nodes.filter(({ type }) => type === "subshell").length, 0);
        const edit = {
          byte: source.indexOf("\\\n"),
          deleteBytes: 2,
          insert: "",
        };
        const fresh = parser.parse(applyEdit(source, edit), {});
        assert.equal(parser.parse(source, { edits: [edit] }).tree, fresh.tree);
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

    test("adjacent negation parentheses follow the extglob condition", () => {
      const command = parseNodes(parser, "!(true)\n");
      const conditional = parseNodes(parser, "[[ !(a) ]]\n");
      assert.deepEqual(
        command
          .filter(({ type }) =>
            ["bang", "subshell", "extglob_pattern"].includes(type),
          )
          .map(({ type, text }) => [type, text]),
        extglob
          ? [["extglob_pattern", "!(true)"]]
          : [
              ["bang", "!"],
              ["subshell", "(true)"],
            ],
      );
      assert.deepEqual(
        conditional
          .filter(({ type }) =>
            [
              "conditional_negation",
              "conditional_group",
              "extglob_pattern",
            ].includes(type),
          )
          .map(({ type, text }) => [type, text]),
        extglob
          ? [["extglob_pattern", "!(a)"]]
          : [
              ["conditional_negation", "!(a)"],
              ["conditional_group", "(a)"],
            ],
      );
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
  });
}
