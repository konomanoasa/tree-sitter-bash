import lexicalTokens from "./lexical-tokens.json" with { type: "json" };

if (Object.keys(lexicalTokens).length !== 2) {
  throw new Error("Source tokens must define only lexical and physical groups");
}
const sourceKinds = new Map();
const scannerSymbols = new Set();
const wholeSources = new Set();
for (const kind of ["lexical", "physical"]) {
  if (!Array.isArray(lexicalTokens[kind])) {
    throw new Error(`Missing ${kind} source tokens`);
  }
  for (const { begin, scanner, whole } of lexicalTokens[kind]) {
    if (
      typeof begin !== "string" ||
      !/^_[a-z][a-z0-9_]*$/.test(begin) ||
      typeof scanner !== "string" ||
      !/^[A-Z][A-Z0-9_]*$/.test(scanner) ||
      sourceKinds.has(begin) ||
      scannerSymbols.has(scanner) ||
      (whole !== undefined && (whole !== true || kind !== "lexical"))
    ) {
      throw new Error(`Invalid or duplicate source token ${begin}`);
    }
    sourceKinds.set(begin, kind);
    scannerSymbols.add(scanner);
    if (whole) wholeSources.add(begin);
  }
}
const sourceToken = ($, begin, kind, suffix) => {
  if (
    begin.type !== "SYMBOL" ||
    sourceKinds.get(begin.name) !== kind ||
    (suffix === "whole" && !wholeSources.has(begin.name))
  ) {
    throw new Error(`Expected ${kind} source token: ${begin.name}`);
  }
  return $[`${begin.name}_${suffix}`];
};
const sourceExternals = ($) => [
  ...lexicalTokens.lexical.map(({ begin }) => $[`${begin}_piece`]),
  ...lexicalTokens.physical.flatMap(({ begin }) => [
    $[`${begin}_prefix`],
    $[`${begin}_character`],
  ]),
  ...Array.from(wholeSources, (begin) => $[`${begin}_whole`]),
];

const regexSourceParts = ($) => [
  alias($._ere_source_group_expression, $.ere_expression),
  $._regex_source_group,
  $._regex_bash_part,
  $.regex_source_fragment,
  physical($, $._ere_source_bar, "|"),
];

const ereCount = ($) =>
  choice(
    $.duplication_count,
    alias($._ere_count_source, $.regex_source_expression),
  );
const ereCompoundRules = (kind) => {
  const name = (part) => `_ere_${kind}_${part}`;
  return {
    [name("element")]: ($) =>
      choice(
        alias($[name("character")], $.collating_element_single),
        alias($[name("multi")], $.collating_element_multi),
      ),
    [name("character")]: ($) => lexical($, $[name("character_begin")]),
    [name("multi")]: ($) => lexical($, $[name("multi_begin")]),
    [name("source")]: ($) =>
      prec.right(
        1,
        seq(
          optional($[name("element")]),
          choice($._regex_bash_part, $.regex_source_fragment),
          repeat(
            choice(
              $[name("element")],
              $._regex_bash_part,
              $.regex_source_fragment,
            ),
          ),
        ),
      ),
  };
};

const ASSIGNMENT_WORD_PRECEDENCE = 3;

const ARITHMETIC_BINARY_LEVELS = [
  "logical_or",
  "logical_and",
  "bitwise_or",
  "bitwise_xor",
  "bitwise_and",
  "equality",
  "relational",
  "shift",
  "additive",
  "multiplicative",
  "power",
];

const PATTERN_PRECEDENCE = {
  expression: 2,
  specialElement: 4,
};

const lexical = ($, begin, fragments = $._fragmented_lexeme) =>
  seq(
    begin,
    choice(repeat1(sourceToken($, begin, "lexical", "piece")), fragments),
  );

const wholeLexical = ($, begin, decorate = (source) => source) =>
  seq(optional(begin), decorate(sourceToken($, begin, "lexical", "whole")));

// Direct aliases preserve MISSING tokens.
const wholeSource = ($, begin, lexeme, visible) =>
  choice(
    wholeLexical($, begin, (source) => alias(source, visible)),
    alias(lexeme, visible),
  );

const KEYWORDS = [
  "if",
  "then",
  "elif",
  "else",
  "fi",
  "for",
  "in",
  "do",
  "done",
  "case",
  "esac",
  "while",
  "until",
  "coproc",
  "time",
  "function",
  "select",
];

const keywordRules = () =>
  Object.fromEntries(
    KEYWORDS.flatMap((name) => [
      [
        `_${name}_keyword_lexeme`,
        ($) => lexical($, $[`_${name}_keyword_begin`]),
      ],
      [
        `_${name}_keyword_source`,
        ($) =>
          wholeSource(
            $,
            $[`_${name}_keyword_begin`],
            $[`_${name}_keyword_lexeme`],
            $[`${name}_keyword`],
          ),
      ],
    ]),
  );

// One stack entry per delimiter lets recovery reach the command.
const PHYSICAL_RULES = {
  _io_variable_open: "{",
  _io_variable_close: "}",
  _dollar_dq_dollar: "$",
  _ere_bar: "|",
  _ere_source_bar: "|",
  _ere_star: "*",
  _ere_plus: "+",
  _ere_question: "?",
  _ere_wildcard_begin: ".",
  _ere_left_anchor_begin: "^",
  _ere_right_anchor_begin: "$",
  _ere_bracket_open: "[",
  _ere_bracket_close: "]",
  _ere_negation: "^",
  _ere_hyphen: "-",
  _ere_literal_hyphen: "-",
  _ere_interval_open: "{",
  _ere_interval_close: "}",
  _ere_comma: ",",
  _ere_class_open: "[",
  _ere_collating_open: "[",
  _ere_equivalence_open: "[",
  _ere_colon: ":",
  _ere_dot: ".",
  _ere_equal: "=",
  _ere_compound_close: "]",
  _ere_range_end_hyphen: "-",
  _regex_open: "(",
  _regex_close: ")",
  _array_assignment_open: "(",
  _array_assignment_close: ")",
  _arithmetic_command_open: "(",
  _process_in_start: "<",
  _process_out_start: ">",
  _extglob_open: "(",
  _extglob_close: ")",
  _extglob_bar: "|",
  _current_shell_open: "{",
  _reply_open: "{",
  _substitution_brace_close: "}",
  _subscript_open: "[",
  _arithmetic_subscript_open: "[",
  _subscript_close: "]",
  _brace_open: "{",
  _brace_close: "}",
  _brace_comma: ",",
  _brace_literal_open: "{",
  _punct_left_parenthesis: "(",
  _punct_right_parenthesis: ")",
  _left_brace: "{",
  _right_brace: "}",
  _parameter_open: "{",
  _parameter_close: "}",
  _command_open: "(",
  _arithmetic_expansion_open: "(",
  _bracket_arithmetic_open: "[",
  _bracket_arithmetic_close: "]",
  _dollar_expansion_start: "$",
  _dq_open: '"',
  _dq_close: '"',
  _sq_open: "'",
  _sq_close: "'",
  _dollar_sq_dollar: "$",
  _dollar_sq_open: "'",
  _dollar_sq_close: "'",
  _backquote_start: "`",
  _backquote_end: "`",
  _double_quoted_backquote_start: "`",
  _punct_pipe: "|",
};
const physicalSource = ($, token, decorate = (character) => character) =>
  seq(
    token,
    repeat(
      choice(sourceToken($, token, "physical", "prefix"), inheritedDocument($)),
    ),
    decorate(sourceToken($, token, "physical", "character")),
  );
const physical = ($, token, spelling, fieldName) => {
  if (token.type === "CHOICE") {
    return choice(
      ...token.members.map((begin) => physical($, begin, spelling, fieldName)),
    );
  }
  const character = (source) => alias(source, spelling);
  if (fieldName !== undefined) {
    return physicalSource($, token, (source) =>
      field(fieldName, character(source)),
    );
  }
  if (token.type === "SYMBOL" && Object.hasOwn(PHYSICAL_RULES, token.name)) {
    if (PHYSICAL_RULES[token.name] !== spelling) {
      throw new Error(`${token.name} is spelled ${PHYSICAL_RULES[token.name]}`);
    }
    return $[`${token.name}_physical`];
  }
  return physicalSource($, token, character);
};
const physicalRules = () =>
  Object.fromEntries(
    Object.entries(PHYSICAL_RULES).map(([name, spelling]) => [
      `${name}_physical`,
      ($) => physicalSource($, $[name], (source) => alias(source, spelling)),
    ]),
  );
const quotedLiterals = ($) => [
  $.single_quoted,
  $.double_quoted,
  $.dollar_single_quoted,
  $.locale_quoted,
];
const structuredSourceParts = ($) => [
  $.escaped_character,
  ...quotedLiterals($),
  $.process_substitution,
  $.current_shell_substitution,
  $.reply_substitution,
  $.brace_expansion,
  $.extglob_pattern,
  $.parameter_expansion,
  $.command_substitution,
  $.arithmetic_expansion,
  $.backquote_substitution,
];
const patternSpecialValue = ($, character) =>
  repeat1(field("value", choice(character, ...structuredSourceParts($))));
const bracketFallback = ($, first, literal, bracket, end) =>
  seq(
    alias(first, $.literal),
    repeat(
      choice(
        literal,
        bracket,
        $.pattern_star_source,
        $.pattern_question_source,
        $._word_structured_part,
      ),
    ),
    end,
  );
const wordPatternSpecialSources = ($) => [
  $.pattern_character_class_source,
  $.pattern_collating_symbol_source,
  $.pattern_equivalence_class_source,
];

const patternBracketPlainAtoms = ($, character) => [
  character,
  $._pattern_operator_bracket_character,
  $.pattern_bracket_hyphen_source,
  ...structuredSourceParts($),
];

const parameterPatternCollatingSymbolSource = ($) =>
  alias(
    $._parameter_pattern_collating_symbol_source,
    $.pattern_collating_symbol_source,
  );

const parameterPatternSpecialSources = ($) => [
  alias(
    $._parameter_pattern_character_class_source,
    $.pattern_character_class_source,
  ),
  parameterPatternCollatingSymbolSource($),
  alias(
    $._parameter_pattern_equivalence_class_source,
    $.pattern_equivalence_class_source,
  ),
];

const tildeExpansion = ($, start, user, end) =>
  prec.right(seq(physical($, start, "~"), optional(field("user", user)), end));
const startedWord = (part, tilde, start) =>
  seq(start, choice(seq(tilde, repeat(part)), repeat1(part)));

const sourceWord = (
  $,
  part,
  assignmentPart,
  tilde,
  start = $._word_start,
  braces = false,
) =>
  seq(
    choice(
      startedWord(
        part,
        tilde,
        braces ? seq(start, $._brace_word_start) : start,
      ),
      seq(
        $._assignment_argument_start,
        ...(braces ? [$._brace_word_start] : []),
        alias($._assignment_argument_head, $.literal),
        repeat(
          choice(
            alias($._assignment_tilde_expansion, $.tilde_expansion),
            assignmentPart,
          ),
        ),
      ),
    ),
    ...(braces ? [$._brace_word_end] : []),
  );
const braceWord = ($, part, assignmentPart, tilde, start) =>
  sourceWord($, part, assignmentPart, tilde, start, true);
const wordSeparator = ($, marker) => seq(marker, optional($._blank));

const arithmeticBoundaryLayout = ($, boundary) =>
  seq(boundary, optional($._arithmetic_layout));

const arithmeticOperatorSegment = ($, boundary, operator) =>
  seq(arithmeticBoundaryLayout($, boundary), field("operator", operator));

const arithmeticOperandLayout = ($) => optional($._arithmetic_layout);

