import { applyEdit } from "./parser.js";

const conditionElementCounts = [128, 512, 2048];
const deepNestingDepths = [16, 64, 256];
const ereSourceSegmentCounts = [32, 128, 512];
const intervalDigitCounts = [128, 1024, 8192];
const sequenceElementCounts = [128, 1024, 8192];
const wordCharacterCounts = [128, 1024, 8192];
const normalNestingDepths = [8, 16, 32];
const hereDocumentBodyCharacters = [4096, 32768, 262144];
const localCommandRows = [1200, 2400, 4800];
const functionRows = 1200;
const commentRows = 4800;

export const workloads = [
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
    name: "eval argument elements",
    sizes: sequenceElementCounts,
    source: (n) => `eval a=(x${" a".repeat(n)})\n`,
  },
  {
    name: "eval argument sequence",
    sizes: sequenceElementCounts,
    source: (n) => `eval a=(x)${" b=(y)".repeat(n)}\n`,
  },
  {
    name: "eval argument substitution depth",
    sizes: normalNestingDepths,
    source: (n) => `eval a=(${"$(eval a=(".repeat(n)}x${"))".repeat(n)})\n`,
  },
  {
    name: "arithmetic command operands",
    sizes: sequenceElementCounts,
    source: (n) => `((x${"+1".repeat(n)}))\n`,
  },
  {
    name: "assignment-shaped arguments",
    sizes: sequenceElementCounts,
    source: (n) => "printf x=~:~/path\n".repeat(n),
  },
  {
    name: "plain declarations",
    editTarget: "value",
    sizes: sequenceElementCounts,
    source: (n) => "declare x=value\n".repeat(n),
  },
  {
    name: "declaration brace values",
    sizes: sequenceElementCounts,
    source: (n) => "declare v={x,y}\n".repeat(n),
  },
  {
    name: "declaration brace subscripts",
    sizes: sequenceElementCounts,
    source: (n) => "declare v[{x,y}]=value\n".repeat(n),
  },
  {
    name: "declaration quoted parts",
    editTarget: "value",
    sizes: sequenceElementCounts,
    source: (n) => `declare x="${"value $y ".repeat(n)}"\n`,
  },
  {
    name: "declaration brace alternatives",
    sizes: sequenceElementCounts,
    source: (n) => `declare v={x${",y".repeat(n)}}\n`,
  },
  {
    name: "declaration substitution depth",
    sizes: normalNestingDepths,
    source: (n) => `${"declare v=$(".repeat(n)}echo x${")".repeat(n)}\n`,
  },
  {
    name: "subscripted argument tildes",
    sizes: sequenceElementCounts,
    source: (n) => "printf x[0]=~:~/path\n".repeat(n),
  },
  {
    name: "subscripted argument literals",
    sizes: sequenceElementCounts,
    source: (n) => "printf x[0]=value\n".repeat(n),
  },
  {
    name: "subscripted argument subscript bytes",
    sizes: wordCharacterCounts,
    source: (n) => `printf x[${"a".repeat(n)}]=~\n`,
  },
  {
    name: "subscripted argument subscript depth",
    sizes: deepNestingDepths,
    source: (n) => `printf x[${"a[".repeat(n)}0${"]".repeat(n)}]=~\n`,
  },
  {
    name: "subscripted argument substitution depth",
    sizes: normalNestingDepths,
    source: (n) =>
      `printf x[${"$(printf x[".repeat(n)}0${"]=~)".repeat(n)}]=~\n`,
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
    name: "pattern bracket ranges",
    sizes: sequenceElementCounts,
    source: (n) => `: x${"[A-Z]".repeat(n)}\n`,
  },
  {
    name: "pattern bracket classes",
    sizes: sequenceElementCounts,
    source: (n) => `: x${"[[:digit:]]".repeat(n)}\n`,
  },
  {
    name: "pattern bracket range class markers",
    sizes: sequenceElementCounts,
    source: (n) => `: x${"[A-[:digit:]]".repeat(n)}\n`,
  },
  {
    name: "pattern bracket collating ranges",
    sizes: sequenceElementCounts,
    source: (n) => `: x${"[A-[.Z.]]".repeat(n)}\n`,
  },
  {
    name: "pattern bracket incomplete collating ranges",
    sizes: sequenceElementCounts,
    source: (n) => `: x${"[A-[.abc]".repeat(n)}\n`,
  },
  {
    name: "pattern bracket incomplete collating ranges with quotes",
    sizes: sequenceElementCounts,
    source: (n) => `: x${'[A-[.abc]"q"'.repeat(n)}\n`,
  },
  {
    name: "pattern bracket incomplete collating ranges with substitutions",
    sizes: sequenceElementCounts,
    source: (n) => `: x${"[A-[.abc]$(printf q)".repeat(n)}\n`,
  },
  {
    name: "parameter brace suppression sequence",
    sizes: sequenceElementCounts,
    source: (n) => `echo ${`\${v:-{x}{a,b}} `.repeat(n)}\n`,
  },
  {
    name: "parameter brace suppression depth",
    sizes: normalNestingDepths,
    source: (n) => `echo ${"${v:-".repeat(n)}{x}${"}".repeat(n)}{a,b}\n`,
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
    name: "word parts",
    editTarget: "value",
    sizes: sequenceElementCounts,
    source: (n) => `echo ${"value\"$x\"'tail'$y".repeat(n)}\n`,
  },
  {
    name: "locale-quoted parts",
    editTarget: "value",
    sizes: sequenceElementCounts,
    source: (n) => `echo $"${"value $x ".repeat(n)}"\n`,
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
    name: "substitution-local here document bytes",
    sizes: hereDocumentBodyCharacters,
    source: (n) => `: "$(cat <<E\nx${"a".repeat(n)}\nE\n)"\n`,
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

export function* editingWorkloads() {
  yield {
    name: "local command edits reuse unchanged source at the head, middle and tail",
    run: (check) => {
      const line = "echo aaaa\n";
      for (const rows of localCommandRows) {
        const source = line.repeat(rows);
        for (const row of editRows(rows)) {
          check(
            `local commands/${rows}/${row}`,
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
    },
  };

  yield {
    name: "function closer deletion and repair",
    run: (check) => {
      const line = "alpha() { : beta; }\n";
      const source = line.repeat(functionRows);
      for (const row of editRows(functionRows)) {
        const byte = Buffer.byteLength(line) * row + line.indexOf("}");
        const edit = { byte, deleteBytes: 1, insert: "" };
        const incomplete = applyEdit(source, edit);
        check(
          `function closer deletion/${functionRows}/${row}`,
          source,
          edit,
          1,
        );
        check(`function closer repair/${functionRows}/${row}`, incomplete, {
          byte,
          deleteBytes: 0,
          insert: "}",
        });
      }
    },
  };

  yield {
    name: "a final comment edit",
    run: (check) => {
      const source = "# comment\n".repeat(commentRows);
      check(`comments/${commentRows}`, source, {
        byte: Buffer.byteLength(source.slice(0, source.lastIndexOf("t"))),
        deleteBytes: 1,
        insert: "x",
      });
    },
  };

  yield {
    name: "here document boundary edits and repair",
    run: (check) => {
      const fixtures = [
        ...hereDocumentBodyCharacters.map((size) => ({
          name: `body/${size}`,
          body: `x${"a".repeat(size)}\n`,
          following: "echo AFTER\n",
          target: "x",
        })),
        ...localCommandRows.map((count) => ({
          name: `commands/${count}`,
          body: "body\n",
          following: "echo aaaa\n".repeat(count),
          target: "aaaa",
        })),
      ];
      for (const invalid of [false, true]) {
        const prefix = `: "$(cat <<E${invalid ? ')"' : ""}\n`;
        const suffix = invalid ? "" : ')"\n';
        const status = invalid ? 1 : 0;
        for (const { name, body, following, target } of fixtures) {
          const source = `${prefix}${body}E\n${suffix}${following}`;
          check(
            `here document boundary/${status}/${name}`,
            source,
            { byte: source.indexOf(target), deleteBytes: 1, insert: "y" },
            status,
          );
          if (invalid) {
            const edits = [
              { byte: prefix.length - 3, deleteBytes: 2, insert: "" },
              {
                byte: prefix.length + body.length,
                deleteBytes: 0,
                insert: ')"\n',
              },
            ];
            check(`here document boundary repair/${name}`, source, edits);
          }
        }
      }
    },
  };

  yield {
    name: "quoted here-document edits retain dollar-quote removal",
    run: (check) => {
      const delimiter = `\${x:-ab}`;
      for (const size of hereDocumentBodyCharacters) {
        const prefix = `cat <<"\${x:-$'ab'}"\n`;
        const source = `${prefix}x${"a".repeat(size)}\n${delimiter}\n`;
        check(`quoted here document/${size}`, source, {
          byte: Buffer.byteLength(prefix),
          deleteBytes: 1,
          insert: "y",
        });
      }
    },
  };
}
