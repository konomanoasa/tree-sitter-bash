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
        ["echo BEFORE\n{ coproc C }\necho AFTER\n", " }", " x }"],
        [
          "echo BEFORE\nif :; then { echo SAME; } >out; fi\necho AFTER\n",
          "; fi",
          " fi",
        ],
      ]) {
        assertEditRoundTrip(parser, { seed, remove, insert, valid: false });
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
    ]) {
      test(`${entry.name}: repairs restore the fresh CST`, () => {
        assertEditRoundTrip(parser, entry);
      });
    }

    if (grammar.name === "bash_extglob") {
      for (const entry of [
        {
          name: "a for brace body loses its required separator",
          seed: "for x; { :; }\n",
          remove: ";",
          insert: "",
          valid: false,
        },
        {
          name: "conditional closing delimiter is repaired",
          seed: "[[ x ]]\n",
          remove: "]]",
          insert: "",
          valid: false,
        },
        {
          name: "arithmetic command loses a close",
          seed: "((x+1))\n",
          remove: "))",
          insert: ")",
          valid: false,
        },
        {
          name: "arithmetic for loses semicolon",
          seed: "for ((i=0;i<2;i++)) do :; done\n",
          remove: "i<2;",
          insert: "i<2",
          valid: false,
        },
        {
          name: "array close is repaired",
          seed: "a=(one [2]=two)\n",
          remove: ")",
          insert: "",
          valid: false,
        },
        {
          name: "loop keyword is lost then repaired",
          seed: "for x in a; do echo $x; done\n",
          remove: "done",
          insert: "don",
          valid: false,
        },
        {
          name: "a here string within a brace loses its operand then is repaired",
          seed: ": {a,$(cat <<<x)}\n",
          remove: "<<<x",
          insert: "<<<",
          valid: false,
        },
        {
          name: "locale quoted delimiter closing quote is repaired",
          seed: 'cat <<$"EOF"\n$x\nEOF\n',
          remove: 'EOF"',
          insert: "EOF",
          valid: false,
        },
        {
          name: "delimiter nested quote boundary is lost then repaired",
          seed: 'cat <<"$(echo "a b")"\nbody\n$(echo a b)\n',
          remove: ')"',
          insert: '"',
          valid: false,
        },
        {
          name: "an inner terminator is removed while an outer document is pending",
          seed: ': <<OUT "$(cat <<IN\n$x\nIN\n)"\n$y\nOUT\n',
          remove: "$x\nIN",
          insert: "$x\n",
          valid: false,
        },
      ]) {
        test(entry.name, () => assertEditRoundTrip(parser, entry));
      }
    }
  });
}