const arithmeticRules = (prefix = "arithmetic") => {
  const candidate = prefix === "arithmetic_candidate";
  const group = `parenthesized_${prefix}`;
  const fragment = candidate ? "subscript_text" : "arithmetic_source_fragment";
  const expression = ($) => $[`_${prefix}_expression`];
  const reference = ($) => $[`_${prefix}_reference`];
  const operator = ($, kind) =>
    alias($[`_arithmetic_${kind}_operator_lexeme`], $[`${prefix}_operator`]);
  const segment = ($, kind) =>
    arithmeticOperatorSegment(
      $,
      $[`_arithmetic_${kind}_operator_boundary`],
      operator($, kind),
    );
  const sourcePart = ($) => $[`_${prefix}_source_part`];
  return {
    [`_${prefix}_expression`]: ($) =>
      choice(
        $[`${prefix}_sequence_expression`],
        $[`${prefix}_assignment_expression`],
        $[`${prefix}_conditional_expression`],
        ...ARITHMETIC_BINARY_LEVELS.map((level) =>
          alias(
            $[`_${prefix}_${level}_binary_expression`],
            $[`${prefix}_binary_expression`],
          ),
        ),
        $[`${prefix}_unary_expression`],
        $[`${prefix}_update_expression`],
        $[`${prefix}_number`],
        reference($),
        ...quotedExpansionParts($),
        $[group],
      ),
    [`${prefix}_sequence_expression`]: ($) =>
      prec.left(
        0,
        seq(
          field("left", expression($)),
          segment($, "comma"),
          arithmeticOperandLayout($),
          field("right", expression($)),
        ),
      ),
    [`${prefix}_assignment_expression`]: ($) =>
      prec.right(
        1,
        seq(
          field("left", reference($)),
          segment($, "assignment"),
          arithmeticOperandLayout($),
          field("right", expression($)),
        ),
      ),
    [`${prefix}_conditional_expression`]: ($) =>
      prec.right(
        2,
        seq(
          field("condition", expression($)),
          segment($, "question"),
          arithmeticOperandLayout($),
          field("consequence", expression($)),
          segment($, "colon"),
          arithmeticOperandLayout($),
          field("alternative", expression($)),
        ),
      ),
    ...Object.fromEntries(
      ARITHMETIC_BINARY_LEVELS.map((level, index) => [
        `_${prefix}_${level}_binary_expression`,
        ($) =>
          (level === "power" ? prec.right : prec.left)(
            index + 3,
            seq(
              field("left", expression($)),
              segment($, level),
              arithmeticOperandLayout($),
              field("right", expression($)),
            ),
          ),
      ]),
    ),
    [`${prefix}_unary_expression`]: ($) =>
      prec.right(
        14,
        seq(
          field("operator", operator($, "unary")),
          arithmeticOperandLayout($),
          field("operand", expression($)),
        ),
      ),
    [`_${prefix}_reference`]: ($) =>
      choice($[`${prefix}_variable`], $[`${prefix}_array_reference`]),
    [`${prefix}_array_reference`]: ($) =>
      prec.right(
        candidate ? 1 : 0,
        seq(
          field("name", $[`${prefix}_variable`]),
          field(
            "subscript",
            candidate
              ? $.array_subscript
              : alias($._arithmetic_subscript, $.array_subscript),
          ),
        ),
      ),
    [`${prefix}_update_expression`]: ($) =>
      prec(
        15,
        choice(
          seq(
            field("operator", operator($, "update")),
            arithmeticOperandLayout($),
            field("operand", reference($)),
          ),
          seq(field("operand", reference($)), segment($, "update")),
        ),
      ),
    [group]: ($) => parenthesizedArithmetic($, expression($)),
    [`${prefix}_number`]: ($) => lexical($, $._arithmetic_number_begin),
    [`${prefix}_variable`]: ($) => lexical($, $._arithmetic_variable_begin),
    [fragment]: ($) => lexical($, $._arithmetic_source_fragment_begin),
    ...(candidate
      ? {}
      : {
          arithmetic_source_expression: ($) =>
            prec.right(
              repeat1(seq(sourcePart($), optional($._arithmetic_layout))),
            ),
        }),
    [`_${prefix}_source_part`]: ($) =>
      choice(
        $[`${prefix}_number`],
        reference($),
        $[fragment],
        alias($._arithmetic_source_operator_lexeme, $[`${prefix}_operator`]),
        $[`${group}_source`],
        ...(candidate ? [$.array_subscript] : []),
        ...quotedLiterals($),
        $.escaped_character,
        ...quotedExpansionParts($),
      ),
    [`${group}_source`]: ($) =>
      seq(
        alias($._arithmetic_source_open, "("),
        optional($._arithmetic_layout),
        repeat(seq(sourcePart($), optional($._arithmetic_layout))),
        alias($._arithmetic_source_close, ")"),
      ),
    [`_${prefix}_field_source`]: ($) =>
      choice(
        $[`_${prefix}_field_prefix`],
        seq(
          optional($[`_${prefix}_field_prefix`]),
          $[`_${prefix}_field_suffix`],
        ),
      ),
    [`_${prefix}_field_prefix`]: ($) =>
      repeat1(
        seq(
          choice(sourcePart($), alias($._arithmetic_source_close, $[fragment])),
          optional($._arithmetic_layout),
        ),
      ),
    [`_${prefix}_field_suffix`]: ($) =>
      seq(
        alias($._arithmetic_source_open, $[fragment]),
        optional($._arithmetic_layout),
        repeat(seq(sourcePart($), optional($._arithmetic_layout))),
        optional($[`_${prefix}_field_suffix`]),
      ),
  };
};

const arithmeticClosingLayout = ($) =>
  seq($._arithmetic_closing_boundary, optional($._arithmetic_layout));

const parenthesizedArithmetic = ($, expression) =>
  seq(
    physical($, $._punct_left_parenthesis, "("),
    optional($._arithmetic_layout),
    field("expression", expression),
    arithmeticClosingLayout($),
    physical($, $._punct_right_parenthesis, ")"),
  );
const arraySubscript = ($, open) =>
  seq(
    physical($, open, "["),
    optional(field("source", $.subscript_source)),
    physical($, $._subscript_close, "]"),
  );
const arithmeticExpansionStart = (
  $,
  marker,
  start = $._arithmetic_dollar_start,
) => seq(start, marker, physical($, $._punct_left_parenthesis, "("));
const arithmeticExpansion = ($, start, sourceStart) =>
  seq(
    choice(
      seq(
        start,
        optional($._arithmetic_layout),
        field("expression", $._arithmetic_expression),
      ),
      seq(
        sourceStart,
        optional($._arithmetic_layout),
        optional(field("expression", $.arithmetic_source_expression)),
      ),
    ),
    arithmeticClosingLayout($),
    physical($, $._punct_right_parenthesis, ")"),
    physical($, $._punct_right_parenthesis, ")"),
    $._arithmetic_expansion_end,
  );

const arithmeticField = ($, expression = (source) => source) =>
  seq(
    choice(
      seq(
        $._arithmetic_field_expression_start,
        optional($._arithmetic_layout),
        expression($._arithmetic_expression),
      ),
      seq(
        $._arithmetic_field_source_start,
        choice(
          $._arithmetic_layout,
          seq(
            optional($._arithmetic_layout),
            expression(
              alias($._arithmetic_field_source, $.arithmetic_source_expression),
            ),
          ),
        ),
      ),
    ),
    $._arithmetic_field_closing_boundary,
    optional($._arithmetic_layout),
  );

const separatorOperatorLayout = ($, operator) =>
  seq(operator, optional(field("linebreak", $._linebreak)));

const newlineListElements = ($) => [
  $.here_document_sequence,
  inheritedDocument($),
  $._layout_newline,
  $._blank_line,
  $._comment_line,
];
const ledNewlineList = ($, lead) =>
  prec.right(seq(lead, repeat(choice(...newlineListElements($)))));

const boundaryLineComment = ($, comment) =>
  seq($._comment_boundary, optional($._horizontal_layout), comment);

const trailingComment = ($) =>
  seq($._trailing_comment_boundary, optional($._horizontal_layout), $.comment);

const inheritedDocument = ($) =>
  alias($._inherited_here_document_sequence, $.here_document_sequence);

const quotedExpansionParts = ($) => [
  $.current_shell_substitution,
  $.reply_substitution,
  alias($._double_quoted_parameter_expansion, $.parameter_expansion),
  $.command_substitution,
  $.arithmetic_expansion,
  alias($._double_quoted_backquote_substitution, $.backquote_substitution),
];
const doubleQuotedPart = ($) =>
  choice(
    $.double_quote_text,
    $.double_quote_escape,
    inheritedDocument($),
    ...quotedExpansionParts($),
  );
const singleQuoted = ($, opener) =>
  seq(
    physical($, opener, "'"),
    repeat(choice($.single_quote_content, inheritedDocument($))),
    physical($, $._sq_close, "'"),
  );
const doubleQuoted = ($, opener) =>
  seq(
    physical($, opener, '"'),
    repeat(doubleQuotedPart($)),
    physical($, $._dq_close, '"'),
  );
const dollarSingleQuoted = ($, dollar) =>
  seq(
    physical($, dollar, "$"),
    physical($, $._dollar_sq_open, "'"),
    repeat(
      choice(
        $.dollar_single_quote_text,
        $.dollar_single_quote_escape,
        inheritedDocument($),
      ),
    ),
    physical($, $._dollar_sq_close, "'"),
  );
const hereDocumentRedirect = ($, operator, end) =>
  seq(
    field("operator", operator),
    optional($._horizontal_layout),
    field("end", end),
  );
const hereEnd = ($, begin) =>
  seq(
    begin,
    field("word", alias($._here_end_source_word, $.word)),
    $._here_end_commit,
  );
const hereDocumentEndSource = (begin, text) => seq(begin, repeat(text));
const backquoteSubstitution = ($, start) =>
  seq(
    backquoteDelimiter($, start),
    optional(field("body", $.backquote_substitution_body)),
    backquoteDelimiter($, $._backquote_end),
  );
const closedCompoundList = ($) =>
  seq(
    field("body", alias($._compound_list, $.list)),
    optional($._closing_layout),
  );
const completeCommandsTail = ($) =>
  seq($.list, optional($._linebreak), optional($._free_trailing_layout));

const linebreakLedCommandsBody = ($) =>
  seq(
    $._linebreak,
    optional($._horizontal_layout),
    optional(choice(completeCommandsTail($), trailingComment($))),
  );

const substitutionCommandsBody = ($, leadingLayout) =>
  choice(
    seq(leadingLayout, optional(completeCommandsTail($))),
    completeCommandsTail($),
    linebreakLedCommandsBody($),
    trailingComment($),
  );

const dollarExpansionPrefix = ($, start = $._dollar_expansion_start) =>
  physical($, start, "$");
const dollarExpansionStart = (
  $,
  token,
  spelling,
  start = $._dollar_expansion_start,
) => seq(dollarExpansionPrefix($, start), physical($, token, spelling));
const backquoteDelimiter = ($, token) => physical($, token, "`");
const commandSubstitution = ($, prefix) =>
  seq(
    prefix,
    optional(field("body", $.command_substitution_body)),
    physical($, $._punct_right_parenthesis, ")"),
    $._command_substitution_end,
  );
const processSubstitution = ($, input, output) =>
  commandSubstitution(
    $,
    seq(
      choice(
        physical($, input, "<", "direction"),
        physical($, output, ">", "direction"),
      ),
      physical($, $._command_open, "("),
      $._command_substitution_body_begin,
    ),
  );
const braceSubstitution = ($, dollar, open) =>
  seq(
    physical($, dollar, "$"),
    physical($, open, "{"),
    ...(open.name === "_reply_open" ? [physical($, $._punct_pipe, "|")] : []),
    $._command_substitution_body_begin,
    choice(closedCompoundList($), optional($._linebreak_layout)),
    physical($, $._substitution_brace_close, "}"),
    $._command_substitution_end,
  );
const extglobAlternatives = ($) => [
  physical($, $._extglob_open, "("),
  optional(field("alternative", $.extglob_alternative)),
  repeat(
    seq(
      physical($, $._extglob_bar, "|"),
      optional(field("alternative", $.extglob_alternative)),
    ),
  ),
  physical($, $._extglob_close, ")"),
];
const extglobPattern = ($) =>
  seq(field("operator", $.extglob_operator), ...extglobAlternatives($));
const braceExpansion = ($, open) =>
  seq(
    physical($, open, "{"),
    choice(
      $.brace_sequence,
      seq(
        optional(field("alternative", $.brace_alternative)),
        repeat1(
          seq(
            physical($, $._brace_comma, ","),
            optional(field("alternative", $.brace_alternative)),
          ),
        ),
      ),
    ),
    physical($, $._brace_close, "}"),
  );

const patternSpecialStart = ($, marker) =>
  seq(physical($, $._pattern_special_left_bracket, "["), marker);
const patternSpecialEnd = ($, marker) =>
  seq(marker, physical($, $._punct_right_bracket, "]"));
const patternSpecialClassSource = ($, marker, characterSource) =>
  prec.dynamic(
    PATTERN_PRECEDENCE.specialElement,
    seq(
      patternSpecialStart($, marker),
      patternSpecialValue($, characterSource),
      patternSpecialEnd($, marker),
    ),
  );

const patternCharacterClassStructuredContent = ($) =>
  choice(...structuredSourceParts($));

const patternCharacterClassBody = ($, content) =>
  choice(
    field("content", content),
    seq(
      optional(field("content", content)),
      repeat1(
        seq(
          field("content", patternCharacterClassStructuredContent($)),
          optional(field("content", content)),
        ),
      ),
    ),
  );

const patternCharacterClassSource = ($, content) =>
  prec.dynamic(
    PATTERN_PRECEDENCE.specialElement,
    seq(
      patternSpecialStart($, physical($, $._punct_colon, ":")),
      patternCharacterClassBody($, content),
      patternSpecialEnd(
        $,
        physical($, $._pattern_character_class_end_colon, ":"),
      ),
    ),
  );

const parameterExpansion = ($, word) =>
  prec(
    1,
    choice(
      seq(dollarExpansionPrefix($), field("parameter", $._unbraced_parameter)),
      bracedParameterExpansion($, word),
    ),
  );

const bracedParameterSource = ($, classifiedParameter) =>
  choice(
    field("parameter", classifiedParameter),
    $._unclassified_numeric_parameter_source,
  );

const bracedParameterExpansion = ($, word) =>
  choice(
    seq(
      $._braced_parameter_header,
      optional(
        choice(
          $.parameter_substring,
          $.parameter_replacement,
          $.parameter_case_conversion,
          $.parameter_transformation,
        ),
      ),
      physical($, $._parameter_close, "}"),
    ),
    seq(
      $._braced_parameter_start,
      field(
        "operator",
        alias(
          $._parameter_names_indirection_operator,
          $.parameter_indirection_operator,
        ),
      ),
      field("prefix", $.parameter_name_prefix),
      field("operator", $.parameter_names_operator),
      physical($, $._parameter_close, "}"),
    ),
    seq(
      $._braced_parameter_value_header,
      optional(field("word", word)),
      physical($, $._parameter_close, "}"),
    ),
    seq(
      $._braced_parameter_pattern_header,
      optional(field("pattern", $.parameter_pattern)),
      physical($, $._parameter_close, "}"),
    ),
    seq(
      $._braced_parameter_length_header,
      physical($, $._parameter_close, "}"),
    ),
  );

