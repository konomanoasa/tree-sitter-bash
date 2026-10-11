import assert from "node:assert/strict";

function parseCst(output) {
  const entries = [];
  for (const line of output.split("\n")) {
    const match = line.match(
      /^([0-9]+:[0-9]+)[ ]+-[ ]+([0-9]+:[0-9]+)([ ]+)([^\n]*)$/,
    );
    if (match === null) continue;
    let content = match[4];
    const rangeWidth = line.indexOf("-") - 1;
    let depth = match[3].length - Math.max(0, rangeWidth - match[2].length);
    const recovery = content.startsWith("•");
    if (recovery) {
      content = content.slice(1);
      depth += 1;
    }
    if (content.startsWith("`")) continue;
    entries.push({
      content,
      depth,
      line,
      range: `${match[1]}-${match[2]}`,
      recovery,
    });
  }
  return entries;
}

function nodeIdentity(entry) {
  const field = entry.content.match(/^([a-z_]+): /)?.[1];
  let type =
    field === undefined ? entry.content : entry.content.slice(field.length + 2);
  if (!type.startsWith('"')) type = type.replace(/[ ]+`[^\n]*$/, "");
  return { field, type, recovery: entry.recovery };
}

function lineOffsets(bytes) {
  const offsets = [0];
  for (const [index, byte] of bytes.entries()) {
    if (byte === 10) offsets.push(index + 1);
  }
  return offsets;
}

function pointOffset(bytes, offsets, point) {
  const [row, column] = point.split(":").map(Number);
  const offset = offsets[row];
  assert.notEqual(offset, undefined, `point exceeds source: ${point}`);
  const lineEnd =
    row + 1 < offsets.length ? offsets[row + 1] - 1 : bytes.length;
  assert.ok(column <= lineEnd - offset, `column exceeds source: ${point}`);
  return offset + column;
}

function sourceNodes(output, source) {
  const bytes = Buffer.from(source);
  const offsets = lineOffsets(bytes);
  return parseCst(output).map((entry) => {
    const [start, end] = entry.range
      .split("-")
      .map((point) => pointOffset(bytes, offsets, point));
    assert.ok(end >= start, `reversed source range: ${entry.range}`);
    return {
      ...entry,
      ...nodeIdentity(entry),
      start,
      end,
      text: bytes.subarray(start, end).toString(),
    };
  });
}

export { nodeIdentity, parseCst, sourceNodes };
