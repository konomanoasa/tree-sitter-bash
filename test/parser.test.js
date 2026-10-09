import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createParser, parseNodes } from "./support/parser.js";

let parser;
before(() => {
  parser = createParser();
});
after(() => {
  parser.close();
});

const nodes = (source) => parseNodes(parser, source);

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
    types: ["brace_expansion", "pattern_star_source", "pattern_bracket_source"],
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
      if (previous !== undefined) assert.deepEqual(actual, previous, prefix);
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

test("punctuation reserved words introduce conditional groups and negated subshells", () => {
  const actual = nodes("[[ ((x)) ]]; ! ( : )\n");
  assert.deepEqual(
    actual
      .filter(({ type }) => type === "conditional_group")
      .map(({ text }) => text),
    ["((x))", "(x)"],
  );
  assert.equal(actual.find(({ type }) => type === "bang").text, "!");
  assert.equal(
    actual.filter(({ type }) => type === "function_definition").length,
    0,
  );
});

test("escaped command and function names advance through each source escape", () => {
  const actual = nodes("\\if arg; \\! () { :; }; function f\\ name { :; }\n");
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

test("time is a command or function name after a pipe", () => {
  const actual = nodes("time -p : | time : |& ti\\\nme() { :; }\n");
  assert.deepEqual(
    actual.filter(({ type }) => type === "timing").map(({ text }) => text),
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
      actual.filter(({ type }) => type === "conditional_binary_expression")
        .length,
      0,
      word,
    );
  }
  const actual = nodes('[[ -n $x]] && $x]] == "x"=~ && x < y ]]\n');
  assert.deepEqual(
    actual
      .filter(({ field }) => ["operand", "left", "right"].includes(field))
      .filter(({ type }) => type === "word" || type === "conditional_pattern")
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

test("ERE groups and alternatives extend a word starting with closing brackets", () => {
  for (const expression of ["]](a)", "]]\\\n(a)", "]]()", "]]|x", "]]||x"]) {
    const actual = nodes(`[[ x =~ ${expression} ]]\n`);
    assert.deepEqual(
      actual
        .filter(({ type }) => type === "regex_operand")
        .map(({ text }) => text),
      [expression],
    );
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
    assert.ok(actual.some(({ type, text }) => type === "bang" && text === "!"));
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
    const actual = nodes(`declare a=(one) ${boundary} b=value c+=~/path\n`);
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
      assert.equal(actual.filter(({ type }) => type === "bang").length, 0);
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
    actual.find(({ type }) => type === "assignment_word").text,
    "A=one",
  );
});

test("continued names use original byte ranges and retain each backslash once", () => {
  const source = "ec\\\nho $\\\n{name}\n";
  const actual = nodes(source);
  assert.equal(actual.find(({ type }) => type === "literal").text, "ec\\\nho");
  assert.equal(
    actual.find(({ type }) => type === "variable_name").text,
    "name",
  );
  assert.deepEqual(
    actual
      .filter(({ type }) => type === "line_continuation")
      .map(({ start, end, text }) => [start, end, text]),
    [
      [2, 3, "\\"],
      [8, 9, "\\"],
    ],
  );
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
    actual.find(({ type }) => type === "dollar_single_quote_escape").text,
    "\\'",
  );
  assert.equal(
    actual.find(({ type }) => type === "parameter_expansion").text,
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
    actual.find(({ type }) => type === "arithmetic_command").text,
    "(( $'a\\'b' ))",
  );
  assert.equal(
    actual.find(({ type }) => type === "dollar_single_quoted").text,
    "$'a\\'b'",
  );
  assert.ok(!actual.some(({ type }) => type === "subshell"));
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

test("a dollar separated from arithmetic quoting remains a source fragment", () => {
  const actual = nodes("echo $(( $\n'1' + $ ))\n");
  assert.deepEqual(
    actual
      .filter(({ type }) => type === "arithmetic_source_fragment")
      .map(({ text }) => text),
    ["$", "$"],
  );
  assert.equal(actual.find(({ type }) => type === "single_quoted").text, "'1'");
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

test("a joined here document delimiter retains its original spelling", () => {
  const actual = nodes("cat <<EOF\nbody\nE\\\nOF\n");
  assert.equal(
    actual.find(({ type }) => type === "here_document_end_text").text,
    "E\\\nOF",
  );
  assert.equal(
    actual.find(({ type }) => type === "here_document_body").text,
    "body\n",
  );
});

test("nested here document queues preserve body and delimiter source order", () => {
  const actual = nodes(
    ": <<OUT \"$(cat <<ONE <<'TWO'\n$first\nONE\n$second\nTWO\n)\" <<LAST\n$outer\nOUT\n$last\nLAST\n",
  );
  assert.deepEqual(
    actual
      .filter(({ type }) =>
        ["here_document_body", "quoted_here_document_body"].includes(type),
      )
      .map(({ type, field, text }) => [type, field, text]),
    [
      ["here_document_body", "body", "$first\n"],
      ["quoted_here_document_body", "body", "$second\n"],
      ["here_document_body", "body", "$outer\n"],
      ["here_document_body", "body", "$last\n"],
    ],
  );
  assert.deepEqual(
    actual
      .filter(({ type }) => type === "here_document_end_text")
      .map(({ text }) => text),
    ["ONE", "TWO", "OUT", "LAST"],
  );
  assert.deepEqual(
    actual
      .filter(({ type }) => type === "parameter_expansion")
      .map(({ text }) => text),
    ["$first", "$outer", "$last"],
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
    unquoted.find(({ type }) => type === "parameter_expansion").text,
    "$x",
  );
  assert.equal(
    quoted.filter(({ type }) => type === "parameter_expansion").length,
    0,
  );
  assert.equal(
    quoted.find(({ type }) => type === "quoted_here_document_text").text,
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

test("arithmetic shifts and subshell here documents retain distinct lookahead contexts", () => {
  const actual = nodes(
    ": {a,$( ((1 << 2))\n: )} {a,$( ((cat <<E\nx\nE\n); :) )}\n",
  );
  assert.deepEqual(
    actual
      .filter(({ type }) => type === "brace_expansion")
      .map(({ text }) => text),
    ["{a,$( ((1 << 2))\n: )}", "{a,$( ((cat <<E\nx\nE\n); :) )}"],
  );
  assert.deepEqual(
    actual
      .filter(({ type }) => type === "arithmetic_operator")
      .map(({ text }) => text),
    ["<<"],
  );
  assert.deepEqual(
    actual
      .filter(({ type }) => type === "here_document_end_text")
      .map(({ text }) => text),
    ["E"],
  );
});

for (const { name, body, cases } of [
  { name: "timed case", body: "time case x in x) :;; esac", cases: 1 },
  {
    name: "timing options",
    body: "time -p -- case x in x) :;; esac",
    cases: 1,
  },
  { name: "unnamed coprocess", body: "coproc case x in x) :;; esac", cases: 1 },
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
  { name: "declaration array element", body: "declare a=(case)", cases: 0 },
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
  { name: "coprocess redirect", body: "coproc worker >out case", cases: 0 },
  { name: "coprocess assignment", body: "coproc worker x=y case", cases: 0 },
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
  { name: "ordinary command arguments", body: ": time -p case", cases: 0 },
  { name: "extglob leading hash", body: ": @(#|a)", cases: 0 },
  { name: "extglob alternative hash", body: ": @(a|#)", cases: 0 },
  {
    name: "extglob case pattern",
    body: "case x in @(a|#)) :;; esac",
    cases: 1,
  },
  { name: "process substitution command", body: "<(printf x) case", cases: 0 },
  {
    name: "process substitution argument",
    body: ": <(printf x) case",
    cases: 0,
  },
  { name: "combined redirection", body: ": &>out case", cases: 0 },
  { name: "combined append redirection", body: ": &>>out case", cases: 0 },
  { name: "command after a combined pipe", body: ": |& time case", cases: 0 },
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
    const actual = nodes(`${words.map((word) => `: ${word}`).join("\n")}\n`);
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

test("conditional newlines drain pending here documents before closing substitutions", () => {
  const word = `{a,\${ cat <<E && [[\n]] }\nE\nx == x ]]; }}`;
  const actual = nodes(`: ${word}\n`);
  assert.deepEqual(
    actual
      .filter(({ type }) => type === "brace_expansion")
      .map(({ text }) => text),
    [word],
  );
  assert.deepEqual(
    actual
      .filter(({ type }) => type === "here_document_text")
      .map(({ text }) => text),
    ["]] }"],
  );
});

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
  "x[}]#'\"'",
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

for (const { name, word, delimiter, quoted } of [
  {
    name: "quoted array parameter pattern",
    word: `"\${x[0]#'"'}"`,
    delimiter: `\${x[0]#'}"`,
    quoted: true,
  },
  {
    name: "here string within a command substitution",
    word: "$(cat <<< x)",
    delimiter: "$(cat <<< x)",
    quoted: false,
  },
  {
    name: "current shell prefix normalizes horizontal blanks",
    word: `\${  \tprintf "x"; }`,
    delimiter: `\${ printf "x"; }`,
    quoted: false,
  },
  {
    name: "current shell prefix normalizes its newline",
    word: `\${\n  :; }`,
    delimiter: `\${ :; }`,
    quoted: false,
  },
  {
    name: "reply prefix removes leading command layout",
    word: `\${| \t\n :; }`,
    delimiter: `\${|:; }`,
    quoted: false,
  },
  {
    name: "reply prefix normalization precedes quote removal",
    word: `""\${| \tprintf "x"; }`,
    delimiter: `\${|printf x; }`,
    quoted: true,
  },
  {
    name: "double quoted brace prefix preserves nested ANSI-C quotes",
    word: `"\${\tprintf $'x'; }"`,
    delimiter: `\${ printf 'x'; }`,
    quoted: true,
  },
  {
    name: "single quoted brace source retains its blanks",
    word: `'\${|\t :; }'`,
    delimiter: `\${|\t :; }`,
    quoted: true,
  },
  {
    name: "ANSI-C quoted brace source retains decoded blanks",
    word: `$'\${|\\t :; }'`,
    delimiter: `\${|\t :; }`,
    quoted: true,
  },
  {
    name: "continued reply prefix preserves the source word",
    word: `\${|\\\n \tprintf x; }`,
    delimiter: `\${|printf x; }`,
    quoted: false,
  },
  {
    name: "input process substitution word",
    word: 'pre<(printf "a b")post',
    delimiter: 'pre<(printf "a b")post',
    quoted: false,
  },
  {
    name: "output process substitution word",
    word: ">(:)",
    delimiter: ">(:)",
    quoted: false,
  },
  {
    name: "extglob internal quotes and escapes",
    word: '@("a b"|c\\ d)',
    delimiter: '@("a b"|c\\ d)',
    quoted: false,
  },
  {
    name: "outer quote removes extglob quotes and escapes",
    word: '""@("a b"|c\\ d)',
    delimiter: "@(a b|c d)",
    quoted: true,
  },
  {
    name: "trailing quote applies to earlier command substitution",
    word: '$(printf "a b")""',
    delimiter: "$(printf a b)",
    quoted: true,
  },
  {
    name: "outer quote applies to parameter source",
    word: `""\${v:-"a b"}`,
    delimiter: `\${v:-a b}`,
    quoted: true,
  },
  {
    name: "outer quote applies to backquote source",
    word: '""`printf "a b"`',
    delimiter: "`printf a b`",
    quoted: true,
  },
  {
    name: "ANSI-C quote inside process substitution",
    word: "<(printf $'a\\tb')",
    delimiter: "<(printf 'a\tb')",
    quoted: false,
  },
  {
    name: "ANSI-C apostrophe retains canonical quoting",
    word: "@($'a\\'b'|c)",
    delimiter: "@('a'\\''b'|c)",
    quoted: false,
  },
  {
    name: "ANSI-C NUL ends its quoted value",
    word: "@($'a\\0b'|c)",
    delimiter: "@('a'|c)",
    quoted: false,
  },
  {
    name: "locale prefix inside command substitution",
    word: '$(printf $"a b")',
    delimiter: '$(printf "a b")',
    quoted: false,
  },
  {
    name: "ANSI-C decoding precedes quoted parameter quote removal",
    word: `"\${v:-$'a\\"b'}"`,
    delimiter: `\${v:-ab}`,
    quoted: true,
  },
  {
    name: "ANSI-C quote inside a double quoted command substitution",
    word: "\"$(printf $'a\\tb')\"",
    delimiter: "$(printf 'a\tb')",
    quoted: true,
  },
  {
    name: "backquote preserves nested ANSI-C spelling",
    word: "`printf $'a\\tb'`",
    delimiter: "`printf $'a\\tb'`",
    quoted: false,
  },
  {
    name: "current shell substitution has its own quote context",
    word: `"\${ printf $'a\\tb'; }"`,
    delimiter: `\${ printf 'a\tb'; }`,
    quoted: true,
  },
  {
    name: "reply substitution has its own quote context",
    word: `"\${|printf $'a\\tb'; }"`,
    delimiter: `\${|printf 'a\tb'; }`,
    quoted: true,
  },
  {
    name: "Unicode escape retains its double quoted backslash",
    word: "\"$(printf '\\日')\"",
    delimiter: "$(printf '\\日')",
    quoted: true,
  },
]) {
  test(`here document delimiter: ${name}`, () => {
    const source = `cat << ${word}\n$body\n${delimiter}\nprintf after\n`;
    const actual = nodes(source);
    const bodyType = quoted
      ? "quoted_here_document_body"
      : "here_document_body";
    assert.equal(actual.find(({ type }) => type === "here_end").text, word);
    assert.deepEqual(
      actual
        .filter(({ type }) => type === bodyType)
        .map(({ field, text }) => [field, text]),
      [["body", "$body\n"]],
    );
    assert.equal(
      actual.find(({ type }) => type === "here_document_end_text").text,
      delimiter,
    );
    assert.equal(
      actual.some(
        ({ type, text }) => type === "parameter_expansion" && text === "$body",
      ),
      !quoted,
    );
    assert.ok(
      actual.some(({ field, text }) => field === "name" && text === "printf"),
    );
  });
}

test("delimiter quoting is local to its word inside quoted command substitution", () => {
  const actual = nodes(
    `: "$(cat << @($'a\\tb'|c) << \${v:-$'x'}\n$first\n@('a\tb'|c)\n$second\n\${v:-'x'}\n)"\n`,
  );
  assert.deepEqual(
    actual
      .filter(({ type }) => type === "here_document_end_text")
      .map(({ text }) => text),
    ["@('a\tb'|c)", `\${v:-'x'}`],
  );
  assert.deepEqual(
    actual
      .filter(({ type }) => type === "here_document_body")
      .map(({ text }) => text),
    ["$first\n", "$second\n"],
  );
  assert.ok(!actual.some(({ type }) => type === "quoted_here_document_body"));
});

for (const source of [
  'cat << @("a b"|c)\n$body\n@(a b|c)\n',
  'cat << ""$(printf "a b")\n$body\n$(printf "a b")\n',
  `cat << \${  :; }\n$body\n\${  :; }\n`,
  `cat << \${| :; }\n$body\n\${| :; }\n`,
  `cat << '\${| :; }'\n$body\n\${|:; }\n`,
]) {
  test(`a delimiter with incorrect normalization remains unterminated: ${JSON.stringify(source)}`, () => {
    assert.equal(parser.parse(source, {}).status, 1);
  });
}

test("Bash operator nodes have exactly their source spelling", () => {
  const actual = nodes(`echo @(a|b) \${x//a/b} \${x^^} $((a++,--b))\n`);
  assert.deepEqual(
    actual
      .filter(({ type }) =>
        [
          "extglob_operator",
          "parameter_replacement_operator",
          "parameter_case_operator",
          "arithmetic_operator",
        ].includes(type),
      )
      .map(({ text }) => text),
    ["@", "//", "^^", "++", ",", "--"],
  );
  assert.ok(actual.every(({ start, end }) => start < end));
});

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
      ["arithmetic_conditional_expression", "expression", "n > 0 ? 1 : 0"],
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
      .filter(({ field }) => ["word", "pattern", "replacement"].includes(field))
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
    actual.find(({ type }) => type === "double_quote_text").text,
    "2",
  );
  assert.ok(
    actual.some(
      ({ type, text }) => type === "double_quote_text" && text === "日\\\n本:5",
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
  const actual = nodes(`a[$"key"]=x; echo "\${a[$"key"]}" \${x:$'1':$"2"}\n`);
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
    actual.filter(({ field }) => field === "subscript").map(({ text }) => text),
    ["[(]", "[)]", "[)(]", "[(key)]", "[(key)]"],
  );
  assert.equal(
    actual.find(({ type }) => type === "arithmetic_binary_expression").text,
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
    actual.filter(({ type }) => type === "subshell").map(({ text }) => text),
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
  const actual = nodes('declare a[x y]=z b["x y"]=v; declare a[x; echo next\n');
  assert.deepEqual(
    actual
      .filter(({ type }) => type === "assignment_word")
      .map(({ text }) => text),
    ['b["x y"]=v'],
  );
  assert.deepEqual(
    actual.filter(({ field }) => field === "argument").map(({ text }) => text),
    ["a[x", "y]=z", "a[x", "next"],
  );
  assert.equal(parser.parse("declare a[(i+1)]=x\n", {}).status, 1);
});

test("command-name subscripts retain whitespace and operators in one word", () => {
  const actual = nodes("a[ ] one; a[(x)] two; a[;|\n)] three; a[(] four\n");
  assert.deepEqual(
    actual
      .filter(({ type, field }) => type === "word" && field === "name")
      .map(({ text }) => text),
    ["a[ ]", "a[(x)]", "a[;|\n)]", "a[(]"],
  );
  assert.deepEqual(
    actual.filter(({ field }) => field === "argument").map(({ text }) => text),
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
    actual.filter(({ field }) => field === "argument").map(({ text }) => text),
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
  const actual = nodes("a[$(x=y >out a[)] ) ] next\n");
  assert.deepEqual(
    actual
      .filter(({ type, field }) => type === "word" && field === "name")
      .map(({ text }) => text),
    ["a[$(x=y >out a[)] ) ]", "a[)]"],
  );
  assert.deepEqual(
    actual.filter(({ field }) => field === "argument").map(({ text }) => text),
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
        .filter(({ field }) => field === "pattern" || field === "replacement")
        .map(({ field, text }) => [field, text]),
      [
        ["pattern", expectedPattern],
        ["replacement", replacement],
      ],
    );
  });
}

test("unterminated parameter extglobs remain source within their expansion", () => {
  const actual = nodes(`echo \${x#@(a} \${x:-@(b} \${x/a/@(c}; echo next\n`);
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
    actual.find(({ type }) => type === "brace_expansion").text,
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

test("brace lookahead skips inner here documents while an outer one is pending", () => {
  const actual = nodes(
    ": <<OUT {a,<(cat <<'INNER'\n},(\nINNER\n)}\n$body\nOUT\n",
  );
  assert.equal(
    actual.find(({ type }) => type === "brace_expansion").text,
    "{a,<(cat <<'INNER'\n},(\nINNER\n)}",
  );
  assert.deepEqual(
    actual
      .filter(({ type }) => type === "here_document_end_text")
      .map(({ text }) => text),
    ["INNER", "OUT"],
  );
  assert.equal(
    actual.find(({ type }) => type === "quoted_here_document_body").text,
    "},(\n",
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
  const actual = nodes(": {[a,b]} {[a,b],c} {@(a,b)} {@(a,b},c) @({a,b),c}\n");
  assert.deepEqual(
    actual
      .filter(({ type }) => type === "brace_alternative")
      .map(({ text }) => text),
    ["[a", "b]", "[a", "b]", "c", "@(a", "b)", "@(a", "b", "a", "b)", "c"],
  );
  assert.deepEqual(
    actual
      .filter(({ type, field }) => type === "word" && field === "argument")
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
    actual.find(({ type }) => type === "tilde_expansion").text,
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
        ({ type }) => type === "brace_endpoint" || type === "brace_increment",
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
      ["extglob_pattern", "brace_expansion", "process_substitution"].includes(
        type,
      ),
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

test("Bash boundaries preserve continued source and Unicode byte ranges", () => {
  const source = `echo 日 @\\\n(a|b) $((2*\\\n*3)) \${x/\\\n/a/字}\n`;
  const actual = nodes(source);
  assert.deepEqual(
    actual
      .filter(({ type }) => type === "line_continuation")
      .map(({ start }) => start),
    [...Buffer.from(source).entries()]
      .filter(
        ([index, value]) =>
          value === 92 && Buffer.from(source)[index + 1] === 10,
      )
      .map(([index]) => index),
  );
  assert.deepEqual(
    actual
      .filter(
        ({ type }) =>
          type === "arithmetic_operator" ||
          type === "parameter_replacement_operator",
      )
      .map(({ text }) => text),
    ["*\\\n*", "/\\\n/"],
  );
  assert.equal(actual.find(({ field }) => field === "replacement").text, "字");
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
      ["conditional_or_expression", 'x == @(a|b) || y =~ (c|d) && ! -n "$z"'],
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
        .filter(({ field }) => field === "initializer" || field === "condition")
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
  const actual = nodes('declare -A a=(["日本語"]=one [x+y]+=two three)\n');
  assert.deepEqual(
    actual.filter(({ field }) => field === "element").map(({ text }) => text),
    ['["日本語"]=one', "[x+y]+=two", "three"],
  );
  assert.deepEqual(
    actual
      .filter(({ type }) => type === "subscript_source")
      .map(({ text }) => text),
    ['"日本語"', "x+y"],
  );
  assert.equal(
    actual.find(({ type }) => type === "declaration_name").text,
    "declare",
  );
  assert.equal(
    actual.find(({ type }) => type === "assignment_append").text,
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
    ["[a b]", "[a;b]", "[a|b]", "[a<b]", "[(]", "[)]", "[a\nb]"].map((text) => [
      "word",
      text,
    ]),
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
    actual.filter(({ field }) => field === "element").map(({ text }) => text),
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
    ["for", "\\(", "\\)", "for", "time", '"if"'].map((text) => ["word", text]),
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
  const actual = nodes("x=(one)>out c=z 2>err declare a=$v b+=~/p; y=()\n");
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
    actual.find(({ type }) => type === "declaration_name").text,
    "declare",
  );
  assert.equal(actual.find(({ type }) => type === "tilde_expansion").text, "~");
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
  assert.equal(actual.find(({ field }) => field === "redirect").text, ">out");
  assert.equal(
    actual.filter(({ type }) => type === "declaration_name").length,
    0,
  );
  const declaration = nodes("coproc declare a=(1)\n");
  assert.equal(
    declaration.find(({ type }) => type === "declaration_name").text,
    "declare",
  );
  assert.equal(
    declaration.find(({ field }) => field === "assignment").text,
    "a=(1)",
  );
});

test("coprocess pending command words preserve brackets and end assignment recognition", () => {
  for (const { source, arguments: arguments_ } of [
    { source: "coproc worker a[ ] x[ ]\n", arguments: ["a[ ]", "x[", "]"] },
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
    actual.filter(({ field }) => field === "filename").map(({ text }) => text),
    ["out", "4-", "log", '"$x"'],
  );
  assert.deepEqual(
    actual
      .filter(({ type, field }) => type === "variable_name" && field === "name")
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
      subscript === "$(printf x)" || subscript === "`printf x`" ? ["x"] : [],
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
    actual.filter(({ field }) => field === "argument").map(({ text }) => text),
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
    actual.filter(({ field }) => field === "filename").map(({ text }) => text),
    ["2", "out", "3", "log"],
  );
  assert.deepEqual(
    actual.filter(({ type }) => type === "literal").map(({ text }) => text),
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
      .map(({ type, field, start, end }) => [type, field ?? null, start, end]),
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
    actual.filter(({ field }) => field === "argument").map(({ text }) => text),
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
  assert.equal(actual.find(({ type }) => type === "function_name").text, "a-b");
  assert.equal(
    actual.find(({ type }) => type === "function_body").text,
    "{ :; } >out",
  );
});

test("Bash command delimiters retain continuation slashes exactly once", () => {
  const source = "[\\\n[ x =\\\n= y ]\\\n]\nfor (\\\n(;;)) do break; done\n";
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
  ["coprocess array after ordinary argument", "coproc worker tail a=(1)\n"],
  ["coprocess array after redirect", "coproc worker >out a=(1)\n"],
  ["coprocess array after process substitution", "coproc worker <(:) a=(1)\n"],
  ["coprocess array after assignment prefix", "coproc x=y worker a=(1)\n"],
  ["coprocess array after redirect prefix", "coproc >out worker a=(1)\n"],
  ["coprocess quoted declaration argument", 'coproc worker "declare" a=(1)\n'],
  ["coprocess reserved command name", "coproc do\n"],
  ["coprocess reserved first argument", "coproc worker do\n"],
  ["coprocess declaration reserved first argument", "coproc declare do\n"],
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
  ["conditional regex bracket does not quote parenthesis", "[[ x =~ [)] ]]\n"],
  ["conditional regex unclosed parenthesis inside bracket", "[[ x =~ [(] ]]\n"],
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

test("append assignments retain the same tilde boundary as equals", () => {
  const actual = nodes("x+=~ a[0]+=~user\n");
  assert.deepEqual(
    actual
      .filter(({ type }) => type === "tilde_expansion")
      .map(({ text }) => text),
    ["~", "~user"],
  );
});

test("Unicode function names do not alias ASCII reserved spellings", () => {
  const actual = nodes("ũf() { :; }\n");
  assert.equal(actual.find(({ type }) => type === "function_name").text, "ũf");
});

test("ERE hierarchy owns static repetition, intervals and code point leaves", () => {
  const actual = nodes("[[ x =~ ^(ab|cd)+[[:digit:]a-z]{2,4}?日.$ ]]\n");
  const texts = (type) =>
    actual.filter((node) => node.type === type).map(({ text }) => text);
  assert.deepEqual(texts("ordinary_character"), ["a", "b", "c", "d", "日"]);
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
    actual.filter(({ field }) => field === "operand").map(({ text }) => text),
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
  assert.equal(actual.filter(({ field }) => field === "operand").length, 0);
  assert.deepEqual(
    actual
      .filter(({ type }) => type === "ere_dupl_symbol")
      .map(({ text }) => text),
    ["+", "+", "+"],
  );
  assert.equal(
    actual.find(({ type }) => type === "escaped_character").text,
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
    actual.find(({ type }) => type === "class_name").text,
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
      actual.find(({ type }) => type === "regex_operand").text,
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
  assert.equal(actual.filter(({ field }) => field === "operand").length, 0);
  assert.deepEqual(
    actual
      .filter(
        ({ type, text }) => type === "ere_expression" && text.startsWith("("),
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
      actual.find(({ type }) => type === "bracket_expression").text,
      `[a-${endpoint}b-c]`,
    );
    assert.ok(
      actual.some(({ field, text }) => field === "name" && text === "echo"),
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