const parameterPatternSource = ($) =>
  choice(
    seq($._parameter_tilde_source, repeat($._parameter_pattern_part)),
    repeat1($._parameter_pattern_part),
  );
const caseClauseItems = ($) =>
  choice(
    $._esac_keyword_source,
    seq(field("items", $._case_list), $._esac_keyword_source),
    seq(field("items", $._case_list_ns), $._esac_keyword_source),
  );

const compoundListField = ($, name) =>
  field(name, alias($._compound_list, $.list));

const conditionalThenHeader = ($, keyword) =>
  seq(
    keyword,
    compoundListField($, "condition"),
    optional($._closing_layout),
    $._then_keyword_source,
  );

const conditionalThenBranch = ($, header, tail) =>
  seq(
    header,
    compoundListField($, "consequence"),
    optional($._closing_layout),
    tail,
  );

const conditionalOperand = ($, name, boundary = []) =>
  choice(
    seq(
      field(name, $._conditional_bare_expression),
      ...boundary,
      optional($._horizontal_layout),
    ),
    seq(
      field(name, $._conditional_complete_expression),
      ...boundary,
      optional($._linebreak_layout),
    ),
  );

const conditionalJunction = ($, precedence, boundary, operator, right) =>
  prec.left(
    precedence,
    seq(
      conditionalOperand($, "left", [boundary]),
      field("operator", operator),
      optional($._linebreak_layout),
      field("right", right),
    ),
  );

const conditionalNegation = ($, operand) =>
  prec(
    3,
    seq(
      field("operator", $.conditional_not),
      optional($._linebreak_layout),
      field("operand", operand),
    ),
  );

// Layout before fi lets elif reduce its empty alternative before else.
const ifClause = ($) =>
  conditionalThenBranch(
    $,
    $._if_then_header,
    choice(
      $._fi_keyword_source,
      seq(field("alternative", $.else_part), $._fi_keyword_source),
    ),
  );

const loopClause = ($, keyword) =>
  seq(keyword, $._loop_condition, field("body", $.do_group));

const separatedForHeader = ($) =>
  seq(
    choice(
      seq(
        optional($._horizontal_layout),
        field(
          "separator",
          alias($._sequential_operator_separator, $.sequential_sep),
        ),
      ),
      field(
        "separator",
        alias($._sequential_newline_separator, $.sequential_sep),
      ),
    ),
    optional($._horizontal_layout),
  );

const commandRedirectContinuations = ($) => [
  field("redirect", alias($._io_redirect_without_descriptor, $.io_redirect)),
  seq($._redirect_separator, field("redirect", $.io_redirect)),
];

const assignmentWord = ($, value) =>
  prec.dynamic(
    ASSIGNMENT_WORD_PRECEDENCE,
    prec.right(
      seq(
        field("name", alias($._assignment_name_lexeme, $.variable_name)),
        optional(field("subscript", $.array_subscript)),
        field("operator", $._assignment_operator),
        optional(field("value", value)),
      ),
    ),
  );

const declarationSuffix = (
  $,
  assignmentField,
  continuation,
  assignment = $.assignment_word,
) =>
  choice(
    seq(
      $._word_separator,
      choice(
        seq(
          $._declaration_end,
          field("argument", $.word),
          optional($._cmd_suffix),
        ),
        seq(
          choice(
            seq(
              $._declaration_assignment_start,
              field(assignmentField, assignment),
            ),
            field("argument", $.word),
          ),
          optional(continuation),
        ),
      ),
    ),
    ...redirectedSuffixes($),
  );

const redirectedSuffixes = ($) =>
  commandRedirectContinuations($).map((redirect) =>
    seq(redirect, optional($._cmd_suffix)),
  );
const redirectList = ($) =>
  seq(
    field("redirect", $.io_redirect),
    repeat(choice(...commandRedirectContinuations($))),
  );

const redirectableCompoundCommand = ($) =>
  prec.right(
    seq(
      field("body", $._compound_command),
      optional(
        seq(
          $._redirect_list_begin,
          optional($._horizontal_layout),
          field("redirects", $._redirect_list),
        ),
      ),
    ),
  );
const assignmentPlainChunk = ($) => lexical($, $._assignment_literal_begin);
const parameterPlainChunk = ($) => lexical($, $._parameter_literal_begin);
const patternBracketExpression = ($, _list, opener) =>
  prec.dynamic(
    PATTERN_PRECEDENCE.expression,
    prec.right(
      2,
      seq(
        physical($, opener, "["),
        optional(field("negation", $.pattern_bracket_negation_source)),
        field("members", _list),
        physical($, $._punct_right_bracket, "]"),
      ),
    ),
  );
const patternBracketList = ($, member, initialRange) =>
  prec.right(
    choice(
      seq(
        field(
          "member",
          choice(
            alias(
              $._pattern_initial_right_bracket,
              $.pattern_bracket_character_source,
            ),
            initialRange,
          ),
        ),
        repeat(field("member", member)),
      ),
      repeat1(field("member", member)),
    ),
  );

const patternBracketRange = ($, endpoint, start = endpoint) =>
  seq(
    field("start", start),
    field("operator", $.pattern_bracket_range_operator_source),
    field("end", endpoint),
  );

const patternInitialBracketRange = ($, endpoint) =>
  patternBracketRange(
    $,
    endpoint,
    alias($._pattern_initial_right_bracket, $.pattern_bracket_character_source),
  );

