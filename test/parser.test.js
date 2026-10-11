import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { grammars } from "../scripts/tree-sitter.js";
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
    const extglob = grammar.name.includes("extglob");
    const nodes = (source) => parseNodes(parser, source);
    test("word loop headers remain deterministic and repair across body boundaries", () => {
      for (const [seed, remove, insert, valid] of [
        [
          "echo BEFORE\nfor item in a b; do echo SAME; done\necho AFTER\n",
          "echo SAME",
          ")",
          false,
        ],
        [
          "echo BEFORE\nselect item in; do echo SAME; done\necho AFTER\n",
          ";",
          "",
          false,
        ],
        [
          "echo BEFORE\nfor item do echo SAME; done\necho AFTER\n",
          "SAME",
          '"',
          false,
        ],
        [
          "echo BEFORE\nselect item\ndo echo SAME; done\necho AFTER\n",
          "do",
          "",
          false,
        ],
        [
          "echo BEFORE\nfor item in a; { echo SAME; }\necho AFTER\n",
          "}",
          ")",
          false,
        ],
        [
          "echo BEFORE\nfor \\\nitem in a \\\nb; do echo SAME; done\necho AFTER\n",
          "do",
          "d",
          false,
        ],
        [
          "echo BEFORE\nselect item in a b; do echo SAME; done\necho AFTER\n",
          "a b",
          "a b c",
          true,
        ],
      ]) {
        assertEditRoundTrip(parser, { seed, remove, insert, valid });
      }
    });

    test("case headers and nested word loops remain deterministic and repair", () => {
      for (const [seed, remove, insert, valid] of [
        ["echo BEFORE\ncase x in esac\necho AFTER\n", "x ", "", false],
        [
          "echo BEFORE\ncase \\\nx in\nx) echo SAME ;; esac\necho AFTER\n",
          "in",
          "i",
          false,
        ],
        [
          "echo BEFORE\nfor item in a; do case x in x) echo SAME ;; esac; done\necho AFTER\n",
          "case x in",
          "case x",
          false,
        ],
        [
          "echo BEFORE\ncase x in x) select item in a; do echo SAME; done ;; esac\necho AFTER\n",
          "do",
          "do )",
          false,
        ],
        [
          'echo BEFORE\necho "$(for item in a; do case x in x) echo SAME ;; esac; done)"\necho AFTER\n',
          "echo SAME ;;",
          "echo SAME ) ;;",
          false,
        ],
        [
          'echo BEFORE\necho "$(for item in a; do case x in x) echo SAME ;; esac; done)"\necho AFTER\n',
          ";; esac",
          ";; ) esac",
          false,
        ],
        [
          "echo BEFORE\ncase x in x) echo SAME ;; esac\necho AFTER\n",
          "case x",
          'case "$item"',
          true,
        ],
      ]) {
        assertEditRoundTrip(parser, { seed, remove, insert, valid });
      }
    });

    test("conditional operand edits before closing delimiters are deterministic and repair", () => {
      for (const fixture of [
        {
          seed: "echo BEFORE\n[[ x == y ]]\necho AFTER\n",
          remove: "y",
          insert: "",
          valid: false,
        },
        {
          seed: "echo BEFORE\n[[ x && y ]]\necho AFTER\n",
          remove: "y",
          insert: ")",
          valid: false,
        },
        {
          seed: "echo BEFORE\n[[ x =~ y ]]\necho AFTER\n",
          remove: "y",
          insert: "",
          valid: false,
        },
        {
          seed: "echo BEFORE\n[[ x == y ]\\\n]\necho AFTER\n",
          remove: "y",
          insert: "",
          valid: false,
        },
      ]) {
        assertEditRoundTrip(parser, fixture);
      }
    });

    test("timing prefixes are deterministic and repair after unexpected delimiters", () => {
      for (const [seed, remove, insert] of [
        ["echo BEFORE\ntime echo SAME\necho AFTER\n", "time", ") time"],
        ["echo BEFORE\ntime\necho AFTER\n", "time", ") time"],
        ["echo BEFORE\ntime -p --\necho AFTER\n", "time", ") time"],
        ["echo BEFORE\nti\\\nme -p echo SAME\necho AFTER\n", "ti", ") ti"],
        [
          "echo BEFORE\nf() { time echo SAME; }\necho AFTER\n",
          "time",
          ") time",
        ],
      ]) {
        assertEditRoundTrip(parser, { seed, remove, insert, valid: false });
      }
    });

    test("coprocesses and timing combinations repair after unexpected delimiters", () => {
      for (const [seed, remove, insert] of [
        [
          "echo BEFORE\ncoproc C { echo SAME; }\necho AFTER\n",
          "coproc",
          ") coproc",
        ],
        [
          "echo BEFORE\ncoproc { echo SAME; }\necho AFTER\n",
          "coproc",
          ") coproc",
        ],
        ["echo BEFORE\ncoproc echo SAME\necho AFTER\n", "coproc", ") coproc"],
        ["echo BEFORE\ncop\\\nroc echo SAME\necho AFTER\n", "cop", ") cop"],
        [
          "echo BEFORE\ntime -p coproc C { echo SAME; }\necho AFTER\n",
          "coproc",
          ") coproc",
        ],
        [
          "echo BEFORE\ncoproc C { time echo SAME; }\necho AFTER\n",
          "time",
          ") time",
        ],
        [
          "echo BEFORE\ncoproc C { time echo SAME; }\necho AFTER\n",
          "coproc",
          ") coproc",
        ],
      ]) {
        assertEditRoundTrip(parser, { seed, remove, insert, valid: false });
      }
    });

    if (grammar.name === "bash_extglob") {
      test("comment becomes a command", () => {
        assertEditRoundTrip(parser, {
          seed: "# echo yes\n",
          remove: "# ",
          insert: "",
          valid: true,
        });
      });

      test("punctuation reserved words introduce conditional groups and negated subshells", () => {
        const actual = nodes("[[ ((x)) ]]; ! ( : )\n");
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "conditional_group")
            .map(({ text }) => text),
          ["((x))", "(x)"],
        );
        assert.equal(actual.find(({ type }) => type === "bang")?.text, "!");
        assert.equal(
          actual.filter(({ type }) => type === "function_definition").length,
          0,
        );
      });

      test("escaped command and function names advance through each source escape", () => {
        const actual = nodes(
          "\\if arg; \\! () { :; }; function f\\ name { :; }\n",
        );
        assert.ok(
          actual.some(
            ({ type, field, text }) =>
              type === "word" && field === "name" && text === "\\if",
          ),
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "function_name")
            .map(({ text }) => text),
          ["\\!", "f\\ name"],
        );
      });

      test("quoted and explicit function names retain reserved spellings", () => {
        const actual = nodes(
          '"[[" () { :; }; "!" () { :; }; function } { :; }; function then { :; }\n',
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "function_name")
            .map(({ text }) => text),
          ['"[["', '"!"', "}", "then"],
        );
      });

      test("function names accept non-assignment equals signs and extglob patterns", () => {
        const actual = nodes(
          "=a() { :; }; 1=a() { :; }; a-b=c() { :; }; a[1]x=y() { :; }; a++=b() { :; }; @(a)() { :; }; x@(a|b)y () { :; }; function @(a) { :; }\n",
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "function_name")
            .map(({ text }) => text),
          [
            "=a",
            "1=a",
            "a-b=c",
            "a[1]x=y",
            "a++=b",
            "@(a)",
            "x@(a|b)y",
            "@(a)",
          ],
        );
      });

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

      test("quoted negation and joined substitutions remain pipeline command words", () => {
        const actual = nodes(': | "!" : |& \\! : | !(x|y) | !<(:)\n');
        assert.deepEqual(
          actual
            .filter(({ type, field }) => type === "word" && field === "name")
            .map(({ text }) => text),
          [":", '"!"', "\\!", "!(x|y)", "!<(:)", ":"],
        );
        assert.equal(actual.filter(({ type }) => type === "bang").length, 0);
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

      test("conditional closing words remain words outside command position", () => {
        assert.deepEqual(
          nodes("x=1 ]]; echo ]] >]]\n")
            .filter(({ type }) => type === "word")
            .map(({ field, text }) => [field, text]),
          [
            ["name", "]]"],
            ["name", "echo"],
            ["argument", "]]"],
            ["filename", "]]"],
          ],
        );
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

      for (const source of [
        ": | ! :\n",
        ": |& ! :\n",
        ": | !\n",
        ": |& !\n",
        "! && :\n",
        "! || :\n",
        "! | :\n",
        "!\n&& :\n",
        "echo $(!)\n",
        "f() { ! }\n",
        "case x in x) !;; esac\n",
        "case x in x) !;& esac\n",
        "! () { :; }\n",
        "[[ () { :; }\n",
        "{ () { :; }\n",
        "} () { :; }\n",
        "]] () { :; }\n",
        "a+=b() { :; }\n",
        "a[1]+=b() { :; }\n",
        "@() { :; }\n",
        "]]\n",
        "! ]]\n",
        ": | ]]\n",
        ": $(]])\n",
        "[[ a\n]]\n",
        "[[ a # comment\n]]\n",
        "[[ a\n== b ]]\n",
        "[[ a ==\nb ]]\n",
        "[[ a =~\nb ]]\n",
        "[[ -n\na ]]\n",
        "[[ ! a\n]]\n",
        "[[ ( a\n) ]]\n",
        "[[ a\n&& b ]]\n",
        "declare >out a=(one)\n",
        "declare 2>out a=(one)\n",
        "declare &>out a=(one)\n",
        "declare {fd}>out a=(one)\n",
        "declare <<<input a=(one)\n",
        "declare <(echo x) a=(one)\n",
        "declare >(echo x) a=(one)\n",
        "declare a=(one)>out b=(two)\n",
      ]) {
        test(`command boundaries reject ${JSON.stringify(source)}`, () => {
          const result = parser.parse(source, {});
          assert.equal(result.status, 1, result.output);
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

      test("declarations survive leading redirects and substitutions inside arguments", () => {
        const actual = nodes(
          `>out declare pre<(echo x) a=(one) a=<(echo y) b=(two) "\${v}" c=(three)\n`,
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "assignment_word")
            .map(({ text }) => text),
          ["a=(one)", "a=<(echo y)", "b=(two)", "c=(three)"],
        );
      });

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

      test("adjacent parentheses distinguish extglob from command and conditional negation", () => {
        const actual = nodes("!(x|y); [[ !(x|y) ]]; ! ( : ); [[ ! (x) ]]\n");
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "extglob_pattern")
            .map(({ text }) => text),
          ["!(x|y)", "!(x|y)"],
        );
        assert.equal(actual.filter(({ type }) => type === "bang").length, 1);
        assert.equal(
          actual.filter(({ type }) => type === "conditional_not").length,
          1,
        );
      });

      test("command roles and redirection targets retain source fields", () => {
        const actual = nodes("A=one echo 日本語 >out\n");
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "word")
            .map(({ field, text }) => [field, text]),
          [
            ["name", "echo"],
            ["argument", "日本語"],
            ["filename", "out"],
          ],
        );
        assert.equal(
          actual.find(({ type }) => type === "assignment_word")?.text,
          "A=one",
        );
      });

      test("arithmetic for quotes protect semicolons and closing parentheses", () => {
        const actual = nodes("for (($'a;))';$\"b;))\";$'c\\'')); do :; done\n");
        assert.deepEqual(
          actual
            .filter(({ field }) =>
              ["initializer", "condition", "update"].includes(field),
            )
            .map(({ type, field, text }) => [type, field, text]),
          [
            ["arithmetic_source_expression", "initializer", "$'a;))'"],
            ["arithmetic_source_expression", "condition", '$"b;))"'],
            ["arithmetic_source_expression", "update", "$'c\\''"],
          ],
        );
      });

      test("parenthesized assignment subscripts take precedence over function names", () => {
        const actual = nodes(
          "a[(i+1)]=x; a[ (j+2) ]+=y; a[(x)] () { :; }; a[ ] () { :; }\n",
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "assignment_word")
            .map(({ text }) => text),
          ["a[(i+1)]=x", "a[ (j+2) ]+=y"],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "function_name")
            .map(({ text }) => text),
          ["a[(x)]", "a[ ]"],
        );
        assert.equal(parser.parse("a[ () { :; }\n", {}).status, 1);
      });

      test("declaration subscripts respect ordinary word and command boundaries", () => {
        const actual = nodes(
          'declare a[x y]=z b["x y"]=v; declare a[x; echo next\n',
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "assignment_word")
            .map(({ text }) => text),
          ['b["x y"]=v'],
        );
        assert.deepEqual(
          actual
            .filter(({ field }) => field === "argument")
            .map(({ text }) => text),
          ["a[x", "y]=z", "a[x", "next"],
        );
        assert.equal(parser.parse("declare a[(i+1)]=x\n", {}).status, 1);
      });

      test("command-name subscripts retain whitespace and operators in one word", () => {
        const actual = nodes(
          "a[ ] one; a[(x)] two; a[;|\n)] three; a[(] four\n",
        );
        assert.deepEqual(
          actual
            .filter(({ type, field }) => type === "word" && field === "name")
            .map(({ text }) => text),
          ["a[ ]", "a[(x)]", "a[;|\n)]", "a[(]"],
        );
        assert.deepEqual(
          actual
            .filter(({ field }) => field === "argument")
            .map(({ text }) => text),
          ["one", "two", "three", "four"],
        );
        assert.equal(
          actual.filter(({ type }) => type === "pattern_bracket_source").length,
          4,
        );
        assert.ok(
          !actual.some(
            ({ type }) => type === "array_subscript" || type === "subshell",
          ),
        );
      });

      test("command-name subscript boundaries stop at the first lexical bracket pair", () => {
        const actual = nodes(
          'a[x][ ] tail; a[] next; echo a[ ]; "a"[ ] tail; a\\[ ] tail; 1a[ ] tail; a-b[ ] tail\n',
        );
        assert.deepEqual(
          actual
            .filter(({ type, field }) => type === "word" && field === "name")
            .map(({ text }) => text),
          ["a[x][", "a[]", "echo", '"a"[', "a\\[", "1a[", "a-b["],
        );
        assert.deepEqual(
          actual
            .filter(({ field }) => field === "argument")
            .map(({ text }) => text),
          [
            "]",
            "tail",
            "next",
            "a[",
            "]",
            "]",
            "tail",
            "]",
            "tail",
            "]",
            "tail",
            "]",
            "tail",
          ],
        );
      });

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

      test("nested command-name subscript bounds survive assignments and redirections", () => {
        const actual = nodes("a[$(>out x=y a[)] ) ] next\n");
        assert.deepEqual(
          actual
            .filter(({ type, field }) => type === "word" && field === "name")
            .map(({ text }) => text),
          ["a[$(>out x=y a[)] ) ]", "a[)]"],
        );
        assert.deepEqual(
          actual
            .filter(({ field }) => field === "argument")
            .map(({ text }) => text),
          ["next"],
        );
      });

      test("extglob suffixes stay in command words beside function definitions", () => {
        const actual = nodes(
          "a[ ]@(x|y) arg; x@(a|b) arg; f+ () { :; }; 'f@'() { :; }\n",
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "extglob_pattern")
            .map(({ text }) => text),
          ["@(x|y)", "@(a|b)"],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "function_name")
            .map(({ text }) => text),
          ["f+", "'f@'"],
        );
      });

      test("conditional precedence owns pattern and regex operands", () => {
        const actual = nodes('[[ x == @(a|b) || y =~ (c|d) && ! -n "$z" ]]\n');
        assert.deepEqual(
          actual
            .filter(({ type }) =>
              [
                "conditional_or_expression",
                "conditional_and_expression",
                "conditional_pattern",
                "regex_operand",
              ].includes(type),
            )
            .map(({ type, text }) => [type, text]),
          [
            [
              "conditional_or_expression",
              'x == @(a|b) || y =~ (c|d) && ! -n "$z"',
            ],
            ["conditional_pattern", "@(a|b)"],
            ["conditional_and_expression", 'y =~ (c|d) && ! -n "$z"'],
            ["regex_operand", "(c|d)"],
          ],
        );
      });

      test("arithmetic for fields distinguish all three expressions", () => {
        const actual = nodes("for ((i=0;i<2;i++)); do :; done\n");
        assert.deepEqual(
          actual
            .filter(({ field }) =>
              ["initializer", "condition", "update"].includes(field),
            )
            .map(({ field, text }) => [field, text]),
          [
            ["initializer", "i=0"],
            ["condition", "i<2"],
            ["update", "i++"],
          ],
        );
        assert.equal(
          nodes("for ((;;)) do break; done\n").filter(({ field }) =>
            ["initializer", "condition", "update"].includes(field),
          ).length,
          0,
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

      for (const source of [
        "for ((a[x;y];;)); do :; done\n",
        "for ((;a[(x;y)];)); do :; done\n",
        "for ((;;a[x;y])); do :; done\n",
        "for (((x;y);;)); do :; done\n",
        "for ((a[x;y])); do :; done\n",
        "for (((x;y;z)); do :; done\n",
        "for ((x;y;z))); do :; done\n",
        "echo $(for ((a[x;y];;)); do :; done)\n",
        "echo `for ((a[x;y];;)); do :; done`\n",
      ]) {
        test(`arithmetic for requires two separators and balanced outer parentheses in ${JSON.stringify(source)}`, () => {
          const result = parser.parse(source, {});
          assert.equal(result.status, 1, result.output);
        });
      }

      test("array assignments preserve type neutral keys and element order", () => {
        const actual = nodes(
          'declare -A a=(["日本語"]=one [x+y]+=two three)\n',
        );
        assert.deepEqual(
          actual
            .filter(({ field }) => field === "element")
            .map(({ text }) => text),
          ['["日本語"]=one', "[x+y]+=two", "three"],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "subscript_source")
            .map(({ text }) => text),
          ['"日本語"', "x+y"],
        );
        assert.equal(
          actual.find(({ type }) => type === "declaration_name")?.text,
          "declare",
        );
        assert.equal(
          actual.find(({ type }) => type === "assignment_append")?.text,
          "+=",
        );
      });

      test("array words keep leading lexical brackets across whitespace and operators", () => {
        const actual = nodes(
          "declare -A a=([a b] [a;b] [a|b] [a<b] [(] [)] [a\nb])\n",
        );
        assert.deepEqual(
          actual
            .filter(({ field }) => field === "element")
            .map(({ type, text }) => [type, text]),
          ["[a b]", "[a;b]", "[a|b]", "[a<b]", "[(]", "[)]", "[a\nb]"].map(
            (text) => ["word", text],
          ),
        );
        assert.equal(
          actual.filter(({ type }) => type === "pattern_bracket_source").length,
          7,
        );
        assert.ok(
          !actual.some(
            ({ type }) => type === "array_subscript" || type === "subshell",
          ),
        );
      });

      test("array lexical brackets apply only at an unquoted element start", () => {
        const actual = nodes('a=([x][a b] "[a b]" \\[a b] a[x y])\n');
        assert.deepEqual(
          actual
            .filter(({ field }) => field === "element")
            .map(({ text }) => text),
          ["[x][a", "b]", '"[a b]"', "\\[a", "b]", "a[x", "y]"],
        );
      });

      test("array elements retain ordinary quoting and reserved spellings in nested contexts", () => {
        const actual = nodes(
          'a=(for); : "$(a=(\\( \\)))"; coproc worker a=(for time "if")\n',
        );
        assert.deepEqual(
          actual
            .filter(({ field }) => field === "element")
            .map(({ type, text }) => [type, text]),
          ["for", "\\(", "\\)", "for", "time", '"if"'].map((text) => [
            "word",
            text,
          ]),
        );
      });

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

      test("leading redirects permit compound assignments before and after declaration names", () => {
        const actual = nodes(">out 2>err a=(one) b+=(two) declare c=(three)\n");
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "assignment_word")
            .map(({ field, text }) => [field, text]),
          [
            ["assignment", "a=(one)"],
            ["assignment", "b+=(two)"],
            ["assignment", "c=(three)"],
          ],
        );
      });

      test("redirects after an assignment preserve subsequent scalar assignments and declarations", () => {
        const actual = nodes(
          "x=(one)>out c=z 2>err declare a=$v b+=~/p; y=()\n",
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "assignment_word")
            .map(({ field, text }) => [field, text]),
          ["x=(one)", "c=z", "a=$v", "b+=~/p", "y=()"].map((text) => [
            "assignment",
            text,
          ]),
        );
        assert.equal(
          actual.find(({ type }) => type === "declaration_name")?.text,
          "declare",
        );
        assert.equal(
          actual.find(({ type }) => type === "tilde_expansion")?.text,
          "~",
        );
      });

      for (const source of [
        "a=([)\n",
        "a=([x)\n",
        "declare -A a=([x)\n",
        "x=y >out b=(one)\n",
        "x=y>out b=(one)\n",
        "x=y >out c=z b=(one)\n",
        ">out x=y 2>err b=(one)\n",
        "x=() >out declare b=(one)\n",
        "x=y >out declare a=x b+=(one)\n",
      ]) {
        test(`compound assignment boundaries reject ${JSON.stringify(source)}`, () => {
          const result = parser.parse(source, {});
          assert.equal(result.status, 1, result.output);
        });
      }

      test("pipeline prefixes and coprocess names own their commands", () => {
        const actual = nodes("time -p ! coproc worker { :; } |& cat\n");
        assert.deepEqual(
          actual
            .filter(
              ({ type, text }) =>
                ["timing", "bang", "pipe_and"].includes(type) ||
                (type === "word" && text === "worker"),
            )
            .map(({ type, field, text }) => [type, field, text]),
          [
            ["timing", "timing", "time -p"],
            ["bang", "negation", "!"],
            ["word", "name", "worker"],
            ["pipe_and", "operator", "|&"],
          ],
        );
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

      test("coprocess assignment-shaped arguments preserve their argument role", () => {
        const actual = nodes(
          'coproc worker a=("x y" $p $(printf z)) x+=y declare -a b+=(2) >out tail\n',
        );
        assert.deepEqual(
          actual
            .filter(({ field }) => field === "argument")
            .map(({ type, text }) => [type, text]),
          [
            ["assignment_word", 'a=("x y" $p $(printf z))'],
            ["word", "z"],
            ["assignment_word", "x+=y"],
            ["word", "declare"],
            ["word", "-a"],
            ["assignment_word", "b+=(2)"],
            ["word", "tail"],
          ],
        );
        assert.deepEqual(
          actual.filter(({ field }) => field === "assignment"),
          [],
        );
        assert.equal(
          actual.find(({ field }) => field === "redirect")?.text,
          ">out",
        );
        assert.equal(
          actual.filter(({ type }) => type === "declaration_name").length,
          0,
        );
        const declaration = nodes("coproc declare a=(1)\n");
        assert.equal(
          declaration.find(({ type }) => type === "declaration_name")?.text,
          "declare",
        );
        assert.equal(
          declaration.find(({ field }) => field === "assignment")?.text,
          "a=(1)",
        );
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

      test("redirection descriptors and here string operators retain exact ranges", () => {
        const actual = nodes(': {fd}>out 3<&4- &>>log <<<"$x"\n');
        assert.deepEqual(
          actual
            .filter(({ type }) =>
              [
                "io_variable",
                "io_number",
                "anddgreat",
                "here_string_operator",
              ].includes(type),
            )
            .map(({ text }) => text),
          ["{fd}", "3", "&>>", "<<<"],
        );
        assert.deepEqual(
          actual
            .filter(({ field }) => field === "filename")
            .map(({ text }) => text),
          ["out", "4-", "log", '"$x"'],
        );
        assert.deepEqual(
          actual
            .filter(
              ({ type, field }) => type === "variable_name" && field === "name",
            )
            .map(({ start, end, text }) => [start, end, text]),
          [[3, 5, "fd"]],
        );
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

      test("descriptor spellings remain word prefixes before process substitutions", () => {
        const actual = nodes(": 2<(printf x) {fd}>(:) {fd[0]}<(printf y)\n");
        assert.deepEqual(
          actual.filter(({ type }) =>
            ["io_variable", "io_number", "io_redirect"].includes(type),
          ),
          [],
        );
        assert.deepEqual(
          actual
            .filter(({ field }) => field === "argument")
            .map(({ text }) => text),
          ["2<(printf x)", "x", "{fd}>(:)", "{fd[0]}<(printf y)", "y"],
        );
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

      test("descriptor duplication operators accept an adjacent numeric operand", () => {
        const actual = nodes(": <&2>out >&3>log\n");
        assert.deepEqual(
          actual.filter(({ type }) => type === "io_number"),
          [],
        );
        assert.deepEqual(
          actual
            .filter(({ field }) => field === "filename")
            .map(({ text }) => text),
          ["2", "out", "3", "log"],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "literal")
            .map(({ text }) => text),
          [":", "2", "out", "3", "log"],
        );
      });

      test("numeric descriptor source does not impose a runtime integer range", () => {
        const actual = nodes("{ :; } 999999999999999999999>out\n");
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "io_number")
            .map(({ field, text }) => [field, text]),
          [["number", "999999999999999999999"]],
        );
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

      test("quoted separated and invalid descriptor spellings remain ordinary words", () => {
        const actual = nodes(
          ": {fd} >out '{fd}'>out {1fd}>out {fd>out {fd[]}>out {fd[ x ]}>out {fd[x][y]}>out\n",
        );
        assert.deepEqual(
          actual.filter(({ type }) => type === "io_variable"),
          [],
        );
        assert.deepEqual(
          actual
            .filter(({ field }) => field === "argument")
            .map(({ text }) => text),
          [
            "{fd}",
            "'{fd}'",
            "{1fd}",
            "{fd",
            "{fd[]}",
            "{fd[",
            "x",
            "]}",
            "{fd[x][y]}",
          ],
        );
      });

      test("function names and body redirections retain source ownership", () => {
        const actual = nodes("function a-b() { :; } >out\n");
        assert.equal(
          actual.find(({ type }) => type === "function_name")?.text,
          "a-b",
        );
        assert.equal(
          actual.find(({ type }) => type === "function_body")?.text,
          "{ :; } >out",
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

      for (const [name, source] of [
        ["numeric descriptor cannot be a redirect operand", ": >2>out\n"],
        ["variable descriptor cannot be a redirect operand", ": >{fd}>out\n"],
        ["array descriptor cannot be a redirect operand", ": >{fd[0]}>out\n"],
        ["numeric descriptor cannot be a conditional operand", "[[ 2>1 ]]\n"],
        [
          "combined output redirect cannot split into a background separator",
          "{ :; } &>a[ x ]\n",
        ],
        [
          "combined append redirect cannot split into a background separator",
          "f() { :; } &>>a[ x ]\n",
        ],
        ["for brace body missing separator", "for x { :; }\n"],
        ["select brace body missing separator", "select x { :; }\n"],
        ["for word list missing separator", "for x in a { :; }\n"],
        ["select word list missing separator", "select x in a { :; }\n"],
        [
          "coprocess array after ordinary argument",
          "coproc worker tail a=(1)\n",
        ],
        ["coprocess array after redirect", "coproc worker >out a=(1)\n"],
        [
          "coprocess array after process substitution",
          "coproc worker <(:) a=(1)\n",
        ],
        [
          "coprocess array after assignment prefix",
          "coproc x=y worker a=(1)\n",
        ],
        ["coprocess array after redirect prefix", "coproc >out worker a=(1)\n"],
        [
          "coprocess quoted declaration argument",
          'coproc worker "declare" a=(1)\n',
        ],
        ["coprocess reserved command name", "coproc do\n"],
        ["coprocess reserved first argument", "coproc worker do\n"],
        [
          "coprocess declaration reserved first argument",
          "coproc declare do\n",
        ],
        ["conditional missing operand", "[[ x == ]]\n"],
        ["conditional missing end", "[[ x == y\n"],
        ["conditional regex unclosed group", "[[ x =~ ( ]]\n"],
        ["array missing close", "a=(one two\n"],
        ["ordinary command array argument", "echo a=(one two)\n"],
        ["quoted declaration array argument", '"declare" a=(one two)\n'],
        ["command prefixed declaration", "command declare a=(one)\n"],
        ["builtin prefixed declaration", "builtin declare a=(one)\n"],
        ["extglob collision function", "@() { :; }\n"],
        ["function absent body", "function f()\n"],
        ["arithmetic for missing separator", "for ((i=0;i<2)) do :; done\n"],
        [
          "conditional regex bracket does not quote parenthesis",
          "[[ x =~ [)] ]]\n",
        ],
        [
          "conditional regex unclosed parenthesis inside bracket",
          "[[ x =~ [(] ]]\n",
        ],
        ["conditional regex bracket does not join words", "[[ x =~ [a b] ]]\n"],
        ["conditional unary requires operand", "[[ -n ]]\n"],
        ["conditional misplaced operator", "[[ x -eq ]]\n"],
      ]) {
        test(name, () => {
          const result = parser.parse(source, {});
          assert.equal(result.status, 1, result.output);
          assert.equal(parser.parse(source, {}).tree, result.tree);
        });
      }

      test("Unicode function names do not alias ASCII reserved spellings", () => {
        const actual = nodes("ũf() { :; }\n");
        assert.equal(
          actual.find(({ type }) => type === "function_name")?.text,
          "ũf",
        );
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
          name: "a for brace body loses its required separator",
          seed: "for x; { :; }\n",
          remove: ";",
          insert: "",
          valid: false,
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
          name: "conditional closing delimiter is repaired",
          seed: "[[ x ]]\n",
          remove: "]]",
          insert: "",
          valid: false,
        },
        {
          name: "arithmetic command changes to subshells",
          seed: "((x+1))\n",
          remove: "((x+1))",
          insert: "( (echo x))",
          valid: true,
        },
        {
          name: "arithmetic command loses a close",
          seed: "((x+1))\n",
          remove: "))",
          insert: ")",
          valid: false,
        },
        {
          name: "arithmetic for inserts omitted initializer",
          seed: "for ((;;)) do break; done\n",
          remove: ";;",
          insert: "i=0;;",
          valid: true,
        },
        {
          name: "arithmetic for loses semicolon",
          seed: "for ((i=0;i<2;i++)) do :; done\n",
          remove: "i<2;",
          insert: "i<2",
          valid: false,
        },
        {
          name: "array assignment changes subscript source",
          seed: "a[x+y]=one\n",
          remove: "x+y",
          insert: '"key"',
          valid: true,
        },
        {
          name: "array close is repaired",
          seed: "a=(one [2]=two)\n",
          remove: ")",
          insert: "",
          valid: false,
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
          name: "loop keyword is lost then repaired",
          seed: "for x in a; do echo $x; done\n",
          remove: "done",
          insert: "don",
          valid: false,
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
