import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { grammars } from "../scripts/tree-sitter.js";
import { applyEdit, createParser } from "./support/parser.js";
import { editingWorkloads, workloads } from "./support/workloads.js";

const measurementSamples = 3;
const warmupSamples = 1;

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

function measure(context, parser, name, source, edit, status = 0) {
  const edits = Array.isArray(edit) ? edit : [edit];
  const edited = edits.reduce(applyEdit, source);
  const freshSamples = [];
  const incrementalSamples = [];
  for (let run = 0; run < warmupSamples + measurementSamples; run++) {
    const freshMs = duration(parser, edited, [], status);
    const incrementalMs = duration(parser, source, edits, status);
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
      if (extglobOnly && grammar.name !== "bash") continue;
      test(`${name}: records fresh and incremental scaling`, (context) => {
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

    for (const { name, run } of editingWorkloads()) {
      test(name, (context) => {
        run((label, source, edits, status = 0) =>
          measure(context, parser, label, source, edits, status),
        );
      });
    }
  });
}
