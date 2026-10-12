import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { grammars } from "../scripts/tree-sitter.js";
import { applyEdit, createParser } from "./support/parser.js";

const conditionElementCounts = [128, 512, 2048];
const deepNestingDepths = [16, 64, 256];
const ereSourceSegmentCounts = [32, 128, 512];
const intervalDigitCounts = [128, 1024, 8192];
const sequenceElementCounts = [128, 1024, 8192];
const wordCharacterCounts = [128, 1024, 8192];
const normalNestingDepths = [8, 16, 32];
const hereDocumentBodyCharacters = [4096, 32768, 262144];
const localCommandRows = [1200, 4800];
const functionRows = 1200;
const commentRows = 4800;
const measurementSamples = 9;
const warmupSamples = 1;

const workloads = [
  {
    name: "ERE concatenation",
    sizes: conditionElementCounts,
    source: (n) => `[[ s =~ x${"a".repeat(n)} ]]\n`,
  },
  {
    name: "ERE alternatives",
    sizes: conditionElementCounts,
    source: (n) => `[[ s =~ x${"|a".repeat(n)} ]]\n`,
  },
  {
    name: "ERE group depth",
    sizes: deepNestingDepths,
    source: (n) => `[[ s =~ ${"(".repeat(n)}x${")".repeat(n)} ]]\n`,
  },
  {
    name: "ERE bracket members",
    sizes: conditionElementCounts,
    source: (n) => `[[ s =~ [x${"a".repeat(n)}] ]]\n`,
  },
  {
    name: "ERE quoted group sequence",
    sizes: ereSourceSegmentCounts,
    source: (n) => `[[ s =~ "p"(x)${'"q"(a)'.repeat(n)} ]]\n`,
  },
  {
    name: "ERE interval digits",
    sizes: intervalDigitCounts,
    source: (n) => `[[ s =~ x{${"1".repeat(n)}} ]]\n`,
  },
  {
    name: "ERE collating source",
    sizes: ereSourceSegmentCounts,
    source: (n) => `[[ s =~ [[.x${`a\${p}`.repeat(n)}.]] ]]\n`,
  },

  {
    name: "conditional operands",
    sizes: conditionElementCounts,
    source: (n) => `[[ x${" && a".repeat(n)} ]]\n`,
  },
  {
    name: "array elements",
    sizes: sequenceElementCounts,
    source: (n) => `a=(x${" a".repeat(n)})\n`,
  },
  {
    name: "arithmetic command operands",
    sizes: sequenceElementCounts,
    source: (n) => `((x${"+1".repeat(n)}))\n`,
  },

  {
    name: "parameter replacements",
    sizes: sequenceElementCounts,
    source: (n) => `echo ${`\${x//a/b} `.repeat(n)}\n`,
  },
  {
    name: "extglob alternatives",
    extglobOnly: true,
    sizes: sequenceElementCounts,
    source: (n) => `echo @(x${"|a".repeat(n)})\n`,
  },
  {
    name: "extglob depth",
    extglobOnly: true,
    sizes: normalNestingDepths,
    source: (n) => `echo ${"@(".repeat(n)}x${")".repeat(n)}\n`,
  },
  {
    name: "conditional extglob alternatives",
    sizes: sequenceElementCounts,
    source: (n) => `[[ a == @(x${"|a".repeat(n)}) ]]\n`,
  },
  {
    name: "conditional extglob depth",
    sizes: normalNestingDepths,
    source: (n) => `[[ a == ${"@(".repeat(n)}x${")".repeat(n)} ]]\n`,
  },
  {
    name: "brace alternatives",
    sizes: sequenceElementCounts,
    source: (n) => `echo {x${",a".repeat(n)}}\n`,
  },
  {
    name: "array subscript bytes",
    sizes: wordCharacterCounts,
    source: (n) => `echo \${a[x${"a".repeat(n)}]}\n`,
  },
  {
    name: "array subscript arithmetic candidates",
    sizes: sequenceElementCounts,
    source: (n) => `echo \${a[x${"+1".repeat(n)}]}\n`,
  },
  {
    name: "array subscript arithmetic source",
    sizes: sequenceElementCounts,
    source: (n) => `echo \${a[x${"+1".repeat(n)}+]}\n`,
  },
  {
    name: "array subscript depth",
    sizes: deepNestingDepths,
    source: (n) => `echo \${a[${"a[".repeat(n)}x${"]".repeat(n)}]}\n`,
  },
  {
    name: "current shell substitution depth",
    sizes: normalNestingDepths,
    source: (n) => `echo ${`\${ echo `.repeat(n)}x${"; }".repeat(n)}\n`,
  },
  {
    name: "commands",
    editTarget: "value",
    sizes: sequenceElementCounts,
    source: (n) => "echo value\n".repeat(n),
  },
  {
    name: "quoted words",
    editTarget: "value",
    sizes: sequenceElementCounts,
    source: (n) => `echo "${"value $x ".repeat(n)}"\n`,
  },
  {
    name: "arithmetic operands",
    sizes: sequenceElementCounts,
    source: (n) => `echo $((x${"+1".repeat(n)}))\n`,
  },
  {
    name: "bracket arithmetic operands",
    sizes: sequenceElementCounts,
    source: (n) => `echo $[x${"+1".repeat(n)}]\n`,
  },
  {
    name: "bracket arithmetic depth",
    sizes: normalNestingDepths,
    source: (n) => `echo ${"$[".repeat(n)}x${"]".repeat(n)}\n`,
  },
  {
    name: "here document bytes",
    sizes: hereDocumentBodyCharacters,
    source: (n) => `cat <<EOF\nx${"a".repeat(n)}\nEOF\n`,
  },
  {
    name: "inherited here document bytes",
    sizes: hereDocumentBodyCharacters,
    source: (n) => `: "$(cat <<E)" $foo\\\nx${"a".repeat(n)}\nE\nbar\n`,
  },
  {
    name: "substitution depth",
    sizes: normalNestingDepths,
    source: (n) => `echo ${"$(echo ".repeat(n)}x${")".repeat(n)}\n`,
  },
  {
    name: "process substitution command words",
    sizes: sequenceElementCounts,
    source: (n) => `<(echo ${"a ".repeat(n)}x) arg\n`,
  },
  {
    name: "function name process substitutions",
    sizes: sequenceElementCounts,
    source: (n) => `${"<(:)".repeat(n)}x() { :; }\n`,
  },
  {
    name: "function name process substitution depth",
    sizes: normalNestingDepths,
    source: (n) => `${"<(echo ".repeat(n)}x${")".repeat(n)}() { :; }\n`,
  },
];

function editRows(count) {
  return [0, Math.floor(count / 2), count - 1];
}

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
  for (let run = 0; run < warmupSamples + measurementSamples; run++) {
    const freshMs = duration(parser, edited, [], status);
    const incrementalMs = duration(parser, source, [edit], status);
    if (run >= warmupSamples) {
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
      editTarget = "x",
    } of workloads) {
      if (extglobOnly && !grammar.name.includes("extglob")) continue;
      test(`${name}: records scaling with matching fresh and incremental trees`, (context) => {
        for (const size of sizes) {
          const source = createSource(size);
          const index = source.indexOf(editTarget);
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
      for (const rows of localCommandRows) {
        const source = line.repeat(rows);
        for (const row of editRows(rows)) {
          measure(
            context,
            parser,
            `${grammar.name}/local commands/${rows}/${row}`,
            source,
            {
              byte: Buffer.byteLength(line) * row + line.indexOf("a"),
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
      const source = line.repeat(functionRows);
      for (const row of editRows(functionRows)) {
        const byte = Buffer.byteLength(line) * row + line.indexOf("}");
        const edit = { byte, deleteBytes: 1, insert: "" };
        const incomplete = applyEdit(source, edit);
        measure(
          context,
          parser,
          `${grammar.name}/function closer deletion/${functionRows}/${row}`,
          source,
          edit,
          1,
        );
        measure(
          context,
          parser,
          `${grammar.name}/function closer repair/${functionRows}/${row}`,
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
      const source = "# comment\n".repeat(commentRows);
      measure(
        context,
        parser,
        `${grammar.name}/comments/${commentRows}`,
        source,
        {
          byte: Buffer.byteLength(source.slice(0, source.lastIndexOf("t"))),
          deleteBytes: 1,
          insert: "x",
        },
      );
    });

    test("inherited document recovery scales with body and following commands", (context) => {
      const prefix = ': "$(cat <<E)" \\\n';
      for (const size of hereDocumentBodyCharacters) {
        const source = `${prefix}x${"a".repeat(size)}\nE\n) word\necho AFTER\n`;
        measure(
          context,
          parser,
          `${grammar.name}/inherited recovery body/${size}`,
          source,
          { byte: prefix.length, deleteBytes: 1, insert: "y" },
          1,
        );
      }
      for (const count of localCommandRows) {
        const source = `${prefix}body\nE\n) word\n${"echo aaaa\n".repeat(count)}`;
        measure(
          context,
          parser,
          `${grammar.name}/inherited recovery commands/${count}`,
          source,
          { byte: source.indexOf("aaaa"), deleteBytes: 1, insert: "b" },
          1,
        );
      }
    });

    test("quoted here-document edits retain the selected extquote conditions", (context) => {
      const delimiter = grammar.name.includes("noextquote")
        ? `\${x:-$'ab'}`
        : `\${x:-ab}`;
      for (const size of hereDocumentBodyCharacters) {
        const prefix = `cat <<"\${x:-$'ab'}"\n`;
        const source = `${prefix}x${"a".repeat(size)}\n${delimiter}\n`;
        measure(
          context,
          parser,
          `${grammar.name}/quoted here document/${size}`,
          source,
          {
            byte: Buffer.byteLength(prefix),
            deleteBytes: 1,
            insert: "y",
          },
        );
      }
    });
  });
}