export default function defineGrammar(name, { extglob, extquote }) {
  if (typeof extglob !== "boolean" || typeof extquote !== "boolean") {
    throw new Error(
      "Bash grammars require fixed extglob and extquote conditions.",
    );
  }
  return grammar({
    name,

    extras: ($) => [
      $._unmatchable,
      $.line_continuation,
      $._removed_newline,
      $._source_begin,
      $._removed_source,
      $._here_document_content_line_start,
    ],

    externals: ($) => {
      const tokens = [
        $._left_brace,
        $._right_brace,
        $._io_number_begin,
        $._bang_begin,
        $._if_keyword_begin,
        $._then_keyword_begin,
        $._elif_keyword_begin,
        $._else_keyword_begin,
        $._fi_keyword_begin,
        $._for_keyword_begin,
        $._in_keyword_begin,
        $._do_keyword_begin,
        $._done_keyword_begin,
        $._case_keyword_begin,
        $._esac_keyword_begin,
        $._while_keyword_begin,
        $._until_keyword_begin,
        $._here_end_begin,
        $._here_end_strip_begin,
        $._here_end_commit,
        $._here_document_line_end_begin,
        $._here_document_body_start,
        $._quoted_here_document_body_start,
        $._quoted_here_document_end_begin,
        $._quoted_here_document_end_text_begin,
        $._quoted_here_document_text_begin,
        $._here_document_end_begin,
        $._here_document_end_commit,
        $._here_document_sequence_end,
        $._here_document_content_line_start,
        $._newline_begin,
        $._arithmetic_assignment_operator_boundary,
        $._arithmetic_question_operator_boundary,
        $._arithmetic_colon_operator_boundary,
        $._arithmetic_logical_or_operator_boundary,
        $._arithmetic_logical_and_operator_boundary,
        $._arithmetic_bitwise_or_operator_boundary,
        $._arithmetic_bitwise_xor_operator_boundary,
        $._arithmetic_bitwise_and_operator_boundary,
        $._arithmetic_equality_operator_boundary,
        $._arithmetic_relational_operator_boundary,
        $._arithmetic_shift_operator_boundary,
        $._arithmetic_additive_operator_boundary,
        $._arithmetic_multiplicative_operator_boundary,
        $._arithmetic_closing_boundary,
        $._arithmetic_left_parenthesis,
        $._arithmetic_source_left_parenthesis,
        $._pattern_special_left_bracket,
        $._comment_boundary,
        $._trailing_comment_boundary,
        $._comment_text_begin,
        $._comment_line_end_begin,
        $._dollar_expansion_start,
        $._braced_parameter_number_start,
        $._braced_positional_parameter_begin,
        $._backquote_start,
        $._backquote_end,
        $._pattern_continuation,
        $._pattern_end,
        $._pipe_continuation,
        $._redirect_list_begin,
        $._case_item_end,
        $._function_body_continuation_boundary,
        $._command_substitution_body_begin,
        $._pattern_bracket_character_begin,
        $._parameter_pattern_bracket_character_begin,
        $._pattern_bracket_hyphen_begin,
        $._pattern_bracket_range_operator_begin,
        $._word_tilde_end,
        $._assignment_tilde_end,
        $._assignment_name_begin,
        $._fname_begin,
        $._and_or_continuation,
        $._word_separator_begin,
        $._term_continuation,
        $._assignment_separator_begin,
        $._redirect_separator_begin,
        $._pre_newline_blank_begin,
        $._command_substitution_end,
        $._separator_newline,
        $._term_boundary,
        $._word_pattern_bracket_open,
        $._parameter_pattern_bracket_open,
        $._double_quoted_backquote_start,
        $._dollar_single_quote_escape_begin,
        $._pattern_character_class_end_colon,
        $.line_continuation,
        $._removed_newline,
        $._plain_word_begin,
        $._literal_begin,
        $._assignment_literal_begin,
        $._parameter_literal_begin,
        $._name_begin,
        $._variable_name_begin,
        $._escaped_character_begin,
        $._single_quote_content_begin,
        $._double_quote_text_begin,
        $._double_quote_escape_begin,
        $._dollar_single_quote_text_begin,
        $._double_quoted_parameter_text_begin,
        $._double_quoted_parameter_escape_begin,
        $._here_document_text_begin,
        $._here_document_escape_begin,
        $._here_document_end_text_begin,
        $._unbraced_positional_parameter_begin,
        $._special_parameter_begin,
        $._special_parameter_hash_begin,
        $._parameter_value_operator_begin,
        $._parameter_pattern_operator_begin,
        $._arithmetic_number_begin,
        $._arithmetic_variable_begin,
        $._arithmetic_unary_operator_begin,
        $._arithmetic_assignment_operator_begin,
        $._arithmetic_question_operator_begin,
        $._arithmetic_colon_operator_begin,
        $._arithmetic_logical_or_operator_begin,
        $._arithmetic_logical_and_operator_begin,
        $._arithmetic_bitwise_or_operator_begin,
        $._arithmetic_bitwise_xor_operator_begin,
        $._arithmetic_bitwise_and_operator_begin,
        $._arithmetic_equality_operator_begin,
        $._arithmetic_relational_operator_begin,
        $._arithmetic_shift_operator_begin,
        $._arithmetic_additive_operator_begin,
        $._arithmetic_multiplicative_operator_begin,
        $._and_if_begin,
        $._or_if_begin,
        $._dsemi_begin,
        $._semi_and_begin,
        $._lessand_begin,
        $._greatand_begin,
        $._dgreat_begin,
        $._lessgreat_begin,
        $._clobber_begin,
        $._dless_operator_begin,
        $._dlessdash_operator_begin,
        $._pattern_star_begin,
        $._pattern_question_begin,
        $._pattern_negation_begin,
        $._pattern_class_content_begin,
        $._parameter_pattern_class_content_begin,
        $._pattern_collating_character_begin,
        $._parameter_pattern_collating_character_begin,
        $._pattern_equivalence_character_begin,
        $._parameter_pattern_equivalence_character_begin,
        $._punct_left_parenthesis,
        $._punct_right_parenthesis,
        $._punct_semicolon,
        $._punct_ampersand,
        $._punct_pipe,
        $._punct_less,
        $._punct_greater,
        $._punct_equals,
        $._punct_right_bracket,
        $._punct_colon,
        $._punct_dot,
        $._sq_open,
        $._sq_close,
        $._dq_open,
        $._dq_close,
        $._dollar_sq_dollar,
        $._dollar_sq_open,
        $._dollar_sq_close,
        $._parameter_open,
        $._parameter_close,
        $._command_open,
        $._arithmetic_expansion_open,
        $._bracket_arithmetic_open,
        $._bracket_arithmetic_close,
        $._numeric_parameter_digit,
        $._word_tilde_start,
        $._assignment_tilde_start,
        $._parameter_tilde_start,
        $._logical_newline_begin,
        $._logical_blank_begin,
        $._arithmetic_expansion_end,
        $._pattern_initial_right_bracket_begin,
        $._source_begin,
        $._removed_source,
        $._here_document_end_line_end_begin,
        $._word_fallback_literal_begin,
        $._assignment_fallback_literal_begin,
        $._parameter_fallback_literal_begin,
        $._word_bracket_fallback_end,
        $._assignment_bracket_fallback_end,
        $._parameter_bracket_fallback_end,
        $._here_document_sequence_begin,
        $._inherited_here_document_begin,
        $._fragmented_lexeme_begin,
        $._fragmented_lexeme_end,
        $.lexeme_fragment,
        $._layout_fragment,
        $._parameter_hyphen_begin,
        $._parameter_question_begin,
        $._arithmetic_blank_begin,
        $._parameter_length_operator_begin,
        $._arithmetic_source_fragment_begin,
        $._arithmetic_source_operator_begin,
        $._word_start,
        $._dollar_dq_dollar,
        $._process_in_start,
        $._process_out_start,
        $._extglob_open,
        $._extglob_close,
        $._extglob_bar,
        $._current_shell_open,
        $._reply_open,
        $._substitution_brace_close,
        $._subscript_open,
        $._arithmetic_subscript_open,
        $._subscript_close,
        $._subscript_all_elements_begin,
        $._subscript_expression_start,
        $._subscript_source_start,
        $._subscript_closing_boundary,
        $._brace_open,
        $._brace_close,
        $._brace_comma,
        $._extglob_operator_begin,
        $._extglob_text_begin,
        $._brace_text_begin,
        $._parameter_indirection_begin,
        $._parameter_names_begin,
        $._parameter_names_indirection_begin,
        $._parameter_names_text_begin,
        $._parameter_substring_begin,
        $._arithmetic_field_expression_start,
        $._arithmetic_field_source_start,
        $._arithmetic_field_closing_boundary,
        $._substring_separator_begin,
        $._parameter_replace_begin,
        $._replacement_separator_begin,
        $._parameter_case_begin,
        $._parameter_transform_begin,
        $._parameter_transform_code_begin,
        $._arithmetic_power_operator_begin,
        $._arithmetic_comma_operator_begin,
        $._arithmetic_update_operator_begin,
        $._arithmetic_power_operator_boundary,
        $._arithmetic_comma_operator_boundary,
        $._arithmetic_update_operator_boundary,
        $._assignment_argument_head_begin,
        $._brace_endpoint_begin,
        $._brace_increment_begin,
        $._brace_separator_begin,
        $._brace_literal_open,
        $._assignment_argument_start,
        $._brace_sequence_start,
        $._select_keyword_begin,
        $._function_keyword_begin,
        $._time_keyword_begin,
        $._coproc_keyword_begin,
        $._dsemi_and_begin,
        $._pipe_and_begin,
        $._andgreat_begin,
        $._anddgreat_begin,
        $._here_string_begin,
        $._explicit_fname_begin,
        $._coproc_name_start,
        $._time_option_begin,
        $._io_variable_open,
        $._io_variable_close,
        $._arithmetic_command_open,
        $._for_arithmetic_open,
        $._for_expression_start,
        $._for_source_start,
        $._assignment_append_begin,
        $._declaration_name_begin,
        $._array_assignment_open,
        $._array_assignment_close,
        $._array_element_start,
        $._array_word_start,
        $._conditional_open_begin,
        $._conditional_close_begin,
        $._conditional_unary_begin,
        $._conditional_binary_begin,
        $._conditional_match_begin,
        $._conditional_regex_begin,
        $._conditional_not_begin,
        $._conditional_word_start,
        $._conditional_pattern_start,
        $._conditional_word_end,
        $._regex_start,
        $._regex_end,
        $._regex_source_group_end,
        $._ere_character_begin,
        $._ere_collating_character_begin,
        $._ere_initial_close_begin,
        $._ere_compound_character_begin,
        $._ere_compound_multi_begin,
        $._ere_equivalence_character_begin,
        $._ere_equivalence_multi_begin,
        $._ere_meta_character_begin,
        $._ere_class_name_begin,
        $._ere_count_begin,
        $._ere_fragment_begin,
        $._ere_wildcard_begin,
        $._ere_left_anchor_begin,
        $._ere_right_anchor_begin,
        $._ere_modifier_begin,
        $._ere_member_open_begin,
        $._ere_member_close_begin,
        $._ere_bar,
        $._ere_source_bar,
        $._ere_star,
        $._ere_plus,
        $._ere_question,
        $._ere_bracket_open,
        $._ere_bracket_close,
        $._ere_negation,
        $._ere_hyphen,
        $._ere_literal_hyphen,
        $._ere_initial_hyphen,
        $._ere_interval_open,
        $._ere_interval_close,
        $._ere_comma,
        $._ere_class_open,
        $._ere_collating_open,
        $._ere_equivalence_open,
        $._ere_colon,
        $._ere_dot,
        $._ere_equal,
        $._ere_compound_close,
        $._ere_range_end_hyphen,
        $._ere_ordinary_close,
        $._ere_ordinary_brace,
        $._regex_open,
        $._regex_close,
        $._function_parentheses_start,
        $._for_semicolon,
        $._for_closing_boundary,
        $._conditional_and_boundary,
        $._conditional_or_boundary,
        $._time_option_start,
        $._time_end_begin,
        $._time_end_start,
        $._empty_bang_begin,
        $._declaration_end,
        $._declaration_assignment_start,
        $._command_word_start,
        $._brace_word_start,
        $._brace_word_end,
        $._empty_time_keyword_begin,
        ...sourceExternals($),
      ];
      const names = new Set();
      for (const { name } of tokens) {
        if (names.has(name)) {
          throw new Error(`Duplicate external token ${name}`);
        }
        names.add(name);
      }
      for (const begin of sourceKinds.keys()) {
        if (!names.has(begin)) {
          throw new Error(`Missing external source token ${begin}`);
        }
      }
      return tokens;
    },

    conflicts: ($) => [
      [$._list],
      [$._term],
      [$._compound_list],
      [$.list],
      [$._conditional_bare_expression, $.conditional_binary_expression],
      [$._sequential_newline_separator, $._linebreak],
      [$._complete_command],
    ],

    rules: {
      program: ($) =>
        seq(
          optional(field("leading", $._linebreak)),
          optional($._horizontal_layout),
          choice(
            seq(
              field("commands", $.list),
              optional(field("trailing", $._linebreak)),
              optional($._free_trailing_layout),
            ),
            optional(trailingComment($)),
          ),
        ),

      _unmatchable: () => token(seq(/[\s\S]/, /[^\s\S]/)),

      _arithmetic_unary_operator_lexeme: ($) =>
        lexical($, $._arithmetic_unary_operator_begin),

      _and_if_lexeme: ($) => lexical($, $._and_if_begin),

      _or_if_lexeme: ($) => lexical($, $._or_if_begin),

      ...keywordRules(),

      _dsemi_lexeme: ($) => lexical($, $._dsemi_begin),

      _semi_and_lexeme: ($) => lexical($, $._semi_and_begin),

      _dgreat_lexeme: ($) => lexical($, $._dgreat_begin),

      _dless_operator_lexeme: ($) => lexical($, $._dless_operator_begin),

      _dlessdash_operator_lexeme: ($) =>
        lexical($, $._dlessdash_operator_begin),

      _quoted_here_document_end_text_lexeme: ($) =>
        lexical($, $._quoted_here_document_end_text_begin),

      _quoted_here_document_text_lexeme: ($) =>
        lexical($, $._quoted_here_document_text_begin),

      _assignment_name_lexeme: ($) => lexical($, $._assignment_name_begin),

      _special_parameter_hash_lexeme: ($) =>
        lexical($, $._special_parameter_hash_begin),
      _parameter_hyphen_lexeme: ($) => lexical($, $._parameter_hyphen_begin),
      _parameter_question_lexeme: ($) =>
        lexical($, $._parameter_question_begin),

      _special_parameter_lexeme: ($) => lexical($, $._special_parameter_begin),

      _parameter_value_operator_lexeme: ($) =>
        choice(
          lexical($, $._parameter_value_operator_begin),
          $._parameter_hyphen_lexeme,
          $._parameter_question_lexeme,
        ),

      _parameter_pattern_operator_lexeme: ($) =>
        choice(
          lexical($, $._parameter_pattern_operator_begin),
          prec.right(
            1,
            seq(
              $._special_parameter_hash_lexeme,
              optional($._special_parameter_hash_lexeme),
            ),
          ),
        ),

      _arithmetic_question_operator_lexeme: ($) =>
        lexical($, $._arithmetic_question_operator_begin),

      _arithmetic_colon_operator_lexeme: ($) =>
        lexical($, $._arithmetic_colon_operator_begin),

      _arithmetic_assignment_operator_lexeme: ($) =>
        lexical($, $._arithmetic_assignment_operator_begin),

      list: ($) =>
        seq(
          field("command", $._complete_command),
          repeat(
            seq(
              choice(
                field("separator", $._separator_led_newline_list),
                seq($._term_continuation, field("separator", $._newline_list)),
                field("separator", $._here_document_led_newline_list),
              ),
              optional($._horizontal_layout),
              field("command", $._complete_command),
            ),
          ),
          optional($._term_boundary),
        ),

      _complete_command: ($) =>
        seq(
          field("body", $._list),
          optional(
            choice(
              seq(
                optional($._horizontal_layout),
                field("terminator", $.separator_op),
              ),
              $._term_boundary,
            ),
          ),
        ),

      _list: ($) =>
        seq(
          field("and_or", $.and_or),
          repeat(
            seq(
              optional($._horizontal_layout),
              field("separator", $.separator_op),
              optional($._horizontal_layout),
              field("and_or", $.and_or),
            ),
          ),
        ),

      and_or: ($) =>
        seq(
          field("pipeline", $.pipeline),
          repeat(
            seq(
              optional(
                seq($._and_or_continuation, optional($._horizontal_layout)),
              ),
              field("operator", choice($._and_if, $._or_if)),
              optional($._linebreak_layout),
              field("pipeline", $.pipeline),
            ),
          ),
        ),

      pipeline: ($) => $._pipeline_body,
      _pipeline_body: ($) =>
        choice(
          $._pipe_sequence,
          seq(
            field("negation", $.bang),
            optional($._horizontal_layout),
            $._pipeline_body,
          ),
          field("negation", $._empty_bang),
          seq(
            field("timing", $.timing),
            optional($._horizontal_layout),
            $._pipeline_body,
          ),
          field("timing", alias($._empty_timing, $.timing)),
        ),
      timing: ($) => seq($._time_keyword_source, optional($._timing_options)),
      _empty_time_keyword_lexeme: ($) =>
        lexical($, $._empty_time_keyword_begin),
      _empty_timing: ($) =>
        seq(
          wholeSource(
            $,
            $._empty_time_keyword_begin,
            $._empty_time_keyword_lexeme,
            $.time_keyword,
          ),
          optional($._timing_options),
        ),
      _timing_options: ($) =>
        seq(
          $._time_option_start,
          $._horizontal_layout,
          choice(
            field("option", alias($._time_end, $.time_option)),
            seq(
              field("option", $.time_option),
              optional(
                seq(
                  $._time_end_start,
                  $._horizontal_layout,
                  field("option", alias($._time_end, $.time_option)),
                ),
              ),
            ),
          ),
        ),
      time_option: ($) => lexical($, $._time_option_begin),
      _time_end: ($) => lexical($, $._time_end_begin),

      pipe_and: ($) => lexical($, $._pipe_and_begin),

      _pipe_sequence: ($) =>
        seq(
          field("command", $.command),
          repeat(
            seq(
              optional(
                seq($._pipe_continuation, optional($._horizontal_layout)),
              ),
              field(
                "operator",
                choice(physical($, $._punct_pipe, "|"), $.pipe_and),
              ),
              optional($._linebreak_layout),
              field("command", $.command),
            ),
          ),
        ),

      command: ($) =>
        choice(
          field("body", $.simple_command),
          $._redirectable_compound_command,
          field("body", $.function_definition),
          field("body", $.coproc),
        ),

      coproc: ($) =>
        seq(
          $._coproc_keyword_source,
          optional($._horizontal_layout),
          choice(
            seq(
              field("name", alias($._coproc_name_word, $.word)),
              optional($._horizontal_layout),
              $._redirectable_compound_command,
            ),
            field("body", alias($._coproc_simple_command, $.simple_command)),
            $._redirectable_compound_command,
          ),
        ),

      _coproc_simple_command: ($) =>
        choice(
          $._prefixed_command,
          $._declaration_command,
          seq($._command_name, optional($._coproc_command_suffix)),
        ),

      _coproc_command_suffix: ($) =>
        choice(
          seq(
            $._assignment_separator,
            field("argument", $.assignment_word),
            optional($._coproc_command_suffix),
          ),
          seq(
            $._word_separator,
            field("argument", alias($._declaration_argument, $.word)),
            optional($._coproc_declaration_suffix),
          ),
          seq(
            $._word_separator,
            field("argument", alias($._command_word, $.word)),
            optional($._cmd_suffix),
          ),
          ...redirectedSuffixes($),
        ),

      _declaration_argument: ($) => alias($.declaration_name, $.literal),

      _redirectable_compound_command: ($) => redirectableCompoundCommand($),

      separator_op: ($) =>
        choice(
          physical($, $._punct_ampersand, "&"),
          physical($, $._punct_semicolon, ";"),
        ),

      _operator_separator: ($) =>
        separatorOperatorLayout($, field("operator", $.separator_op)),

      _newline_separator: ($) => field("newlines", $._newline_list),

      _separator_led_newline_separator: ($) =>
        field("newlines", $._separator_led_newline_list),

      _here_document_led_separator: ($) =>
        field("newlines", $._here_document_led_newline_list),

      _sequential_operator_separator: ($) =>
        separatorOperatorLayout($, physical($, $._punct_semicolon, ";")),

      _sequential_newline_separator: ($) => field("newlines", $._newline_list),

      _term: ($) =>
        seq(
          field("and_or", $.and_or),
          repeat(
            seq(
              choice(
                field(
                  "separator",
                  alias($._separator_led_newline_separator, $.separator),
                ),
                seq(
                  optional($._horizontal_layout),
                  field("separator", alias($._operator_separator, $.separator)),
                ),
                seq(
                  $._term_continuation,
                  field("separator", alias($._newline_separator, $.separator)),
                ),
                field(
                  "separator",
                  alias($._here_document_led_separator, $.separator),
                ),
              ),
              optional($._horizontal_layout),
              field("and_or", $.and_or),
            ),
          ),
          optional($._term_boundary),
        ),

      _compound_list: ($) =>
        seq(
          optional(field("leading", $._linebreak)),
          optional($._horizontal_layout),
          field("body", $._term),
          optional(
            choice(
              seq(
                optional($._horizontal_layout),
                field("terminator", alias($._operator_separator, $.separator)),
              ),
              field("terminator", alias($._newline_separator, $.separator)),
            ),
          ),
        ),

      _and_if: ($) => alias($._and_if_lexeme, $.and_if),
      _or_if: ($) => alias($._or_if_lexeme, $.or_if),
      bang: ($) => lexical($, $._bang_begin),
      _empty_bang_lexeme: ($) => lexical($, $._empty_bang_begin),
      _empty_bang: ($) =>
        wholeSource($, $._empty_bang_begin, $._empty_bang_lexeme, $.bang),
      function_definition: ($) =>
        seq(
          $._function_definition_header,
          $._function_body_continuation_boundary,
          optional(field("linebreak", $._linebreak)),
          optional($._horizontal_layout),
          field("body", $.function_body),
        ),

      _function_definition_header: ($) =>
        choice(
          seq(
            field("name", $.function_name),
            optional($._horizontal_layout),
            $._function_parentheses,
          ),
          seq(
            $._function_keyword_source,
            $._word_separator,
            field("name", alias($._explicit_function_name, $.function_name)),
            optional(
              seq(
                $._function_parentheses_start,
                optional($._horizontal_layout),
                $._function_parentheses,
              ),
            ),
          ),
        ),
      _function_parentheses: ($) =>
        seq(
          physical($, $._punct_left_parenthesis, "("),
          optional($._horizontal_layout),
          physical($, $._punct_right_parenthesis, ")"),
        ),
      _explicit_function_name: ($) => lexical($, $._explicit_fname_begin),

      function_body: ($) => $._redirectable_compound_command,

      function_name: ($) => lexical($, $._fname_begin),
      name: ($) => lexical($, $._name_begin),
      _compound_command: ($) =>
        choice(
          $.brace_group,
          $.subshell,
          $.for_clause,
          $.select_clause,
          $.arithmetic_command,
          $.conditional_command,
          $.arithmetic_for_clause,
          $.case_clause,
          $.if_clause,
          $.while_clause,
          $.until_clause,
        ),

      _redirect_list: ($) => redirectList($),

      brace_group: ($) =>
        seq(
          physical($, $._left_brace, "{"),
          compoundListField($, "body"),
          optional($._closing_layout),
          physical($, $._right_brace, "}"),
        ),

      subshell: ($) =>
        seq(
          physical($, $._punct_left_parenthesis, "("),
          field("body", alias($._compound_list, $.list)),
          optional($._closing_layout),
          physical($, $._punct_right_parenthesis, ")"),
        ),
      for_clause: ($) => seq($._for_keyword_source, $._word_loop_clause),

      select_clause: ($) => seq($._select_keyword_source, $._word_loop_clause),

      _word_loop_clause: ($) =>
        choice(
          seq($._word_loop_do_header, field("body", $.do_group)),
          seq(
            $._word_loop_separated_header,
            field("body", choice($.do_group, $.brace_group)),
          ),
        ),

      _word_loop_do_header: ($) =>
        seq($._word_separator, field("name", $.name), $._horizontal_layout),

      _word_loop_separated_header: ($) =>
        seq(
          $._word_separator,
          field("name", $.name),
          optional(
            seq(
              $._linebreak_layout,
              field("in", $._in),
              optional(seq($._horizontal_layout, field("words", $._wordlist))),
            ),
          ),
          separatedForHeader($),
        ),

      _in: ($) => $._in_keyword_source,

      _wordlist: ($) =>
        prec.right(
          seq(
            field("word", $.word),
            repeat(seq($._word_separator, field("word", $.word))),
          ),
        ),
      do_group: ($) =>
        seq(
          $._do_keyword_source,
          compoundListField($, "body"),
          optional($._closing_layout),
          prec(20, $._done_keyword_source),
        ),

      _if_then_header: ($) => conditionalThenHeader($, $._if_keyword_source),

      _elif_then_header: ($) =>
        conditionalThenHeader($, $._elif_keyword_source),

      if_clause: ($) => prec.right(ifClause($)),

      else_part: ($) =>
        prec.right(
          choice(
            conditionalThenBranch(
              $,
              $._elif_then_header,
              optional(field("alternative", $.else_part)),
            ),
            seq(
              $._else_keyword_source,
              compoundListField($, "body"),
              optional($._closing_layout),
            ),
          ),
        ),

      _loop_condition: ($) =>
        seq(compoundListField($, "condition"), optional($._closing_layout)),

      while_clause: ($) => loopClause($, $._while_keyword_source),

      until_clause: ($) => loopClause($, $._until_keyword_source),

      _case_selector_header: ($) =>
        seq(
          $._case_keyword_source,
          $._word_separator,
          field("word", alias($._case_word, $.word)),
        ),

      case_clause: ($) => seq($._case_header, caseClauseItems($)),

      _case_header: ($) =>
        seq(
          $._case_selector_header,
          $._linebreak_layout,
          field("in", $._in),
          optional($._linebreak_layout),
        ),

      _case_list_ns: ($) =>
        choice(
          field("item", alias($._case_item_ns, $.case_item)),
          seq(
            field("terminated", $._case_list),
            field("item", alias($._case_item_ns, $.case_item)),
          ),
        ),

      _case_list: ($) => repeat1(field("item", $.case_item)),

      _case_item_header: ($) =>
        seq(
          field("patterns", $.pattern_list),
          $._pattern_end,
          optional($._horizontal_layout),
          physical($, $._punct_right_parenthesis, ")"),
        ),

      _case_item_ns: ($) =>
        seq(
          $._case_item_header,
          choice(
            seq(optional($._linebreak), optional($._horizontal_layout)),
            prec.dynamic(10, closedCompoundList($)),
          ),
        ),

      case_item: ($) =>
        seq(
          $._case_item_header,
          choice(
            optional($._linebreak_layout),
            prec.dynamic(10, field("body", alias($._compound_list, $.list))),
          ),
          seq($._case_item_end, optional($._horizontal_layout)),
          field("terminator", choice($._dsemi, $._semi_and, $.dsemi_and)),
          optional($._linebreak_layout),
        ),

      pattern_list: ($) =>
        prec.dynamic(
          2,
          seq(
            optional(
              seq(
                physical($, $._punct_left_parenthesis, "("),
                optional($._horizontal_layout),
              ),
            ),
            field("word", alias($._case_word, $.word)),
            repeat(
              seq(
                $._pattern_continuation,
                optional($._horizontal_layout),
                physical($, $._punct_pipe, "|"),
                optional($._horizontal_layout),
                field("word", alias($._case_word, $.word)),
              ),
            ),
          ),
        ),
      dsemi_and: ($) => lexical($, $._dsemi_and_begin),
      _dsemi: ($) => alias($._dsemi_lexeme, $.dsemi),
      _semi_and: ($) => alias($._semi_and_lexeme, $.semi_and),
      simple_command: ($) => choice($._prefixed_command, $._named_command),
      _prefixed_command: ($) =>
        choice(
          seq(
            $._cmd_prefix,
            optional(seq($._word_separator, $._named_command)),
          ),
          seq(
            $._assignment_prefix,
            choice(...commandRedirectContinuations($)),
            repeat(
              choice(
                seq(
                  $._assignment_separator,
                  field(
                    "assignment",
                    alias($._scalar_assignment_word, $.assignment_word),
                  ),
                ),
                ...commandRedirectContinuations($),
              ),
            ),
            optional(seq($._word_separator, $._scalar_named_command)),
          ),
        ),
      _scalar_named_command: ($) =>
        choice(
          seq(field("name", $.word), optional($._cmd_suffix)),
          seq(
            field("name", $.declaration_name),
            optional($._scalar_declaration_suffix),
          ),
        ),
      _scalar_declaration_suffix: ($) =>
        declarationSuffix(
          $,
          "assignment",
          $._scalar_declaration_suffix,
          alias($._scalar_assignment_word, $.assignment_word),
        ),
      _named_command: ($) =>
        choice(
          seq($._command_name, optional($._cmd_suffix)),
          $._declaration_command,
        ),
      _command_name: ($) => field("name", alias($._command_word, $.word)),
      _declaration_command: ($) =>
        seq(field("name", $.declaration_name), optional($._declaration_suffix)),
      declaration_name: ($) => lexical($, $._declaration_name_begin),
      _declaration_suffix: ($) =>
        declarationSuffix($, "assignment", $._declaration_suffix),

      _coproc_declaration_suffix: ($) =>
        declarationSuffix($, "argument", $._coproc_declaration_suffix),

      _cmd_prefix: ($) => choice($._redirect_prefix, $._assignment_prefix),
      _redirect_prefix: ($) =>
        seq(
          field("redirect", $.io_redirect),
          repeat(choice(...commandRedirectContinuations($))),
        ),
      _assignment_prefix: ($) =>
        seq(
          optional(seq($._redirect_prefix, $._assignment_separator)),
          field("assignment", $.assignment_word),
          repeat(
            seq(
              $._assignment_separator,
              field("assignment", $.assignment_word),
            ),
          ),
        ),

      _cmd_suffix: ($) =>
        repeat1(
          choice(
            seq($._word_separator, field("argument", $.word)),
            ...commandRedirectContinuations($),
          ),
        ),

      io_redirect: ($) =>
        choice(
          seq(
            field("number", choice($.io_number, $.io_variable)),
            field("body", choice($.io_file, $.io_here)),
          ),
          field("body", choice($.io_file, $.io_here)),
        ),
      _io_redirect_without_descriptor: ($) =>
        field("body", choice($.io_file, $.io_here)),

      io_variable: ($) =>
        seq(
          physical($, $._io_variable_open, "{"),
          field("name", $.variable_name),
          optional(field("subscript", $.array_subscript)),
          physical($, $._io_variable_close, "}"),
        ),
      io_number: ($) => lexical($, $._io_number_begin),
      _io_file_prefix: ($) =>
        seq(
          choice(
            physical($, $._punct_less, "<", "operator"),
            physical($, $._punct_greater, ">", "operator"),
            field(
              "operator",
              choice(
                $.lessand,
                $.greatand,
                $._dgreat,
                $.lessgreat,
                $.clobber,
                $.andgreat,
                $.anddgreat,
                $.here_string_operator,
              ),
            ),
          ),
          optional($._horizontal_layout),
        ),

      io_file: ($) =>
        choice(
          seq($._io_file_prefix, field("filename", $._filename)),
          seq(
            field("operator", choice($.lessand, $.greatand)),
            optional($._horizontal_layout),
            field("filename", alias($._numeric_filename, $.word)),
          ),
        ),

      _filename: ($) => $.word,
      _numeric_filename: ($) => alias($.io_number, $.literal),

      andgreat: ($) => lexical($, $._andgreat_begin),
      anddgreat: ($) => lexical($, $._anddgreat_begin),
      here_string_operator: ($) => lexical($, $._here_string_begin),
      lessand: ($) => lexical($, $._lessand_begin),
      greatand: ($) => lexical($, $._greatand_begin),
      _dgreat: ($) => alias($._dgreat_lexeme, $.dgreat),
      lessgreat: ($) => lexical($, $._lessgreat_begin),
      clobber: ($) => lexical($, $._clobber_begin),
      io_here: ($) =>
        choice(
          hereDocumentRedirect(
            $,
            alias($._dless_operator_lexeme, $.dless),
            $.here_end,
          ),
          hereDocumentRedirect(
            $,
            alias($._dlessdash_operator_lexeme, $.dlessdash),
            alias($._here_end_strip, $.here_end),
          ),
        ),
      here_end: ($) => hereEnd($, $._here_end_begin),
      _here_end_strip: ($) => hereEnd($, $._here_end_strip_begin),

      _here_end_source_word: ($) =>
        seq(
          $._word_start,
          $._brace_word_start,
          repeat1($._pattern_word_part),
          $._brace_word_end,
        ),
      _fragmented_lexeme: ($) =>
        seq(
          $._fragmented_lexeme_begin,
          repeat1(
            choice(field("fragment", $.lexeme_fragment), inheritedDocument($)),
          ),
          $._fragmented_lexeme_end,
        ),
      _fragmented_layout: ($) =>
        seq(
          $._fragmented_lexeme_begin,
          repeat1(choice($._layout_fragment, inheritedDocument($))),
          $._fragmented_lexeme_end,
        ),
      _inherited_here_document_sequence: ($) =>
        seq(
          $._inherited_here_document_begin,
          repeat1(field("document", $.here_document)),
          $._here_document_sequence_end,
        ),
      here_document_sequence: ($) =>
        seq(
          $._here_document_sequence_begin,
          optional($._closing_layout),
          optional(boundaryLineComment($, field("comment", $.comment))),
          field("line_end", $.here_document_line_end),
          repeat1(field("document", $.here_document)),
          $._here_document_sequence_end,
        ),
      _here_document_prefix: ($) =>
        seq(
          $._here_document_body_start,
          optional(field("body", $.here_document_body)),
        ),

      _quoted_here_document_prefix: ($) =>
        seq(
          $._quoted_here_document_body_start,
          optional(field("body", $.quoted_here_document_body)),
        ),

      here_document: ($) =>
        seq(
          choice($._here_document_prefix, $._quoted_here_document_prefix),
          choice(
            field("end", $.here_document_end),
            $._here_document_end_commit,
          ),
        ),

      here_document_end: ($) =>
        seq(
          choice(
            hereDocumentEndSource(
              $._quoted_here_document_end_begin,
              alias(
                $._quoted_here_document_end_text_lexeme,
                $.here_document_end_text,
              ),
            ),
            hereDocumentEndSource(
              $._here_document_end_begin,
              $.here_document_end_text,
            ),
          ),
          optional($._here_document_end_line_end),
          $._here_document_end_commit,
        ),

      _here_document_end_line_end: ($) =>
        lexical($, $._here_document_end_line_end_begin),

      here_document_end_text: ($) =>
        lexical($, $._here_document_end_text_begin),

      here_document_body: ($) =>
        repeat1(
          choice(
            $.here_document_text,
            $.here_document_escape,
            ...quotedExpansionParts($),
            $._newline,
          ),
        ),
      here_document_text: ($) => lexical($, $._here_document_text_begin),

      here_document_escape: ($) => lexical($, $._here_document_escape_begin),
      quoted_here_document_body: ($) =>
        repeat1(
          choice(
            alias(
              $._quoted_here_document_text_lexeme,
              $.quoted_here_document_text,
            ),
            $._newline,
          ),
        ),
      assignment_word: ($) =>
        assignmentWord($, choice($.assignment_value, $.array_assignment)),
      _scalar_assignment_word: ($) => assignmentWord($, $.assignment_value),
      _assignment_operator: ($) =>
        choice(physical($, $._punct_equals, "="), $.assignment_append),
      assignment_append: ($) => lexical($, $._assignment_append_begin),
      array_assignment: ($) =>
        seq(
          physical($, $._array_assignment_open, "("),
          optional($._linebreak_layout),
          optional(
            seq(
              field(
                "element",
                choice(
                  alias($._array_word, $.word),
                  $.array_element_assignment,
                ),
              ),
              repeat(
                seq(
                  $._linebreak_layout,
                  field(
                    "element",
                    choice(
                      alias($._array_word, $.word),
                      $.array_element_assignment,
                    ),
                  ),
                ),
              ),
              optional($._linebreak_layout),
            ),
          ),
          physical($, $._array_assignment_close, ")"),
        ),
      _array_word: ($) =>
        braceWord(
          $,
          $._pattern_word_part,
          $._assignment_word_part,
          $.tilde_expansion,
          $._array_word_start,
        ),
      array_element_assignment: ($) =>
        prec.right(
          seq(
            $._array_element_start,
            field("subscript", $.array_subscript),
            field("operator", $._assignment_operator),
            optional(field("value", $.assignment_value)),
          ),
        ),

      variable_name: ($) => lexical($, $._variable_name_begin),
      assignment_value: ($) => prec.right($._assignment_source_word),

      _assignment_source_word: ($) =>
        repeat1(
          choice(
            alias($._assignment_tilde_expansion, $.tilde_expansion),
            $._assignment_word_part,
          ),
        ),

      _assignment_word_part: ($) =>
        choice(
          $._assignment_bracket_fallback,
          $.pattern_bracket_source,
          alias($._assignment_literal, $.literal),
          $.pattern_star_source,
          $.pattern_question_source,
          $._word_structured_part,
        ),

      _assignment_literal: ($) => prec.right(assignmentPlainChunk($)),

      word: ($) => $._source_word,

      _source_word: ($) =>
        choice(
          $._plain_word,
          braceWord(
            $,
            $._pattern_word_part,
            $._assignment_word_part,
            $.tilde_expansion,
            $._word_start,
          ),
        ),
      _coproc_name_word: ($) =>
        seq(
          startedWord(
            $._pattern_word_part,
            $.tilde_expansion,
            seq($._coproc_name_start, $._brace_word_start),
          ),
          $._brace_word_end,
        ),
      _command_word: ($) =>
        choice(
          $._plain_word,
          braceWord(
            $,
            $._pattern_word_part,
            $._assignment_word_part,
            $.tilde_expansion,
            $._command_word_start,
          ),
        ),
      _case_word: ($) =>
        prec.right(
          sourceWord(
            $,
            $._pattern_word_part,
            $._assignment_word_part,
            alias($._case_tilde_expansion, $.tilde_expansion),
          ),
        ),
      _case_tilde_expansion: ($) =>
        tildeExpansion(
          $,
          $._word_tilde_start,
          alias($._case_tilde_user, $.tilde_user),
          $._word_tilde_end,
        ),
      _case_tilde_user: ($) => repeat1($._pattern_word_part),
      _assignment_argument_head: ($) =>
        lexical($, $._assignment_argument_head_begin),

      tilde_expansion: ($) =>
        tildeExpansion($, $._word_tilde_start, $.tilde_user, $._word_tilde_end),
      _assignment_tilde_expansion: ($) =>
        tildeExpansion(
          $,
          $._assignment_tilde_start,
          alias($._assignment_tilde_user, $.tilde_user),
          $._assignment_tilde_end,
        ),
      _parameter_tilde_expansion: ($) =>
        tildeExpansion(
          $,
          $._parameter_tilde_start,
          alias($._parameter_tilde_user, $.tilde_user),
          $._word_tilde_end,
        ),

      tilde_user: ($) => repeat1($._pattern_word_part),
      _assignment_tilde_user: ($) => repeat1($._assignment_word_part),
      _parameter_tilde_user: ($) => repeat1($._parameter_pattern_part),
      _pattern_word_part: ($) =>
        choice(
          $._word_bracket_fallback,
          $.pattern_bracket_source,
          $.literal,
          $.pattern_star_source,
          $.pattern_question_source,
          $._word_structured_part,
        ),

      _word_structured_part: ($) =>
        choice(...structuredSourceParts($), inheritedDocument($)),

      _plain_word: ($) =>
        wholeSource($, $._plain_word_begin, $._plain_word_lexeme, $.literal),
      _plain_word_lexeme: ($) => lexical($, $._plain_word_begin),
      literal: ($) => lexical($, $._literal_begin),

      ...physicalRules(),
      _word_fallback_literal: ($) => lexical($, $._word_fallback_literal_begin),
      _word_bracket_fallback: ($) =>
        bracketFallback(
          $,
          $._word_fallback_literal,
          $.literal,
          $.pattern_bracket_source,
          $._word_bracket_fallback_end,
        ),
      _assignment_fallback_literal: ($) =>
        lexical($, $._assignment_fallback_literal_begin),
      _assignment_bracket_fallback: ($) =>
        bracketFallback(
          $,
          $._assignment_fallback_literal,
          alias($._assignment_literal, $.literal),
          $.pattern_bracket_source,
          $._assignment_bracket_fallback_end,
        ),
      _parameter_fallback_literal: ($) =>
        lexical($, $._parameter_fallback_literal_begin),
      _parameter_bracket_fallback: ($) =>
        bracketFallback(
          $,
          $._parameter_fallback_literal,
          alias($._parameter_pattern_literal, $.literal),
          alias(
            $._parameter_pattern_bracket_expression,
            $.pattern_bracket_source,
          ),
          $._parameter_bracket_fallback_end,
        ),

      pattern_star_source: ($) => lexical($, $._pattern_star_begin),
      pattern_question_source: ($) => lexical($, $._pattern_question_begin),
      pattern_bracket_source: ($) =>
        patternBracketExpression(
          $,
          $.pattern_bracket_members_source,
          $._word_pattern_bracket_open,
        ),
      _parameter_pattern_bracket_expression: ($) =>
        patternBracketExpression(
          $,
          alias(
            $._parameter_pattern_bracket_list,
            $.pattern_bracket_members_source,
          ),
          $._parameter_pattern_bracket_open,
        ),
      pattern_bracket_negation_source: ($) =>
        prec(1, lexical($, $._pattern_negation_begin)),
      pattern_bracket_members_source: ($) =>
        patternBracketList(
          $,
          $._pattern_bracket_member,
          alias(
            $._pattern_initial_bracket_range,
            $.pattern_bracket_range_source,
          ),
        ),

      _parameter_pattern_bracket_list: ($) =>
        patternBracketList(
          $,
          $._parameter_pattern_bracket_member,
          alias(
            $._parameter_pattern_initial_bracket_range,
            $.pattern_bracket_range_source,
          ),
        ),

      _pattern_bracket_member: ($) =>
        choice(
          ...wordPatternSpecialSources($),
          $.pattern_bracket_range_source,
          ...patternBracketPlainAtoms($, $.pattern_bracket_character_source),
        ),

      _parameter_pattern_bracket_member: ($) =>
        choice(
          ...parameterPatternSpecialSources($),
          alias(
            $._parameter_pattern_bracket_range,
            $.pattern_bracket_range_source,
          ),
          ...patternBracketPlainAtoms(
            $,
            alias(
              $._parameter_pattern_bracket_character,
              $.pattern_bracket_character_source,
            ),
          ),
        ),

      pattern_bracket_range_source: ($) =>
        patternBracketRange($, $._pattern_bracket_range_endpoint),

      _parameter_pattern_bracket_range: ($) =>
        patternBracketRange($, $._parameter_pattern_bracket_range_endpoint),

      _pattern_initial_bracket_range: ($) =>
        patternInitialBracketRange($, $._pattern_bracket_range_endpoint),

      _parameter_pattern_initial_bracket_range: ($) =>
        patternInitialBracketRange(
          $,
          $._parameter_pattern_bracket_range_endpoint,
        ),

      _pattern_bracket_range_endpoint: ($) =>
        choice(
          ...patternBracketPlainAtoms($, $.pattern_bracket_character_source),
          $.pattern_collating_symbol_source,
        ),

      _parameter_pattern_bracket_range_endpoint: ($) =>
        choice(
          ...patternBracketPlainAtoms(
            $,
            alias(
              $._parameter_pattern_bracket_character,
              $.pattern_bracket_character_source,
            ),
          ),
          parameterPatternCollatingSymbolSource($),
        ),

      pattern_bracket_character_source: ($) =>
        lexical($, $._pattern_bracket_character_begin),
      _parameter_pattern_bracket_character: ($) =>
        lexical($, $._parameter_pattern_bracket_character_begin),
      _pattern_operator_bracket_character: ($) =>
        choice(
          alias($.pattern_star_source, $.pattern_bracket_character_source),
          alias($.pattern_question_source, $.pattern_bracket_character_source),
        ),

      pattern_bracket_range_operator_source: ($) =>
        lexical($, $._pattern_bracket_range_operator_begin),
      pattern_bracket_hyphen_source: ($) =>
        lexical($, $._pattern_bracket_hyphen_begin),
      pattern_character_class_source: ($) =>
        patternCharacterClassSource(
          $,
          $.pattern_character_class_content_source,
        ),

      _parameter_pattern_character_class_source: ($) =>
        patternCharacterClassSource(
          $,
          alias(
            $._parameter_pattern_character_class_content_source,
            $.pattern_character_class_content_source,
          ),
        ),

      pattern_character_class_content_source: ($) =>
        lexical($, $._pattern_class_content_begin),
      _parameter_pattern_character_class_content_source: ($) =>
        lexical($, $._parameter_pattern_class_content_begin),

      pattern_collating_symbol_source: ($) =>
        patternSpecialClassSource(
          $,
          physical($, $._punct_dot, "."),
          $.pattern_collating_symbol_character_source,
        ),

      _parameter_pattern_collating_symbol_source: ($) =>
        patternSpecialClassSource(
          $,
          physical($, $._punct_dot, "."),
          alias(
            $._parameter_pattern_collating_symbol_character_source,
            $.pattern_collating_symbol_character_source,
          ),
        ),

      pattern_collating_symbol_character_source: ($) =>
        lexical($, $._pattern_collating_character_begin),
      _parameter_pattern_collating_symbol_character_source: ($) =>
        lexical($, $._parameter_pattern_collating_character_begin),

      pattern_equivalence_class_source: ($) =>
        patternSpecialClassSource(
          $,
          physical($, $._punct_equals, "="),
          $.pattern_equivalence_class_character_source,
        ),

      _parameter_pattern_equivalence_class_source: ($) =>
        patternSpecialClassSource(
          $,
          physical($, $._punct_equals, "="),
          alias(
            $._parameter_pattern_equivalence_class_character_source,
            $.pattern_equivalence_class_character_source,
          ),
        ),

      pattern_equivalence_class_character_source: ($) =>
        lexical($, $._pattern_equivalence_character_begin),
      _parameter_pattern_equivalence_class_character_source: ($) =>
        lexical($, $._parameter_pattern_equivalence_character_begin),

      escaped_character: ($) => lexical($, $._escaped_character_begin),
      single_quoted: ($) => singleQuoted($, $._sq_open),
      single_quote_content: ($) => lexical($, $._single_quote_content_begin),
      double_quoted: ($) => doubleQuoted($, $._dq_open),
      locale_quoted: ($) =>
        seq(physical($, $._dollar_dq_dollar, "$"), doubleQuoted($, $._dq_open)),
      process_substitution: ($) =>
        processSubstitution($, $._process_in_start, $._process_out_start),
      current_shell_substitution: ($) =>
        braceSubstitution($, $._dollar_expansion_start, $._current_shell_open),
      reply_substitution: ($) =>
        braceSubstitution($, $._dollar_expansion_start, $._reply_open),
      extglob_operator: ($) => lexical($, $._extglob_operator_begin),
      extglob_pattern: ($) => extglobPattern($),
      extglob_group: ($) => seq(...extglobAlternatives($)),
      extglob_alternative: ($) =>
        repeat1(
          choice(
            $.extglob_group,
            $._word_bracket_fallback,
            alias($._extglob_text, $.literal),
            $.pattern_star_source,
            $.pattern_question_source,
            $.pattern_bracket_source,
            $._word_structured_part,
          ),
        ),
      _extglob_text: ($) => lexical($, $._extglob_text_begin),
      array_subscript: ($) => arraySubscript($, $._subscript_open),
      subscript_all_elements_candidate: ($) =>
        lexical($, $._subscript_all_elements_begin),
      subscript_source: ($) =>
        seq(
          choice(
            field("candidate", $.subscript_all_elements_candidate),
            seq(
              $._subscript_expression_start,
              optional($._arithmetic_layout),
              field("candidate", $._arithmetic_candidate_expression),
            ),
            seq(
              $._subscript_source_start,
              choice(
                seq(
                  optional($._arithmetic_layout),
                  field(
                    "candidate",
                    alias(
                      $._arithmetic_candidate_field_source,
                      $.arithmetic_candidate_source_expression,
                    ),
                  ),
                ),
                $._arithmetic_layout,
              ),
            ),
          ),
          arithmeticBoundaryLayout($, $._subscript_closing_boundary),
        ),
      array_reference: ($) =>
        seq(
          field("name", $.variable_name),
          field("subscript", $.array_subscript),
        ),
      brace_expansion: ($) => braceExpansion($, $._brace_open),
      brace_alternative: ($) => $._brace_parts,
      _brace_parts: ($) =>
        repeat1(
          choice(
            $._brace_literal_group,
            $._word_bracket_fallback,
            alias($._brace_text, $.literal),
            $._word_structured_part,
            $.pattern_star_source,
            $.pattern_question_source,
            $.pattern_bracket_source,
          ),
        ),
      _brace_text: ($) => lexical($, $._brace_text_begin),
      _brace_literal_group: ($) =>
        seq(
          alias($._brace_literal_open_physical, $.literal),
          optional($._brace_parts),
          alias($._brace_close_physical, $.literal),
        ),
      brace_sequence: ($) =>
        seq(
          $._brace_sequence_start,
          field("start", $.brace_endpoint),
          alias($._brace_separator, $.brace_sequence_separator),
          field("end", $.brace_endpoint),
          optional(
            seq(
              alias($._brace_separator, $.brace_sequence_separator),
              field("increment", $.brace_increment),
            ),
          ),
        ),
      brace_endpoint: ($) => lexical($, $._brace_endpoint_begin),
      brace_increment: ($) => lexical($, $._brace_increment_begin),
      _brace_separator: ($) => lexical($, $._brace_separator_begin),

      double_quote_text: ($) => lexical($, $._double_quote_text_begin),

      double_quote_escape: ($) => lexical($, $._double_quote_escape_begin),
      dollar_single_quoted: ($) => dollarSingleQuoted($, $._dollar_sq_dollar),
      dollar_single_quote_text: ($) =>
        lexical($, $._dollar_single_quote_text_begin),
      dollar_single_quote_escape: ($) =>
        lexical($, $._dollar_single_quote_escape_begin),

      _braced_parameter_start: ($) =>
        dollarExpansionStart($, $._parameter_open, "{"),
      _braced_parameter_header: ($) =>
        seq(
          $._braced_parameter_start,
          choice(
            bracedParameterSource($, $._braced_parameter),
            seq(
              field("operator", $.parameter_indirection_operator),
              bracedParameterSource($, $._braced_parameter),
            ),
            field("parameter", $._special_parameter_hash),
          ),
        ),
      _braced_parameter_value_header: ($) =>
        seq(
          $._braced_parameter_header,
          field("operator", $._parameter_value_operator),
        ),
      _braced_parameter_pattern_header: ($) =>
        seq(
          $._braced_parameter_header,
          field("operator", $._parameter_pattern_operator),
        ),
      _braced_parameter_length_header: ($) =>
        seq(
          $._braced_parameter_start,
          field("operator", $.parameter_length_operator),
          bracedParameterSource($, $._length_parameter),
        ),
      parameter_expansion: ($) => parameterExpansion($, $.parameter_word),

      _double_quoted_parameter_expansion: ($) =>
        parameterExpansion(
          $,
          alias($._double_quoted_parameter_word, $.parameter_word),
        ),

      _unbraced_parameter: ($) =>
        choice(
          $.variable_name,
          alias($._unbraced_positional_parameter, $.positional_parameter),
          $._special_parameter_except_hash,
          $._special_parameter_hash,
        ),

      _braced_parameter: ($) =>
        choice(
          $.array_reference,
          $.variable_name,
          $.positional_parameter,
          $._special_parameter_except_hash,
        ),

      _length_parameter: ($) =>
        choice($._braced_parameter, $._special_parameter_hash),

      _special_parameter_hash: ($) =>
        alias($._special_parameter_hash_lexeme, $.special_parameter),
      _special_parameter_except_hash: ($) =>
        choice(
          alias($._special_parameter_lexeme, $.special_parameter),
          alias($._parameter_hyphen_lexeme, $.special_parameter),
          alias($._parameter_question_lexeme, $.special_parameter),
        ),
      _unbraced_positional_parameter: ($) =>
        lexical($, $._unbraced_positional_parameter_begin),
      positional_parameter: ($) =>
        lexical($, $._braced_positional_parameter_begin),
      _unclassified_numeric_parameter_source: ($) =>
        seq(
          $._braced_parameter_number_start,
          repeat1(
            physical($, $._numeric_parameter_digit, "numeric_parameter_source"),
          ),
        ),

      parameter_substring_operator: ($) =>
        lexical($, $._parameter_substring_begin),
      parameter_replacement_operator: ($) =>
        lexical($, $._parameter_replace_begin),
      parameter_case_operator: ($) => lexical($, $._parameter_case_begin),
      _arithmetic_comma_operator_lexeme: ($) =>
        lexical($, $._arithmetic_comma_operator_begin),
      _arithmetic_update_operator_lexeme: ($) =>
        lexical($, $._arithmetic_update_operator_begin),
      _parameter_transform_lexeme: ($) =>
        lexical($, $._parameter_transform_begin),
      _substring_separator_lexeme: ($) =>
        lexical($, $._substring_separator_begin),
      _replacement_separator_lexeme: ($) =>
        lexical($, $._replacement_separator_begin),
      parameter_indirection_operator: ($) =>
        lexical($, $._parameter_indirection_begin),
      parameter_names_operator: ($) => lexical($, $._parameter_names_begin),
      _parameter_names_indirection_operator: ($) =>
        lexical($, $._parameter_names_indirection_begin),
      parameter_name_prefix: ($) =>
        repeat1(
          choice(
            alias($._parameter_names_text, $.literal),
            $.escaped_character,
            ...quotedLiterals($),
            ...quotedExpansionParts($),
          ),
        ),
      _parameter_names_text: ($) => lexical($, $._parameter_names_text_begin),
      parameter_substring: ($) =>
        seq(
          field("operator", $.parameter_substring_operator),
          optional(field("offset", $.substring_source)),
          optional(
            seq(
              alias(
                $._substring_separator_lexeme,
                $.parameter_substring_separator,
              ),
              optional(field("length", $.substring_source)),
            ),
          ),
        ),
      substring_source: ($) => arithmeticField($),
      _bracket_arithmetic_field: ($) =>
        arithmeticField($, (expression) => field("expression", expression)),
      parameter_replacement: ($) =>
        seq(
          field("operator", $.parameter_replacement_operator),
          optional(field("pattern", $.parameter_pattern)),
          optional(
            seq(
              alias(
                $._replacement_separator_lexeme,
                $.parameter_replacement_separator,
              ),
              optional(field("replacement", $.parameter_word)),
            ),
          ),
        ),
      parameter_case_conversion: ($) =>
        seq(
          field("operator", $.parameter_case_operator),
          optional(field("pattern", $.parameter_pattern)),
        ),
      parameter_transformation: ($) =>
        seq(
          field(
            "operator",
            alias(
              $._parameter_transform_lexeme,
              $.parameter_transformation_operator,
            ),
          ),
          field("transformation", $.parameter_transformation_code),
        ),
      parameter_transformation_code: ($) =>
        lexical($, $._parameter_transform_code_begin),
      parameter_length_operator: ($) =>
        lexical($, $._parameter_length_operator_begin),
      _parameter_value_operator: ($) =>
        wholeSource(
          $,
          $._parameter_value_operator_begin,
          $._parameter_value_operator_lexeme,
          $.parameter_value_operator,
        ),
      _parameter_pattern_operator: ($) =>
        wholeSource(
          $,
          $._parameter_pattern_operator_begin,
          $._parameter_pattern_operator_lexeme,
          $.parameter_pattern_operator,
        ),
      parameter_word: ($) => parameterPatternSource($),

      _double_quoted_parameter_word: ($) =>
        repeat1($._double_quoted_parameter_word_part),

      _double_quoted_parameter_word_part: ($) =>
        choice(
          alias($._double_quoted_parameter_text, $.double_quote_text),
          alias($._double_quoted_parameter_escape, $.double_quote_escape),
          ...quotedLiterals($),
          ...quotedExpansionParts($),
        ),
      parameter_pattern: ($) => prec.right(1, parameterPatternSource($)),

      _parameter_tilde_source: ($) =>
        alias($._parameter_tilde_expansion, $.tilde_expansion),
      _parameter_pattern_part: ($) =>
        choice(
          $._parameter_bracket_fallback,
          alias(
            $._parameter_pattern_bracket_expression,
            $.pattern_bracket_source,
          ),
          alias($._parameter_pattern_literal, $.literal),
          $.pattern_star_source,
          $.pattern_question_source,
          $._word_structured_part,
        ),
      _parameter_pattern_literal: ($) => prec.right(parameterPlainChunk($)),

      _double_quoted_parameter_text: ($) =>
        lexical($, $._double_quoted_parameter_text_begin),

      _double_quoted_parameter_escape: ($) =>
        lexical($, $._double_quoted_parameter_escape_begin),
      _command_substitution_prefix: ($) =>
        seq($._command_substitution_start, $._command_substitution_body_begin),
      command_substitution: ($) =>
        commandSubstitution($, $._command_substitution_prefix),

      _command_substitution_start: ($) =>
        dollarExpansionStart($, $._command_open, "("),
      _arithmetic_dollar_start: ($) =>
        dollarExpansionStart($, $._arithmetic_expansion_open, "("),
      command_substitution_body: ($) =>
        prec.left(substitutionCommandsBody($, $._closing_layout)),

      backquote_substitution: ($) =>
        backquoteSubstitution($, $._backquote_start),
      _double_quoted_backquote_substitution: ($) =>
        backquoteSubstitution($, $._double_quoted_backquote_start),
      backquote_substitution_body: ($) => $._substitution_body,

      _substitution_body: ($) =>
        prec.left(substitutionCommandsBody($, $._horizontal_layout)),

      _arithmetic_expansion_start: ($) =>
        arithmeticExpansionStart($, $._arithmetic_left_parenthesis),

      _arithmetic_source_expansion_start: ($) =>
        arithmeticExpansionStart($, $._arithmetic_source_left_parenthesis),

      conditional_command: ($) =>
        seq(
          alias($._conditional_open, $.conditional_open),
          optional($._linebreak_layout),
          conditionalOperand($, "condition"),
          alias($._conditional_close, $.conditional_close),
        ),
      _conditional_open: ($) => lexical($, $._conditional_open_begin),
      _conditional_close: ($) => lexical($, $._conditional_close_begin),
      _conditional_word: ($) =>
        seq($._conditional_word_start, $._case_word, $._conditional_word_end),
      _conditional_bare_expression: ($) =>
        choice(
          alias($._conditional_word, $.word),
          alias($._conditional_bare_negation, $.conditional_negation),
          alias(
            $._conditional_bare_and_expression,
            $.conditional_and_expression,
          ),
          alias($._conditional_bare_or_expression, $.conditional_or_expression),
        ),
      _conditional_complete_expression: ($) =>
        choice(
          $.conditional_unary_expression,
          $.conditional_binary_expression,
          $.conditional_negation,
          $.conditional_group,
          $.conditional_and_expression,
          $.conditional_or_expression,
        ),
      conditional_unary_expression: ($) =>
        seq(
          field("operator", $.conditional_unary_operator),
          $._horizontal_layout,
          field("operand", alias($._conditional_word, $.word)),
        ),
      conditional_unary_operator: ($) => lexical($, $._conditional_unary_begin),
      conditional_binary_expression: ($) =>
        seq(
          field("left", alias($._conditional_word, $.word)),
          optional($._horizontal_layout),
          choice(
            seq(
              field("operator", $.conditional_binary_operator),
              optional($._horizontal_layout),
              field("right", alias($._conditional_word, $.word)),
            ),
            seq(
              field("operator", $.conditional_match_operator),
              optional($._horizontal_layout),
              field("right", $.conditional_pattern),
            ),
            seq(
              field("operator", $.conditional_regex_operator),
              optional($._horizontal_layout),
              field("right", $.regex_operand),
            ),
          ),
        ),
      conditional_binary_operator: ($) =>
        lexical($, $._conditional_binary_begin),
      conditional_match_operator: ($) => lexical($, $._conditional_match_begin),
      conditional_regex_operator: ($) => lexical($, $._conditional_regex_begin),
      conditional_pattern: ($) =>
        seq(
          $._conditional_pattern_start,
          $._case_word,
          $._conditional_word_end,
        ),
      conditional_negation: ($) =>
        conditionalNegation($, $._conditional_complete_expression),
      _conditional_bare_negation: ($) =>
        conditionalNegation($, $._conditional_bare_expression),
      conditional_not: ($) => lexical($, $._conditional_not_begin),
      conditional_group: ($) =>
        seq(
          physical($, $._punct_left_parenthesis, "("),
          optional($._linebreak_layout),
          conditionalOperand($, "expression"),
          physical($, $._punct_right_parenthesis, ")"),
        ),
      conditional_and_expression: ($) =>
        conditionalJunction(
          $,
          2,
          $._conditional_and_boundary,
          $._and_if,
          $._conditional_complete_expression,
        ),
      _conditional_bare_and_expression: ($) =>
        conditionalJunction(
          $,
          2,
          $._conditional_and_boundary,
          $._and_if,
          $._conditional_bare_expression,
        ),
      conditional_or_expression: ($) =>
        conditionalJunction(
          $,
          1,
          $._conditional_or_boundary,
          $._or_if,
          $._conditional_complete_expression,
        ),
      _conditional_bare_or_expression: ($) =>
        conditionalJunction(
          $,
          1,
          $._conditional_or_boundary,
          $._or_if,
          $._conditional_bare_expression,
        ),
      regex_operand: ($) =>
        seq(
          $._regex_start,
          field("expression", $._regex_expression),
          $._regex_end,
        ),
      _regex_expression: ($) =>
        choice($.extended_reg_exp, $.regex_source_expression),
      extended_reg_exp: ($) =>
        choice(
          $.ere_branch,
          prec.left(
            1,
            seq(
              choice($.ere_branch, $.regex_source_expression),
              repeat1(
                seq(
                  physical($, $._ere_bar, "|"),
                  choice($.ere_branch, $.regex_source_expression),
                ),
              ),
            ),
          ),
        ),
      ere_branch: ($) =>
        prec.left(
          2,
          seq(
            optional($.regex_source_expression),
            $.ere_expression,
            repeat(
              choice(
                $.ere_expression,
                alias(
                  $._regex_following_source_expression,
                  $.regex_source_expression,
                ),
              ),
            ),
          ),
        ),
      ere_expression: ($) =>
        prec.right(
          4,
          seq(
            choice(
              $.one_char_or_coll_elem_ere,
              physical($, $._ere_left_anchor_begin, "^"),
              physical($, $._ere_right_anchor_begin, "$"),
              prec(3, $._ere_group),
            ),
            repeat($.ere_dupl_symbol),
          ),
        ),
      _ere_group: ($) =>
        seq(
          physical($, $._regex_open, "(", "opening"),
          optional(field("expression", $._regex_expression)),
          physical($, $._regex_close, ")", "closing"),
        ),
      _ere_source_group_expression: ($) =>
        prec.right(seq($._ere_group, repeat($.ere_dupl_symbol))),
      one_char_or_coll_elem_ere: ($) =>
        choice(
          $.ordinary_character,
          physical($, $._ere_wildcard_begin, "."),
          $.bracket_expression,
        ),
      ordinary_character: ($) =>
        choice(
          lexical($, $._ere_character_begin),
          lexical($, $._ere_ordinary_close),
          lexical($, $._ere_ordinary_brace),
        ),
      ere_dupl_symbol: ($) =>
        prec.right(
          5,
          seq(
            choice(
              physical($, $._ere_star, "*"),
              physical($, $._ere_plus, "+"),
              physical($, $._ere_question, "?"),
              seq(
                physical($, $._ere_interval_open, "{"),
                field("minimum", ereCount($)),
                optional(
                  seq(
                    physical($, $._ere_comma, ","),
                    optional(field("maximum", ereCount($))),
                  ),
                ),
                physical($, $._ere_interval_close, "}"),
              ),
            ),
            optional(field("modifier", $.repetition_modifier)),
          ),
        ),
      repetition_modifier: ($) => lexical($, $._ere_modifier_begin),
      duplication_count: ($) => lexical($, $._ere_count_begin),
      _ere_count_source: ($) =>
        prec.right(
          1,
          seq(
            optional($.duplication_count),
            choice($._regex_bash_part, $.regex_source_fragment),
            repeat(
              choice(
                $.duplication_count,
                $._regex_bash_part,
                $.regex_source_fragment,
              ),
            ),
          ),
        ),
      _regex_source_group: ($) =>
        seq(
          physical($, $._regex_open, "(", "opening"),
          optional(field("expression", $._regex_expression)),
          $._regex_source_group_end,
        ),
      regex_source_expression: ($) =>
        prec.right(
          -1,
          repeat1(choice(...regexSourceParts($), $.ere_dupl_symbol)),
        ),
      _regex_following_source_expression: ($) =>
        prec.right(
          -1,
          seq(
            choice(...regexSourceParts($)),
            repeat(choice(...regexSourceParts($), $.ere_dupl_symbol)),
          ),
        ),
      regex_source_fragment: ($) => lexical($, $._ere_fragment_begin),
      bracket_expression: ($) =>
        seq(
          physical($, $._ere_bracket_open, "["),
          choice($.matching_list, $.nonmatching_list),
          physical($, $._ere_bracket_close, "]"),
        ),
      matching_list: ($) => $.bracket_list,
      nonmatching_list: ($) =>
        seq(physical($, $._ere_negation, "^"), $.bracket_list),
      bracket_list: ($) =>
        seq(
          choice(
            $.follow_list,
            alias($._ere_initial_follow_list, $.follow_list),
          ),
          optional(physical($, $._ere_literal_hyphen, "-")),
        ),
      _ere_initial_follow_list: ($) =>
        seq(
          alias($._ere_initial_term, $.expression_term),
          repeat($.expression_term),
        ),
      _ere_initial_term: ($) =>
        choice(
          alias($._ere_initial_single, $.single_expression),
          alias($._ere_initial_range, $.range_expression),
        ),
      _ere_initial_single: ($) => alias($._ere_initial_end, $.end_range),
      _ere_initial_range: ($) =>
        seq(
          alias($._ere_initial_start, $.start_range),
          choice($.end_range, physical($, $._ere_range_end_hyphen, "-")),
        ),
      _ere_initial_start: ($) =>
        seq(
          alias($._ere_initial_end, $.end_range),
          physical($, $._ere_hyphen, "-"),
        ),
      _ere_initial_end: ($) =>
        alias($._ere_initial_character, $.collating_element_single),
      _ere_initial_character: ($) =>
        choice(
          lexical($, $._ere_initial_close_begin),
          lexical($, $._ere_initial_hyphen),
        ),
      follow_list: ($) => repeat1($.expression_term),
      expression_term: ($) =>
        choice(
          $.single_expression,
          $.range_expression,
          alias($._ere_member_source, $.regex_source_expression),
        ),
      single_expression: ($) =>
        choice($.end_range, $.character_class, $.equivalence_class),
      range_expression: ($) =>
        seq(
          $.start_range,
          choice($.end_range, physical($, $._ere_range_end_hyphen, "-")),
        ),
      start_range: ($) => seq($.end_range, physical($, $._ere_hyphen, "-")),
      end_range: ($) => choice($.collating_element_single, $.collating_symbol),
      collating_element_single: ($) =>
        choice(
          lexical($, $._ere_collating_character_begin),
          lexical($, $._ere_member_open_begin),
          lexical($, $._ere_member_close_begin),
        ),
      _ere_member_source: ($) =>
        prec.right(
          1,
          repeat1(choice($._regex_bash_part, $.regex_source_fragment)),
        ),
      character_class: ($) =>
        seq(
          physical($, $._ere_class_open, "["),
          physical($, $._ere_colon, ":"),
          field(
            "name",
            choice(
              $.class_name,
              alias($._ere_class_source, $.regex_source_expression),
            ),
          ),
          physical($, $._ere_colon, ":"),
          physical($, $._ere_compound_close, "]"),
        ),
      class_name: ($) => lexical($, $._ere_class_name_begin),
      _ere_class_source: ($) =>
        prec.right(
          1,
          seq(
            optional($.class_name),
            choice($._regex_bash_part, $.regex_source_fragment),
            repeat(
              choice($.class_name, $._regex_bash_part, $.regex_source_fragment),
            ),
          ),
        ),
      collating_symbol: ($) =>
        seq(
          physical($, $._ere_collating_open, "["),
          physical($, $._ere_dot, "."),
          field(
            "element",
            choice(
              $._ere_compound_element,
              $.meta_character,
              alias($._ere_compound_source, $.regex_source_expression),
            ),
          ),
          physical($, $._ere_dot, "."),
          physical($, $._ere_compound_close, "]"),
        ),
      equivalence_class: ($) =>
        seq(
          physical($, $._ere_equivalence_open, "["),
          physical($, $._ere_equal, "="),
          field(
            "element",
            choice(
              $._ere_equivalence_element,
              alias($._ere_equivalence_source, $.regex_source_expression),
            ),
          ),
          physical($, $._ere_equal, "="),
          physical($, $._ere_compound_close, "]"),
        ),
      ...ereCompoundRules("compound"),
      ...ereCompoundRules("equivalence"),
      meta_character: ($) => lexical($, $._ere_meta_character_begin),
      _regex_bash_part: ($) =>
        choice(
          ...quotedLiterals($),
          $.escaped_character,
          $.tilde_expansion,
          $.process_substitution,
          ...quotedExpansionParts($),
        ),

      arithmetic_command: ($) =>
        arithmeticExpansion(
          $,
          arithmeticExpansionStart(
            $,
            $._arithmetic_left_parenthesis,
            physical($, $._arithmetic_command_open, "("),
          ),
          arithmeticExpansionStart(
            $,
            $._arithmetic_source_left_parenthesis,
            physical($, $._arithmetic_command_open, "("),
          ),
        ),
      arithmetic_for_clause: ($) =>
        seq(
          $._for_keyword_source,
          optional($._horizontal_layout),
          alias($._for_arithmetic_open_lexeme, $.arithmetic_for_open),
          field("initializer", $._for_expression),
          physical($, $._for_semicolon, ";"),
          field("condition", $._for_expression),
          physical($, $._for_semicolon, ";"),
          field("update", $._for_expression),
          physical($, $._punct_right_parenthesis, ")"),
          physical($, $._punct_right_parenthesis, ")"),
          $._arithmetic_expansion_end,
          optional($._horizontal_layout),
          optional(
            choice(
              seq(physical($, $._punct_semicolon, ";"), optional($._linebreak)),
              $._linebreak,
            ),
          ),
          optional($._horizontal_layout),
          field("body", choice($.do_group, $.brace_group)),
        ),
      _for_arithmetic_open_lexeme: ($) => lexical($, $._for_arithmetic_open),
      _for_expression: ($) =>
        seq(
          choice(
            seq(
              $._for_expression_start,
              optional($._arithmetic_layout),
              $._arithmetic_expression,
            ),
            seq(
              $._for_source_start,
              optional($._arithmetic_layout),
              optional(
                alias(
                  $._arithmetic_field_source,
                  $.arithmetic_source_expression,
                ),
              ),
            ),
          ),
          $._for_closing_boundary,
          optional($._arithmetic_layout),
        ),

      _arithmetic_source_open: ($) =>
        physicalSource($, $._punct_left_parenthesis),
      _arithmetic_source_close: ($) =>
        physicalSource($, $._punct_right_parenthesis),

      arithmetic_expansion: ($) =>
        choice(
          arithmeticExpansion(
            $,
            $._arithmetic_expansion_start,
            $._arithmetic_source_expansion_start,
          ),
          seq(
            dollarExpansionStart($, $._bracket_arithmetic_open, "["),
            optional($._bracket_arithmetic_field),
            physical($, $._bracket_arithmetic_close, "]"),
          ),
        ),
      _arithmetic_subscript: ($) =>
        arraySubscript($, $._arithmetic_subscript_open),
      _arithmetic_source_operator_lexeme: ($) =>
        lexical($, $._arithmetic_source_operator_begin),
      ...Object.fromEntries(
        ARITHMETIC_BINARY_LEVELS.map((level) => [
          `_arithmetic_${level}_operator_lexeme`,
          ($) => lexical($, $[`_arithmetic_${level}_operator_begin`]),
        ]),
      ),
      ...arithmeticRules(),
      ...arithmeticRules("arithmetic_candidate"),

      _arithmetic_layout: ($) =>
        repeat1(
          choice(
            lexical($, $._arithmetic_blank_begin, $._fragmented_layout),
            $._newline,
            inheritedDocument($),
          ),
        ),

      _pattern_initial_right_bracket: ($) =>
        lexical($, $._pattern_initial_right_bracket_begin),

      _newline_list: ($) =>
        prec.right(repeat1(choice(...newlineListElements($)))),

      _separator_led_newline_list: ($) =>
        ledNewlineList($, seq($._separator_newline, $._layout_newline)),

      _here_document_led_newline_list: ($) =>
        ledNewlineList($, $.here_document_sequence),

      _linebreak: ($) => $._newline_list,

      _linebreak_layout: ($) =>
        choice(
          seq($._linebreak, optional($._horizontal_layout)),
          $._horizontal_layout,
        ),

      _horizontal_layout: ($) => $._blank,
      _closing_layout: ($) => $._blank,
      _word_separator: ($) => wordSeparator($, $._word_separator_begin),

      _assignment_separator: ($) =>
        wordSeparator($, $._assignment_separator_begin),

      _redirect_separator: ($) => wordSeparator($, $._redirect_separator_begin),

      _free_trailing_layout: ($) =>
        prec.right(
          1,
          choice(
            seq($._closing_layout, optional(inheritedDocument($))),
            trailingComment($),
          ),
        ),

      comment: ($) => $.comment_text,
      comment_text: ($) => lexical($, $._comment_text_begin),

      _comment_line_end: ($) => physical($, $._comment_line_end_begin, "\n"),

      _pre_newline_blank: ($) =>
        lexical($, $._pre_newline_blank_begin, $._fragmented_layout),

      here_document_line_end: ($) =>
        lexical($, $._here_document_line_end_begin),

      _comment_line: ($) =>
        seq(boundaryLineComment($, $.comment), $._comment_line_end),

      _blank_line: ($) => seq($._pre_newline_blank, $._layout_newline),

      _layout_newline: ($) => physical($, $._logical_newline_begin, "\n"),

      _newline: ($) => lexical($, $._newline_begin, $._fragmented_layout),

      _blank: ($) => lexical($, $._logical_blank_begin, $._fragmented_layout),
    },
  });
}
