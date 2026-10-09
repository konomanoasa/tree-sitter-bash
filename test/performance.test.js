import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { grammars } from "../scripts/tree-sitter.js";
import { applyEdit, createParser } from "./support/parser.js";

const workloads = [
  {
    name: "ERE concatenation",
    sizes: [128, 512, 2048],
    source: (n) => `[[ s =~ x${"a".repeat(n)} ]]\n`,
  },
  {
    name: "ERE alternatives",
    sizes: [128, 512, 2048],
    source: (n) => `[[ s =~ x${"|a".repeat(n)} ]]\n`,
  },
  {
    name: "ERE group depth",
    sizes: [16, 64, 256],
    source: (n) => `[[ s =~ ${"(".repeat(n)}x${")".repeat(n)} ]]\n`,
  },
  {
    name: "ERE bracket members",
    sizes: [128, 512, 2048],
    source: (n) => `[[ s =~ [x${"a".repeat(n)}] ]]\n`,
  },
  {
    name: "ERE quoted group sequence",
    sizes: [32, 128, 512],
    source: (n) => `[[ s =~ "p"(x)${'"q"(a)'.repeat(n)} ]]\n`,
  },
  {
    name: "ERE interval digits",
    sizes: [128, 1024, 8192],
    source: (n) => `[[ s =~ x{${"1".repeat(n)}} ]]\n`,
  },
  {
    name: "ERE collating source",
    sizes: [32, 128, 512],
    source: (n) => `[[ s =~ [[.x${`a\${p}`.repeat(n)}.]] ]]\n`,
  },

  {
    name: "conditional operands",
    sizes: [128, 512, 2048],
    source: (n) => `[[ x${" && a".repeat(n)} ]]\n`,
  },
  {
    name: "array elements",
    sizes: [128, 1024, 8192],
    source: (n) => `a=(x${" a".repeat(n)})\n`,
  },
  {
    name: "arithmetic command operands",
    sizes: [128, 1024, 8192],
    source: (n) => `((x${"+1".repeat(n)}))\n`,
  },

  {
    name: "parameter replacements",
    sizes: [128, 1024, 8192],
    source: (n) => `echo ${`\${x//a/b} `.repeat(n)}\n`,
  },
  {
    name: "extglob alternatives",
    extglobOnly: true,
    sizes: [128, 1024, 8192],
    source: (n) => `echo @(x${"|a".repeat(n)})\n`,
  },
  {
    name: "extglob depth",
    extglobOnly: true,
    sizes: [8, 16, 32],
    source: (n) => `echo ${"@(".repeat(n)}x${")".repeat(n)}\n`,
  },
  {
    name: "conditional extglob alternatives",
    sizes: [128, 1024, 8192],
    source: (n) => `[[ a == @(x${"|a".repeat(n)}) ]]\n`,
  },
  {
    name: "conditional extglob depth",
    sizes: [8, 16, 32],
    source: (n) => `[[ a == ${"@(".repeat(n)}x${")".repeat(n)} ]]\n`,
  },
  {
    name: "brace alternatives",
    sizes: [128, 1024, 8192],
    source: (n) => `echo {x${",a".repeat(n)}}\n`,
  },
  {
    name: "array subscript bytes",
    sizes: [128, 1024, 8192],
    source: (n) => `echo \${a[x${"a".repeat(n)}]}\n`,
  },
  {
    name: "array subscript arithmetic candidates",
    sizes: [128, 1024, 8192],
    source: (n) => `echo \${a[x${"+1".repeat(n)}]}\n`,
  },
  {
    name: "array subscript arithmetic source",
    sizes: [128, 1024, 8192],
    source: (n) => `echo \${a[x${"+1".repeat(n)}+]}\n`,
  },
  {
    name: "array subscript depth",
    sizes: [16, 64, 256],
    source: (n) => `echo \${a[${"a[".repeat(n)}x${"]".repeat(n)}]}\n`,
  },
  {
    name: "current shell substitution depth",
    sizes: [8, 16, 32],
    source: (n) => `echo ${`\${ echo `.repeat(n)}x${"; }".repeat(n)}\n`,
  },
  {
    name: "commands",
    sizes: [128, 1024, 8192],
    source: (n) => "echo value\n".repeat(n),
  },
  {
    name: "quoted words",
    sizes: [128, 1024, 8192],
    source: (n) => `echo "${"value $x ".repeat(n)}"\n`,
  },
  {
    name: "arithmetic operands",
    sizes: [128, 1024, 8192],
    source: (n) => `echo $((x${"+1".repeat(n)}))\n`,
  },
  {
    name: "here document bytes",
    sizes: [4096, 32768, 262144],
    source: (n) => `cat <<EOF\nx${"a".repeat(n)}\nEOF\n`,
  },
  {
    name: "substitution depth",
    sizes: [8, 16, 32],
    source: (n) => `echo ${"$(echo ".repeat(n)}x${")".repeat(n)}\n`,
  },
];

const measurementSamples = 9;

function duration(parser, source, edits, status) {
  const parsed = parser.parse(source, {
    edits,
    arguments: ["-q", "-t", "--json-summary"],
  });
  assert.equal(parsed.status, status, parsed.output);
  let milliseconds;
  if (edits.length === 0) {
    const summary = JSON.parse(
      parsed.output.slice(parsed.output.indexOf("{\n")),
    ).parse_summaries[0];
    milliseconds = summary.duration.secs * 1000 + summary.duration.nanos / 1e6;
  } else {
    const match = parsed.output.match(/Edit: +([0-9.]+) ms/);
    assert.ok(match, parsed.output);
    milliseconds = Number(match[1]);
  }
  assert.ok(Number.isFinite(milliseconds) && milliseconds >= 0, parsed.output);
  return milliseconds;
}

function measure(
  context,
  parser,
  name,
  source,
  edit,
  status = 0,
  reuse = false,
) {
  const edited = applyEdit(source, edit);
  const fresh = parser.parse(edited, {});
  const incremental = parser.parse(source, {
    edits: [edit],
    arguments: reuse ? ["--debug"] : [],
  });
  assert.equal(fresh.status, status, fresh.output);
  assert.equal(incremental.status, status, incremental.output);
  if (status === 0) {
    assert.equal(incremental.tree, fresh.tree, name);
  } else {
    const end = ` - [${edited.split("\n").length - 1}, 0]`;
    for (const result of [fresh, incremental]) {
      assert.ok(result.tree.split("\n")[0].includes(end), result.tree);
    }
  }
  if (reuse) {
    assert.match(incremental.debugOutput, /reuse_node symbol:/, name);
  }
  const freshSamples = [];
  const incrementalSamples = [];
  for (let run = 0; run <= measurementSamples; run++) {
    const freshMs = duration(parser, edited, [], status);
    const incrementalMs = duration(parser, source, [edit], status);
    if (run > 0) {
      freshSamples.push(freshMs);
      incrementalSamples.push(incrementalMs);
    }
  }
  const median = (samples) =>
    samples.sort((a, b) => a - b)[Math.floor(samples.length / 2)];
  const freshMs = median(freshSamples);
  const incrementalMs = median(incrementalSamples);
  context.diagnostic(
    `${name}: bytes=${Buffer.byteLength(edited)}, fresh_ms=${freshMs.toFixed(3)}, incremental_ms=${incrementalMs.toFixed(3)}, ratio=${freshMs === 0 ? "unresolved" : (incrementalMs / freshMs).toFixed(2)}`,
  );
}

for (const grammar of grammars) {
  describe(`${grammar.name}: performance`, () => {
    let parser;
    before(() => {
      parser = createParser(grammar);
    });
    after(() => {
      parser.close();
    });

    for (const {
      name,
      sizes,
      source: createSource,
      extglobOnly,
    } of workloads) {
      if (extglobOnly && !grammar.name.includes("extglob")) continue;
      test(`${name}: records scaling with matching fresh and incremental trees`, (context) => {
        for (const size of sizes) {
          const source = createSource(size);
          const index = source.indexOf(
            name === "commands" || name === "quoted words" ? "value" : "x",
          );
          assert.ok(index >= 0);
          measure(context, parser, `${grammar.name}/${name}/${size}`, source, {
            byte: Buffer.byteLength(source.slice(0, index)),
            deleteBytes: 1,
            insert: "y",
          });
        }
      });
    }

    test("local command edits reuse unchanged source at the head, middle and tail", (context) => {
      const line = "echo aaaa\n";
      for (const rows of [1200, 4800]) {
        const source = line.repeat(rows);
        for (const row of [0, rows / 2, rows - 1]) {
          measure(
            context,
            parser,
            `${grammar.name}/local commands/${rows}/${row}`,
            source,
            {
              byte: line.length * row + 5,
              deleteBytes: 1,
              insert: "b",
            },
            0,
            true,
          );
        }
      }
    });

    test("deleting and restoring function closers measures recovery and repair", (context) => {
      const line = "alpha() { : beta; }\n";
      const source = line.repeat(1200);
      for (const row of [0, 600, 1199]) {
        const byte = line.length * row + line.indexOf("}");
        const edit = { byte, deleteBytes: 1, insert: "" };
        const incomplete = applyEdit(source, edit);
        measure(
          context,
          parser,
          `${grammar.name}/function closer deletion/1200/${row}`,
          source,
          edit,
          1,
        );
        measure(
          context,
          parser,
          `${grammar.name}/function closer repair/1200/${row}`,
          incomplete,
          {
            byte,
            deleteBytes: 0,
            insert: "}",
          },
        );
      }
    });

    test("a final comment edit records fresh and incremental timings", (context) => {
      const source = "# comment\n".repeat(4800);
      measure(context, parser, `${grammar.name}/comments/4800`, source, {
        byte: source.length - 2,
        deleteBytes: 1,
        insert: "x",
      });
    });

    test("quoted here-document edits retain the selected extquote conditions", (context) => {
      const delimiter = grammar.name.includes("noextquote")
        ? `\${x:-$'ab'}`
        : `\${x:-ab}`;
      for (const size of [4096, 32768, 262144]) {
        const prefix = `cat <<"\${x:-$'ab'}"\n`;
        const source = `${prefix}x${"a".repeat(size)}\n${delimiter}\n`;
        measure(
          context,
          parser,
          `${grammar.name}/quoted here document/${size}`,
          source,
          {
            byte: prefix.length,
            deleteBytes: 1,
            insert: "y",
          },
        );
      }
    });
  });
}
