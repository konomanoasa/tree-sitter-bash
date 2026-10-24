import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { grammars } from "../scripts/tree-sitter.js";
import {
  applyEdit,
  assertEditRoundTrip,
  createParser,
  parseNodes,
} from "./support/parser.js";
import { nestedHereDocuments } from "./support/workloads.js";

const delimiterCases = [
  {
    name: "delimiter-quoted-value",
    word: `"\${x:-$'ab'}"`,
    end: `\${x:-ab}`,
  },
  {
    name: "delimiter-unquoted-value",
    word: `\${x:-$'ab'}`,
    end: `\${x:-'ab'}`,
  },
  {
    name: "delimiter-quoted-pattern",
    word: `"\${x#$'ab'}"`,
    end: `\${x#'ab'}`,
  },
  {
    name: "delimiter-quoted-subscript",
    word: `"\${a[$'ab']}"`,
    end: `\${a[ab]}`,
  },
  {
    name: "delimiter-quoted-substring",
    word: `"\${x:$'0'}"`,
    end: `\${x:0}`,
  },
  {
    name: "delimiter-nested-pattern",
    word: `"\${x:-\${y#$'ab'}}"`,
    end: `\${x:-\${y#'ab'}}`,
  },
  {
    name: "delimiter-nested-value",
    word: `"\${x#\${y:-$'ab'}}"`,
    end: `\${x#\${y:-ab}}`,
  },
  {
    name: "delimiter-replacement",
    word: `"\${x/a/$'ab'}"`,
    end: `\${x/a/'ab'}`,
  },
  {
    name: "delimiter-locale-value",
    word: `"\${x:-$"ab"}"`,
    end: `\${x:-ab}`,
  },
  {
    name: "delimiter-locale-subscript",
    word: `"\${a[$"ab"]}"`,
    end: `\${a[ab]}`,
  },
  {
    name: "delimiter-ansi-inner-quote",
    word: `"\${x:-$'a\\"b'}"`,
    end: `\${x:-ab}`,
  },
  {
    name: "delimiter-ansi-inner-escape",
    word: `"\${x:-$'a\\tb'}"`,
    end: `\${x:-a\tb}`,
  },
  {
    name: "delimiter-ansi-backslash",
    word: `"\${x:-$'a\\\\b'}"`,
    end: `\${x:-a\\b}`,
  },
  {
    name: "delimiter-ansi-brace",
    word: `"\${x:-$'a}b'}"`,
    end: `\${x:-a}b}`,
  },
  {
    name: "delimiter-ordinary-ansi",
    word: "$'ab'",
    end: "ab",
  },
  {
    name: "delimiter-ordinary-locale",
    word: '$"ab"',
    end: "ab",
  },
  {
    name: "delimiter-pid-parameter-before-single-quote",
    word: "$$'a'",
    end: "$$a",
  },
  {
    name: "delimiter-pid-parameter-before-double-quote",
    word: '$$"a"',
    end: "$$a",
  },
  {
    name: "delimiter-pid-parameter-before-brace",
    word: "$${",
    end: "$${",
  },
  {
    name: "delimiter-quoted-pid-parameter-before-single-quote",
    word: `"\${v:-$$'a'}"`,
    end: `\${v:-$$'a'}`,
  },
  {
    name: "delimiter-nested-command",
    word: `"$(printf \${x:-$'ab'})"`,
    end: `$(printf \${x:-ab})`,
  },
  {
    name: "delimiter-combined-conditions",
    word: `@("\${x:-$'ab'}"|c)`,
    end: `@("\${x:-ab}"|c)`,
    extglob: true,
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
    test("local here document source ownership survives edits and suspension", () => {
      const fixtures = [
        "cat <<E\n\\$HOME\nE\n",
        "printf %s `cat <<E\n\\\\\\$HOME\nE\n`\n",
        "cat <<OUT\n$(cat <<IN\n\\$HOME\nIN\n)\nOUT\n",
        ': <<OUT "$(cat <<IN\n\\$HOME\nIN\n)"\n$HOME\nOUT\n',
        "cat <<OUT\n`cat <<-'IN'\n\t$HOME\n\tIN\n`\nOUT\n",
      ];
      for (const seed of fixtures) {
        assertEditRoundTrip(parser, {
          seed,
          remove: "HOME",
          insert: "other",
          valid: true,
        });
      }
    });
    test("edits before nested here documents preserve fresh trees after insertion and undo", () => {
      for (const depth of [5, 6, 8]) {
        for (const [open, close] of [
          ["$(", ")"],
          ["$( { ", "}; )"],
          ["${ ", "}"],
        ]) {
          for (const following of ["", "echo next\n"]) {
            const seed = nestedHereDocuments(depth, { open, close, following });
            for (const remove of ["echo BEFORE", "cat <<OUT"]) {
              assertEditRoundTrip(parser, {
                seed,
                remove,
                insert: ` ${remove}`,
                valid: true,
              });
            }
          }
        }
      }
    });
    test("moving a substitution close before its body rejects and repairs locally", () => {
      for (const [open, close] of [
        ["$(", ")"],
        ["`", "`"],
        ["<(", ")"],
        [">(", ")"],
        ["${ ", "}"],
        ["${| ", "}"],
      ]) {
        for (const [before, after] of [
          ["echo BEFORE\n: ", "\necho AFTER\n"],
          ["cat <<OUT\n$(: ", ")\nOUT\necho AFTER\n"],
        ]) {
          const body = "cat <<E\nbody\nE\n";
          const seed = `${before}${open}${body}${close}${after}`;
          assertEditRoundTrip(parser, {
            seed,
            remove: body + close,
            insert: `cat <<E${close === "}" ? "; " : ""}${close}\nbody\nE\n`,
            valid: false,
          });
          assertEditRoundTrip(parser, {
            seed,
            remove: "\nE\n",
            insert: "\nOTHER\n",
            valid: false,
          });
        }
      }
    });
    test("breaking a here document terminator after trailing blanks or a comment restores the sequence", () => {
      for (const seed of [
        "cat <<`cat` # c\nx\n`cat`\n",
        "cat <<`cat`  \nx\n`cat`\n",
        "cat <<-`cat` # c\n\tx\n\t`cat`\n",
        "cat <<`cat` | cat # c\nx\n`cat`\n",
        "cat <<`cat` # c\nx\n`cat`\necho after\n",
      ]) {
        assertEditRoundTrip(parser, {
          seed,
          remove: "`cat`\n",
          insert: "`c[at`\n",
          valid: false,
        });
      }
    });
    test("breaking a here document terminator inside a quoted substitution restores the command", () => {
      for (const [open, close] of [
        ['"$(', ')"'],
        ['"`', '`"'],
        ['"${ ', '}"'],
      ]) {
        assertEditRoundTrip(parser, {
          seed: `echo ${open}cat <<\${x:-E} \nx\n\${x:-E}\n${close}\n`,
          remove: `\${x:-E}\n`,
          insert: `\${x:"-E}\n`,
          valid: false,
        });
      }
      assertEditRoundTrip(parser, {
        seed: `echo "$(cat <<\${x:-E}\n\\$x\n\${x:-E}\n)"\n`,
        remove: `\${x:-E}\n)`,
        insert: `\${x:"-E}\n)`,
        valid: false,
      });
    });
    const extglob = grammar.name === "bash";
    const nodes = (source) => parseNodes(parser, source);
    test("stripped tabs on a final line without a newline end an empty delimiter", () => {
      const seed = "cat <<-''\n\tx\n\t\t";
      assert.deepEqual(
        nodes(seed)
          .filter(({ type }) =>
            ["quoted_here_document_body", "here_document_end"].includes(type),
          )
          .map(({ type, text }) => [type, text]),
        [
          ["quoted_here_document_body", "x\n"],
          ["here_document_end", "\t\t"],
        ],
      );
      assertEditRoundTrip(parser, {
        seed,
        remove: "\t\t",
        insert: "\t\t\n",
        valid: true,
      });
      assertEditRoundTrip(parser, {
        seed,
        remove: "\n\t\t",
        insert: "\n",
        valid: true,
      });
    });
    if (grammar.name === "bash") {
      test("here document Unicode delimiters use UTF-8 independently of locale", () => {
        const source = ": <<$'\\u00e9\\U0001f600'\nbody\né😀\n";
        const originalLocale = process.env.LC_ALL;
        try {
          for (const locale of ["C", "en_US.UTF-8"]) {
            process.env.LC_ALL = locale;
            const actual = nodes(source);
            assert.deepEqual(
              actual
                .filter(({ type }) =>
                  [
                    "dollar_single_quote_escape",
                    "quoted_here_document_body",
                    "here_document_end_text",
                  ].includes(type),
                )
                .map(({ type, text }) => [type, text]),
              [
                ["dollar_single_quote_escape", "\\u00e9"],
                ["dollar_single_quote_escape", "\\U0001f600"],
                ["quoted_here_document_body", "body\n"],
                ["here_document_end_text", "é😀"],
              ],
              locale,
            );
          }
        } finally {
          if (originalLocale === undefined) delete process.env.LC_ALL;
          else process.env.LC_ALL = originalLocale;
        }
      });

      test("a joined here document delimiter retains its original spelling", () => {
        const actual = nodes("cat <<EOF\nbody\nE\\\nOF\n");
        assert.equal(
          actual.find(({ type }) => type === "here_document_end_text")?.text,
          "E\\\nOF",
        );
        assert.equal(
          actual.find(({ type }) => type === "here_document_body")?.text,
          "body\n",
        );
      });

      test("nested here document ends retain continued and Unicode source ranges", () => {
        const source = "cat <<OUT\n$(cat <<IN\n日$x\nI\\\nN\n)\nOUT\n";
        const actual = nodes(source);
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "here_document_end_text")
            .map(({ text }) => text),
          ["I\\\nN", "OUT"],
        );
        const start = Buffer.from(source).indexOf("日$x\n");
        assert.ok(
          actual.some(
            ({ type, field, text, start: begin, end }) =>
              type === "here_document_body" &&
              field === "body" &&
              text === "日$x\n" &&
              begin === start &&
              end === start + 6,
          ),
        );
        const slash = Buffer.from(source).indexOf("\\");
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "line_continuation")
            .map(({ start, end, text }) => [start, end, text]),
          [[slash, slash + 1, "\\"]],
        );
      });

      test("delimiter quoting changes only body expansion recognition", () => {
        const unquoted = nodes("cat <<EOF\n$x\nEOF\n");
        const quoted = nodes("cat <<'EOF'\n$x\nEOF\n");
        assert.equal(
          unquoted.find(({ type }) => type === "parameter_expansion")?.text,
          "$x",
        );
        assert.equal(
          quoted.filter(({ type }) => type === "parameter_expansion").length,
          0,
        );
        assert.equal(
          quoted.find(({ type }) => type === "quoted_here_document_text")?.text,
          "$x",
        );
      });

      test("here strings inside substitutions preserve surrounding arithmetic and braces", () => {
        const source = ": $(( $(cat <<<1) + 2 )) {a,$(cat <<\\\n<x)}\n";
        const actual = nodes(source);
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "arithmetic_binary_expression")
            .map(({ text }) => text),
          ["$(cat <<<1) + 2"],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "brace_expansion")
            .map(({ text }) => text),
          ["{a,$(cat <<\\\n<x)}"],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "here_string_operator")
            .map(({ text }) => text),
          ["<<<", "<<\\\n<"],
        );
        assert.ok(!actual.some(({ type }) => type === "here_document"));
      });

      test("here document delimiter: continued reply prefix preserves the source word", () => {
        const word = `\${|\\\n \tprintf x; }`;
        const delimiter = `\${| \tprintf x; }`;
        const source = `cat << ${word}\n$body\n${delimiter}\nprintf after\n`;
        const actual = nodes(source);
        assert.equal(
          actual.find(({ type }) => type === "here_end")?.text,
          word,
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "here_document_body")
            .map(({ field, text }) => [field, text]),
          [["body", "$body\n"]],
        );
        assert.equal(
          actual.find(({ type }) => type === "here_document_end_text")?.text,
          delimiter,
        );
        assert.ok(
          actual.some(
            ({ type, text }) =>
              type === "parameter_expansion" && text === "$body",
          ),
        );
        assert.ok(
          actual.some(
            ({ field, text }) => field === "name" && text === "printf",
          ),
        );
      });

      for (const source of [
        'cat << @("a b"|c)\n$body\n@(a b|c)\n',
        'cat << ""$(printf "a b")\n$body\n$(printf "a b")\n',
        `cat << \${  :; }\n$body\n\${ :; }\n`,
        `cat << \${| :; }\n$body\n\${|:; }\n`,
        `cat << '\${| :; }'\n$body\n\${|:; }\n`,
      ]) {
        test(`an altered delimiter spelling remains unterminated: ${JSON.stringify(source)}`, () => {
          const actual = nodes(source);
          assert.ok(!actual.some(({ type }) => type === "here_document_end"));
        });
      }

      for (const entry of [
        {
          name: "quoting a here delimiter disables a backquote inside a parameter word",
          seed: `cat <<E\n\${x:-"\`echo \\"1\\"\`"}\nE\n`,
          remove: "<<E",
          insert: "<<'E'",
          valid: true,
        },
        {
          name: "unquoting a here delimiter restores inherited backquote quoting",
          seed: `cat <<'E'\n\${x:-"\`echo \\"1\\"\`"}\nE\n`,
          remove: "<<'E'",
          insert: "<<E",
          valid: true,
        },
        {
          name: "a locale assignment changes without changing a Unicode here delimiter",
          seed: "LC_ALL=C\n: <<$'\\u00e9'\nbody\né\n",
          remove: "LC_ALL=C",
          insert: "LC_ALL=en_US.UTF-8",
          valid: true,
        },
        {
          name: "a here document at a conditional newline gains closing delimiters",
          seed: `: {a,\${ cat <<E && [[\ntext\nE\nx == x ]]; }}\n`,
          remove: "text",
          insert: "]] }",
          valid: true,
        },
        {
          name: "an arithmetic substitution changes a here document to a here string",
          seed: ": $(( $(cat <<E\n1\nE\n) + 2 ))\n",
          remove: "<<E\n1\nE\n",
          insert: "<<<1\n",
          valid: true,
        },
        {
          name: "bracket arithmetic retains a here document containing its closing bracket",
          seed: ": $[ $(cat <<E\n]\nE\n) + 2 ]\n",
          remove: "<<E\n]\nE\n",
          insert: "<<<']'\n",
          valid: true,
        },
        {
          name: "quoting a here delimiter disables bracket arithmetic in its body",
          seed: "cat <<E\n$[1+2]\nE\n",
          remove: "<<E",
          insert: "<<'E'",
          valid: true,
        },
        {
          name: "a bracket arithmetic delimiter changes spelling without evaluating its value",
          seed: "cat <<$[1+2]\nbody\n$[1+2]\n",
          remove: "<<$[1+2]",
          insert: "<<$[1 + 2]",
          valid: true,
        },
        {
          name: "a here string within a brace loses its operand then is repaired",
          seed: ": {a,$(cat <<<x)}\n",
          remove: "<<<x",
          insert: "<<<",
          valid: false,
        },
        {
          name: "a brace delimiter gains a newline and becomes unterminated",
          seed: `cat << \${ :; }\n$x\n\${ :; }\n`,
          remove: `<< \${ `,
          insert: `<< \${\n\t `,
          valid: true,
        },
        {
          name: "a reply delimiter loses layout and no longer matches its terminator",
          seed: `cat << \${| \t:; }\n$x\n\${| \t:; }\n`,
          remove: `<< \${| \t`,
          insert: `<< \${|`,
          valid: true,
        },
        {
          name: "a brace delimiter changes kind before its terminator",
          seed: `cat << \${ :; }\n$x\n\${ :; }\n`,
          remove: `<< \${ `,
          insert: `<< \${| `,
          valid: true,
        },
        {
          name: "an inner reply delimiter gains a newline while an outer document is pending",
          seed: `: <<OUT "$(cat << \${|:; }\n日$x\n\${|:; }\n)"\n$y\nOUT\n`,
          remove: `<< \${|`,
          insert: `<< \${|\n\t`,
          valid: false,
        },
        {
          name: "a process substitution delimiter becomes quoted",
          seed: "cat << <(:)\n$x\n<(:)\n",
          remove: "<< <(:)",
          insert: '<< ""<(:)',
          valid: true,
        },
        {
          name: "a process substitution delimiter changes direction before its terminator",
          seed: "cat << <(:)\n$x\n<(:)\n",
          remove: "<< <",
          insert: "<< >",
          valid: true,
        },
        {
          name: "an outer delimiter quote changes removal inside extglob",
          seed: 'cat << @("a b"|c)\n$x\n@("a b"|c)\n',
          remove: "<< ",
          insert: '<< ""',
          valid: true,
        },
        {
          name: "an ANSI-C delimiter escape changes without changing its value",
          seed: "cat << @($'a\\tb'|c)\n$x\n@('a\tb'|c)\n",
          remove: "\\t",
          insert: "\\x09",
          valid: true,
        },
        {
          name: "a locale quote prefix changes without changing delimiter spelling",
          seed: 'cat << $(printf $"a b")\n$x\n$(printf "a b")\n',
          remove: '$"',
          insert: '"',
          valid: true,
        },
        {
          name: "a process substitution delimiter gains a continued terminator",
          seed: "cat << <(printf 日本)\n$x\n<(printf 日本)\n",
          remove: "$x\n<(printf 日本)",
          insert: "$x\n<(printf 日\\\n本)",
          valid: true,
        },
        {
          name: "an inner process substitution delimiter changes quoting with an outer document pending",
          seed: ': <<OUT "$(cat << <(:)\n$x\n<(:)\n)"\n$y\nOUT\n',
          remove: "<< <(:)",
          insert: '<< ""<(:)',
          valid: true,
        },
        {
          name: "locale quoted delimiter prefix is removed and restored",
          seed: 'cat <<[$"x"]\n$x\n[x]\n',
          remove: '$"',
          insert: '"',
          valid: true,
        },
        {
          name: "locale quoted delimiter closing quote is repaired",
          seed: 'cat <<$"EOF"\n$x\nEOF\n',
          remove: 'EOF"',
          insert: "EOF",
          valid: false,
        },
        {
          name: "here string becomes here document",
          seed: "cat <<<EOF\nEOF\n",
          remove: "<<<",
          insert: "<<",
          valid: true,
        },
        {
          name: "extglob here document delimiter becomes quoted",
          seed: "cat <<@(a|b)\n$x\n@(a|b)\n",
          remove: "<<@(a|b)",
          insert: "<<'@(a|b)'",
          valid: true,
        },
        {
          name: "here document current shell substitution changes kind",
          seed: `cat <<EOF\n\${ printf hi; }\nEOF\n`,
          remove: `\${ `,
          insert: `\${| `,
          valid: true,
        },
        {
          name: "delimiter nested quote boundary is lost then repaired",
          seed: 'cat <<"$(echo "a b")"\nbody\n$(echo a b)\n',
          remove: ')"',
          insert: '"',
          valid: false,
        },
        {
          name: "quoted delimiter changes expansion ownership",
          seed: "cat <<EOF\n$x\nEOF\n",
          remove: "<<EOF",
          insert: "<<'EOF'",
          valid: true,
        },
        {
          name: "here document becomes input redirection",
          seed: "cat <<EOF\nbody\nEOF\n",
          remove: "<<",
          insert: "<",
          valid: true,
        },
        {
          name: "here document end is lost then repaired",
          seed: "cat <<EOF\nbody\nEOF\n",
          remove: "body\nEOF",
          insert: "body\nOTHER",
          valid: true,
        },
        {
          name: "joining a delimiter line",
          seed: "cat <<EOF\nbody\nEOF\n",
          remove: "body\nEOF",
          insert: "body\nE\\\nOF",
          valid: true,
        },
        {
          name: "literal body becomes a substitution",
          seed: "cat <<EOF\nbody\nEOF\n",
          remove: "body",
          insert: "$(echo $x)",
          valid: true,
        },
        {
          name: "nested here document delimiter changes",
          seed: "cat <<EOF\n$(cat <<INNER\nx\nINNER\n)\nEOF\n",
          remove: "INNER",
          insert: "'INNER'",
          valid: true,
        },
        {
          name: "an inner quoted delimiter changes while an outer document is pending",
          seed: ': <<OUT "$(cat <<IN\n$x\nIN\n)"\n$y\nOUT\n',
          remove: "<<IN",
          insert: "<<'IN'",
          valid: true,
        },
        {
          name: "an inner terminator is removed while an outer document is pending",
          seed: ': <<OUT "$(cat <<IN\n$x\nIN\n)"\n$y\nOUT\n',
          remove: "$x\nIN",
          insert: "$x\n",
          valid: false,
        },
        {
          name: "a suspended outer here document loses its terminator",
          seed: "cat <<OUT\n$(cat <<IN\n$x\nIN\n)\nOUT\n",
          remove: ")\nOUT",
          insert: ")\n",
          valid: true,
        },
        {
          name: "a backquote here document gains a continued terminator",
          seed: "echo `cat <<EOF\n$x\nEOF\n`\n",
          remove: "$x\nEOF",
          insert: "$x\nE\\\\\nOF",
          valid: true,
        },
        {
          name: "tab stripping exposes a later delimiter line as a command",
          seed: "cat <<EOF\n\tEOF\nEOF\n",
          remove: "<<",
          insert: "<<-",
          valid: true,
        },
        {
          name: "an empty delimiter becomes a quoted nonempty delimiter",
          seed: "cat <<'' <<EOF\n$v\n\n$w\nEOF\n",
          remove: "'' <<EOF\n$v\n",
          insert: "'END' <<EOF\n$v\nEND",
          valid: true,
        },
      ]) {
        test(entry.name, () => assertEditRoundTrip(parser, entry));
      }
    }

    test("delimiter quote removal retains the newline in a parameter dollar quote", () => {
      const end = `\${x:-ab}`;
      for (const [prefix, suffix] of [
        ["", ""],
        [": $(", ")\n"],
        [": {a,$(", ")}\n"],
      ]) {
        const source = `${prefix}: <<"\${x:-$'\\\nab'}"\nbody\n${end}\n${suffix}`;
        const parsed = parser.parse(source, {});
        assert.equal(parsed.status, prefix === "" ? 0 : 1, source);
        assert.ok(!parsed.tree.includes("(here_document_end "));
        const repair = {
          byte: source.indexOf("\\\n"),
          deleteBytes: 2,
          insert: "",
        };
        const fresh = parser.parse(applyEdit(source, repair), {});
        assert.equal(fresh.status, 0, fresh.output);
        assert.equal(
          parser.parse(source, { edits: [repair] }).tree,
          fresh.tree,
        );
      }
    });

    test("more than sixteen pending documents keep declaration order and input ownership", () => {
      for (const count of [16, 17, 32]) {
        const declarations = " <<E".repeat(count);
        const terminators = "E\n".repeat(count);
        const local = `:${declarations}\n${terminators}`;
        for (const source of [
          local,
          `: "$(${local})"\n`,
          `: <<OUT\n$(${local})\nOUT\n`,
          `${": <<E; ".repeat(count)}\n${terminators}`,
        ]) {
          assert.equal(parser.parse(source, {}).status, 0, source);
        }
        const bodies = Array.from(
          { length: count },
          (_, index) => `body ${index}\n`,
        );
        const actual = nodes(
          `:${declarations}\n${bodies.map((body) => `${body}E\n`).join("")}`,
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "here_document_body")
            .map(({ text }) => text),
          bodies,
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "here_document_end_text")
            .map(({ text }) => text),
          Array(count).fill("E"),
        );
        const source = ": $(: <<E\nE\n); ".repeat(count);
        assert.equal(parser.parse(source, {}).status, 0, source);
        assert.equal(parser.parse(": <<E\nE\n".repeat(count), {}).status, 0);
      }
      const outer = " <<OUT".repeat(16);
      const ends = "OUT\n".repeat(16);
      const nested = `:${outer} "$(:${" <<IN".repeat(16)}\n${"IN\n".repeat(16)})"\n${ends}`;
      assert.equal(parser.parse(nested, {}).status, 0, nested);
      assert.equal(
        parser.parse(`:${outer}; { : <<IN; }\n${ends}IN\n`, {}).status,
        0,
      );
      assertEditRoundTrip(parser, {
        seed: `:${outer}\n${ends}`,
        remove: "\n",
        insert: " <<OUT\nOUT\n",
        valid: true,
      });
    });

    test("substitution boundaries reject pending documents and recover after completion", () => {
      for (const [name, prefix, closer] of [
        ["command", ": $(cat <<E", ")"],
        ["quoted command", ': "$(cat <<E', ')"'],
        ["nested command", ": $(: $(cat <<E", "))"],
        ["input process", ": <(cat <<E", ")"],
        ["output process", ": >(cat <<E", ")"],
        ["backquote", ": `cat <<E", "`"],
        ["quoted backquote", ': "`cat <<E', '`"'],
        ["current shell", ": ${ cat <<E;", " }"],
        ["reply", ": ${| cat <<E;", " }"],
        ["current shell list", ": ${ cat <<E; :;", " }"],
        ["reply pipeline", ": ${| cat <<E | :;", " }"],
      ]) {
        const incomplete = `${prefix}${closer}\n`;
        const completion = "\nbody\nE\n";
        const complete = `${prefix}${completion}${closer}\n`;
        const options = { arguments: ["-c"] };
        const fresh = parser.parse(incomplete, options);
        assert.equal(fresh.status, 1, name);
        assert.equal(parser.parse(`${incomplete}E\n`, options).status, 1, name);
        assert.ok(!fresh.tree.includes("here_document_end"));
        const original = parser.parse(complete, options);
        assert.equal(original.status, 0, `${name}\n${original.output}`);
        const insert = {
          byte: Buffer.byteLength(prefix),
          deleteBytes: 0,
          insert: completion,
        };
        const remove = {
          byte: insert.byte,
          deleteBytes: Buffer.byteLength(completion),
          insert: "",
        };
        const broken = parser.parse(complete, { ...options, edits: [remove] });
        assert.equal(broken.status, 1, `${name}\n${broken.output}`);
        for (const [source, edits] of [
          [incomplete, [insert]],
          [complete, [remove, insert]],
        ]) {
          const repaired = parser.parse(source, { ...options, edits });
          assert.equal(repaired.status, 0, `${name}\n${repaired.output}`);
          assert.equal(repaired.tree, original.tree, name);
        }
      }
      const source = "cat <<OUT $(:) `:`\nbody\nOUT\n";
      assert.equal(parser.parse(source, {}).status, 0);
    });

    test("delimiter spelling preserves control bytes and layout through edits", () => {
      for (const [word, end, nonEnd] of [
        ["\x01", "\x01", "\x01\x01"],
        ["\x7f", "\x7f", "\x01\x7f"],
        ["'\x01'", "\x01", "\x01\x01"],
        ['"\x7f"', "\x7f", "\x01\x7f"],
        ['""\x01', "\x01", "\x01\x01"],
        ["\x7f''", "\x7f", "\x01\x7f"],
        ["\\\x01''", "\x01", "\x01\x01"],
        ['"\\\x7f"', "\\\x7f", "\\\x01\x7f"],
        ["\\\x01\x7f''", "\x01\x7f", "\x01\x01\x7f"],
        ["'\\\x01'", "\\\x01", "\\\x01\x01"],
        ["$'\x01'", "\x01", "\x01\x01"],
        ["$'\\x01'", "\x01", "\x01\x01"],
        ["$'\\177'", "\x7f", "\x01\x7f"],
        ["$'\\u0001'", "\x01", "\x01\x01"],
        ["$'\\c?'", "\x7f", "\x01\x7f"],
        ["A$'\\x01'B", "A\x01B", "A\x01\x01B"],
        ["$'\\x01\\x7f\\x01'", "\x01\x7f\x01", "\x01\x01\x01\x7f\x01\x01"],
        ["$'A\\0\\x01'$'\\x7f'", "A\x7f", "A\x01\x7f"],
        [`"\${x:-$'\\x01'}"`, `\${x:-\x01}`, `\${x:-\x01\x01}`],
        [`\${x:-$'\\x01'}`, `\${x:-'\x01'}`, `\${x:-'\x01\x01'}`],
        [`"$(printf $'\\x7f')"`, `$(printf '\x7f')`, `$(printf '\x01\x7f')`],
        [`\${\t :; }`, `\${\t :; }`, `\${ :; }`],
        [`\${| \t:; }`, `\${| \t:; }`, `\${|:; }`],
        [`\${|\\\n \t:; }`, `\${| \t:; }`, `\${|:; }`],
        [`""\${| \tprintf "x"; }`, `\${| \tprintf x; }`, `\${|printf x; }`],
        [`"\${\tprintf $'x'; }"`, `\${\tprintf 'x'; }`, `\${ printf 'x'; }`],
      ]) {
        const body = `body\n${nonEnd}\n`;
        const seed = `cat <<${word}\n${body}${end}\necho AFTER\n`;
        const actual = nodes(seed);
        const delimiter = actual.find(({ type }) => type === "here_end");
        assert.equal(delimiter?.text, word);
        assert.equal(delimiter?.start, 6);
        assert.equal(delimiter?.end, 6 + Buffer.byteLength(word));
        assert.deepEqual(
          actual
            .filter(({ type }) =>
              ["here_document_body", "quoted_here_document_body"].includes(
                type,
              ),
            )
            .map(({ text }) => text),
          [body],
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "here_document_end_text")
            .map(({ text, start, end: endByte }) => [text, start, endByte]),
          [
            [
              end,
              Buffer.byteLength(`cat <<${word}\n${body}`),
              Buffer.byteLength(`cat <<${word}\n${body}${end}`),
            ],
          ],
        );
        assert.ok(
          actual.some(
            ({ type, text }) =>
              type === "simple_command" && text === "echo AFTER",
          ),
        );
        assertEditRoundTrip(parser, {
          seed,
          remove: word,
          insert: "E",
          valid: true,
        });
      }
    });

    test("decoded delimiter byte edits retain incomplete UTF-8 and restore matching", () => {
      for (const [word, end, remove] of [
        ["$'\\xc3\\xa9'", "é", "\\xa9"],
        ["$'\\303\\251'", "é", "\\251"],
        ["$'\\xc3'$'\\xa9'", "é", "\\xa9"],
        ["$'\\xc3'\"\"$'\\xa9'", "é", "\\xa9"],
        ["$'\\xc3\\0'$'\\xa9'", "é", "\\xa9"],
        ["$'\\xe3\\x81\\x82'", "あ", "\\x82"],
        ["$'\\xf0\\x9f\\x98\\x80'", "😀", "\\x80"],
        [`"\${x:-$'\\xc3\\xa9'}"`, `\${x:-é}`, "\\xa9"],
      ]) {
        const seed = `cat <<${word}\nbody\n${end}\necho AFTER\n`;
        const actual = nodes(seed);
        assert.equal(
          actual.find(({ type }) => type === "here_end")?.text,
          word,
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "here_document_end_text")
            .map(({ text }) => text),
          [end],
        );
        assert.ok(
          actual.some(
            ({ type, text }) =>
              type === "simple_command" && text === "echo AFTER",
          ),
        );
        const incomplete = nodes(seed.replace(remove, ""));
        assert.equal(
          incomplete.find(({ type }) => type === "here_end")?.text,
          word.replace(remove, ""),
        );
        assert.ok(!incomplete.some(({ type }) => type === "here_document_end"));
        assert.equal(
          incomplete.find(({ type }) => type === "quoted_here_document_body")
            ?.text,
          `body\n${end}\necho AFTER\n`,
        );
        assertEditRoundTrip(parser, { seed, remove, insert: "", valid: true });
      }
    });

    test("multibyte control escapes preserve source and do not invent terminators", () => {
      for (const [word, asciiWord, end] of [
        ["$'\\cé'", "$'\\cI'", "\t"],
        ["$'\\cあ'", "$'\\cB'", "\u0002"],
        ["$'\\c😀'", "$'\\c@'", ""],
        [`"\${x:-$'\\cé'}"`, `"\${x:-$'\\cI'}"`, `\${x:-\t}`],
      ]) {
        const body = `body\n${end}\n�\necho AFTER\n`;
        const source = `cat <<${word}\n${body}`;
        const actual = nodes(source);
        const delimiter = actual.find(({ type }) => type === "here_end");
        assert.equal(delimiter?.text, word);
        assert.equal(delimiter?.start, 6);
        assert.equal(delimiter?.end, 6 + Buffer.byteLength(word));
        assert.ok(!actual.some(({ type }) => type === "here_document_end"));
        assert.equal(
          actual.find(({ type }) => type === "quoted_here_document_body")?.text,
          body,
        );
        const seed = `cat <<${asciiWord}\n${body}`;
        assert.deepEqual(
          nodes(seed)
            .filter(({ type }) => type === "here_document_end")
            .map(({ text }) => text),
          [`${end}\n`],
        );
        assertEditRoundTrip(parser, {
          seed,
          remove: asciiWord,
          insert: word,
          valid: true,
        });
      }
    });

    test("undecodable delimiter bytes are rejected and repaired without losing body bytes", () => {
      for (const byte of [0xff, 0x80, 0xe3]) {
        const invalid = Buffer.from([byte]);
        for (const [open, close, endOpen, endClose] of [
          ["", "", "", ""],
          ["'", "'", "", ""],
          ['"', '"', "", ""],
          ["\\", "", "", ""],
          ["$'", "'", "", ""],
          ["$(echo ", ")", "$(echo ", ")"],
          ["`echo ", "`", "`echo ", "`"],
          ['"${x:-', '}"', "${x:-", "}"],
          ["\"${x:-$'", "'}\"", "${x:-", "}"],
        ]) {
          const prefix = Buffer.from(`cat <<${open}`);
          const suffix = Buffer.concat([
            Buffer.from(`${close}\nbody\n${endOpen}`),
            invalid,
            Buffer.from(`${endClose}\n${endOpen}E${endClose}\n`),
          ]);
          const source = Buffer.concat([prefix, invalid, suffix]);
          const rejected = parser.parse(source, {});
          assert.equal(rejected.status, 1, rejected.output);
          const repaired = parser.parse(source, {
            arguments: ["-c"],
            edits: [{ byte: prefix.length, deleteBytes: 1, insert: "E" }],
          });
          const fresh = parser.parse(
            Buffer.concat([prefix, Buffer.from("E"), suffix]),
            { arguments: ["-c"] },
          );
          assert.equal(fresh.status, 0, fresh.output);
          assert.equal(repaired.status, 0, repaired.output);
          assert.equal(repaired.tree, fresh.tree);
        }
      }
    });

    test("undecodable body bytes retain their ranges and differ from a valid replacement character", () => {
      for (const byte of [0xff, 0x80, 0xe3]) {
        for (const delimiter of ["E", "'E'"]) {
          const prefix = Buffer.from(`cat <<${delimiter}\n`);
          const body = Buffer.from([byte, 10]);
          const source = Buffer.concat([prefix, body, Buffer.from("E\n")]);
          const nodes = parseNodes(parser, source);
          const bodyNode = nodes.find(
            ({ type }) =>
              type === "here_document_body" ||
              type === "quoted_here_document_body",
          );
          assert.ok(bodyNode);
          assert.equal(bodyNode.start, prefix.length);
          assert.equal(bodyNode.end, prefix.length + body.length);
          assert.deepEqual(source.subarray(bodyNode.start, bodyNode.end), body);
        }
      }
      const source = "cat <<�\nbody\n�\n";
      assert.equal(parser.parse(source, {}).status, 0);
    });

    test("EOF acceptance depends on shell structure rather than here-document terminators", () => {
      const declarations = [
        ["declaration", "cat <<EOF"],
        ["trailing blank", "cat <<EOF \t"],
        ["trailing comment", "cat <<EOF # comment"],
        ["trailing continuation", "cat <<EOF \\\n"],
        ["quoted delimiter", "cat <<'EOF'"],
        ["ANSI-C delimiter", "cat <<$'EOF'"],
        ["tab stripping", "cat <<-EOF"],
        ["multiple declarations", "cat <<FIRST <<SECOND"],
        ["following command", "cat <<EOF; echo after"],
        ["background command", "cat <<EOF &"],
        ["pipeline", "cat <<EOF | cat"],
        ["stderr pipeline", "cat <<EOF |& cat"],
        ["and-list", "cat <<EOF && echo after"],
        ["brace group", "{ cat <<EOF; }"],
        ["subshell", "(cat <<EOF)"],
        ["function", "f() { cat <<EOF; }"],
        ["timed command", "time cat <<EOF"],
        ["coprocess", "coproc cat <<EOF"],
      ];
      for (const [name, source] of [
        ...declarations.flatMap(([name, header]) =>
          ["", "\n", "\nbody", "\nbody\n"].map((suffix) => [
            `${name}, suffix ${JSON.stringify(suffix)}`,
            header + suffix,
          ]),
        ),
        ["empty delimiter", "cat <<''"],
        ["empty delimiter, newline", "cat <<''\n"],
        ["empty delimiter, body", "cat <<''\nbody\n"],
        ["second body", "cat <<FIRST <<SECOND\nFIRST\n"],
        ["later declaration", "cat <<FIRST\nFIRST\ncat <<SECOND"],
      ]) {
        const parsed = parser.parse(source, {});
        assert.equal(parsed.status, 0, `${name}\n${parsed.output}`);
        assert.doesNotMatch(parsed.tree, /\((ERROR|MISSING)[ \n]/, name);
      }
    });

    test("a backslash before physical EOF stays in the delimiter", () => {
      for (const [source, delimiter] of [
        ["cat <<EOF\\", "EOF\\"],
        ["cat <<\\", "\\"],
        ["cat <<'EOF'\\", "'EOF'\\"],
      ]) {
        assert.deepEqual(
          nodes(source)
            .filter(({ type }) => type === "here_end")
            .map(({ text }) => text),
          [delimiter],
          source,
        );
      }
    });

    test("omitted terminators preserve bodies and enclosing document queues", () => {
      for (const { source, bodies, ends, names } of [
        {
          source: "cat <<''\n  a\n  b\n  ''\n",
          bodies: ["  a\n  b\n  ''\n"],
          ends: [],
          names: ["cat"],
        },
        {
          source: "cat <<A <<B\nA\nbody\n",
          bodies: ["body\n"],
          ends: ["A"],
          names: ["cat"],
        },
        {
          source: ': <<OUT "$(cat <<IN\ninner\nIN\n)"\n$x\n',
          bodies: ["inner\n", "$x\n"],
          ends: ["IN"],
          names: [":", "cat"],
        },
        {
          source: "cat <<OUT\n`cat <<IN\nbody\nIN\n`\n",
          bodies: ["`cat <<IN\nbody\nIN\n`\n", "body\n"],
          ends: ["IN"],
          names: ["cat", "cat"],
        },
      ]) {
        const actual = parseNodes(parser, source);
        assert.deepEqual(
          actual
            .filter(({ type }) =>
              ["here_document_body", "quoted_here_document_body"].includes(
                type,
              ),
            )
            .map(({ text }) => text),
          bodies,
        );
        assert.deepEqual(
          actual
            .filter(({ type }) => type === "here_document_end_text")
            .map(({ text }) => text),
          ends,
        );
        assert.equal(
          actual.filter(({ type }) => type === "here_document_end").length,
          ends.length,
        );
        assert.deepEqual(
          actual
            .filter(({ field, type }) => field === "name" && type === "word")
            .map(({ text }) => text),
          names,
        );
      }
    });

    test("removed EOF tails stay inside here documents through completion and undo", () => {
      for (const body of ["", "x\n"]) {
        for (const [tail, continuations] of [
          ["\t", 0],
          ["\\\n", 1],
          ["\\\n\t", 1],
          ["\t\\\n", 1],
          ["\t\\\n\t\\\n\t", 2],
        ]) {
          const seed = `cat <<-E\n${body}${tail}`;
          const actual = nodes(seed);
          const document = actual.find(({ type }) => type === "here_document");
          assert.ok(document, seed);
          assert.equal(document.text, body + tail, seed);
          assert.deepEqual(
            actual
              .filter(({ type }) =>
                ["here_document_body", "quoted_here_document_body"].includes(
                  type,
                ),
              )
              .map(({ field, text }) => [field, text]),
            body === "" ? [] : [["body", body]],
            seed,
          );
          assert.equal(
            actual.filter(({ type }) => type === "here_document_end").length,
            0,
            seed,
          );
          const removed = actual.filter(
            ({ type }) => type === "line_continuation",
          );
          assert.equal(removed.length, continuations, seed);
          for (const node of removed) {
            assert.equal(node.text, "\\", seed);
            assert.ok(
              node.start >= document.start && node.end <= document.end,
              seed,
            );
          }
          assertEditRoundTrip(parser, {
            seed,
            remove: tail,
            insert: `${tail}E\necho after\n`,
            valid: true,
          });
        }
      }
    });

    test("pending here-documents preserve fresh trees through EOF edits and completion", () => {
      for (const [name, header, ending] of [
        ["plain", "cat <<EOF", "\nbody\nEOF"],
        ["quoted", "cat <<'EOF'", "\n$literal\nEOF\n"],
        ["empty delimiter", "cat <<''", "\nbody\n\n"],
        ["tabs", "cat <<-EOF", "\n\tbody\n\tEOF\n"],
        ["comment", "cat <<EOF # comment", "\nbody\nEOF\n"],
        ["continuation", "cat <<EOF \\\n", "\nbody\nEOF\n"],
        ["following command", "cat <<EOF; echo after", "\nbody\nEOF\n"],
        ["multiple", "cat <<FIRST <<SECOND", "\nFIRST\nSECOND\n"],
        ["extquote delimiter", `cat <<"\${x:-$'ab'}"`, `\nbody\n\${x:-ab}\n`],
      ]) {
        const source = header + ending;
        const options = { arguments: ["-c"] };
        const original = parser.parse(source, options);
        assert.equal(original.status, 0, `${name}\n${original.output}`);
        const remove = {
          byte: Buffer.byteLength(header),
          deleteBytes: Buffer.byteLength(ending),
          insert: "",
        };
        const restore = { byte: remove.byte, deleteBytes: 0, insert: ending };
        const incomplete = parser.parse(source, {
          ...options,
          edits: [remove],
        });
        assert.equal(incomplete.status, 0, `${name}\n${incomplete.output}`);
        assert.equal(incomplete.tree, parser.parse(header, options).tree);
        for (const [initial, edits] of [
          [header, [restore]],
          [source, [remove, restore]],
        ]) {
          const repaired = parser.parse(initial, { ...options, edits });
          assert.equal(repaired.status, 0, `${name}\n${repaired.output}`);
          assert.equal(repaired.tree, original.tree, name);
        }
      }
    });

    for (const [name, prefix, delimiter, suffix] of [
      ["parameter", "cat <<EOF\n${value:-\n", "EOF\n", "}\nEOF\nafter\n"],
      ["arithmetic", "cat <<EOF\n$((1 +\n", "EOF\n", "))\nEOF\nafter\n"],
      ["command", "cat <<EOF\n$(printf x\n", "EOF\n", ")\nEOF\nafter\n"],
      ["backquote", "cat <<EOF\n`printf x\n", "EOF\n", "`\nEOF\nafter\n"],
      ["current shell", "cat <<EOF\n${ printf x\n", "EOF\n", "}\nEOF\nafter\n"],
      ["reply", "cat <<EOF\n${| printf x\n", "EOF\n", "}\nEOF\nafter\n"],
      ["subscript", "cat <<EOF\n${a[\n", "EOF\n", "]}\nEOF\nafter\n"],
      ["substring", "cat <<EOF\n${value:\n", "EOF\n", "}\nEOF\nafter\n"],
      ["extglob", "cat <<EOF\n${value#@(\n", "EOF\n", ")}\nEOF\nafter\n"],
      ["double quote", 'cat <<EOF\n${value:-"\n', "EOF\n", '"}\nEOF\nafter\n'],
      ["single quote", "cat <<EOF\n${value#'\n", "EOF\n", "'}\nEOF\nafter\n"],
      [
        "dollar single quote",
        "cat <<EOF\n${value#$'\n",
        "EOF\n",
        "'}\nEOF\nafter\n",
      ],
      [
        "nested document",
        "cat <<EOF\n$(cat <<INNER\n",
        "EOF\n",
        "INNER\n)\nEOF\nafter\n",
      ],
      [
        "nested quoted document",
        "cat <<EOF\n$(cat <<'INNER'\n",
        "EOF\n",
        "INNER\n)\nEOF\nafter\n",
      ],
      [
        "stripped tabs",
        "cat <<-EOF\n${value:-\n",
        "\tEOF\n",
        "}\nEOF\nafter\n",
      ],
      [
        "continued delimiter",
        "cat <<EOF\n${value:-\n",
        "E\\\nOF\n",
        "}\nEOF\nafter\n",
      ],
    ]) {
      test(`here-document delimiter bounds ${name} before its later closer`, () => {
        const source = `${prefix}x${delimiter}${suffix}`;
        const options = { arguments: ["-c"] };
        const original = parser.parse(source, options);
        assert.equal(original.status, 0, original.output);
        const remove = {
          byte: Buffer.byteLength(prefix),
          deleteBytes: 1,
          insert: "",
        };
        const fresh = parser.parse(`${prefix}${delimiter}${suffix}`, options);
        const incremental = parser.parse(source, {
          ...options,
          edits: [remove],
        });
        assert.equal(fresh.status, 1, fresh.output);
        assert.equal(incremental.status, 1, incremental.output);
        const undo = { byte: remove.byte, deleteBytes: 0, insert: "x" };
        const repaired = parser.parse(source, {
          ...options,
          edits: [remove, undo],
        });
        assert.equal(repaired.status, 0, repaired.output);
        assert.equal(repaired.tree, original.tree);
      });
    }

    for (const entry of delimiterCases) {
      test(entry.name, () => {
        const end = entry.end;
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
  });
}
