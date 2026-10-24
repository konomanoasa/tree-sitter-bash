#ifndef TREE_SITTER_BASH_SCANNER_H
#define TREE_SITTER_BASH_SCANNER_H

#if !defined(BASH_EXTGLOB)
#error "Bash scanner requires fixed parsing conditions"
#endif

#include "arithmetic.h"
#include "input.h"
#include "lexical-tokens.h"
#include "tree_sitter/alloc.h"
#include "tree_sitter/parser.h"

#include <limits.h>
#include <stdbool.h>
#include <stdint.h>
#include <string.h>

#ifndef TREE_SITTER_SERIALIZATION_BUFFER_SIZE
#define TREE_SITTER_SERIALIZATION_BUFFER_SIZE 1024
#endif

#define SCANNER_SERIALIZATION_VERSION 43
#define SCANNER_STATE_CAPACITY (TREE_SITTER_SERIALIZATION_BUFFER_SIZE - 1)
#define ARRAY_COUNT(array) (sizeof(array) / sizeof((array)[0]))
#define RESERVED_WORD_LENGTH 8

enum TokenType {
  LEFT_BRACE,
  RIGHT_BRACE,
  FILE_DESCRIPTOR,
  PIPELINE_NEGATION,
  IF_KEYWORD,
  THEN_KEYWORD,
  ELIF_KEYWORD,
  ELSE_KEYWORD,
  FI_KEYWORD,
  FOR_KEYWORD,
  IN_KEYWORD,
  DO_KEYWORD,
  DONE_KEYWORD,
  CASE_KEYWORD,
  ESAC_KEYWORD,
  WHILE_KEYWORD,
  UNTIL_KEYWORD,
  HERE_END_BEGIN,
  HERE_END_STRIP_BEGIN,
  HERE_END_COMMIT,
  HERE_DOCUMENT_LINE_END,
  HERE_DOCUMENT_BODY_START,
  QUOTED_HERE_DOCUMENT_BODY_START,
  QUOTED_HERE_DOCUMENT_END_BEGIN,
  QUOTED_HERE_DOCUMENT_END_TEXT,
  QUOTED_HERE_DOCUMENT_TEXT,
  HERE_DOCUMENT_END_BEGIN,
  HERE_DOCUMENT_END_COMMIT,
  HERE_DOCUMENT_SEQUENCE_END,
  HERE_DOCUMENT_CONTENT_LINE_START,
  NEWLINE,
  ARITHMETIC_ASSIGNMENT_OPERATOR_BOUNDARY,
  ARITHMETIC_QUESTION_OPERATOR_BOUNDARY,
  ARITHMETIC_COLON_OPERATOR_BOUNDARY,
  ARITHMETIC_LOGICAL_OR_OPERATOR_BOUNDARY,
  ARITHMETIC_LOGICAL_AND_OPERATOR_BOUNDARY,
  ARITHMETIC_BITWISE_OR_OPERATOR_BOUNDARY,
  ARITHMETIC_BITWISE_XOR_OPERATOR_BOUNDARY,
  ARITHMETIC_BITWISE_AND_OPERATOR_BOUNDARY,
  ARITHMETIC_EQUALITY_OPERATOR_BOUNDARY,
  ARITHMETIC_RELATIONAL_OPERATOR_BOUNDARY,
  ARITHMETIC_SHIFT_OPERATOR_BOUNDARY,
  ARITHMETIC_ADDITIVE_OPERATOR_BOUNDARY,
  ARITHMETIC_MULTIPLICATIVE_OPERATOR_BOUNDARY,
  ARITHMETIC_CLOSING_BOUNDARY,
  ARITHMETIC_LEFT_PARENTHESIS,
  ARITHMETIC_SOURCE_LEFT_PARENTHESIS,
  PATTERN_SPECIAL_LEFT_BRACKET,
  COMMENT_BOUNDARY,
  TRAILING_COMMENT_BOUNDARY,
  COMMENT_START,
  COMMENT_LINE_END,
  DOLLAR_EXPANSION_START,
  BRACED_PARAMETER_NUMBER_START,
  BRACED_POSITIONAL_PARAMETER_START,
  BACKQUOTE_START,
  BACKQUOTE_END,
  PATTERN_CONTINUATION,
  PATTERN_END,
  PIPE_CONTINUATION,
  REDIRECT_LIST_BEGIN,
  CASE_ITEM_END,
  FUNCTION_BODY_CONTINUATION_BOUNDARY,
  COMMAND_SUBSTITUTION_BODY_BEGIN,
  PATTERN_BRACKET_CHARACTER,
  PARAMETER_PATTERN_BRACKET_CHARACTER,
  ASSIGNMENT_PATTERN_BRACKET_CHARACTER,
  PATTERN_BRACKET_HYPHEN,
  PATTERN_BRACKET_RANGE_OPERATOR,
  WORD_TILDE_END,
  ASSIGNMENT_TILDE_END,
  ASSIGNMENT_NAME_TOKEN,
  FNAME_TOKEN,
  AND_OR_CONTINUATION,
  WORD_SEPARATOR_BEGIN,
  TERM_CONTINUATION,
  ASSIGNMENT_SEPARATOR_BEGIN,
  SCALAR_ASSIGNMENT_SEPARATOR_BEGIN,
  REDIRECT_SEPARATOR_BEGIN,
  PRE_NEWLINE_BLANK,
  COMMAND_SUBSTITUTION_END,
  SEPARATOR_NEWLINE,
  TERM_BOUNDARY,
  WORD_PATTERN_BRACKET_OPEN,
  PARAMETER_PATTERN_BRACKET_OPEN,
  DOUBLE_QUOTED_BACKQUOTE_START,
  DOLLAR_SINGLE_QUOTE_ESCAPE,
  PATTERN_CHARACTER_CLASS_END_COLON,
  LINE_CONTINUATION,
  REMOVED_NEWLINE,
  PLAIN_WORD_BEGIN,
  LITERAL_BEGIN,
  ASSIGNMENT_LITERAL_BEGIN,
  PARAMETER_LITERAL_BEGIN,
  NAME_BEGIN,
  VARIABLE_NAME_BEGIN,
  ESCAPED_CHARACTER_BEGIN,
  SINGLE_QUOTE_CONTENT_BEGIN,
  DOUBLE_QUOTE_TEXT_BEGIN,
  DOUBLE_QUOTE_ESCAPE_BEGIN,
  DOLLAR_SINGLE_QUOTE_TEXT_BEGIN,
  DOUBLE_QUOTED_PARAMETER_TEXT_BEGIN,
  DOUBLE_QUOTED_PARAMETER_ESCAPE_BEGIN,
  HERE_DOCUMENT_TEXT_BEGIN,
  HERE_DOCUMENT_ESCAPE_BEGIN,
  HERE_DOCUMENT_END_TEXT_BEGIN,
  UNBRACED_POSITIONAL_PARAMETER_BEGIN,
  SPECIAL_PARAMETER_BEGIN,
  SPECIAL_PARAMETER_HASH_BEGIN,
  PARAMETER_VALUE_OPERATOR_BEGIN,
  PARAMETER_PATTERN_OPERATOR_BEGIN,
  ARITHMETIC_NUMBER_BEGIN,
  ARITHMETIC_VARIABLE_BEGIN,
  ARITHMETIC_UNARY_OPERATOR_BEGIN,
  ARITHMETIC_ASSIGNMENT_OPERATOR_BEGIN,
  ARITHMETIC_QUESTION_OPERATOR_BEGIN,
  ARITHMETIC_COLON_OPERATOR_BEGIN,
  ARITHMETIC_LOGICAL_OR_OPERATOR_BEGIN,
  ARITHMETIC_LOGICAL_AND_OPERATOR_BEGIN,
  ARITHMETIC_BITWISE_OR_OPERATOR_BEGIN,
  ARITHMETIC_BITWISE_XOR_OPERATOR_BEGIN,
  ARITHMETIC_BITWISE_AND_OPERATOR_BEGIN,
  ARITHMETIC_EQUALITY_OPERATOR_BEGIN,
  ARITHMETIC_RELATIONAL_OPERATOR_BEGIN,
  ARITHMETIC_SHIFT_OPERATOR_BEGIN,
  ARITHMETIC_ADDITIVE_OPERATOR_BEGIN,
  ARITHMETIC_MULTIPLICATIVE_OPERATOR_BEGIN,
  AND_IF_BEGIN,
  OR_IF_BEGIN,
  DSEMI_BEGIN,
  SEMI_AND_BEGIN,
  LESSAND_BEGIN,
  GREATAND_BEGIN,
  DGREAT_BEGIN,
  LESSGREAT_BEGIN,
  CLOBBER_BEGIN,
  DLESS_OPERATOR_BEGIN,
  DLESSDASH_OPERATOR_BEGIN,
  PATTERN_STAR_BEGIN,
  PATTERN_QUESTION_BEGIN,
  PATTERN_NEGATION_BEGIN,
  PATTERN_CLASS_CONTENT_BEGIN,
  PARAMETER_PATTERN_CLASS_CONTENT_BEGIN,
  PATTERN_COLLATING_CHARACTER_BEGIN,
  PARAMETER_PATTERN_COLLATING_CHARACTER_BEGIN,
  PATTERN_EQUIVALENCE_CHARACTER_BEGIN,
  PARAMETER_PATTERN_EQUIVALENCE_CHARACTER_BEGIN,
  PUNCT_LEFT_PARENTHESIS,
  PUNCT_RIGHT_PARENTHESIS,
  PUNCT_SEMICOLON,
  PUNCT_AMPERSAND,
  PUNCT_PIPE,
  PUNCT_LESS,
  PUNCT_GREATER,
  PUNCT_EQUALS,
  PUNCT_RIGHT_BRACKET,
  PUNCT_COLON,
  PUNCT_DOT,
  SQ_OPEN,
  SQ_CLOSE,
  DQ_OPEN,
  DQ_CLOSE,
  DOLLAR_SQ_DOLLAR,
  DOLLAR_SQ_OPEN,
  DOLLAR_SQ_CLOSE,
  PARAMETER_OPEN,
  PARAMETER_CLOSE,
  COMMAND_OPEN,
  COMMAND_CLOSE,
  ARITHMETIC_EXPANSION_OPEN,
  BRACKET_ARITHMETIC_OPEN,
  BRACKET_ARITHMETIC_CLOSE,
  NUMERIC_PARAMETER_DIGIT,
  WORD_TILDE_START,
  ASSIGNMENT_TILDE_START,
  PARAMETER_TILDE_START,
  LOGICAL_NEWLINE_BEGIN,
  LOGICAL_BLANK_BEGIN,
  CLOSING_BLANK_BEGIN,
  ARITHMETIC_EXPANSION_END,
  PATTERN_INITIAL_RIGHT_BRACKET_BEGIN,
  SOURCE_BEGIN,
  REMOVED_SOURCE,
  HERE_DOCUMENT_END_LINE_END,
  WORD_FALLBACK_LITERAL_BEGIN,
  ASSIGNMENT_FALLBACK_LITERAL_BEGIN,
  PARAMETER_FALLBACK_LITERAL_BEGIN,
  WORD_BRACKET_FALLBACK_END,
  ASSIGNMENT_BRACKET_FALLBACK_END,
  PARAMETER_BRACKET_FALLBACK_END,
  HERE_DOCUMENT_SEQUENCE_BEGIN,
  PARAMETER_HYPHEN_BEGIN,
  PARAMETER_QUESTION_BEGIN,
  ARITHMETIC_BLANK_BEGIN,
  PARAMETER_LENGTH_OPERATOR_BEGIN,
  ARITHMETIC_SOURCE_FRAGMENT_BEGIN,
  ARITHMETIC_SOURCE_OPERATOR_BEGIN,
  WORD_START,
  DOLLAR_DQ_DOLLAR,
  PROCESS_IN_START,
  PROCESS_OUT_START,
  EXTGLOB_OPEN,
  EXTGLOB_CLOSE,
  EXTGLOB_BAR,
  CURRENT_SHELL_OPEN,
  REPLY_OPEN,
  SUBSTITUTION_BRACE_CLOSE,
  SUBSCRIPT_OPEN,
  ARITHMETIC_SUBSCRIPT_OPEN,
  SUBSCRIPT_CLOSE,
  SUBSCRIPT_ALL_ELEMENTS_BEGIN,
  SUBSCRIPT_EXPRESSION_START,
  SUBSCRIPT_SOURCE_START,
  SUBSCRIPT_CLOSING_BOUNDARY,
  BRACE_OPEN,
  BRACE_CLOSE,
  BRACE_COMMA,
  EXTGLOB_OPERATOR_BEGIN,
  EXTGLOB_TEXT_BEGIN,
  BRACE_TEXT_BEGIN,
  PARAMETER_INDIRECTION_BEGIN,
  PARAMETER_NAMES_BEGIN,
  PARAMETER_NAMES_INDIRECTION_BEGIN,
  PARAMETER_NAMES_TEXT_BEGIN,
  PARAMETER_SUBSTRING_BEGIN,
  ARITHMETIC_FIELD_EXPRESSION_START,
  ARITHMETIC_FIELD_SOURCE_START,
  ARITHMETIC_FIELD_CLOSING_BOUNDARY,
  SUBSTRING_SEPARATOR_BEGIN,
  PARAMETER_REPLACE_BEGIN,
  REPLACEMENT_SEPARATOR_BEGIN,
  PARAMETER_CASE_BEGIN,
  PARAMETER_TRANSFORM_BEGIN,
  PARAMETER_TRANSFORM_CODE_BEGIN,
  ARITHMETIC_POWER_OPERATOR_BEGIN,
  ARITHMETIC_COMMA_OPERATOR_BEGIN,
  ARITHMETIC_UPDATE_OPERATOR_BEGIN,
  ARITHMETIC_POWER_OPERATOR_BOUNDARY,
  ARITHMETIC_COMMA_OPERATOR_BOUNDARY,
  ARITHMETIC_UPDATE_OPERATOR_BOUNDARY,
  ASSIGNMENT_ARGUMENT_END,
  BRACE_ENDPOINT_BEGIN,
  BRACE_INCREMENT_BEGIN,
  BRACE_SEPARATOR_BEGIN,
  BRACE_LITERAL_OPEN,
  ASSIGNMENT_ARGUMENT_START,
  BRACE_SEQUENCE_START,
  SELECT_KEYWORD,
  FUNCTION_KEYWORD,
  TIME_KEYWORD,
  COPROC_KEYWORD,
  DSEMI_AND_BEGIN,
  PIPE_AND_BEGIN,
  ANDGREAT_BEGIN,
  ANDDGREAT_BEGIN,
  HERE_STRING_BEGIN,
  EXPLICIT_FNAME_BEGIN,
  COPROC_NAME_START,
  COPROC_BARE_COMMAND_START,
  TIME_OPTION_BEGIN,
  IO_VARIABLE_OPEN,
  IO_VARIABLE_CLOSE,
  ARITHMETIC_COMMAND_OPEN,
  FOR_ARITHMETIC_OPEN,
  FOR_EXPRESSION_START,
  FOR_SOURCE_START,
  ASSIGNMENT_APPEND_BEGIN,
  DECLARATION_NAME_BEGIN,
  ARRAY_ASSIGNMENT_OPEN,
  ARRAY_ASSIGNMENT_CLOSE,
  ARRAY_ELEMENT_START,
  ARRAY_WORD_START,
  CONDITIONAL_OPEN_BEGIN,
  CONDITIONAL_CLOSE_BEGIN,
  CONDITIONAL_UNARY_BEGIN,
  CONDITIONAL_BINARY_BEGIN,
  CONDITIONAL_MATCH_BEGIN,
  CONDITIONAL_REGEX_BEGIN,
  CONDITIONAL_NOT_BEGIN,
  CONDITIONAL_WORD_START,
  CONDITIONAL_PATTERN_START,
  CONDITIONAL_WORD_END,
  REGEX_START,
  REGEX_END,
  REGEX_SOURCE_GROUP_END,
  ERE_CHARACTER_BEGIN,
  ERE_COLLATING_CHARACTER_BEGIN,
  ERE_INITIAL_CLOSE_BEGIN,
  ERE_COMPOUND_CHARACTER_BEGIN,
  ERE_COMPOUND_MULTI_BEGIN,
  ERE_EQUIVALENCE_CHARACTER_BEGIN,
  ERE_EQUIVALENCE_MULTI_BEGIN,
  ERE_META_CHARACTER_BEGIN,
  ERE_CLASS_NAME_BEGIN,
  ERE_COUNT_BEGIN,
  ERE_FRAGMENT_BEGIN,
  ERE_WILDCARD_BEGIN,
  ERE_LEFT_ANCHOR_BEGIN,
  ERE_RIGHT_ANCHOR_BEGIN,
  ERE_MODIFIER_BEGIN,
  ERE_MEMBER_OPEN_BEGIN,
  ERE_MEMBER_CLOSE_BEGIN,
  ERE_BAR,
  ERE_SOURCE_BAR,
  ERE_STAR,
  ERE_PLUS,
  ERE_QUESTION,
  ERE_BRACKET_OPEN,
  ERE_BRACKET_CLOSE,
  ERE_NEGATION,
  ERE_HYPHEN,
  ERE_LITERAL_HYPHEN,
  ERE_INITIAL_HYPHEN,
  ERE_INTERVAL_OPEN,
  ERE_INTERVAL_CLOSE,
  ERE_COMMA,
  ERE_CLASS_OPEN,
  ERE_COLLATING_OPEN,
  ERE_EQUIVALENCE_OPEN,
  ERE_COLON,
  ERE_DOT,
  ERE_EQUAL,
  ERE_COMPOUND_CLOSE,
  ERE_RANGE_END_HYPHEN,
  ERE_ORDINARY_CLOSE,
  ERE_ORDINARY_BRACE,
  REGEX_OPEN,
  REGEX_CLOSE,
  FUNCTION_PARENTHESES_START,
  FOR_SEMICOLON,
  FOR_CLOSING_BOUNDARY,
  CONDITIONAL_AND_BOUNDARY,
  CONDITIONAL_OR_BOUNDARY,
  TIME_OPTION_START,
  TIME_END_BEGIN,
  TIME_END_START,
  EMPTY_BANG_BEGIN,
  DECLARATION_END,
  DECLARATION_ASSIGNMENT_START,
  COPROC_DECLARATION_ASSIGNMENT_START,
  COMMAND_WORD_START,
  BRACE_WORD_START,
  BRACE_WORD_END,
  EMPTY_TIME_KEYWORD,
  RAW_COMMAND_NAME_BEGIN,
  RAW_ARGUMENT_START,
  COPROC_RAW_ARGUMENT_START,
  RAW_LAYOUT_START,
#define LEXICAL_SOURCE_ENUM(begin, piece) piece,
  BASH_LEXICAL_SOURCE_TOKENS(LEXICAL_SOURCE_ENUM)
#undef LEXICAL_SOURCE_ENUM
#define PHYSICAL_SOURCE_ENUM(begin, prefix, character) prefix, character,
    BASH_PHYSICAL_SOURCE_TOKENS(PHYSICAL_SOURCE_ENUM)
#undef PHYSICAL_SOURCE_ENUM
#define WHOLE_SOURCE_ENUM(begin, whole) whole,
      BASH_WHOLE_SOURCE_TOKENS(WHOLE_SOURCE_ENUM)
#undef WHOLE_SOURCE_ENUM
        TOKEN_COUNT,
};

enum LexicalSourceKind {
  LEXICAL_SOURCE_NONE,
  LEXICAL_SOURCE_TEXT,
  LEXICAL_SOURCE_PHYSICAL,
  LEXICAL_SOURCE_WHOLE,
};

struct LexicalSource {
  enum LexicalSourceKind kind;
  enum TokenType piece;
  enum TokenType prefix;
};

static const struct LexicalSource LEXICAL_SOURCES[TOKEN_COUNT] = {
#define LEXICAL_SOURCE_ENTRY(begin, piece) \
  [begin] = {LEXICAL_SOURCE_TEXT, piece, TOKEN_COUNT},
  BASH_LEXICAL_SOURCE_TOKENS(LEXICAL_SOURCE_ENTRY)
#undef LEXICAL_SOURCE_ENTRY
#define PHYSICAL_SOURCE_ENTRY(begin, prefix, character) \
  [begin] = {LEXICAL_SOURCE_PHYSICAL, character, prefix},
    BASH_PHYSICAL_SOURCE_TOKENS(PHYSICAL_SOURCE_ENTRY)
#undef PHYSICAL_SOURCE_ENTRY
#define WHOLE_SOURCE_ENTRY(begin, whole) \
  [whole] = {LEXICAL_SOURCE_WHOLE, whole, TOKEN_COUNT},
      BASH_WHOLE_SOURCE_TOKENS(WHOLE_SOURCE_ENTRY)
#undef WHOLE_SOURCE_ENTRY
};

static const enum TokenType WHOLE_SOURCES[TOKEN_COUNT] = {
#define WHOLE_SOURCE_SYMBOL(begin, whole) [begin] = whole,
  BASH_WHOLE_SOURCE_TOKENS(WHOLE_SOURCE_SYMBOL)
#undef WHOLE_SOURCE_SYMBOL
};

static enum TokenType lexical_source_symbol(enum TokenType symbol) {
  switch (symbol) {
#define WHOLE_SOURCE_BEGIN(begin, whole) \
  case whole: \
    return begin;
    BASH_WHOLE_SOURCE_TOKENS(WHOLE_SOURCE_BEGIN)
#undef WHOLE_SOURCE_BEGIN
    default:
      return symbol;
  }
}

enum ArithmeticOperatorCategory {
  ARITHMETIC_OPERATOR_CATEGORY_ASSIGNMENT,
  ARITHMETIC_OPERATOR_CATEGORY_QUESTION,
  ARITHMETIC_OPERATOR_CATEGORY_COLON,
  ARITHMETIC_OPERATOR_CATEGORY_LOGICAL_OR,
  ARITHMETIC_OPERATOR_CATEGORY_LOGICAL_AND,
  ARITHMETIC_OPERATOR_CATEGORY_BITWISE_OR,
  ARITHMETIC_OPERATOR_CATEGORY_BITWISE_XOR,
  ARITHMETIC_OPERATOR_CATEGORY_BITWISE_AND,
  ARITHMETIC_OPERATOR_CATEGORY_EQUALITY,
  ARITHMETIC_OPERATOR_CATEGORY_RELATIONAL,
  ARITHMETIC_OPERATOR_CATEGORY_SHIFT,
  ARITHMETIC_OPERATOR_CATEGORY_ADDITIVE,
  ARITHMETIC_OPERATOR_CATEGORY_MULTIPLICATIVE,
  ARITHMETIC_OPERATOR_CATEGORY_POWER,
  ARITHMETIC_OPERATOR_CATEGORY_COMMA,
  ARITHMETIC_OPERATOR_CATEGORY_UPDATE,
  ARITHMETIC_OPERATOR_CATEGORY_COUNT,
};

static const enum TokenType
  ARITHMETIC_OPERATOR_BOUNDARIES[ARITHMETIC_OPERATOR_CATEGORY_COUNT] = {
    [ARITHMETIC_OPERATOR_CATEGORY_POWER] = ARITHMETIC_POWER_OPERATOR_BOUNDARY,
    [ARITHMETIC_OPERATOR_CATEGORY_COMMA] = ARITHMETIC_COMMA_OPERATOR_BOUNDARY,
    [ARITHMETIC_OPERATOR_CATEGORY_UPDATE] = ARITHMETIC_UPDATE_OPERATOR_BOUNDARY,
    [ARITHMETIC_OPERATOR_CATEGORY_ASSIGNMENT] =
      ARITHMETIC_ASSIGNMENT_OPERATOR_BOUNDARY,
    [ARITHMETIC_OPERATOR_CATEGORY_QUESTION] =
      ARITHMETIC_QUESTION_OPERATOR_BOUNDARY,
    [ARITHMETIC_OPERATOR_CATEGORY_COLON] = ARITHMETIC_COLON_OPERATOR_BOUNDARY,
    [ARITHMETIC_OPERATOR_CATEGORY_LOGICAL_OR] =
      ARITHMETIC_LOGICAL_OR_OPERATOR_BOUNDARY,
    [ARITHMETIC_OPERATOR_CATEGORY_LOGICAL_AND] =
      ARITHMETIC_LOGICAL_AND_OPERATOR_BOUNDARY,
    [ARITHMETIC_OPERATOR_CATEGORY_BITWISE_OR] =
      ARITHMETIC_BITWISE_OR_OPERATOR_BOUNDARY,
    [ARITHMETIC_OPERATOR_CATEGORY_BITWISE_XOR] =
      ARITHMETIC_BITWISE_XOR_OPERATOR_BOUNDARY,
    [ARITHMETIC_OPERATOR_CATEGORY_BITWISE_AND] =
      ARITHMETIC_BITWISE_AND_OPERATOR_BOUNDARY,
    [ARITHMETIC_OPERATOR_CATEGORY_EQUALITY] =
      ARITHMETIC_EQUALITY_OPERATOR_BOUNDARY,
    [ARITHMETIC_OPERATOR_CATEGORY_RELATIONAL] =
      ARITHMETIC_RELATIONAL_OPERATOR_BOUNDARY,
    [ARITHMETIC_OPERATOR_CATEGORY_SHIFT] = ARITHMETIC_SHIFT_OPERATOR_BOUNDARY,
    [ARITHMETIC_OPERATOR_CATEGORY_ADDITIVE] =
      ARITHMETIC_ADDITIVE_OPERATOR_BOUNDARY,
    [ARITHMETIC_OPERATOR_CATEGORY_MULTIPLICATIVE] =
      ARITHMETIC_MULTIPLICATIVE_OPERATOR_BOUNDARY,
};

enum BracketInput {
  BRACKET_INPUT_COLON,
  BRACKET_INPUT_DOT,
  BRACKET_INPUT_EQUALS,
  BRACKET_INPUT_OPEN,
  BRACKET_INPUT_CLASS_OPEN,
  BRACKET_INPUT_COLLATING_OPEN,
  BRACKET_INPUT_CLOSE,
  BRACKET_INPUT_NEGATION,
  BRACKET_INPUT_MEMBER,
  BRACKET_INPUT_HYPHEN,
};

enum BracketClassStage {
  BRACKET_CLASS_UNMARKED,
  BRACKET_CLASS_MARKED,
  BRACKET_CLASS_STAGE_COUNT,
};

enum BracketPhase {
  BRACKET_PHASE_NEGATION,
  BRACKET_PHASE_FIRST,
  BRACKET_PHASE_MEMBERS,
  BRACKET_PHASE_OPENED,
  BRACKET_PHASE_AFTER_RANGE,
  BRACKET_PHASE_RANGE,
  BRACKET_PHASE_RANGE_OPENED,
  BRACKET_PHASE_CLASS,
  BRACKET_PHASE_RANGE_CLASS = BRACKET_PHASE_CLASS +
    (BRACKET_INPUT_EQUALS + 1) * BRACKET_CLASS_STAGE_COUNT,
  BRACKET_PHASE_COUNT = BRACKET_PHASE_RANGE_CLASS + BRACKET_CLASS_STAGE_COUNT,
  BRACKET_PHASE_COMPLETE,
};

enum { BRACKET_CHAINS_LIMIT = 1 << BRACKET_PHASE_COUNT };

static enum BracketInput bracket_input(int32_t character) {
  switch (character) {
    case ':':
      return BRACKET_INPUT_COLON;
    case '.':
      return BRACKET_INPUT_DOT;
    case '=':
      return BRACKET_INPUT_EQUALS;
    case '-':
      return BRACKET_INPUT_HYPHEN;
    case '[':
      return BRACKET_INPUT_OPEN;
    case ']':
      return BRACKET_INPUT_CLOSE;
    case '!':
    case '^':
      return BRACKET_INPUT_NEGATION;
    default:
      return BRACKET_INPUT_MEMBER;
  }
}

/* bracket_open_input guarantees a closer for every class phase. */
static unsigned bracket_phase_after(unsigned phase, enum BracketInput input) {
  if (phase >= BRACKET_PHASE_CLASS) {
    bool endpoint = phase >= BRACKET_PHASE_RANGE_CLASS;
    unsigned base = endpoint ? BRACKET_PHASE_RANGE_CLASS : BRACKET_PHASE_CLASS;
    unsigned marker =
      endpoint ? BRACKET_INPUT_DOT : (phase - base) / BRACKET_CLASS_STAGE_COUNT;
    unsigned stage = (phase - base) % BRACKET_CLASS_STAGE_COUNT;
    if (input == BRACKET_INPUT_CLOSE && stage == BRACKET_CLASS_MARKED) {
      return endpoint ? BRACKET_PHASE_AFTER_RANGE : BRACKET_PHASE_MEMBERS;
    }
    return base +
      (endpoint ? 0 : marker * BRACKET_CLASS_STAGE_COUNT) +
      (input == marker ? BRACKET_CLASS_MARKED : BRACKET_CLASS_UNMARKED);
  }
  if (phase == BRACKET_PHASE_RANGE_OPENED) {
    return input == BRACKET_INPUT_DOT ? BRACKET_PHASE_RANGE_CLASS
                                      : BRACKET_PHASE_AFTER_RANGE;
  }
  if (phase == BRACKET_PHASE_OPENED) {
    return input <= BRACKET_INPUT_EQUALS
      ? BRACKET_PHASE_CLASS + input * BRACKET_CLASS_STAGE_COUNT
      : BRACKET_PHASE_MEMBERS;
  }
  if (phase == BRACKET_PHASE_RANGE) {
    switch (input) {
      case BRACKET_INPUT_CLOSE:
        return BRACKET_PHASE_COMPLETE;
      case BRACKET_INPUT_COLLATING_OPEN:
        return BRACKET_PHASE_RANGE_OPENED;
      default:
        return BRACKET_PHASE_AFTER_RANGE;
    }
  }
  switch (input) {
    case BRACKET_INPUT_HYPHEN:
      return phase == BRACKET_PHASE_MEMBERS ? BRACKET_PHASE_RANGE
                                            : BRACKET_PHASE_MEMBERS;
    case BRACKET_INPUT_CLASS_OPEN:
    case BRACKET_INPUT_COLLATING_OPEN:
      return BRACKET_PHASE_OPENED;
    case BRACKET_INPUT_CLOSE:
      return phase <= BRACKET_PHASE_FIRST ? BRACKET_PHASE_MEMBERS
                                          : BRACKET_PHASE_COMPLETE;
    case BRACKET_INPUT_NEGATION:
      return phase == BRACKET_PHASE_NEGATION ? BRACKET_PHASE_FIRST
                                             : BRACKET_PHASE_MEMBERS;
    default:
      return BRACKET_PHASE_MEMBERS;
  }
}

static uint32_t bracket_chains_after(uint32_t chains, enum BracketInput input) {
  uint32_t next = 0;
  for (unsigned phase = 0; phase < BRACKET_PHASE_COUNT; phase += 1) {
    if ((chains & (1u << phase)) != 0) {
      unsigned after = bracket_phase_after(phase, input);
      if (after < BRACKET_PHASE_COUNT) {
        next |= (uint32_t)(1u << after);
      }
    }
  }
  return next;
}

static bool bracket_input_opens(enum BracketInput input) {
  return input == BRACKET_INPUT_OPEN ||
    input == BRACKET_INPUT_CLASS_OPEN ||
    input == BRACKET_INPUT_COLLATING_OPEN;
}

static uint32_t
bracket_chains_after_literal(uint32_t chains, enum BracketInput input) {
  chains = bracket_chains_after(chains, input);
  return bracket_input_opens(input) ? chains | (1u << BRACKET_PHASE_NEGATION)
                                    : chains;
}

struct HereDocument {
  uint8_t *delimiter;
  size_t delimiter_length;
  size_t declaration_depth;
  size_t input_owner;
  bool quoted;
  bool strip_tabs;
  bool ending;
};

struct HereDocumentList {
  struct HereDocument *data;
  size_t count;
};

struct LexicalEmission {
  enum TokenType symbol;
  size_t remaining;
  uint32_t bracket_chains;
  bool active;
  bool removed_newline;
  bool allows_assignment_tilde;
  bool tracks_brackets;
};

struct HereDocumentFrame {
  struct HereDocumentList documents;
  size_t backquote_depth;
  bool at_line_start;
};

enum QuoteMode {
  QUOTE_PLAIN,
  QUOTE_DOUBLE,
  QUOTE_PARAMETER,
};

static enum QuoteMode quote_double(enum QuoteMode parent) {
  return parent == QUOTE_PARAMETER ? QUOTE_PARAMETER : QUOTE_DOUBLE;
}

static enum QuoteMode quote_parameter(enum QuoteMode parent) {
  return parent == QUOTE_PLAIN ? QUOTE_PLAIN : QUOTE_PARAMETER;
}

/* Raw offsets from scan start. element_remaining is past the next class or
   collating opener or bracket end; zero means unknown. collating_absent_* bound
   markers without closers; collating_closer_end is the shared `]` for openers
   from collating_closer_from, or zero if unknown. */
struct BracketCache {
  size_t element_remaining;
  size_t collating_absent_start;
  size_t collating_absent_end;
  size_t collating_closer_from;
  size_t collating_closer_end;
};

static bool
collating_absent_in(const struct BracketCache *cache, size_t marker) {
  return cache->collating_absent_start <= marker &&
    marker < cache->collating_absent_end;
}

static bool
collating_closes_in(const struct BracketCache *cache, size_t marker) {
  return cache->collating_closer_end != 0 &&
    cache->collating_closer_from <= marker &&
    marker + 2 <= cache->collating_closer_end;
}

static bool collating_cached(const struct BracketCache *cache) {
  return cache->collating_absent_end != 0 || cache->collating_closer_end != 0;
}

struct SourceContext {
  enum TokenType opener;
  size_t stage_count;
  size_t count;
  size_t substitution_depth;
  uint32_t bracket_chains;
  size_t regex_depth;
  size_t word_remaining;
  size_t brace_suppressed_remaining;
  struct BracketCache bracket;
  size_t assignment_head_remaining;
  size_t arithmetic_field_remaining;
  bool regex_started;
  bool brace_free;
  bool pattern_region;
  bool raw_argument;
  bool raw_element_start;
  bool local_disabled;
  uint8_t quote;
};

struct Scanner {
  struct HereDocumentList pending;
  struct HereDocumentFrame active;
  struct HereDocumentFrame *suspended_frames;
  size_t suspended_frame_count;
  bool sequence_end_pending;
  size_t backquote_depth;
  size_t substitution_depth;
  struct SourceSnapshot source;
  struct SourceContext *contexts;
  size_t context_count;
  struct LexicalEmission emission;
  struct BracketCache bracket;
  bool assignment_tilde_allowed;
  bool here_document_end_line_consumed;
};

static bool is_here_document_context(enum TokenType opener) {
  return opener == HERE_DOCUMENT_BODY_START ||
    opener == QUOTED_HERE_DOCUMENT_BODY_START;
}

static bool is_bracket_fallback_context(enum TokenType opener) {
  return opener == WORD_FALLBACK_LITERAL_BEGIN ||
    opener == ASSIGNMENT_FALLBACK_LITERAL_BEGIN ||
    opener == PARAMETER_FALLBACK_LITERAL_BEGIN;
}

static enum TokenType fallback_literal_for(enum TokenType literal) {
  switch (literal) {
    case PARAMETER_LITERAL_BEGIN:
      return PARAMETER_FALLBACK_LITERAL_BEGIN;
    case ASSIGNMENT_LITERAL_BEGIN:
      return ASSIGNMENT_FALLBACK_LITERAL_BEGIN;
    default:
      return WORD_FALLBACK_LITERAL_BEGIN;
  }
}

static enum TokenType literal_for_fallback(enum TokenType fallback) {
  switch (fallback) {
    case PARAMETER_FALLBACK_LITERAL_BEGIN:
      return PARAMETER_LITERAL_BEGIN;
    case ASSIGNMENT_FALLBACK_LITERAL_BEGIN:
      return ASSIGNMENT_LITERAL_BEGIN;
    default:
      return LITERAL_BEGIN;
  }
}

static bool is_bracket_word_context(enum TokenType symbol) {
  return symbol == COMMAND_WORD_START || symbol == ARRAY_WORD_START;
}

static bool is_word_context(enum TokenType symbol) {
  return is_bracket_word_context(symbol) ||
    symbol == BRACE_WORD_START ||
    symbol == DECLARATION_ASSIGNMENT_START ||
    symbol == ASSIGNMENT_ARGUMENT_START;
}

static bool assignment_separator_is_valid(const bool *valid) {
  return valid[ASSIGNMENT_SEPARATOR_BEGIN] ||
    valid[SCALAR_ASSIGNMENT_SEPARATOR_BEGIN];
}

static bool is_arithmetic_field_context(enum TokenType opener) {
  return opener == PARAMETER_SUBSTRING_BEGIN ||
    opener == SUBSTRING_SEPARATOR_BEGIN ||
    opener == BRACKET_ARITHMETIC_OPEN;
}

static void clear_document(struct HereDocument *document) {
  ts_free(document->delimiter);
  *document = (struct HereDocument){0};
}

static void clear_documents(struct HereDocumentList *documents) {
  for (size_t index = 0; index < documents->count; index += 1) {
    clear_document(&documents->data[index]);
  }

  ts_free(documents->data);
  *documents = (struct HereDocumentList){0};
}

static void clear_scanner(struct Scanner *scanner) {
  source_snapshot_clear(&scanner->source);
  ts_free(scanner->contexts);
  clear_documents(&scanner->pending);
  clear_documents(&scanner->active.documents);
  for (size_t index = 0; index < scanner->suspended_frame_count; index += 1) {
    clear_documents(&scanner->suspended_frames[index].documents);
  }
  ts_free(scanner->suspended_frames);
  *scanner = (struct Scanner){0};
}

struct StateWriter {
  char *data;
  size_t length;
  size_t capacity;
};

static bool write_state_bytes(
  struct StateWriter *writer,
  const char *bytes,
  size_t length
) {
  if (length > writer->capacity - writer->length) {
    return false;
  }

  if (length > 0) {
    memcpy(writer->data + writer->length, bytes, length);
  }
  writer->length += length;
  return true;
}

static bool write_state_byte(struct StateWriter *writer, uint8_t byte) {
  char data = (char)byte;
  return write_state_bytes(writer, &data, 1);
}

static bool write_state_size(struct StateWriter *writer, size_t value) {
  return source_write_unsigned(
    (uint8_t *)writer->data,
    writer->capacity,
    &writer->length,
    value
  );
}

enum DocumentFlag {
  DOCUMENT_FLAG_QUOTED = 1,
  DOCUMENT_FLAG_STRIP_TABS = 2,
  DOCUMENT_FLAG_ENDING = 4,
  DOCUMENT_FLAG_MASK = 7,
};

enum ScannerFlag {
  SCANNER_FLAG_SEQUENCE_END_PENDING = 1,
  SCANNER_FLAG_AT_LINE_START = 2,
  SCANNER_FLAG_ASSIGNMENT_TILDE_ALLOWED = 4,
  SCANNER_FLAG_ELEMENT_REMAINING = 8,
  SCANNER_FLAG_COLLATING = 16,
  SCANNER_FLAG_MASK = 31,
};

enum ContextFlag {
  CONTEXT_FLAG_LOCAL_DISABLED = 1,
  CONTEXT_FLAG_REGEX_STARTED = 2,
  CONTEXT_FLAG_BRACE_FREE = 4,
  CONTEXT_FLAG_PATTERN_REGION = 8,
  CONTEXT_FLAG_RAW_ARGUMENT = 16,
  CONTEXT_FLAG_RAW_ELEMENT_START = 32,
  CONTEXT_FLAG_COLLATING = 64,
  CONTEXT_FLAG_ELEMENT_REMAINING = 128,
};

enum EmissionFlag {
  EMISSION_FLAG_ACTIVE = 1,
  EMISSION_FLAG_REMOVED_NEWLINE = 2,
  EMISSION_FLAG_ALLOWS_ASSIGNMENT_TILDE = 4,
  EMISSION_FLAG_END_LINE_CONSUMED = 8,
  EMISSION_FLAG_TRACKS_BRACKETS = 16,
  EMISSION_FLAG_MASK = 31,
};

static uint8_t document_flags(const struct HereDocument *document) {
  return (uint8_t)((document->quoted ? DOCUMENT_FLAG_QUOTED : 0) |
    (document->strip_tabs ? DOCUMENT_FLAG_STRIP_TABS : 0) |
    (document->ending ? DOCUMENT_FLAG_ENDING : 0));
}

static bool write_document_delimiter(
  struct StateWriter *writer,
  const struct HereDocument *document
) {
  return (
    write_state_size(writer, document->delimiter_length) &&
    write_state_bytes(
      writer,
      (const char *)document->delimiter,
      document->delimiter_length
    )
  );
}

static bool serialize_document(
  struct StateWriter *writer,
  const struct HereDocument *document,
  bool with_declaration_depth
) {
  if (!write_state_byte(writer, document_flags(document))) {
    return false;
  }
  if (
    with_declaration_depth &&
    !write_state_size(writer, document->declaration_depth)
  ) {
    return false;
  }
  return write_state_size(writer, document->input_owner) &&
    write_document_delimiter(writer, document);
}

static bool serialize_document_run(
  struct StateWriter *writer,
  const struct HereDocumentList *documents,
  bool with_declaration_depth
) {
  for (size_t index = 0; index < documents->count; index += 1) {
    if (!serialize_document(
          writer,
          &documents->data[index],
          with_declaration_depth
        )) {
      return false;
    }
  }
  return true;
}

static bool serialize_documents(
  struct StateWriter *writer,
  const struct HereDocumentList *documents,
  bool with_declaration_depth
) {
  return (
    write_state_size(writer, documents->count) &&
    serialize_document_run(writer, documents, with_declaration_depth)
  );
}

static bool serialize_suspended_frames(
  const struct Scanner *scanner,
  struct StateWriter *writer
) {
  if (!write_state_size(writer, scanner->suspended_frame_count)) return false;
  for (size_t index = 0; index < scanner->suspended_frame_count; index += 1) {
    const struct HereDocumentFrame *frame = &scanner->suspended_frames[index];
    if (
      frame->documents.count > SIZE_MAX >> 1 ||
      !write_state_size(
        writer,
        (frame->documents.count << 1) | (frame->at_line_start ? 1 : 0)
      ) ||
      !write_state_size(writer, frame->backquote_depth) ||
      !serialize_document_run(writer, &frame->documents, false)
    ) {
      return false;
    }
  }
  return true;
}

static bool serialize_source_snapshot(
  const struct SourceSnapshot *snapshot,
  struct StateWriter *writer
) {
  uint8_t source_data[SCANNER_STATE_CAPACITY];
  size_t source_length;
  return source_snapshot_serialize(
           snapshot,
           source_data,
           sizeof(source_data),
           &source_length
         ) &&
    write_state_size(writer, source_length) &&
    write_state_bytes(writer, (const char *)source_data, source_length);
}

static unsigned context_flag_mask(enum TokenType opener) {
  const unsigned common = CONTEXT_FLAG_LOCAL_DISABLED |
    CONTEXT_FLAG_COLLATING |
    CONTEXT_FLAG_ELEMENT_REMAINING;
  if (opener == REGEX_START) return common | CONTEXT_FLAG_REGEX_STARTED;
  if (opener == COMMAND_WORD_START || opener == ASSIGNMENT_ARGUMENT_START)
    return common | CONTEXT_FLAG_RAW_ARGUMENT | CONTEXT_FLAG_RAW_ELEMENT_START;
  if (opener == BRACE_WORD_START || opener == DECLARATION_ASSIGNMENT_START)
    return common |
      CONTEXT_FLAG_BRACE_FREE |
      CONTEXT_FLAG_PATTERN_REGION |
      CONTEXT_FLAG_RAW_ARGUMENT |
      CONTEXT_FLAG_RAW_ELEMENT_START;
  return common;
}

static unsigned bracket_cache_flags(
  const struct BracketCache *cache,
  unsigned element,
  unsigned collating
) {
  return (cache->element_remaining != 0 ? element : 0) |
    (collating_cached(cache) ? collating : 0);
}

static bool serialize_bracket_cache(
  struct StateWriter *writer,
  const struct BracketCache *cache
) {
  return (cache->element_remaining == 0 ||
           write_state_size(writer, cache->element_remaining)) &&
    (!collating_cached(cache) ||
      (write_state_size(writer, cache->collating_absent_start) &&
        write_state_size(writer, cache->collating_absent_end) &&
        write_state_size(writer, cache->collating_closer_from) &&
        write_state_size(writer, cache->collating_closer_end)));
}

static bool serialize_source_contexts(
  const struct Scanner *scanner,
  struct StateWriter *writer
) {
  if (!write_state_size(writer, scanner->context_count)) return false;
  size_t context_depth = 0;
  for (size_t index = 0; index < scanner->context_count; index += 1) {
    const struct SourceContext *context = &scanner->contexts[index];
    if (
      context->count == 0 ||
      context->count > SIZE_MAX - context_depth ||
      !write_state_size(writer, context->opener) ||
      !write_state_size(writer, context->stage_count) ||
      !write_state_size(writer, context->count) ||
      !write_state_byte(writer, context->quote) ||
      (is_bracket_fallback_context(context->opener) &&
        !write_state_size(writer, context->bracket_chains)) ||
      (is_here_document_context(context->opener) &&
        !write_state_size(writer, context->substitution_depth)) ||
      (context->opener == REGEX_START &&
        !write_state_size(writer, context->regex_depth)) ||
      (is_word_context(context->opener) &&
        (!write_state_size(writer, context->word_remaining) ||
          !write_state_size(writer, context->assignment_head_remaining) ||
          !write_state_size(writer, context->brace_suppressed_remaining))) ||
      (is_arithmetic_field_context(context->opener) &&
        !write_state_size(writer, context->arithmetic_field_remaining)) ||
      !write_state_byte(
        writer,
        (context->local_disabled ? CONTEXT_FLAG_LOCAL_DISABLED : 0) |
          (context->regex_started ? CONTEXT_FLAG_REGEX_STARTED : 0) |
          (context->brace_free ? CONTEXT_FLAG_BRACE_FREE : 0) |
          (context->pattern_region ? CONTEXT_FLAG_PATTERN_REGION : 0) |
          (context->raw_argument ? CONTEXT_FLAG_RAW_ARGUMENT : 0) |
          (context->raw_element_start ? CONTEXT_FLAG_RAW_ELEMENT_START : 0) |
          bracket_cache_flags(
            &context->bracket,
            CONTEXT_FLAG_ELEMENT_REMAINING,
            CONTEXT_FLAG_COLLATING
          )
      ) ||
      !serialize_bracket_cache(writer, &context->bracket)
    ) {
      return false;
    }
    context_depth += context->count;
  }
  return true;
}

static bool
serialize_emission(const struct Scanner *scanner, struct StateWriter *writer) {
  const struct LexicalEmission *emission = &scanner->emission;
  uint8_t flags = (emission->active ? EMISSION_FLAG_ACTIVE : 0) |
    (emission->removed_newline ? EMISSION_FLAG_REMOVED_NEWLINE : 0) |
    (emission->allows_assignment_tilde ? EMISSION_FLAG_ALLOWS_ASSIGNMENT_TILDE
                                       : 0) |
    (scanner->here_document_end_line_consumed ? EMISSION_FLAG_END_LINE_CONSUMED
                                              : 0) |
    (emission->tracks_brackets ? EMISSION_FLAG_TRACKS_BRACKETS : 0);
  return write_state_byte(writer, flags) &&
    (!emission->active ||
      (write_state_size(writer, emission->symbol) &&
        write_state_size(writer, emission->remaining))) &&
    (!emission->tracks_brackets ||
      write_state_size(writer, emission->bracket_chains));
}

static bool serialize_scanner_state(
  const struct Scanner *scanner,
  struct StateWriter *writer
) {
  uint8_t flags =
    (scanner->sequence_end_pending ? SCANNER_FLAG_SEQUENCE_END_PENDING : 0) |
    (scanner->active.at_line_start ? SCANNER_FLAG_AT_LINE_START : 0) |
    (scanner->assignment_tilde_allowed ? SCANNER_FLAG_ASSIGNMENT_TILDE_ALLOWED
                                       : 0) |
    bracket_cache_flags(
      &scanner->bracket,
      SCANNER_FLAG_ELEMENT_REMAINING,
      SCANNER_FLAG_COLLATING
    );
  return write_state_byte(writer, flags) &&
    serialize_bracket_cache(writer, &scanner->bracket) &&
    write_state_size(writer, scanner->backquote_depth) &&
    write_state_size(writer, scanner->substitution_depth) &&
    write_state_size(writer, scanner->active.backquote_depth) &&
    serialize_documents(writer, &scanner->pending, true) &&
    serialize_documents(writer, &scanner->active.documents, false) &&
    serialize_suspended_frames(scanner, writer) &&
    serialize_source_snapshot(&scanner->source, writer) &&
    serialize_source_contexts(scanner, writer) &&
    serialize_emission(scanner, writer);
}

static bool scanner_state_fits(const struct Scanner *scanner) {
  char data[SCANNER_STATE_CAPACITY];
  struct StateWriter writer = {
    .data = data,
    .capacity = sizeof(data),
  };
  return serialize_scanner_state(scanner, &writer);
}

struct SerializedScannerState {
  const char *data;
  size_t length;
  size_t offset;
};

static bool read_byte(struct SerializedScannerState *state, uint8_t *byte) {
  if (state->offset >= state->length) {
    return false;
  }
  *byte = (uint8_t)state->data[state->offset];
  state->offset += 1;
  return true;
}

static bool read_size(struct SerializedScannerState *state, size_t *value) {
  uint64_t decoded;
  if (
    !source_read_unsigned(
      (const uint8_t *)state->data,
      state->length,
      &state->offset,
      &decoded
    ) ||
    decoded > SIZE_MAX
  ) {
    return false;
  }
  *value = (size_t)decoded;
  return true;
}

static bool read_document_body(
  struct SerializedScannerState *state,
  uint8_t flags,
  struct HereDocument *document,
  bool with_declaration_depth
) {
  size_t declaration_depth = 0;
  size_t input_owner = 0;
  size_t delimiter_length;
  if (
    (flags & ~DOCUMENT_FLAG_MASK) != 0 ||
    (with_declaration_depth && !read_size(state, &declaration_depth)) ||
    !read_size(state, &input_owner) ||
    !read_size(state, &delimiter_length) ||
    delimiter_length > state->length - state->offset
  ) {
    return false;
  }

  uint8_t *delimiter = NULL;
  if (delimiter_length > 0) {
    delimiter = ts_malloc(delimiter_length);
    if (delimiter == NULL) {
      return false;
    }
    memcpy(delimiter, state->data + state->offset, delimiter_length);
  }
  state->offset += delimiter_length;

  *document = (struct HereDocument){
    .delimiter = delimiter,
    .delimiter_length = delimiter_length,
    .declaration_depth = declaration_depth,
    .input_owner = input_owner,
    .quoted = (flags & DOCUMENT_FLAG_QUOTED) != 0,
    .strip_tabs = (flags & DOCUMENT_FLAG_STRIP_TABS) != 0,
    .ending = (flags & DOCUMENT_FLAG_ENDING) != 0,
  };
  return true;
}

static bool deserialize_document(
  struct SerializedScannerState *state,
  struct HereDocument *document,
  bool with_declaration_depth
) {
  uint8_t flags;
  return read_byte(state, &flags) &&
    read_document_body(state, flags, document, with_declaration_depth);
}

static bool deserialize_document_run(
  struct SerializedScannerState *state,
  struct HereDocumentList *documents,
  size_t count,
  bool with_declaration_depth
) {
  if (
    count > SIZE_MAX / sizeof(struct HereDocument) ||
    count > state->length - state->offset
  ) {
    return false;
  }

  if (count == 0) {
    return true;
  }

  documents->data = ts_calloc(count, sizeof(struct HereDocument));
  if (documents->data == NULL) {
    return false;
  }

  for (size_t index = 0; index < count; index += 1) {
    if (!deserialize_document(
          state,
          &documents->data[index],
          with_declaration_depth
        )) {
      return false;
    }
    documents->count += 1;
  }
  return true;
}

static bool deserialize_documents(
  struct SerializedScannerState *state,
  struct HereDocumentList *documents,
  bool with_declaration_depth
) {
  size_t count;
  return read_size(state, &count) &&
    deserialize_document_run(state, documents, count, with_declaration_depth);
}

static bool deserialize_suspended_frames(
  struct SerializedScannerState *state,
  struct Scanner *scanner
) {
  size_t count;
  if (
    !read_size(state, &count) ||
    count > SIZE_MAX / sizeof(struct HereDocumentFrame) ||
    count > state->length - state->offset
  ) {
    return false;
  }
  if (count > 0) {
    scanner->suspended_frames =
      ts_calloc(count, sizeof(struct HereDocumentFrame));
    if (scanner->suspended_frames == NULL) {
      return false;
    }
  }
  scanner->suspended_frame_count = count;
  for (size_t index = 0; index < count; index += 1) {
    size_t packed_count;
    struct HereDocumentFrame *frame = &scanner->suspended_frames[index];
    if (
      !read_size(state, &packed_count) ||
      !read_size(state, &frame->backquote_depth) ||
      !deserialize_document_run(
        state,
        &frame->documents,
        packed_count >> 1,
        false
      )
    ) {
      return false;
    }
    frame->at_line_start = (packed_count & 1) != 0;
  }
  return true;
}

static bool deserialize_source_snapshot(
  struct SerializedScannerState *state,
  struct SourceSnapshot *snapshot
) {
  size_t source_length;
  if (
    !read_size(state, &source_length) ||
    source_length > state->length - state->offset ||
    !source_snapshot_deserialize(
      snapshot,
      (const uint8_t *)state->data + state->offset,
      source_length
    )
  ) {
    return false;
  }
  state->offset += source_length;
  return true;
}

static bool deserialize_bracket_cache(
  struct SerializedScannerState *state,
  struct BracketCache *cache,
  bool element,
  bool collating
) {
  if (
    element &&
    (!read_size(state, &cache->element_remaining) ||
      cache->element_remaining == 0)
  )
    return false;
  return !collating ||
    (read_size(state, &cache->collating_absent_start) &&
      read_size(state, &cache->collating_absent_end) &&
      read_size(state, &cache->collating_closer_from) &&
      read_size(state, &cache->collating_closer_end) &&
      collating_cached(cache) &&
      (cache->collating_absent_end == 0 ||
        cache->collating_absent_start < cache->collating_absent_end) &&
      (cache->collating_closer_end == 0 ||
        cache->collating_closer_from + 2 <= cache->collating_closer_end));
}

static bool deserialize_context_fields(
  struct SerializedScannerState *state,
  struct SourceContext *context
) {
  uint8_t quote;
  if (!read_byte(state, &quote) || quote > QUOTE_PARAMETER) return false;
  context->quote = quote;
  size_t chains = 0;
  if (is_bracket_fallback_context(context->opener)) {
    if (!read_size(state, &chains) || chains >= BRACKET_CHAINS_LIMIT)
      return false;
    context->bracket_chains = (uint32_t)chains;
  }
  if (
    is_here_document_context(context->opener) &&
    !read_size(state, &context->substitution_depth)
  )
    return false;
  if (
    context->opener == REGEX_START && !read_size(state, &context->regex_depth)
  )
    return false;
  if (
    is_word_context(context->opener) &&
    (context->count != 1 ||
      !read_size(state, &context->word_remaining) ||
      !read_size(state, &context->assignment_head_remaining) ||
      !read_size(state, &context->brace_suppressed_remaining))
  )
    return false;
  if (
    is_arithmetic_field_context(context->opener) &&
    (context->count != 1 ||
      !read_size(state, &context->arithmetic_field_remaining))
  )
    return false;
  uint8_t flags;
  if (
    !read_byte(state, &flags) ||
    (flags & ~context_flag_mask(context->opener)) != 0
  )
    return false;
  if (!deserialize_bracket_cache(
        state,
        &context->bracket,
        (flags & CONTEXT_FLAG_ELEMENT_REMAINING) != 0,
        (flags & CONTEXT_FLAG_COLLATING) != 0
      ))
    return false;
  context->local_disabled = (flags & CONTEXT_FLAG_LOCAL_DISABLED) != 0;
  context->regex_started = (flags & CONTEXT_FLAG_REGEX_STARTED) != 0;
  context->brace_free = (flags & CONTEXT_FLAG_BRACE_FREE) != 0;
  context->pattern_region = (flags & CONTEXT_FLAG_PATTERN_REGION) != 0;
  context->raw_argument = (flags & CONTEXT_FLAG_RAW_ARGUMENT) != 0;
  context->raw_element_start = (flags & CONTEXT_FLAG_RAW_ELEMENT_START) != 0;
  return true;
}

static bool deserialize_source_contexts(
  struct SerializedScannerState *state,
  struct Scanner *scanner
) {
  size_t count;
  if (
    !read_size(state, &count) ||
    count > (state->length - state->offset) / 5 ||
    count > SIZE_MAX / sizeof(*scanner->contexts)
  ) {
    return false;
  }
  if (count > 0) {
    scanner->contexts = ts_calloc(count, sizeof(*scanner->contexts));
    if (scanner->contexts == NULL) {
      return false;
    }
  }
  scanner->context_count = count;
  size_t depth = 0;
  for (size_t index = 0; index < count; index += 1) {
    struct SourceContext *context = &scanner->contexts[index];
    size_t symbol;
    if (
      !read_size(state, &symbol) ||
      symbol >= TOKEN_COUNT ||
      !read_size(state, &context->stage_count) ||
      context->stage_count == 0 ||
      context->stage_count > SOURCE_STATE_CAPACITY / 2 ||
      !read_size(state, &context->count) ||
      context->count == 0 ||
      context->count > SIZE_MAX - depth
    ) {
      return false;
    }
    context->opener = (enum TokenType)symbol;
    if (!deserialize_context_fields(state, context)) {
      return false;
    }
    depth += context->count;
  }
  size_t available = scanner->source.stage_count;
  for (size_t index = count; index > 0; index--) {
    const struct SourceContext *context = &scanner->contexts[index - 1];
    if (context->stage_count > available) return false;
    available = context->stage_count;
  }
  return true;
}

static bool deserialize_emission(
  struct SerializedScannerState *state,
  struct Scanner *scanner
) {
  uint8_t flags;
  if (!read_byte(state, &flags) || (flags & ~EMISSION_FLAG_MASK) != 0) {
    return false;
  }
  scanner->emission.active = (flags & EMISSION_FLAG_ACTIVE) != 0;
  scanner->emission.removed_newline =
    (flags & EMISSION_FLAG_REMOVED_NEWLINE) != 0;
  scanner->emission.allows_assignment_tilde =
    (flags & EMISSION_FLAG_ALLOWS_ASSIGNMENT_TILDE) != 0;
  scanner->here_document_end_line_consumed =
    (flags & EMISSION_FLAG_END_LINE_CONSUMED) != 0;
  scanner->emission.tracks_brackets =
    (flags & EMISSION_FLAG_TRACKS_BRACKETS) != 0;
  if (!scanner->emission.active) {
    return !scanner->emission.tracks_brackets;
  }
  size_t symbol;
  if (
    !read_size(state, &symbol) ||
    symbol >= TOKEN_COUNT ||
    (symbol != SOURCE_BEGIN &&
      LEXICAL_SOURCES[symbol].kind == LEXICAL_SOURCE_NONE) ||
    !read_size(state, &scanner->emission.remaining) ||
    scanner->emission.remaining == 0
  ) {
    return false;
  }
  scanner->emission.symbol = (enum TokenType)symbol;
  size_t chains = 0;
  if (
    scanner->emission.tracks_brackets &&
    (!read_size(state, &chains) || chains >= BRACKET_CHAINS_LIMIT)
  ) {
    return false;
  }
  scanner->emission.bracket_chains = (uint32_t)chains;
  return true;
}

static bool deserialize_scanner_state(
  struct Scanner *scanner,
  const char *data,
  size_t length
) {
  struct SerializedScannerState state = {
    .data = data,
    .length = length,
  };
  uint8_t flags;
  if (
    !read_byte(&state, &flags) ||
    (flags & ~SCANNER_FLAG_MASK) != 0 ||
    !deserialize_bracket_cache(
      &state,
      &scanner->bracket,
      (flags & SCANNER_FLAG_ELEMENT_REMAINING) != 0,
      (flags & SCANNER_FLAG_COLLATING) != 0
    ) ||
    !read_size(&state, &scanner->backquote_depth) ||
    !read_size(&state, &scanner->substitution_depth) ||
    !read_size(&state, &scanner->active.backquote_depth) ||
    !deserialize_documents(&state, &scanner->pending, true) ||
    !deserialize_documents(&state, &scanner->active.documents, false) ||
    !deserialize_suspended_frames(&state, scanner) ||
    !deserialize_source_snapshot(&state, &scanner->source) ||
    !deserialize_source_contexts(&state, scanner) ||
    !deserialize_emission(&state, scanner) ||
    state.offset != state.length
  ) {
    return false;
  }
  scanner->sequence_end_pending =
    (flags & SCANNER_FLAG_SEQUENCE_END_PENDING) != 0;
  scanner->active.at_line_start = (flags & SCANNER_FLAG_AT_LINE_START) != 0;
  scanner->assignment_tilde_allowed =
    (flags & SCANNER_FLAG_ASSIGNMENT_TILDE_ALLOWED) != 0;
  return true;
}

static unsigned bash_scanner_serialize(void *payload, char *buffer) {
  const struct Scanner *scanner = payload;
  if (scanner == NULL) {
    return 0;
  }

  struct StateWriter writer = {
    .data = buffer + 1,
    .capacity = SCANNER_STATE_CAPACITY,
  };
  if (!serialize_scanner_state(scanner, &writer)) {
    return 0;
  }

  buffer[0] = SCANNER_SERIALIZATION_VERSION;
  return (unsigned)writer.length + 1;
}

static void
bash_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
  struct Scanner *scanner = payload;
  if (scanner == NULL) {
    return;
  }

  clear_scanner(scanner);
  if (
    length < 1 ||
    length > TREE_SITTER_SERIALIZATION_BUFFER_SIZE ||
    (uint8_t)buffer[0] != SCANNER_SERIALIZATION_VERSION
  ) {
    return;
  }

  if (!deserialize_scanner_state(scanner, buffer + 1, length - 1)) {
    clear_scanner(scanner);
  }
}

static bool copy_documents(
  const struct HereDocumentList *documents,
  struct HereDocumentList *copy
) {
  if (documents->count == 0) return true;
  copy->data = ts_calloc(documents->count, sizeof(*copy->data));
  if (copy->data == NULL) return false;
  copy->count = documents->count;
  for (size_t index = 0; index < documents->count; index += 1) {
    const struct HereDocument *document = &documents->data[index];
    struct HereDocument *next = &copy->data[index];
    *next = *document;
    next->delimiter = NULL;
    if (document->delimiter_length > 0) {
      next->delimiter = ts_malloc(document->delimiter_length);
      if (next->delimiter == NULL) return false;
      memcpy(next->delimiter, document->delimiter, document->delimiter_length);
    }
  }
  return true;
}

static bool scanner_copy(const struct Scanner *scanner, struct Scanner *copy) {
  *copy = *scanner;
  copy->pending = (struct HereDocumentList){0};
  copy->active.documents = (struct HereDocumentList){0};
  copy->suspended_frames = NULL;
  copy->suspended_frame_count = 0;
  copy->source.stages = NULL;
  copy->contexts = NULL;
  if (
    !copy_documents(&scanner->pending, &copy->pending) ||
    !copy_documents(&scanner->active.documents, &copy->active.documents)
  ) {
    goto failure;
  }
  if (scanner->suspended_frame_count > 0) {
    copy->suspended_frames = ts_calloc(
      scanner->suspended_frame_count,
      sizeof(*copy->suspended_frames)
    );
    if (copy->suspended_frames == NULL) goto failure;
    copy->suspended_frame_count = scanner->suspended_frame_count;
    for (size_t index = 0; index < scanner->suspended_frame_count; index += 1) {
      const struct HereDocumentFrame *frame = &scanner->suspended_frames[index];
      struct HereDocumentFrame *next = &copy->suspended_frames[index];
      *next = *frame;
      next->documents = (struct HereDocumentList){0};
      if (!copy_documents(&frame->documents, &next->documents)) goto failure;
    }
  }
  if (scanner->source.stage_count > 0) {
    size_t size = scanner->source.stage_count * sizeof(*copy->source.stages);
    copy->source.stages = ts_malloc(size);
    if (copy->source.stages == NULL) goto failure;
    memcpy(copy->source.stages, scanner->source.stages, size);
  }
  if (scanner->context_count > 0) {
    size_t size = scanner->context_count * sizeof(*copy->contexts);
    copy->contexts = ts_malloc(size);
    if (copy->contexts == NULL) goto failure;
    memcpy(copy->contexts, scanner->contexts, size);
  }

  return true;

failure:
  clear_scanner(copy);
  return false;
}

static void *bash_scanner_create(void) {
  return ts_calloc(1, sizeof(struct Scanner));
}

static void bash_scanner_destroy(void *payload) {
  struct Scanner *scanner = payload;
  if (scanner == NULL) {
    return;
  }

  clear_scanner(scanner);
  ts_free(scanner);
}

static enum TokenType top_context_opener(const struct Scanner *scanner) {
  return scanner->context_count == 0
    ? TOKEN_COUNT
    : scanner->contexts[scanner->context_count - 1].opener;
}

static struct SourceContext *top_context(struct Scanner *scanner) {
  return &scanner->contexts[scanner->context_count - 1];
}

static enum QuoteMode source_quote(const struct Scanner *scanner) {
  return scanner == NULL || scanner->context_count == 0
    ? QUOTE_PLAIN
    : scanner->contexts[scanner->context_count - 1].quote;
}

static enum QuoteMode
quote_after_token(enum QuoteMode parent, enum TokenType token) {
  switch (token) {
    case DQ_OPEN:
    case BRACKET_ARITHMETIC_OPEN:
      return quote_double(parent);
    case PARAMETER_OPEN:
      return quote_parameter(parent);
    case COMMAND_OPEN:
    case CURRENT_SHELL_OPEN:
    case REPLY_OPEN:
    case BACKQUOTE_START:
    case DOUBLE_QUOTED_BACKQUOTE_START:
    case PARAMETER_PATTERN_OPERATOR_BEGIN:
    case PARAMETER_REPLACE_BEGIN:
    case REPLACEMENT_SEPARATOR_BEGIN:
    case PARAMETER_CASE_BEGIN:
      return QUOTE_PLAIN;
    case HERE_DOCUMENT_BODY_START:
    case ARITHMETIC_EXPANSION_OPEN:
    case ARITHMETIC_COMMAND_OPEN:
    case FOR_ARITHMETIC_OPEN:
    case SUBSCRIPT_OPEN:
    case ARITHMETIC_SUBSCRIPT_OPEN:
    case PARAMETER_SUBSTRING_BEGIN:
    case SUBSTRING_SEPARATOR_BEGIN:
      return QUOTE_DOUBLE;
    default:
      return parent;
  }
}

static bool arithmetic_for_context(const struct Scanner *scanner) {
  if (scanner->context_count == 0) return false;
  enum TokenType opener = top_context_opener(scanner);
  return opener == FOR_ARITHMETIC_OPEN || opener == PUNCT_LEFT_PARENTHESIS;
}

static bool bracket_delimited_arithmetic(const struct Scanner *scanner) {
  for (size_t count = scanner->context_count; count > 0; count--) {
    switch (scanner->contexts[count - 1].opener) {
      case PUNCT_LEFT_PARENTHESIS:
        break;
      case BRACKET_ARITHMETIC_OPEN:
      case SUBSCRIPT_OPEN:
      case ARITHMETIC_SUBSCRIPT_OPEN:
        return true;
      default:
        return false;
    }
  }
  return false;
}

static size_t arithmetic_field_remaining(const struct Scanner *scanner) {
  if (scanner->context_count == 0) return 0;
  const struct SourceContext *context =
    &scanner->contexts[scanner->context_count - 1];
  return is_arithmetic_field_context(context->opener)
    ? context->arithmetic_field_remaining
    : 0;
}

struct ReservedWord {
  const char *text;
  enum TokenType symbol;
};

static const struct ReservedWord RESERVED_WORDS[] = {
  {"!", PIPELINE_NEGATION},
  {"{", LEFT_BRACE},
  {"}", RIGHT_BRACE},
  {"[[", CONDITIONAL_OPEN_BEGIN},
  {"]]", CONDITIONAL_CLOSE_BEGIN},
  {"if", IF_KEYWORD},
  {"then", THEN_KEYWORD},
  {"elif", ELIF_KEYWORD},
  {"else", ELSE_KEYWORD},
  {"fi", FI_KEYWORD},
  {"for", FOR_KEYWORD},
  {"in", IN_KEYWORD},
  {"do", DO_KEYWORD},
  {"done", DONE_KEYWORD},
  {"case", CASE_KEYWORD},
  {"esac", ESAC_KEYWORD},
  {"while", WHILE_KEYWORD},
  {"until", UNTIL_KEYWORD},
  {"coproc", COPROC_KEYWORD},
  {"time", TIME_KEYWORD},
  {"function", FUNCTION_KEYWORD},
  {"select", SELECT_KEYWORD},
};

static const struct ReservedWord CLOSING_WORDS[] = {
  {"then", THEN_KEYWORD},
  {"elif", ELIF_KEYWORD},
  {"else", ELSE_KEYWORD},
  {"fi", FI_KEYWORD},
  {"do", DO_KEYWORD},
  {"done", DONE_KEYWORD},
  {"esac", ESAC_KEYWORD},
};

static const struct ReservedWord *find_reserved_word(const char *word) {
  size_t word_count = ARRAY_COUNT(RESERVED_WORDS);
  for (size_t index = 0; index < word_count; index += 1) {
    if (strcmp(word, RESERVED_WORDS[index].text) == 0) {
      return &RESERVED_WORDS[index];
    }
  }
  return NULL;
}

static void backquote_stages(bool quoted, struct SourceStage *stages) {
  stages[0] = source_stage(SOURCE_REMOVE_CONTINUATIONS);
  stages[1] = source_stage(SOURCE_BACKQUOTE_DECODE);
  stages[1].quoted = quoted;
  stages[2] = source_stage(SOURCE_REMOVE_CONTINUATIONS);
}

static void here_document_body_stages(
  const struct HereDocument *document,
  struct SourceStage *stages
) {
  stages[0] = source_stage(SOURCE_REMOVE_CONTINUATIONS);
  stages[0].disabled = true;
  stages[1] = source_stage(SOURCE_REMOVE_CONTINUATIONS);
  stages[1].disabled = document->quoted;
  stages[2] = source_stage(SOURCE_STRIP_LEADING_TABS);
  stages[2].disabled = !document->strip_tabs;
  stages[3] = source_stage(SOURCE_REMOVE_CONTINUATIONS);
  stages[3].disabled = true;
}

static void
discard_documents_above(struct HereDocumentList *documents, size_t depth) {
  size_t retained = 0;
  for (size_t index = 0; index < documents->count; index += 1) {
    struct HereDocument *document = &documents->data[index];
    if (document->declaration_depth > depth) {
      clear_document(document);
    } else {
      documents->data[retained] = *document;
      retained += 1;
    }
  }
  if (retained == 0) {
    ts_free(documents->data);
    documents->data = NULL;
  }
  documents->count = retained;
}

static bool source_context_has_input(enum TokenType opener) {
  return opener == BACKQUOTE_START ||
    opener == DOUBLE_QUOTED_BACKQUOTE_START ||
    is_here_document_context(opener);
}

static size_t source_input_owner(const struct Scanner *scanner) {
  for (size_t index = scanner->context_count; index > 0; index--)
    if (source_context_has_input(scanner->contexts[index - 1].opener))
      return index;
  return 0;
}

static size_t enclosing_substitution_depth(const struct Scanner *scanner) {
  return scanner->substitution_depth + scanner->backquote_depth;
}

static bool here_document_is_startable(
  const struct Scanner *scanner,
  const struct HereDocument *document
) {
  return document->input_owner == source_input_owner(scanner) &&
    document->declaration_depth == enclosing_substitution_depth(scanner);
}

static bool has_startable_pending_document(const struct Scanner *scanner) {
  for (size_t index = 0; index < scanner->pending.count; index += 1) {
    if (here_document_is_startable(scanner, &scanner->pending.data[index])) {
      return true;
    }
  }
  return false;
}

static void discard_enclosed_pending_documents(struct Scanner *scanner) {
  discard_documents_above(
    &scanner->pending,
    enclosing_substitution_depth(scanner)
  );
}

static bool append_document(
  struct HereDocumentList *documents,
  struct HereDocument document
) {
  if (documents->count >= SIZE_MAX / sizeof(struct HereDocument)) {
    return false;
  }

  size_t next_count = documents->count + 1;
  struct HereDocument *resized =
    ts_realloc(documents->data, next_count * sizeof(struct HereDocument));
  if (resized == NULL) {
    return false;
  }

  resized[documents->count] = document;
  documents->data = resized;
  documents->count = next_count;
  return true;
}

static bool
append_pending_document(struct Scanner *scanner, struct HereDocument document) {
  document.declaration_depth = enclosing_substitution_depth(scanner);
  document.input_owner = source_input_owner(scanner);

  if (!append_document(&scanner->pending, document)) {
    return false;
  }

  if (!scanner_state_fits(scanner)) {
    scanner->pending.count -= 1;
    scanner->pending.data[scanner->pending.count] = (struct HereDocument){0};
    return false;
  }
  return true;
}

/* Delimiter storage stays with pending until activation commits. */
static bool partition_pending_documents(
  const struct Scanner *scanner,
  struct HereDocumentList *startable,
  struct HereDocumentList *retained
) {
  *startable = (struct HereDocumentList){0};
  *retained = (struct HereDocumentList){0};
  for (size_t index = 0; index < scanner->pending.count; index += 1) {
    if (here_document_is_startable(scanner, &scanner->pending.data[index])) {
      startable->count += 1;
    }
  }
  retained->count = scanner->pending.count - startable->count;
  if (startable->count == 0) {
    return false;
  }
  if (retained->count == 0) {
    *startable = scanner->pending;
    return true;
  }
  startable->data = ts_calloc(startable->count, sizeof(struct HereDocument));
  retained->data = ts_calloc(retained->count, sizeof(struct HereDocument));
  if (startable->data == NULL || retained->data == NULL) {
    ts_free(startable->data);
    ts_free(retained->data);
    return false;
  }
  size_t startable_index = 0;
  size_t retained_index = 0;
  for (size_t index = 0; index < scanner->pending.count; index += 1) {
    struct HereDocument *document = &scanner->pending.data[index];
    if (here_document_is_startable(scanner, document)) {
      startable->data[startable_index++] = *document;
    } else {
      retained->data[retained_index++] = *document;
    }
  }
  return true;
}

/* Rollback must retain reallocated frames. */
static bool
suspend_active_documents(struct Scanner *scanner, struct Scanner *next) {
  if (
    scanner->suspended_frame_count >=
    SIZE_MAX / sizeof(struct HereDocumentFrame)
  ) {
    return false;
  }
  struct HereDocumentFrame *frames = ts_realloc(
    scanner->suspended_frames,
    (scanner->suspended_frame_count + 1) * sizeof(struct HereDocumentFrame)
  );
  if (frames == NULL) {
    return false;
  }
  scanner->suspended_frames = frames;
  frames[scanner->suspended_frame_count] = scanner->active;
  next->suspended_frames = frames;
  next->suspended_frame_count = scanner->suspended_frame_count + 1;
  next->active.at_line_start = false;
  return true;
}

static bool activate_startable_pending_documents(struct Scanner *scanner) {
  struct HereDocumentList startable;
  struct HereDocumentList retained;
  if (!partition_pending_documents(scanner, &startable, &retained)) {
    return false;
  }

  struct Scanner next = *scanner;
  next.pending = retained;
  next.active.documents = startable;
  next.active.backquote_depth = scanner->backquote_depth;
  bool fits = (scanner->active.documents.count == 0 ||
                suspend_active_documents(scanner, &next)) &&
    scanner_state_fits(&next);
  if (!fits) {
    if (next.suspended_frame_count > scanner->suspended_frame_count) {
      scanner->suspended_frames[scanner->suspended_frame_count] =
        (struct HereDocumentFrame){0};
    }
    if (retained.count > 0) {
      ts_free(startable.data);
      ts_free(retained.data);
    }
    return false;
  }

  if (retained.count > 0) {
    ts_free(scanner->pending.data);
  }
  *scanner = next;
  return true;
}

static void restore_suspended_documents(struct Scanner *scanner) {
  if (scanner->suspended_frame_count == 0) {
    return;
  }

  scanner->suspended_frame_count -= 1;
  scanner->active = scanner->suspended_frames[scanner->suspended_frame_count];
  scanner->suspended_frames[scanner->suspended_frame_count] =
    (struct HereDocumentFrame){0};

  if (scanner->suspended_frame_count == 0) {
    ts_free(scanner->suspended_frames);
    scanner->suspended_frames = NULL;
  }
}

static void finish_active_document(struct Scanner *scanner) {
  scanner->backquote_depth = scanner->active.backquote_depth;
  struct HereDocumentList *documents = &scanner->active.documents;
  clear_document(&documents->data[0]);
  documents->count -= 1;

  if (documents->count > 0) {
    memmove(
      documents->data,
      documents->data + 1,
      documents->count * sizeof(struct HereDocument)
    );
    return;
  }

  clear_documents(documents);
  scanner->sequence_end_pending = true;
}

struct ByteBuffer {
  char *data;
  size_t length;
  size_t capacity;
  size_t limit;
  bool failed;
};

static bool grow_byte_buffer(struct ByteBuffer *buffer, size_t minimum) {
  if (buffer->limit != 0 && minimum > buffer->limit) {
    buffer->failed = true;
    return false;
  }

  size_t capacity = buffer->capacity == 0 ? 32 : buffer->capacity;
  while (capacity < minimum) {
    if (capacity > SIZE_MAX / 2) {
      capacity = SIZE_MAX;
      break;
    }
    capacity *= 2;
  }

  if (buffer->limit != 0 && capacity > buffer->limit) {
    capacity = buffer->limit;
  }

  if (capacity < minimum) {
    buffer->failed = true;
    return false;
  }

  char *resized = ts_realloc(buffer->data, capacity);
  if (resized == NULL) {
    buffer->failed = true;
    return false;
  }

  buffer->data = resized;
  buffer->capacity = capacity;
  return true;
}

static bool
append_bytes(struct ByteBuffer *buffer, const uint8_t *bytes, size_t length) {
  if (buffer == NULL) {
    return true;
  }

  if (length > SIZE_MAX - buffer->length) {
    buffer->failed = true;
    return false;
  }

  size_t next_length = buffer->length + length;
  if (
    next_length > buffer->capacity && !grow_byte_buffer(buffer, next_length)
  ) {
    return false;
  }

  if (length > 0) {
    memcpy(buffer->data + buffer->length, bytes, length);
  }
  buffer->length = next_length;
  return true;
}

static bool append_byte(struct ByteBuffer *buffer, uint8_t byte) {
  return append_bytes(buffer, &byte, 1);
}

static bool
encode_utf8_scalar(int32_t character, uint8_t bytes[4], size_t *length) {
  if (character < 0 || character > 0x10ffff) {
    return false;
  }

  if (character <= 0x7f) {
    bytes[0] = (uint8_t)character;
    *length = 1;
    return true;
  }

  if (character <= 0x7ff) {
    bytes[0] = (uint8_t)(0xc0 | (character >> 6));
    bytes[1] = (uint8_t)(0x80 | (character & 0x3f));
    *length = 2;
    return true;
  }

  if (character >= 0xd800 && character <= 0xdfff) {
    return false;
  }

  if (character <= 0xffff) {
    bytes[0] = (uint8_t)(0xe0 | (character >> 12));
    bytes[1] = (uint8_t)(0x80 | ((character >> 6) & 0x3f));
    bytes[2] = (uint8_t)(0x80 | (character & 0x3f));
    *length = 3;
    return true;
  }

  bytes[0] = (uint8_t)(0xf0 | (character >> 18));
  bytes[1] = (uint8_t)(0x80 | ((character >> 12) & 0x3f));
  bytes[2] = (uint8_t)(0x80 | ((character >> 6) & 0x3f));
  bytes[3] = (uint8_t)(0x80 | (character & 0x3f));
  *length = 4;
  return true;
}

static bool append_codepoint(struct ByteBuffer *buffer, int32_t character) {
  uint8_t bytes[4];
  size_t length;
  if (buffer == NULL) return true;
  return encode_utf8_scalar(character, bytes, &length) &&
    append_bytes(buffer, bytes, length);
}

static bool append_quoted_escape(struct ByteBuffer *buffer, int32_t character) {
  switch (character) {
    case 'a':
      return append_byte(buffer, '\a');
    case 'b':
      return append_byte(buffer, '\b');
    case 'e':
    case 'E':
      return append_byte(buffer, 0x1b);
    case 'f':
      return append_byte(buffer, '\f');
    case 'n':
      return append_byte(buffer, '\n');
    case 'r':
      return append_byte(buffer, '\r');
    case 't':
      return append_byte(buffer, '\t');
    case 'v':
      return append_byte(buffer, '\v');
    case '\\':
    case '\'':
    case '"':
    case '?':
      return append_codepoint(buffer, character);
    default:
      return append_byte(buffer, '\\') && append_codepoint(buffer, character);
  }
}

static bool is_horizontal_blank(int32_t character) {
  return character == ' ' || character == '\t';
}

static bool is_one_of(int32_t character, const char *set) {
  return character > 0 &&
    character < 128 &&
    strchr(set, (int)character) != NULL;
}

static bool is_special_parameter_character(int32_t character) {
  return is_one_of(character, "0*@#?$!-");
}

static bool is_parameter_start_character(int32_t character) {
  return (
    is_name_start_character(character) ||
    is_decimal_digit(character) ||
    is_special_parameter_character(character)
  );
}

static bool is_ascii(int32_t character) {
  return character >= 0 && character <= 0x7f;
}

static bool is_lowercase_letter(int32_t character) {
  return character >= 'a' && character <= 'z';
}

static void advance_name(TSLexer *lexer) {
  do {
    lexer->advance(lexer, false);
  } while (is_name_character(lexer->lookahead));
}

static bool is_control_operator_start(int32_t character) {
  return is_one_of(character, "&();<>|");
}

static bool accept_token(TSLexer *lexer, enum TokenType symbol) {
  lexer->mark_end(lexer);
  lexer->result_symbol = (TSSymbol)symbol;
  return true;
}

static bool accept_character(TSLexer *lexer, enum TokenType symbol) {
  lexer->advance(lexer, false);
  return accept_token(lexer, symbol);
}

enum DispatchResult {
  DISPATCH_NEXT,
  DISPATCH_ACCEPTED,
  DISPATCH_REJECTED,
};

static enum DispatchResult dispatch_outcome(bool accepted) {
  return accepted ? DISPATCH_ACCEPTED : DISPATCH_REJECTED;
}

static bool skip_escape_run(TSLexer *lexer, bool *continuation) {
  size_t count = 0;
  while (lexer->lookahead == '\\') {
    if (count == SIZE_MAX) {
      return false;
    }
    count += 1;
    lexer->advance(lexer, false);
  }
  *continuation = count == 1 && lexer->lookahead == '\n';
  if ((count & 1) != 0 && lexer->lookahead != SOURCE_BACKQUOTE_BOUNDARY) {
    lexer->advance(lexer, false);
  }
  return true;
}

static bool lexer_at_eof(const TSLexer *lexer) {
  return lexer->lookahead == 0 && lexer->eof(lexer);
}

static struct LogicalLexer *lookahead_input(TSLexer *lexer);
static bool
lookahead_local_policy(TSLexer *lexer, bool disabled, bool keep_removals);

static bool advance_source(TSLexer *lexer, struct ByteBuffer *source) {
  if (source != NULL && !append_codepoint(source, lexer->lookahead)) {
    return false;
  }
  lexer->advance(lexer, false);
  return true;
}

static bool skip_dollar_parameter(TSLexer *lexer, struct ByteBuffer *source) {
  return lexer->lookahead != '$' || advance_source(lexer, source);
}

static bool lookahead_local_disabled(TSLexer *lexer) {
  struct LogicalLexer *input = lookahead_input(lexer);
  return input != NULL &&
    input->cursor.stage_count > 0 &&
    input->cursor.initial[input->cursor.stage_count - 1].disabled;
}

static bool advance_to_comment_end(TSLexer *lexer, struct ByteBuffer *source) {
  bool disabled = lookahead_local_disabled(lexer);
  if (lexer->lookahead != '#' || !advance_source(lexer, source)) {
    return false;
  }
  if (!lookahead_local_policy(lexer, true, false)) {
    return false;
  }
  while (!lexer_at_eof(lexer) && lexer->lookahead != '\n') {
    if (lexer->lookahead == SOURCE_BACKQUOTE_BOUNDARY) {
      break;
    }
    if (!advance_source(lexer, source)) {
      return false;
    }
  }
  return lookahead_local_policy(lexer, disabled, false);
}

static bool comment_reaches_end(const TSLexer *lexer) {
  return lexer_at_eof(lexer) || (lexer->lookahead == SOURCE_BACKQUOTE_BOUNDARY);
}

static bool is_token_delimiter_character(int32_t character) {
  return is_horizontal_blank(character) ||
    character == '\n' ||
    is_control_operator_start(character) ||
    character == SOURCE_BACKQUOTE_BOUNDARY;
}

static bool is_token_delimiter(const TSLexer *lexer) {
  return lexer_at_eof(lexer) || is_token_delimiter_character(lexer->lookahead);
}

static bool
bracket_word_contains(const struct Scanner *scanner, const TSLexer *lexer);
static bool extglob_context(const struct Scanner *scanner);

static bool pattern_boundary(
  const struct Scanner *scanner,
  const TSLexer *lexer,
  bool parameter
) {
  if (!parameter) {
    if (extglob_context(scanner)) {
      return lexer_at_eof(lexer) ||
        lexer->lookahead == SOURCE_BACKQUOTE_BOUNDARY;
    }
    return is_token_delimiter(lexer) && !bracket_word_contains(scanner, lexer);
  }
  return lexer_at_eof(lexer) ||
    lexer->lookahead == '}' ||
    lexer->lookahead == SOURCE_BACKQUOTE_BOUNDARY;
}

static bool is_quote_or_expansion_start(int32_t character) {
  return is_one_of(character, "'\"$`");
}

static bool is_extglob_operator(int32_t character) {
  return is_one_of(character, "?*+@!");
}

static bool is_dollar_group_opener(int32_t character) {
  return is_one_of(character, "({[");
}

static char dollar_group_closer(int32_t opener) {
  return opener == '(' ? ')' : opener == '[' ? ']' : '}';
}

static bool braced_command_follows(int32_t character) {
  return is_horizontal_blank(character) ||
    character == '\n' ||
    character == '|';
}

static bool process_substitution_follows(struct LogicalLexer *input) {
  return is_one_of(input->lexer.lookahead, "<>") && logical_peek(input) == '(';
}

struct ValidationToken {
  uint8_t kind;
  uint8_t category;
};

struct ValidationTokenBuffer {
  struct ValidationToken *data;
  size_t length;
  size_t capacity;
};

struct ArithmeticScan {
  struct ValidationTokenBuffer tokens;
  struct EmbeddedSkip *embedded;
  char embedded_closer;
  size_t group_depth;
  size_t limit;
  bool source_only;
  bool bracket_delimited;
  bool stop_semicolon;
  bool force_extglob;
};

struct AmbiguousSubstitution {
  size_t start;
  size_t end;
  size_t parent;
  size_t next;
  struct Scanner context;
  struct ArithmeticScan scan;
  struct EmbeddedSkip *command;
  size_t command_resume;
  size_t resume;
  enum ArithmeticValidation result;
  bool scan_started;
  bool scan_complete;
  bool raw;
  bool arithmetic;
  bool complete;
  bool force_extglob;
};

enum PatternMode {
  PATTERN_WORD,
  PATTERN_ASSIGNMENT,
  PATTERN_PARAMETER,
  PATTERN_REPLACEMENT,
  PATTERN_WORD_TILDE,
  PATTERN_ASSIGNMENT_TILDE,
  PATTERN_PARAMETER_TILDE,
};

struct LookaheadCharacter {
  int32_t value;
  size_t substitution;
  size_t view;
  size_t logical_position;
  size_t raw_cut;
  size_t next;
  size_t fork;
};

struct LookaheadView {
  struct LogicalLexer *input;
  size_t inherited;
  size_t suffix_count;
  size_t entry;
  size_t next;
};

struct LookaheadLexer {
  TSLexer lexer;
  TSLexer *source;
  struct LookaheadCharacter *characters;
  size_t length;
  size_t capacity;
  size_t position;
  struct LookaheadView *views;
  size_t view_count;
  size_t view_capacity;
  struct AmbiguousSubstitution *substitutions;
  size_t substitution_count;
  size_t substitution_capacity;
  size_t requested;
  size_t active;
  bool failed;
};

static void lookahead_fail(struct LookaheadLexer *lookahead) {
  lookahead->failed = true;
  lookahead->lexer.lookahead = 0;
  if (
    lookahead->source != NULL && lookahead->source->advance == logical_advance
  ) {
    ((struct LogicalLexer *)lookahead->source)->native->failed = true;
  }
}

static void lookahead_seek(struct LookaheadLexer *lookahead, size_t position) {
  lookahead->position = position;
  if (lookahead->failed || lookahead->length == 0) {
    return;
  }
  int32_t character = lookahead->characters[position].value;
  lookahead->lexer.lookahead = character == LOOKAHEAD_END ? 0 : character;
}

static size_t probe_position(const TSLexer *lexer) {
  return ((const struct LookaheadLexer *)lexer)->position;
}

static void probe_seek(TSLexer *lexer, size_t position) {
  lookahead_seek((struct LookaheadLexer *)lexer, position);
}

static void probe_fail(TSLexer *lexer) {
  lookahead_fail((struct LookaheadLexer *)lexer);
}

static bool lookahead_append(struct LookaheadLexer *lookahead, size_t view) {
  struct LogicalLexer *input = lookahead->views[view].input;
  if (input->result == SOURCE_FAILURE) {
    lookahead_fail(lookahead);
    return false;
  }
  struct LookaheadCharacter *characters = source_grow(
    lookahead->characters,
    &lookahead->capacity,
    lookahead->length + 1,
    sizeof(struct LookaheadCharacter)
  );
  if (characters == NULL) {
    lookahead_fail(lookahead);
    return false;
  }
  lookahead->characters = characters;
  lookahead->characters[lookahead->length++] = (struct LookaheadCharacter){
    .value =
      lexer_at_eof(&input->lexer) ? LOOKAHEAD_END : input->lexer.lookahead,
    .substitution = SIZE_MAX,
    .view = view,
    .logical_position = input->result == SOURCE_CHARACTER
      ? input->cursor.logical_position - 1
      : input->cursor.logical_position,
    .raw_cut = input->consumed,
    .next = SIZE_MAX,
    .fork = SIZE_MAX,
  };
  return true;
}

static struct LogicalLexer *
lookahead_restore(struct LookaheadLexer *lookahead) {
  const struct LookaheadCharacter *character =
    &lookahead->characters[lookahead->position];
  struct LogicalLexer *input = lookahead->views[character->view].input;
  input->cursor.logical_position = character->logical_position;
  input->consumed = character->raw_cut;
  logical_load(input);
  if (input->result == SOURCE_FAILURE) {
    lookahead_fail(lookahead);
  }
  return input;
}

static void lookahead_advance(TSLexer *lexer, bool skip) {
  struct LookaheadLexer *lookahead = (struct LookaheadLexer *)lexer;
  if (lookahead->failed) {
    return;
  }
  if (lookahead->length == 0 && !lookahead_append(lookahead, 0)) {
    return;
  }
  size_t position = lookahead->position;
  size_t next = lookahead->characters[position].next;
  if (next == SIZE_MAX) {
    struct LogicalLexer *input = lookahead_restore(lookahead);
    if (lexer_at_eof(&input->lexer)) {
      return;
    }
    input->lexer.advance(&input->lexer, skip);
    next = lookahead->length;
    if (!lookahead_append(lookahead, lookahead->characters[position].view)) {
      return;
    }
    lookahead->characters[position].next = next;
  }
  lookahead_seek(lookahead, next);
}

static void lookahead_mark_end(TSLexer *lexer) {
  struct LookaheadLexer *lookahead = (struct LookaheadLexer *)lexer;
  if (!lookahead->failed) {
    struct LogicalLexer *input = lookahead->views[0].input;
    input->mark = lookahead->length == 0
      ? input->consumed
      : lookahead->characters[lookahead->position].raw_cut;
  }
}

static bool lookahead_eof(const TSLexer *lexer) {
  const struct LookaheadLexer *lookahead = (const struct LookaheadLexer *)lexer;
  return lookahead->failed ||
    (lookahead->length == 0
        ? lexer_at_eof(lookahead->source)
        : lookahead->characters[lookahead->position].value == LOOKAHEAD_END);
}

static bool lookahead_has_failed(const TSLexer *lexer) {
  return lexer->advance == lookahead_advance &&
    ((const struct LookaheadLexer *)lexer)->failed;
}

static bool lookahead_is_pending(const TSLexer *lexer) {
  const struct LookaheadLexer *lookahead = (const struct LookaheadLexer *)lexer;
  return lookahead->failed || lookahead->requested != SIZE_MAX;
}

static struct LogicalLexer *lookahead_input(TSLexer *lexer) {
  if (lexer->advance == logical_advance) {
    return (struct LogicalLexer *)lexer;
  }
  if (lexer->advance != lookahead_advance) {
    return NULL;
  }
  struct LookaheadLexer *lookahead = (struct LookaheadLexer *)lexer;
  if (lookahead->length == 0 && !lookahead_append(lookahead, 0)) {
    return NULL;
  }
  return lookahead_restore(lookahead);
}

static bool lookahead_find_view(
  const struct LookaheadLexer *lookahead,
  size_t raw_cut,
  size_t inherited,
  const struct SourceStage *suffix,
  size_t suffix_count,
  size_t *entry
) {
  size_t position = lookahead->position;
  for (
    size_t index = lookahead->characters[position].fork; index != SIZE_MAX;
    index = lookahead->views[index].next
  ) {
    const struct LookaheadView *view = &lookahead->views[index];
    if (
      view->inherited != inherited ||
      view->suffix_count != suffix_count ||
      lookahead->characters[view->entry].raw_cut != raw_cut
    ) {
      continue;
    }
    bool matches = true;
    for (size_t stage = 0; stage < suffix_count; stage += 1) {
      const struct SourceStage *existing =
        &view->input->cursor.initial[inherited + stage];
      matches = matches &&
        existing->kind == suffix[stage].kind &&
        existing->disabled == suffix[stage].disabled &&
        existing->quoted == suffix[stage].quoted &&
        existing->at_line_start == suffix[stage].at_line_start;
    }
    if (matches) {
      *entry = view->entry;
      return true;
    }
  }
  return false;
}

static bool lookahead_add_view(
  struct LookaheadLexer *lookahead,
  struct LogicalLexer *parent,
  size_t raw_cut,
  size_t inherited,
  const struct SourceStage *suffix,
  size_t suffix_count
) {
  struct LogicalLexer *input = ts_malloc(sizeof(*input));
  if (input == NULL) {
    lookahead_fail(lookahead);
    return false;
  }
  if (!logical_fork(input, parent, raw_cut, inherited, suffix, suffix_count)) {
    ts_free(input);
    lookahead_fail(lookahead);
    return false;
  }
  struct LookaheadView *views = source_grow(
    lookahead->views,
    &lookahead->view_capacity,
    lookahead->view_count + 1,
    sizeof(*views)
  );
  if (views == NULL) {
    logical_clear(input);
    ts_free(input);
    lookahead_fail(lookahead);
    return false;
  }
  lookahead->views = views;
  size_t position = lookahead->position;
  size_t index = lookahead->view_count++;
  size_t entry = lookahead->length;
  lookahead->views[index] = (struct LookaheadView){
    .input = input,
    .inherited = inherited,
    .suffix_count = suffix_count,
    .entry = entry,
    .next = lookahead->characters[position].fork,
  };
  lookahead->characters[position].fork = index;
  if (!lookahead_append(lookahead, index)) {
    return false;
  }
  lookahead_seek(lookahead, entry);
  return true;
}

static bool lookahead_set_stages_at(
  TSLexer *lexer,
  size_t raw_cut,
  size_t inherited,
  const struct SourceStage *suffix,
  size_t suffix_count
) {
  if (lexer->advance == logical_advance) {
    if (((struct LogicalLexer *)lexer)->consumed != raw_cut) {
      return false;
    }
    return logical_replace_view(
      (struct LogicalLexer *)lexer,
      inherited,
      suffix,
      suffix_count
    );
  }
  if (lexer->advance != lookahead_advance) {
    return false;
  }
  struct LookaheadLexer *lookahead = (struct LookaheadLexer *)lexer;
  struct LogicalLexer *parent = lookahead_input(lexer);
  if (parent == NULL) {
    return false;
  }
  while (parent->base + parent->cursor.raw_count < raw_cut) {
    int32_t value;
    if (
      logical_read(parent, &value) != SOURCE_CHARACTER ||
      !source_feed(&parent->cursor, value)
    ) {
      lookahead_fail(lookahead);
      return false;
    }
  }
  size_t entry;
  if (
    lookahead_find_view(
      lookahead,
      raw_cut,
      inherited,
      suffix,
      suffix_count,
      &entry
    )
  ) {
    lookahead_seek(lookahead, entry);
    return true;
  }
  return lookahead_add_view(
    lookahead,
    parent,
    raw_cut,
    inherited,
    suffix,
    suffix_count
  );
}

static bool lookahead_set_stages(
  TSLexer *lexer,
  size_t inherited,
  const struct SourceStage *suffix,
  size_t suffix_count
) {
  struct LogicalLexer *input = lookahead_input(lexer);
  return input != NULL &&
    lookahead_set_stages_at(
      lexer,
      input->consumed,
      inherited,
      suffix,
      suffix_count
    );
}

/* Reread comments after # to keep following continuations literal. */
static bool
lookahead_local_policy(TSLexer *lexer, bool disabled, bool keep_removals) {
  struct LogicalLexer *input = lookahead_input(lexer);
  if (input == NULL || input->cursor.stage_count == 0) {
    return false;
  }
  size_t local = input->cursor.stage_count - 1;
  if (input->cursor.initial[local].kind != SOURCE_REMOVE_CONTINUATIONS) {
    return false;
  }
  if (input->cursor.initial[local].disabled == disabled) {
    return true;
  }
  struct SourceStage stage = source_stage(SOURCE_REMOVE_CONTINUATIONS);
  stage.disabled = disabled;
  size_t start = keep_removals && disabled && input->result == SOURCE_CHARACTER
    ? input->base + (size_t)input->character.origin.start
    : input->consumed;
  return lookahead_set_stages_at(lexer, start, local, &stage, 1);
}

struct LookaheadContext {
  size_t stage_count;
  bool local_disabled;
};

static bool lookahead_backquote_begin(
  TSLexer *lexer,
  bool quoted,
  struct LookaheadContext *context
) {
  struct LogicalLexer *input = lookahead_input(lexer);
  if (input == NULL || input->cursor.stage_count == 0) {
    return false;
  }
  size_t count = input->cursor.stage_count;
  *context = (struct LookaheadContext){
    .stage_count = count,
    .local_disabled = input->cursor.initial[count - 1].disabled,
  };
  struct SourceStage stages[3];
  backquote_stages(quoted, stages);
  return lookahead_set_stages(lexer, count - 1, stages, 3);
}

static bool
lookahead_context_end(TSLexer *lexer, const struct LookaheadContext *context) {
  if (context->stage_count == 0) {
    return true;
  }
  struct SourceStage stage = source_stage(SOURCE_REMOVE_CONTINUATIONS);
  stage.disabled = context->local_disabled;
  return lookahead_set_stages(lexer, context->stage_count - 1, &stage, 1);
}

static void complete_ambiguous_substitutions(struct LookaheadLexer *lookahead);

static const struct AmbiguousSubstitution *
request_ambiguous_substitution(struct LookaheadLexer *lookahead, size_t index) {
  if (lookahead->active != SIZE_MAX) {
    lookahead->requested = index;
    return NULL;
  }
  size_t position = lookahead->position;
  lookahead->active = index;
  complete_ambiguous_substitutions(lookahead);
  lookahead_seek(lookahead, position);
  return lookahead->failed ? NULL : &lookahead->substitutions[index];
}

static const struct AmbiguousSubstitution *lookup_ambiguous_substitution(
  const struct Scanner *scanner,
  TSLexer *lexer,
  bool force_extglob
) {
  struct LookaheadLexer *lookahead = (struct LookaheadLexer *)lexer;
  if (lookahead->length == 0 && !lookahead_append(lookahead, 0)) {
    return NULL;
  }
  for (
    size_t index = lookahead->characters[lookahead->position].substitution;
    index != SIZE_MAX;
    index = lookahead->substitutions[index].next
  ) {
    struct AmbiguousSubstitution *substitution =
      &lookahead->substitutions[index];
    if (
      substitution->force_extglob == force_extglob &&
      substitution->start == lookahead->position &&
      substitution->raw == (scanner == NULL) &&
      (scanner == NULL ||
        (substitution->context.backquote_depth == scanner->backquote_depth))
    ) {
      if (!substitution->complete) {
        return request_ambiguous_substitution(lookahead, index);
      }
      return substitution;
    }
  }
  struct AmbiguousSubstitution *substitutions = source_grow(
    lookahead->substitutions,
    &lookahead->substitution_capacity,
    lookahead->substitution_count + 1,
    sizeof(struct AmbiguousSubstitution)
  );
  if (substitutions == NULL) {
    lookahead_fail(lookahead);
    return NULL;
  }
  lookahead->substitutions = substitutions;
  size_t index = lookahead->substitution_count++;
  lookahead->substitutions[index] = (struct AmbiguousSubstitution){
    .start = lookahead->position,
    .parent = lookahead->active,
    .next = lookahead->characters[lookahead->position].substitution,
    .context = scanner == NULL ? (struct Scanner){0} : *scanner,
    .raw = scanner == NULL,
    .force_extglob = force_extglob,
    .scan = {.force_extglob = force_extglob},
  };
  lookahead->characters[lookahead->position].substitution = index;
  return request_ambiguous_substitution(lookahead, index);
}

static enum ArithmeticValidation skip_ambiguous_substitution(
  const struct Scanner *scanner,
  TSLexer *lexer,
  bool force_extglob
) {
  const struct AmbiguousSubstitution *substitution =
    lookup_ambiguous_substitution(scanner, lexer, force_extglob);
  if (substitution == NULL) {
    return ARITHMETIC_VALIDATION_INVALID;
  }
  enum ArithmeticValidation result = substitution->result;
  probe_seek(lexer, substitution->end);
  return result;
}

static enum ArithmeticValidation skip_embedded_construct(
  const struct Scanner *scanner,
  TSLexer *lexer,
  char initial_closer,
  bool force_extglob
);

static enum ArithmeticValidation
skip_subscript_source(const struct Scanner *scanner, TSLexer *lexer);

static bool skip_subscript_body(const struct Scanner *scanner, TSLexer *lexer) {
  lexer->advance(lexer, false);
  return skip_subscript_source(scanner, lexer) == ARITHMETIC_VALIDATION_VALID;
}
static enum ArithmeticValidation skip_extglob_pattern(
  const struct Scanner *scanner,
  TSLexer *lexer,
  bool force_extglob
);
static bool scan_delimiter_single_quoted_segment(
  TSLexer *lexer,
  struct ByteBuffer *delimiter,
  bool dollar
);

static bool
skip_bracket_member_expansion(const struct Scanner *scanner, TSLexer *lexer) {
  int32_t character = lexer->lookahead;
  if (character == '\'') {
    return scan_delimiter_single_quoted_segment(lexer, NULL, false);
  }
  if (character == '"' || character == '`') {
    lexer->advance(lexer, false);
    return skip_embedded_construct(scanner, lexer, (char)character, false) ==
      ARITHMETIC_VALIDATION_VALID;
  }
  if (character == '$') {
    lexer->advance(lexer, false);
    int32_t introducer = lexer->lookahead;
    if (introducer == '\'') {
      return scan_delimiter_single_quoted_segment(lexer, NULL, true);
    }
    if (is_dollar_group_opener(introducer)) {
      lexer->advance(lexer, false);
      return skip_embedded_construct(
               scanner,
               lexer,
               dollar_group_closer(introducer),
               false
             ) == ARITHMETIC_VALIDATION_VALID;
    }
    if (is_name_start_character(introducer)) {
      while (is_name_character(lexer->lookahead)) {
        lexer->advance(lexer, false);
      }
    } else if (
      is_decimal_digit(introducer) || is_special_parameter_character(introducer)
    ) {
      lexer->advance(lexer, false);
    }
  }
  return true;
}

enum BracketAtom {
  BRACKET_ATOM_PLAIN,
  BRACKET_ATOM_MEMBER,
  BRACKET_ATOM_END,
};

static enum BracketAtom
skip_bracket_quoted_atom(const struct Scanner *scanner, TSLexer *lexer) {
  int32_t character = lexer->lookahead;
  if (character == '\\') {
    lexer->advance(lexer, false);
    if (
      lexer_at_eof(lexer) ||
      lexer->lookahead == SOURCE_BACKQUOTE_BOUNDARY ||
      lexer->lookahead == '\n'
    ) {
      return BRACKET_ATOM_END;
    }
    lexer->advance(lexer, false);
    return BRACKET_ATOM_MEMBER;
  }
  if (is_quote_or_expansion_start(character)) {
    return skip_bracket_member_expansion(scanner, lexer) ? BRACKET_ATOM_MEMBER
                                                         : BRACKET_ATOM_END;
  }
  return BRACKET_ATOM_PLAIN;
}

static const struct SourceContext *
assignment_argument_context(const struct Scanner *scanner) {
  size_t count = scanner->context_count;
  while (
    count > 0 &&
    is_bracket_fallback_context(scanner->contexts[count - 1].opener)
  )
    count--;
  const struct SourceContext *context =
    count == 0 ? NULL : &scanner->contexts[count - 1];
  return context != NULL && is_word_context(context->opener) ? context : NULL;
}

static size_t lexer_raw_position(const TSLexer *lexer) {
  if (lexer->advance == logical_advance)
    return ((const struct LogicalLexer *)lexer)->consumed;
  if (lexer->advance == lookahead_advance) {
    const struct LookaheadLexer *probe = (const struct LookaheadLexer *)lexer;
    return probe->characters[probe->position].raw_cut;
  }
  return 0;
}

static bool
assignment_value_position(const struct Scanner *scanner, const TSLexer *lexer) {
  const struct SourceContext *context = assignment_argument_context(scanner);
  return context == NULL ||
    context->assignment_head_remaining <= lexer_raw_position(lexer);
}

static bool assignment_tilde_follows(
  const struct Scanner *scanner,
  const TSLexer *lexer,
  enum PatternMode mode,
  int32_t previous
) {
  if (mode != PATTERN_ASSIGNMENT || lexer->lookahead != '~') return false;
  const struct SourceContext *context = assignment_argument_context(scanner);
  return (previous == ':' && assignment_value_position(scanner, lexer)) ||
    (context != NULL &&
      context->assignment_head_remaining > 0 &&
      context->assignment_head_remaining == lexer_raw_position(lexer));
}

static bool is_bracket_literal_boundary(
  const struct Scanner *scanner,
  const TSLexer *lexer,
  enum PatternMode mode
) {
  return pattern_boundary(
           scanner,
           lexer,
           mode == PATTERN_PARAMETER ||
             mode == PATTERN_REPLACEMENT ||
             mode == PATTERN_PARAMETER_TILDE
         ) ||
    (mode == PATTERN_REPLACEMENT && lexer->lookahead == '/') ||
    (mode == PATTERN_ASSIGNMENT_TILDE && lexer->lookahead == ':') ||
    ((mode == PATTERN_WORD_TILDE ||
       mode == PATTERN_ASSIGNMENT_TILDE ||
       mode == PATTERN_PARAMETER_TILDE) &&
      lexer->lookahead == '/');
}

static bool in_bracket_fallback(const struct Scanner *scanner) {
  return scanner->context_count > 0 &&
    is_bracket_fallback_context(top_context_opener(scanner));
}

static uint32_t fallback_chains(const struct Scanner *scanner) {
  return in_bracket_fallback(scanner)
    ? scanner->contexts[scanner->context_count - 1].bracket_chains
    : 0;
}

static bool extglob_enabled(const struct Scanner *scanner) {
  if (BASH_EXTGLOB) return true;
  for (
    size_t index = 0; scanner != NULL && index < scanner->context_count; index++
  ) {
    if (scanner->contexts[index].opener == CONDITIONAL_PATTERN_START)
      return true;
  }
  return false;
}

static bool extglob_context(const struct Scanner *scanner) {
  size_t count =
    scanner->context_count - (in_bracket_fallback(scanner) ? 1 : 0);
  return count > 0 && scanner->contexts[count - 1].opener == EXTGLOB_OPEN;
}

static const struct SourceContext *
pattern_source_context(const struct Scanner *scanner) {
  size_t count = scanner->context_count;
  while (
    count > 0 &&
    (is_bracket_fallback_context(scanner->contexts[count - 1].opener) ||
      scanner->contexts[count - 1].opener == EXTGLOB_OPEN)
  )
    count--;
  return count == 0 ? NULL : &scanner->contexts[count - 1];
}

static enum TokenType pattern_context(const struct Scanner *scanner) {
  const struct SourceContext *context = pattern_source_context(scanner);
  return context == NULL ? TOKEN_COUNT : context->opener;
}

static bool is_word_piece_opener(enum TokenType opener) {
  return opener == BRACE_OPEN ||
    opener == BRACE_LITERAL_OPEN ||
    opener == WORD_TILDE_START ||
    opener == ASSIGNMENT_TILDE_START ||
    opener == WORD_FALLBACK_LITERAL_BEGIN ||
    opener == ASSIGNMENT_FALLBACK_LITERAL_BEGIN;
}

static const struct SourceContext *
word_source_context(const struct Scanner *scanner, bool braces_only) {
  for (size_t count = scanner->context_count; count > 0; count--) {
    const struct SourceContext *context = &scanner->contexts[count - 1];
    switch (context->opener) {
      case DECLARATION_ASSIGNMENT_START:
      case BRACE_WORD_START:
        return context;
      case COMMAND_WORD_START:
      case ARRAY_WORD_START:
        if (!braces_only) return context;
        break;
      case SUBSCRIPT_OPEN:
      case EXTGLOB_OPEN:
        break;
      default:
        if (!is_word_piece_opener(context->opener)) return NULL;
    }
  }
  return NULL;
}

static bool
brace_suppressed(const struct Scanner *scanner, const TSLexer *lexer) {
  const struct SourceContext *word = word_source_context(scanner, true);
  return word != NULL &&
    lexer_raw_position(lexer) < word->brace_suppressed_remaining;
}

static bool
brace_boundary(const struct Scanner *scanner, const TSLexer *lexer) {
  if (brace_suppressed(scanner, lexer)) return false;
  int32_t character = lexer->lookahead;
  enum TokenType context = pattern_context(scanner);
  return (context == BRACE_OPEN && character == ',') ||
    ((context == BRACE_OPEN || context == BRACE_LITERAL_OPEN) &&
      character == '}');
}

static bool scan_brace_expansion(
  const struct Scanner *scanner,
  TSLexer *lexer,
  bool *nested_parentheses
);

static bool word_region_contains(
  const struct SourceContext *context,
  const TSLexer *lexer
) {
  if (
    context == NULL ||
    context->word_remaining == 0 ||
    lexer_at_eof(lexer) ||
    lexer->lookahead == SOURCE_BACKQUOTE_BOUNDARY
  )
    return false;
  if (lexer->advance == logical_advance)
    return ((const struct LogicalLexer *)lexer)->consumed <
      context->word_remaining;
  if (lexer->advance == lookahead_advance) {
    const struct LookaheadLexer *probe = (const struct LookaheadLexer *)lexer;
    return probe->length > 0 &&
      probe->characters[probe->position].raw_cut < context->word_remaining;
  }
  return false;
}

static bool
bracket_word_contains(const struct Scanner *scanner, const TSLexer *lexer) {
  return word_region_contains(word_source_context(scanner, false), lexer);
}

static bool
bracket_payload_contains(const struct Scanner *scanner, const TSLexer *lexer) {
  const struct SourceContext *context = word_source_context(scanner, false);
  return context != NULL &&
    !context->pattern_region &&
    !context->raw_argument &&
    word_region_contains(context, lexer);
}

static const struct SourceContext *
raw_word_context(const struct Scanner *scanner) {
  for (size_t count = scanner->context_count; count > 0; count--) {
    const struct SourceContext *context = &scanner->contexts[count - 1];
    if (context->raw_argument)
      return context->word_remaining > 0 ? context : NULL;
    if (!is_word_piece_opener(context->opener)) return NULL;
  }
  return NULL;
}

static bool parameter_pattern_context(const struct Scanner *scanner) {
  enum TokenType context = pattern_context(scanner);
  return context == PARAMETER_OPEN ||
    context == PARAMETER_INDIRECTION_BEGIN ||
    context == PARAMETER_REPLACE_BEGIN ||
    context == REPLACEMENT_SEPARATOR_BEGIN ||
    context == PARAMETER_TILDE_START;
}

static size_t bracket_context_index(const struct Scanner *scanner) {
  size_t count = scanner->context_count;
  if (
    count != 0 &&
    is_bracket_fallback_context(scanner->contexts[count - 1].opener)
  )
    count--;
  return count == 0 ? SIZE_MAX : count - 1;
}

static const struct BracketCache *bracket_cache(const struct Scanner *scanner) {
  size_t index = bracket_context_index(scanner);
  return index == SIZE_MAX ? &scanner->bracket
                           : &scanner->contexts[index].bracket;
}

enum BracketStep {
  BRACKET_STEP_END,
  BRACKET_STEP_PLAIN,
  BRACKET_STEP_MEMBER,
};

/* `close` is the first plain `]` from `close_from`; `closer` is its
   preceding class marker. */
struct BracketScan {
  enum PatternMode mode;
  enum BracketInput opener;
  struct BracketCache cache;
  size_t close_from;
  size_t close;
  size_t closer;
  int32_t closer_marker;
  size_t element;
};

static struct BracketScan bracket_scan(enum PatternMode mode) {
  return (struct BracketScan){
    .mode = mode,
    .close_from = SIZE_MAX,
    .close = SIZE_MAX,
    .closer = SIZE_MAX,
    .element = SIZE_MAX,
  };
}

/* Quoted atoms and brace expansions are opaque members and get consumed;
   plain characters stay at the lexer. */
static enum BracketStep bracket_step(
  const struct Scanner *scanner,
  TSLexer *lexer,
  enum PatternMode mode
) {
  int32_t character = lexer->lookahead;
  if (
    is_bracket_literal_boundary(scanner, lexer, mode) ||
    brace_boundary(scanner, lexer) ||
    (extglob_context(scanner) &&
      !parameter_pattern_context(scanner) &&
      is_one_of(character, "()"))
  )
    return BRACKET_STEP_END;
  enum BracketAtom atom = skip_bracket_quoted_atom(scanner, lexer);
  if (atom == BRACKET_ATOM_END) return BRACKET_STEP_END;
  if (atom == BRACKET_ATOM_MEMBER) return BRACKET_STEP_MEMBER;
  if (character == '{' && word_source_context(scanner, true) != NULL) {
    size_t start = probe_position(lexer);
    if (scan_brace_expansion(scanner, lexer, NULL)) return BRACKET_STEP_MEMBER;
    probe_seek(lexer, start);
  }
  return BRACKET_STEP_PLAIN;
}

static bool class_closer_follows(
  const struct Scanner *scanner,
  TSLexer *lexer,
  struct BracketScan *scan,
  int32_t marker
) {
  if (assignment_tilde_follows(scanner, lexer, scan->mode, marker))
    return false;
  size_t query = lexer_raw_position(lexer);
  if (query < scan->close_from || query > scan->close) {
    size_t start = probe_position(lexer);
    scan->close_from = query;
    scan->close = SIZE_MAX;
    scan->closer = SIZE_MAX;
    for (;;) {
      enum BracketStep step = bracket_step(scanner, lexer, scan->mode);
      if (step == BRACKET_STEP_END) break;
      if (step == BRACKET_STEP_MEMBER) {
        scan->closer = SIZE_MAX;
        continue;
      }
      int32_t character = lexer->lookahead;
      if (character == ']') {
        scan->close = lexer_raw_position(lexer);
        break;
      }
      scan->closer =
        is_one_of(character, ":=") ? lexer_raw_position(lexer) : SIZE_MAX;
      scan->closer_marker = character;
      lexer->advance(lexer, false);
      if (assignment_tilde_follows(scanner, lexer, scan->mode, character))
        break;
    }
    probe_seek(lexer, start);
  }
  return scan->close != SIZE_MAX &&
    scan->closer != SIZE_MAX &&
    scan->closer_marker == marker &&
    scan->closer >= query;
}

static bool collating_closer_follows(
  const struct Scanner *scanner,
  TSLexer *lexer,
  struct BracketScan *scan
) {
  size_t marker = lexer_raw_position(lexer);
  const struct BracketCache *known = bracket_cache(scanner);
  if (
    collating_absent_in(known, marker) ||
    collating_absent_in(&scan->cache, marker)
  )
    return false;
  if (
    collating_closes_in(known, marker) ||
    collating_closes_in(&scan->cache, marker)
  )
    return true;
  size_t start = probe_position(lexer);
  lexer->advance(lexer, false);
  bool marked = false;
  bool found = false;
  while (!assignment_tilde_follows(scanner, lexer, scan->mode, '.')) {
    enum BracketStep step = bracket_step(scanner, lexer, scan->mode);
    if (step == BRACKET_STEP_END) break;
    if (step == BRACKET_STEP_MEMBER) {
      marked = false;
      continue;
    }
    int32_t character = lexer->lookahead;
    if (character == ']' && marked) {
      found = true;
      break;
    }
    marked = character == '.';
    lexer->advance(lexer, false);
    if (assignment_tilde_follows(scanner, lexer, scan->mode, character)) break;
  }
  if (found) {
    scan->cache.collating_closer_from = marker;
    scan->cache.collating_closer_end = lexer_raw_position(lexer);
  } else if (scan->cache.collating_absent_end == 0) {
    scan->cache.collating_absent_start = marker;
    scan->cache.collating_absent_end = lexer_raw_position(lexer);
  }
  probe_seek(lexer, start);
  return found;
}

static enum BracketInput bracket_open_input(
  const struct Scanner *scanner,
  TSLexer *lexer,
  struct BracketScan *scan
) {
  size_t start = probe_position(lexer);
  lexer->advance(lexer, false);
  int32_t marker = lexer->lookahead;
  enum BracketInput input = BRACKET_INPUT_OPEN;
  if (marker == '.') {
    if (collating_closer_follows(scanner, lexer, scan))
      input = BRACKET_INPUT_COLLATING_OPEN;
  } else if (marker == ':' || marker == '=') {
    lexer->advance(lexer, false);
    if (class_closer_follows(scanner, lexer, scan, marker))
      input = BRACKET_INPUT_CLASS_OPEN;
  }
  probe_seek(lexer, start);
  return input;
}

static void scan_bracket_members(
  const struct Scanner *scanner,
  TSLexer *lexer,
  struct BracketScan *scan,
  unsigned phase,
  uint32_t *chains,
  bool *complete,
  bool until_element
) {
  scan->element = SIZE_MAX;
  for (;;) {
    enum BracketStep step = bracket_step(scanner, lexer, scan->mode);
    if (step == BRACKET_STEP_END) break;
    int32_t character = lexer->lookahead;
    enum BracketInput input = step == BRACKET_STEP_MEMBER ? BRACKET_INPUT_MEMBER
      : character == '[' ? bracket_open_input(scanner, lexer, scan)
                         : bracket_input(character);
    unsigned next = bracket_phase_after(phase, input);
    if (
      scan->element == SIZE_MAX &&
      (next == BRACKET_PHASE_OPENED || next == BRACKET_PHASE_RANGE_OPENED)
    ) {
      scan->element = lexer_raw_position(lexer);
      if (until_element) break;
    }
    phase = next;
    *chains = bracket_chains_after(*chains, input);
    if (phase >= BRACKET_PHASE_COUNT) break;
    if (step == BRACKET_STEP_PLAIN) {
      lexer->advance(lexer, false);
      if (assignment_tilde_follows(scanner, lexer, scan->mode, character))
        break;
    }
    if ((*chains & (1u << phase)) != 0) break;
  }
  *complete = phase == BRACKET_PHASE_COMPLETE;
  if (scan->element == SIZE_MAX) scan->element = lexer_raw_position(lexer);
}

static bool scan_pattern_bracket(
  const struct Scanner *scanner,
  TSLexer *lexer,
  struct BracketScan *scan,
  uint32_t *chains,
  bool *complete
) {
  if (lexer->lookahead != '[') return false;
  scan->opener = *chains == 0 ? BRACKET_INPUT_OPEN
                              : bracket_open_input(scanner, lexer, scan);
  lexer->advance(lexer, false);
  size_t opener_end = probe_position(lexer);
  *chains = bracket_chains_after(*chains, scan->opener);
  scan_bracket_members(
    scanner,
    lexer,
    scan,
    BRACKET_PHASE_NEGATION,
    chains,
    complete,
    false
  );
  size_t end = probe_position(lexer);
  probe_seek(lexer, opener_end);
  lexer->mark_end(lexer);
  probe_seek(lexer, end);
  return true;
}

static enum PatternMode
pattern_mode(const struct Scanner *scanner, bool parameter, bool assignment) {
  switch (pattern_context(scanner)) {
    case PARAMETER_REPLACE_BEGIN:
      return PATTERN_REPLACEMENT;
    case ASSIGNMENT_TILDE_START:
      return PATTERN_ASSIGNMENT_TILDE;
    case WORD_TILDE_START:
      return PATTERN_WORD_TILDE;
    case PARAMETER_TILDE_START:
      return PATTERN_PARAMETER_TILDE;
    default:
      return parameter ? PATTERN_PARAMETER
        : assignment   ? PATTERN_ASSIGNMENT
                       : PATTERN_WORD;
  }
}

/* Cache omission affects performance only. */
static void record_bracket_scan(
  struct Scanner *scanner,
  const struct BracketScan *scan,
  bool element
) {
  size_t index = bracket_context_index(scanner);
  struct BracketCache *cache =
    index == SIZE_MAX ? &scanner->bracket : &scanner->contexts[index].bracket;
  struct BracketCache saved = *cache;
  if (scan->cache.collating_absent_end != 0) {
    cache->collating_absent_start = scan->cache.collating_absent_start;
    cache->collating_absent_end = scan->cache.collating_absent_end;
  }
  if (scan->cache.collating_closer_end != 0) {
    cache->collating_closer_from = scan->cache.collating_closer_from;
    cache->collating_closer_end = scan->cache.collating_closer_end;
  }
  if (element) cache->element_remaining = scan->element + 1;
  if (!scanner_state_fits(scanner)) *cache = saved;
}

static bool scan_pattern_bracket_hyphen(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  lexer->advance(lexer, false);
  lexer->mark_end(lexer);
  enum TokenType symbol = PATTERN_BRACKET_HYPHEN;
  if (
    valid[PATTERN_BRACKET_RANGE_OPERATOR] &&
    !pattern_boundary(
      scanner,
      lexer,
      valid[PARAMETER_PATTERN_BRACKET_CHARACTER] ||
        parameter_pattern_context(scanner)
    ) &&
    lexer->lookahead != ']'
  ) {
    symbol = PATTERN_BRACKET_RANGE_OPERATOR;
  }
  if (!valid[symbol]) {
    return false;
  }
  lexer->result_symbol = (TSSymbol)symbol;
  return true;
}

static bool scan_pattern_bracket_character(
  struct Scanner *scanner,
  TSLexer *lexer,
  enum TokenType symbol
) {
  int32_t character = lexer->lookahead;
  if (
    is_one_of(character, "[]-!^*?:.=\\") ||
    is_quote_or_expansion_start(character) ||
    pattern_boundary(
      scanner,
      lexer,
      symbol == PARAMETER_PATTERN_BRACKET_CHARACTER ||
        parameter_pattern_context(scanner)
    )
  ) {
    return false;
  }
  if (character == '\n' && scanner->active.documents.count > 0) {
    scanner->active.at_line_start = true;
  }
  return accept_character(lexer, symbol);
}

enum ParameterQuoteState {
  PARAMETER_QUOTE_START,
  PARAMETER_QUOTE_PREFIX,
  PARAMETER_QUOTE_NAME,
  PARAMETER_QUOTE_POSITIONAL,
  PARAMETER_QUOTE_SUBSCRIPT,
  PARAMETER_QUOTE_OPERATOR,
  PARAMETER_QUOTE_COLON,
  PARAMETER_QUOTE_WORD,
  PARAMETER_QUOTE_ERROR,
  PARAMETER_QUOTE_PATTERN,
  PARAMETER_QUOTE_ARITHMETIC,
};

struct ParameterQuote {
  enum ParameterQuoteState state;
  size_t subscript_depth;
};

static bool
parameter_quote_step(struct ParameterQuote *quote, int32_t character) {
  switch (quote->state) {
    case PARAMETER_QUOTE_START:
    case PARAMETER_QUOTE_PREFIX:
      if (
        quote->state == PARAMETER_QUOTE_START &&
        (character == '#' || character == '!')
      ) {
        quote->state = PARAMETER_QUOTE_PREFIX;
        return true;
      }
      if (is_name_start_character(character)) {
        quote->state = PARAMETER_QUOTE_NAME;
        return true;
      }
      if (is_decimal_digit(character)) {
        quote->state = PARAMETER_QUOTE_POSITIONAL;
        return true;
      }
      if (
        !is_one_of(character, "#%") && is_special_parameter_character(character)
      ) {
        quote->state = PARAMETER_QUOTE_OPERATOR;
        return true;
      }
      break;
    case PARAMETER_QUOTE_NAME:
      if (is_name_character(character)) return true;
      if (character == '[') {
        quote->state = PARAMETER_QUOTE_SUBSCRIPT;
        quote->subscript_depth = 1;
        return true;
      }
      break;
    case PARAMETER_QUOTE_POSITIONAL:
      if (is_decimal_digit(character)) return true;
      break;
    case PARAMETER_QUOTE_SUBSCRIPT:
      if (character == '[') {
        if (quote->subscript_depth == SIZE_MAX) return false;
        quote->subscript_depth++;
      } else if (character == ']' && --quote->subscript_depth == 0) {
        quote->state = PARAMETER_QUOTE_OPERATOR;
      }
      return true;
    case PARAMETER_QUOTE_COLON:
      quote->state = character == '?' ? PARAMETER_QUOTE_ERROR
        : is_one_of(character, "-+=") ? PARAMETER_QUOTE_WORD
                                      : PARAMETER_QUOTE_ARITHMETIC;
      return true;
    case PARAMETER_QUOTE_OPERATOR:
      break;
    case PARAMETER_QUOTE_WORD:
    case PARAMETER_QUOTE_ERROR:
    case PARAMETER_QUOTE_PATTERN:
    case PARAMETER_QUOTE_ARITHMETIC:
      return true;
  }
  quote->state = character == ':'    ? PARAMETER_QUOTE_COLON
    : character == '?'               ? PARAMETER_QUOTE_ERROR
    : is_one_of(character, "#%/^,~") ? PARAMETER_QUOTE_PATTERN
                                     : PARAMETER_QUOTE_WORD;
  return true;
}

static bool parameter_inherits_quotes(const struct ParameterQuote *quote) {
  return quote->state != PARAMETER_QUOTE_PATTERN &&
    quote->state != PARAMETER_QUOTE_SUBSCRIPT &&
    quote->state != PARAMETER_QUOTE_ARITHMETIC;
}

enum CommandWordHead {
  COMMAND_WORD_OTHER,
  COMMAND_WORD_NAME,
  COMMAND_WORD_SUBSCRIPT,
  COMMAND_WORD_APPEND,
  COMMAND_WORD_ASSIGNMENT,
};

struct CommandWord {
  char text[8];
  uint8_t length;
  bool active;
  bool candidate;
  bool digits;
  bool name;
  enum CommandWordHead head;
};

enum CommandPosition {
  COMMAND_POSITION_START,
  COMMAND_POSITION_REDIRECT_PREFIX,
  COMMAND_POSITION_ASSIGNMENT_PREFIX,
  COMMAND_POSITION_SCALAR_PREFIX,
  COMMAND_POSITION_WORD,
  COMMAND_POSITION_CLOSED,
  COMMAND_POSITION_FOR_NAME,
  COMMAND_POSITION_FOR_IN,
  COMMAND_POSITION_PIPE_COMMAND,
  COMMAND_POSITION_TIME_OPTION,
  COMMAND_POSITION_TIME_END,
  COMMAND_POSITION_FUNCTION_NAME,
  COMMAND_POSITION_COPROC_NAME,
  COMMAND_POSITION_COPROC_COMMAND,
};

struct CommandTracker {
  struct CommandWord word;
  enum CommandPosition position;
  bool redirect_operand;
  bool function_name;
};

enum CaseTrackerState {
  CASE_TRACKER_EXPECT_WORD,
  CASE_TRACKER_EXPECT_IN,
  CASE_TRACKER_EXPECT_PATTERN,
  CASE_TRACKER_IN_PATTERN,
  CASE_TRACKER_BODY,
};

struct CaseTracker {
  size_t depth;
  uint8_t state;
};

static bool case_tracker_in_pattern(uint8_t state) {
  return (
    state == CASE_TRACKER_EXPECT_PATTERN || state == CASE_TRACKER_IN_PATTERN
  );
}

struct CaseTrackerBuffer {
  struct CaseTracker *data;
  size_t length;
  size_t capacity;
  bool failed;
};

static struct CaseTracker *
active_case_tracker(const struct CaseTrackerBuffer *cases, size_t depth) {
  if (cases->length == 0) {
    return NULL;
  }
  struct CaseTracker *tracker = &cases->data[cases->length - 1];
  return tracker->depth == depth ? tracker : NULL;
}

static void
pop_case_trackers_at_depth(struct CaseTrackerBuffer *cases, size_t depth) {
  while (cases->length > 0 && cases->data[cases->length - 1].depth >= depth) {
    cases->length -= 1;
  }
}

enum CaseWordKind {
  CASE_WORD_GENERIC,
  CASE_WORD_IN,
  CASE_WORD_ESAC,
  CASE_WORD_CASE,
  CASE_WORD_FOR,
  CASE_WORD_DO,
  CASE_WORD_TIME,
  CASE_WORD_TIME_OPTION,
  CASE_WORD_TIME_END,
  CASE_WORD_FUNCTION,
  CASE_WORD_COPROC,
  CASE_WORD_COMMAND_CLOSE,
  CASE_WORD_COMMAND_PREFIX,
};

struct CaseWord {
  const char *text;
  enum CaseWordKind kind;
};

static const struct CaseWord CASE_WORDS[] = {
  {"in", CASE_WORD_IN},
  {"esac", CASE_WORD_ESAC},
  {"case", CASE_WORD_CASE},
  {"for", CASE_WORD_FOR},
  {"select", CASE_WORD_FOR},
  {"do", CASE_WORD_DO},
  {"time", CASE_WORD_TIME},
  {"-p", CASE_WORD_TIME_OPTION},
  {"--", CASE_WORD_TIME_END},
  {"function", CASE_WORD_FUNCTION},
  {"coproc", CASE_WORD_COPROC},
  {"fi", CASE_WORD_COMMAND_CLOSE},
  {"done", CASE_WORD_COMMAND_CLOSE},
  {"}", CASE_WORD_COMMAND_CLOSE},
  {"!", CASE_WORD_COMMAND_PREFIX},
  {"{", CASE_WORD_COMMAND_PREFIX},
  {"if", CASE_WORD_COMMAND_PREFIX},
  {"then", CASE_WORD_COMMAND_PREFIX},
  {"elif", CASE_WORD_COMMAND_PREFIX},
  {"else", CASE_WORD_COMMAND_PREFIX},
  {"while", CASE_WORD_COMMAND_PREFIX},
  {"until", CASE_WORD_COMMAND_PREFIX},
};

static enum CaseWordKind classify_case_word(const char *word) {
  for (size_t index = 0; index < ARRAY_COUNT(CASE_WORDS); index += 1) {
    if (strcmp(word, CASE_WORDS[index].text) == 0) {
      return CASE_WORDS[index].kind;
    }
  }
  return CASE_WORD_GENERIC;
}

enum CaseTrackerNote {
  CASE_TRACKER_NOTE_WORD,
  CASE_TRACKER_NOTE_COMMAND_PREFIX,
  CASE_TRACKER_NOTE_END,
  CASE_TRACKER_NOTE_BEGIN,
};

static enum CaseTrackerNote case_tracker_note_word(
  struct CaseTracker *tracker,
  enum CaseWordKind kind,
  bool at_command_start
) {
  if (tracker != NULL && tracker->state != CASE_TRACKER_BODY) {
    switch (tracker->state) {
      case CASE_TRACKER_EXPECT_WORD:
        tracker->state = CASE_TRACKER_EXPECT_IN;
        break;
      case CASE_TRACKER_EXPECT_IN:
        if (kind == CASE_WORD_IN) {
          tracker->state = CASE_TRACKER_EXPECT_PATTERN;
        }
        break;
      case CASE_TRACKER_EXPECT_PATTERN:
        if (kind == CASE_WORD_ESAC) {
          return CASE_TRACKER_NOTE_END;
        }
        tracker->state = CASE_TRACKER_IN_PATTERN;
        break;
      default:
        break;
    }
    return CASE_TRACKER_NOTE_WORD;
  }

  if (!at_command_start) {
    return CASE_TRACKER_NOTE_WORD;
  }
  if (kind == CASE_WORD_ESAC && tracker != NULL) {
    return CASE_TRACKER_NOTE_END;
  }
  if (kind == CASE_WORD_COMMAND_PREFIX || kind == CASE_WORD_DO) {
    return CASE_TRACKER_NOTE_COMMAND_PREFIX;
  }
  if (kind == CASE_WORD_CASE) {
    return CASE_TRACKER_NOTE_BEGIN;
  }
  return CASE_TRACKER_NOTE_WORD;
}

static bool append_case_tracker(struct CaseTrackerBuffer *cases, size_t depth) {
  struct CaseTracker *data = source_grow(
    cases->data,
    &cases->capacity,
    cases->length + 1,
    sizeof(struct CaseTracker)
  );
  if (data == NULL) {
    cases->failed = true;
    return false;
  }
  cases->data = data;
  cases->data[cases->length] = (struct CaseTracker){
    .depth = depth,
    .state = CASE_TRACKER_EXPECT_WORD,
  };
  cases->length += 1;
  return true;
}

static bool is_delimiter_word_character(int32_t character) {
  return (
    (character >= 'A' && character <= 'Z') ||
    (character >= 'a' && character <= 'z') ||
    (character >= '0' && character <= '9') ||
    character == '-' ||
    character == '_' ||
    character == '!' ||
    character == '{' ||
    character == '}'
  );
}

static void reset_command_word(struct CommandWord *word) {
  word->length = 0;
  word->active = false;
  word->candidate = true;
  word->digits = true;
  word->name = true;
  word->head = COMMAND_WORD_OTHER;
}

static void reset_command_position(
  struct CommandTracker *command,
  enum CommandPosition position
) {
  reset_command_word(&command->word);
  command->position = position;
  command->redirect_operand = false;
  command->function_name = false;
}

static bool command_assignment_position(enum CommandPosition position) {
  return position == COMMAND_POSITION_START ||
    position == COMMAND_POSITION_REDIRECT_PREFIX ||
    position == COMMAND_POSITION_ASSIGNMENT_PREFIX ||
    position == COMMAND_POSITION_CLOSED ||
    position == COMMAND_POSITION_PIPE_COMMAND ||
    position == COMMAND_POSITION_TIME_OPTION ||
    position == COMMAND_POSITION_TIME_END ||
    position == COMMAND_POSITION_COPROC_NAME ||
    position == COMMAND_POSITION_COPROC_COMMAND;
}

static bool command_reserved_position(enum CommandPosition position) {
  return command_assignment_position(position) &&
    position != COMMAND_POSITION_REDIRECT_PREFIX &&
    position != COMMAND_POSITION_ASSIGNMENT_PREFIX;
}

static bool finish_prefix_word(
  struct CommandTracker *command,
  enum CaseWordKind kind,
  enum CommandPosition position
) {
  if (position == COMMAND_POSITION_FUNCTION_NAME) {
    reset_command_position(command, COMMAND_POSITION_START);
    command->function_name = true;
    return true;
  }
  if (
    position == COMMAND_POSITION_TIME_OPTION && kind == CASE_WORD_TIME_OPTION
  ) {
    reset_command_position(command, COMMAND_POSITION_TIME_END);
    return true;
  }
  if (
    (position == COMMAND_POSITION_TIME_OPTION ||
      position == COMMAND_POSITION_TIME_END) &&
    kind == CASE_WORD_TIME_END
  ) {
    reset_command_position(command, COMMAND_POSITION_START);
    return true;
  }
  return false;
}

static void place_command_word(
  struct CommandTracker *command,
  enum CaseWordKind kind,
  enum CommandPosition position,
  bool coproc
) {
  const struct CommandWord *word = &command->word;
  if (position == COMMAND_POSITION_FOR_NAME) {
    command->position = COMMAND_POSITION_FOR_IN;
  } else if (position == COMMAND_POSITION_FOR_IN) {
    if (kind == CASE_WORD_DO) {
      command->position = COMMAND_POSITION_START;
    }
  } else if (!command_reserved_position(position)) {
    return;
  } else if (kind == CASE_WORD_FOR) {
    command->position = COMMAND_POSITION_FOR_NAME;
  } else if (
    kind == CASE_WORD_TIME &&
    !coproc &&
    position != COMMAND_POSITION_PIPE_COMMAND
  ) {
    command->position = COMMAND_POSITION_TIME_OPTION;
  } else if (kind == CASE_WORD_FUNCTION && !coproc) {
    command->position = COMMAND_POSITION_FUNCTION_NAME;
  } else if (kind == CASE_WORD_COPROC && !coproc) {
    command->position = COMMAND_POSITION_COPROC_NAME;
  } else if (kind == CASE_WORD_COMMAND_CLOSE) {
    command->position = COMMAND_POSITION_CLOSED;
  } else if (position == COMMAND_POSITION_COPROC_NAME) {
    command->position = COMMAND_POSITION_COPROC_COMMAND;
  } else {
    command->function_name = word->name || word->head == COMMAND_WORD_SUBSCRIPT;
  }
}

static bool finish_command_word(
  struct CaseTrackerBuffer *cases,
  size_t depth,
  struct CommandTracker *command,
  bool before_redirect
) {
  struct CommandWord *word = &command->word;
  if (!word->active) {
    reset_command_word(word);
    return true;
  }
  if (word->digits && before_redirect) {
    reset_command_word(word);
    return true;
  }
  command->function_name = false;
  if (command->redirect_operand) {
    command->redirect_operand = false;
    reset_command_word(word);
    return true;
  }

  char text[sizeof(word->text) + 1] = {0};
  if (word->candidate) {
    memcpy(text, word->text, word->length);
  }
  enum CaseWordKind kind =
    word->candidate ? classify_case_word(text) : CASE_WORD_GENERIC;
  struct CaseTracker *tracker = active_case_tracker(cases, depth);
  bool in_case_header = tracker != NULL && tracker->state != CASE_TRACKER_BODY;
  enum CommandPosition position = command->position;
  if (!in_case_header && finish_prefix_word(command, kind, position)) {
    return true;
  }
  bool coproc = position == COMMAND_POSITION_COPROC_NAME ||
    position == COMMAND_POSITION_COPROC_COMMAND;
  bool assignment_position = command_assignment_position(position);
  bool at_command_start = command_reserved_position(position);
  if (
    (assignment_position || position == COMMAND_POSITION_SCALAR_PREFIX) &&
    !in_case_header &&
    word->head == COMMAND_WORD_ASSIGNMENT
  ) {
    reset_command_position(
      command,
      position == COMMAND_POSITION_SCALAR_PREFIX
        ? COMMAND_POSITION_SCALAR_PREFIX
        : COMMAND_POSITION_ASSIGNMENT_PREFIX
    );
    return true;
  }
  command->position = COMMAND_POSITION_WORD;
  switch (case_tracker_note_word(tracker, kind, at_command_start)) {
    case CASE_TRACKER_NOTE_COMMAND_PREFIX:
      command->position = COMMAND_POSITION_START;
      break;
    case CASE_TRACKER_NOTE_END:
      cases->length -= 1;
      command->position = COMMAND_POSITION_CLOSED;
      break;
    case CASE_TRACKER_NOTE_BEGIN:
      if (!append_case_tracker(cases, depth)) {
        return false;
      }
      break;
    default:
      if (!in_case_header) {
        place_command_word(command, kind, position, coproc);
      }
      break;
  }
  reset_command_word(word);
  return true;
}

static void begin_command_redirect(struct CommandTracker *command) {
  if (command->position == COMMAND_POSITION_ASSIGNMENT_PREFIX)
    command->position = COMMAND_POSITION_SCALAR_PREFIX;
  else if (command_assignment_position(command->position))
    command->position = COMMAND_POSITION_REDIRECT_PREFIX;
  command->redirect_operand = true;
  command->function_name = false;
}

static void
track_command_word_character(struct CommandWord *word, int32_t character) {
  if (!word->active) {
    reset_command_word(word);
    word->name = is_name_start_character(character);
    word->head = word->name ? COMMAND_WORD_NAME : COMMAND_WORD_OTHER;
    word->active = true;
  } else {
    if (
      character == '=' &&
      (word->head == COMMAND_WORD_NAME ||
        word->head == COMMAND_WORD_SUBSCRIPT ||
        word->head == COMMAND_WORD_APPEND)
    )
      word->head = COMMAND_WORD_ASSIGNMENT;
    else if (
      character == '+' &&
      (word->head == COMMAND_WORD_NAME || word->head == COMMAND_WORD_SUBSCRIPT)
    )
      word->head = COMMAND_WORD_APPEND;
    else if (
      word->head != COMMAND_WORD_ASSIGNMENT &&
      !(word->head == COMMAND_WORD_NAME && is_name_character(character))
    )
      word->head = COMMAND_WORD_OTHER;
    if (!is_name_character(character)) word->name = false;
  }
  if (!is_decimal_digit(character)) {
    word->digits = false;
  }

  if (!is_delimiter_word_character(character)) {
    word->candidate = false;
    return;
  }

  if (word->length < sizeof(word->text)) {
    word->text[word->length] = (char)character;
    word->length += 1;
  } else {
    word->candidate = false;
  }
}

static uint8_t hexadecimal_value(int32_t character) {
  if (character >= '0' && character <= '9') {
    return (uint8_t)(character - '0');
  }

  if (character >= 'A' && character <= 'F') {
    return (uint8_t)(character - 'A' + 10);
  }

  return (uint8_t)(character - 'a' + 10);
}

static bool
scan_hexadecimal_escape(TSLexer *lexer, struct ByteBuffer *delimiter) {
  lexer->advance(lexer, false);
  if (!is_hexadecimal_digit(lexer->lookahead)) {
    return append_byte(delimiter, '\\') && append_byte(delimiter, 'x');
  }
  uint8_t value = 0;
  unsigned digits = 0;
  while (digits++ < 2 && is_hexadecimal_digit(lexer->lookahead)) {
    value = (uint8_t)((value << 4) | hexadecimal_value(lexer->lookahead));
    lexer->advance(lexer, false);
  }
  return append_byte(delimiter, value);
}

static bool scan_unicode_escape(
  TSLexer *lexer,
  struct ByteBuffer *delimiter,
  int32_t introducer
) {
  unsigned limit = introducer == 'u' ? 4 : 8;
  uint32_t value = 0;
  lexer->advance(lexer, false);
  unsigned digits = 0;
  while (digits < limit && is_hexadecimal_digit(lexer->lookahead)) {
    value = (value << 4) | hexadecimal_value(lexer->lookahead);
    digits++;
    lexer->advance(lexer, false);
  }
  if (digits == 0)
    return append_byte(delimiter, '\\') &&
      append_codepoint(delimiter, introducer);
  return delimiter == NULL || append_codepoint(delimiter, (int32_t)value);
}

static bool scan_octal_escape(TSLexer *lexer, struct ByteBuffer *delimiter) {
  uint8_t value = 0;
  uint8_t digits = 0;
  while (digits < 3 && lexer->lookahead >= '0' && lexer->lookahead <= '7') {
    value = (uint8_t)((value << 3) | (lexer->lookahead - '0'));
    digits += 1;
    lexer->advance(lexer, false);
  }
  return append_byte(delimiter, value);
}

static bool scan_control_escape(TSLexer *lexer, struct ByteBuffer *delimiter) {
  lexer->advance(lexer, false);
  if (lexer_at_eof(lexer) || lexer->lookahead == SOURCE_BACKQUOTE_BOUNDARY) {
    return false;
  }
  if (lexer->lookahead == '\'') {
    return append_byte(delimiter, '\\') && append_byte(delimiter, 'c');
  }
  int32_t control_character = lexer->lookahead;
  lexer->advance(lexer, false);
  uint8_t bytes[4];
  size_t length;
  if (!encode_utf8_scalar(control_character, bytes, &length)) {
    return false;
  }
  bytes[0] = bytes[0] == '?' ? UINT8_C(0x7f) : bytes[0] & UINT8_C(0x1f);
  if (!append_bytes(delimiter, bytes, length)) {
    return false;
  }
  if (control_character != '\\') {
    return true;
  }
  if (lexer_at_eof(lexer) || lexer->lookahead == SOURCE_BACKQUOTE_BOUNDARY) {
    return false;
  }
  int32_t escaped = lexer->lookahead;
  lexer->advance(lexer, false);
  return escaped == '\\' ||
    delimiter == NULL ||
    append_codepoint(delimiter, escaped);
}

static bool
scan_dollar_single_quote_escape(TSLexer *lexer, struct ByteBuffer *delimiter) {
  int32_t character = lexer->lookahead;
  if (lexer_at_eof(lexer) || character == SOURCE_BACKQUOTE_BOUNDARY) {
    return false;
  }
  if (character == 'x') {
    return scan_hexadecimal_escape(lexer, delimiter);
  }
  if (character == 'u' || character == 'U') {
    return scan_unicode_escape(lexer, delimiter, character);
  }
  if (character >= '0' && character <= '7') {
    return scan_octal_escape(lexer, delimiter);
  }
  if (character == 'c') {
    return scan_control_escape(lexer, delimiter);
  }
  lexer->advance(lexer, false);
  return append_quoted_escape(delimiter, character);
}

enum HereDocumentLineKind {
  HERE_DOCUMENT_LINE_DELIMITER,
  HERE_DOCUMENT_LINE_LAYOUT,
  HERE_DOCUMENT_LINE_CONTENT,
  HERE_DOCUMENT_LINE_END_OF_INPUT,
  HERE_DOCUMENT_LINE_INVALID,
};

struct CommandStart {
  int32_t first_character;
  int32_t second_character;
  char first_word[RESERVED_WORD_LENGTH + 1];
  bool first_is_delimited;
  bool first_word_is_reserved_candidate;
};

static bool match_here_document_delimiter_character(
  const struct HereDocument *document,
  size_t *offset,
  int32_t character
) {
  uint8_t bytes[4];
  size_t length;
  if (
    !encode_utf8_scalar(character, bytes, &length) ||
    length > document->delimiter_length - *offset ||
    memcmp(document->delimiter + *offset, bytes, length) != 0
  ) {
    return false;
  }
  *offset += length;
  return true;
}

static bool
stripped_tabs_end_input(const struct LogicalLexer *view, size_t line_start) {
  size_t count = view->cursor.removal_count;
  if (view->result != SOURCE_END || count == 0) {
    return false;
  }
  const struct SourceRemoval *removal = &view->cursor.removals[count - 1];
  return removal->kind == SOURCE_REMOVED_TAB &&
    view->base + (size_t)removal->origin.start >= line_start;
}

struct HereDocumentBoundary {
  struct LogicalLexer view;
  const struct HereDocument *document;
  size_t context;
  size_t frame;
  size_t end;
  bool at_line_start;
  bool matched;
};

struct HereDocumentInput {
  struct HereDocumentBoundary *boundaries;
  size_t count;
  struct HereDocumentBoundary *end;
};

static void here_document_input_clear(struct HereDocumentInput *input) {
  for (size_t index = 0; index < input->count; index += 1) {
    logical_clear(&input->boundaries[index].view);
  }
  ts_free(input->boundaries);
  *input = (struct HereDocumentInput){0};
}

static bool here_document_input_init(
  struct HereDocumentInput *input,
  struct NativeInput *native,
  const struct Scanner *scanner
) {
  *input = (struct HereDocumentInput){0};
  if (
    scanner->active.documents.count == 0 && scanner->suspended_frame_count == 0
  ) {
    return true;
  }
  if (scanner->suspended_frame_count >= SIZE_MAX / sizeof(*input->boundaries)) {
    goto failure;
  }
  input->boundaries =
    ts_calloc(scanner->suspended_frame_count + 1, sizeof(*input->boundaries));
  if (input->boundaries == NULL) {
    goto failure;
  }
  size_t frame = 0;
  for (size_t index = 0; index < scanner->context_count; index += 1) {
    const struct SourceContext *context = &scanner->contexts[index];
    if (!is_here_document_context(context->opener)) {
      continue;
    }
    size_t document_frame = frame++;
    const struct HereDocument *document;
    if (document_frame < scanner->suspended_frame_count) {
      document = scanner->suspended_frames[document_frame].documents.data;
    } else if (
      document_frame == scanner->suspended_frame_count &&
      scanner->active.documents.count > 0
    ) {
      document = scanner->active.documents.data;
    } else {
      goto failure;
    }
    if (document->ending) {
      continue;
    }
    struct SourceSnapshot snapshot = scanner->source;
    snapshot.stage_count = context->stage_count + 2;
    if (snapshot.stage_count > scanner->source.stage_count) {
      goto failure;
    }
    struct HereDocumentBoundary *boundary = &input->boundaries[input->count];
    *boundary = (struct HereDocumentBoundary){
      .document = document,
      .context = index,
      .frame = document_frame,
      .at_line_start = snapshot.stages[snapshot.stage_count - 1].at_line_start,
    };
    if (!logical_init_at(&boundary->view, native, &snapshot, 0, false)) {
      goto failure;
    }
    input->count += 1;
  }
  return true;

failure:
  here_document_input_clear(input);
  return false;
}

static void here_document_boundary_advance(struct HereDocumentBoundary *bound) {
  bound->at_line_start = bound->view.lexer.lookahead == '\n';
  bound->view.lexer.advance(&bound->view.lexer, false);
}

static enum SourceResult here_document_boundary_read(
  struct HereDocumentBoundary *bound,
  size_t position
) {
  struct LogicalLexer *view = &bound->view;
  while (!bound->matched && position >= view->consumed) {
    if (view->result == SOURCE_FAILURE) {
      return SOURCE_FAILURE;
    }
    if (bound->at_line_start) {
      size_t start = view->consumed;
      size_t offset = 0;
      bool matches = true;
      while (
        view->result == SOURCE_CHARACTER &&
        view->lexer.lookahead != SOURCE_BACKQUOTE_BOUNDARY &&
        view->lexer.lookahead != '\n' &&
        matches
      ) {
        matches = match_here_document_delimiter_character(
          bound->document,
          &offset,
          view->lexer.lookahead
        );
        here_document_boundary_advance(bound);
      }
      if (view->result == SOURCE_FAILURE) {
        return SOURCE_FAILURE;
      }
      if (
        matches &&
        view->lexer.lookahead != SOURCE_BACKQUOTE_BOUNDARY &&
        offset == bound->document->delimiter_length &&
        (offset > 0 ||
          (view->result == SOURCE_CHARACTER && view->lexer.lookahead == '\n') ||
          stripped_tabs_end_input(view, start))
      ) {
        bound->end = start;
        bound->matched = true;
        break;
      }
      if (position < view->consumed) {
        break;
      }
    }
    if (
      view->result == SOURCE_END ||
      view->lexer.lookahead == SOURCE_BACKQUOTE_BOUNDARY
    ) {
      break;
    }
    here_document_boundary_advance(bound);
  }
  return bound->matched && position >= bound->end ? SOURCE_END
                                                  : SOURCE_CHARACTER;
}

static enum SourceResult
here_document_input_read(void *payload, size_t position) {
  struct HereDocumentInput *input = payload;
  for (size_t index = 0; index < input->count; index++) {
    struct HereDocumentBoundary *bound = &input->boundaries[index];
    enum SourceResult result = here_document_boundary_read(bound, position);
    if (result != SOURCE_CHARACTER) {
      if (result == SOURCE_END) input->end = bound;
      return result;
    }
  }
  return SOURCE_CHARACTER;
}

static bool
newline_starts_pending_document(const struct Scanner *scanner, TSLexer *lexer) {
  return lexer->lookahead == '\n' && has_startable_pending_document(scanner);
}

static bool
document_header_newline_follows(const struct Scanner *scanner, TSLexer *lexer) {
  if (lexer->lookahead == '#') advance_to_comment_end(lexer, NULL);
  return newline_starts_pending_document(scanner, lexer);
}

static bool here_document_source_view(
  struct LogicalLexer *view,
  struct LogicalLexer *input,
  const struct Scanner *scanner,
  const struct HereDocument *document
) {
  if (input == NULL || input->cursor.stage_count == 0) {
    return false;
  }
  if (
    scanner != NULL &&
    scanner->active.documents.count > 0 &&
    document == &scanner->active.documents.data[0]
  ) {
    for (size_t index = scanner->context_count; index > 0; index -= 1) {
      const struct SourceContext *context = &scanner->contexts[index - 1];
      if (
        context->opener == HERE_DOCUMENT_BODY_START ||
        context->opener == QUOTED_HERE_DOCUMENT_BODY_START
      ) {
        struct SourceStage local = source_stage(SOURCE_REMOVE_CONTINUATIONS);
        local.disabled = true;
        return logical_fork(
          view,
          input,
          input->consumed,
          context->stage_count + 2,
          &local,
          1
        );
      }
    }
  }
  struct SourceStage stages[4];
  here_document_body_stages(document, stages);
  return logical_fork(
    view,
    input,
    input->consumed,
    input->cursor.stage_count - 1,
    stages,
    4
  );
}

static bool here_document_line_start(
  struct LogicalLexer *input,
  size_t end,
  struct CommandStart *start
) {
  *start = (struct CommandStart){0};
  struct LogicalLexer view;
  if (!logical_fork(
        &view,
        input,
        input->consumed,
        input->cursor.stage_count,
        NULL,
        0
      )) {
    return false;
  }
  size_t word_length = 0;
  bool has_content = false;
  bool has_second_character = false;
  bool in_word = false;
  bool awaiting_delimiter = false;
  while (
    view.result == SOURCE_CHARACTER &&
    view.base + (size_t)view.character.origin.character < end
  ) {
    int32_t current = view.lexer.lookahead;
    if (current == '\n') {
      break;
    }
    if (has_content && !has_second_character) {
      start->second_character = current;
      has_second_character = true;
    }
    if (!has_content && !is_horizontal_blank(current)) {
      has_content = true;
      start->first_character = current;
      in_word = is_lowercase_letter(current);
      start->first_word_is_reserved_candidate = in_word;
      awaiting_delimiter = !in_word;
      if (in_word) {
        start->first_word[word_length++] = (char)current;
      }
    } else if (in_word) {
      if (is_lowercase_letter(current)) {
        if (word_length < sizeof(start->first_word) - 1) {
          start->first_word[word_length++] = (char)current;
        } else {
          start->first_word_is_reserved_candidate = false;
        }
      } else {
        in_word = false;
        start->first_is_delimited = is_token_delimiter_character(current);
      }
    } else if (awaiting_delimiter) {
      awaiting_delimiter = false;
      start->first_is_delimited = is_token_delimiter_character(current);
    }
    view.lexer.advance(&view.lexer, false);
  }
  if (in_word || awaiting_delimiter) {
    start->first_is_delimited = true;
  }
  bool valid = view.result != SOURCE_FAILURE;
  logical_clear(&view);
  return valid;
}

static enum HereDocumentLineKind read_here_document_line(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const struct HereDocument *document,
  struct ByteBuffer *source,
  struct CommandStart *start
) {
  struct LogicalLexer *input = lookahead_input(lexer);
  if (input == NULL) {
    return HERE_DOCUMENT_LINE_INVALID;
  }
  if (start != NULL) {
    *start = (struct CommandStart){0};
  }
  struct LogicalLexer view;
  if (!here_document_source_view(&view, input, scanner, document)) {
    input->native->failed = true;
    return HERE_DOCUMENT_LINE_INVALID;
  }
  bool empty_final_line = document->delimiter_length == 0 &&
    stripped_tabs_end_input(&view, view.consumed);
  bool at_end = !empty_final_line &&
    (view.result == SOURCE_END ||
      view.lexer.lookahead == SOURCE_BACKQUOTE_BOUNDARY);
  if (at_end) {
    logical_clear(&view);
    return HERE_DOCUMENT_LINE_END_OF_INPUT;
  }
  size_t delimiter_offset = 0;
  bool matches = true;
  while (view.result == SOURCE_CHARACTER) {
    int32_t character = view.lexer.lookahead;
    if (character == SOURCE_BACKQUOTE_BOUNDARY) {
      matches = false;
      break;
    }
    if (character != '\n' && matches) {
      matches = match_here_document_delimiter_character(
        document,
        &delimiter_offset,
        character
      );
    }
    if (!advance_source(&view.lexer, source)) {
      input->native->failed = true;
      logical_clear(&view);
      return HERE_DOCUMENT_LINE_INVALID;
    }
    if (character == '\n' || (!matches && start == NULL && source == NULL)) {
      break;
    }
  }
  size_t end = view.consumed;
  bool valid = view.result != SOURCE_FAILURE &&
    (start == NULL || here_document_line_start(input, end, start));
  logical_clear(&view);
  if (
    !valid ||
    !lookahead_set_stages_at(lexer, end, input->cursor.stage_count, NULL, 0)
  ) {
    input->native->failed = true;
    return HERE_DOCUMENT_LINE_INVALID;
  }
  if (matches && delimiter_offset == document->delimiter_length) {
    return HERE_DOCUMENT_LINE_DELIMITER;
  }
  if (
    start != NULL &&
    (start->first_character == 0 || start->first_character == '#')
  ) {
    return HERE_DOCUMENT_LINE_LAYOUT;
  }
  return HERE_DOCUMENT_LINE_CONTENT;
}

static bool scan_dollar_single_quote_token(TSLexer *lexer) {
  lexer->advance(lexer, false);
  if (!scan_dollar_single_quote_escape(lexer, NULL)) {
    return false;
  }
  return accept_token(lexer, DOLLAR_SINGLE_QUOTE_ESCAPE);
}

static bool scan_delimiter_single_quoted_segment(
  TSLexer *lexer,
  struct ByteBuffer *delimiter,
  bool dollar
) {
  size_t initial_length = delimiter == NULL ? 0 : delimiter->length;
  /* Bash truncates the decoded segment at NUL but validates the rest. */
  size_t truncated = SIZE_MAX;
  bool disabled = lookahead_local_disabled(lexer);
  if (!lookahead_local_policy(lexer, true, true)) {
    return false;
  }
  lexer->advance(lexer, false);
  while (!lexer_at_eof(lexer)) {
    int32_t character = lexer->lookahead;
    if (character == SOURCE_BACKQUOTE_BOUNDARY) return false;
    if (character == '\'') {
      lexer->advance(lexer, false);
      if (truncated != SIZE_MAX) delimiter->length = truncated;
      return lookahead_local_policy(lexer, disabled, true);
    }
    if (dollar && character == '\\') {
      lexer->advance(lexer, false);
      if (!scan_dollar_single_quote_escape(lexer, delimiter)) {
        return false;
      }
      if (
        delimiter != NULL &&
        truncated == SIZE_MAX &&
        delimiter->length > initial_length
      ) {
        char *nul = memchr(
          delimiter->data + initial_length,
          0,
          delimiter->length - initial_length
        );
        if (nul != NULL) truncated = (size_t)(nul - delimiter->data);
      }
      continue;
    }
    if (!append_codepoint(delimiter, character)) {
      return false;
    }
    lexer->advance(lexer, false);
  }
  return false;
}

enum DelimiterReadResult {
  DELIMITER_READ_INVALID,
  DELIMITER_READ_RESOURCE_FAILURE,
  DELIMITER_READ_INCOMPLETE,
  DELIMITER_READ_WORD,
};

static enum ArithmeticValidation skip_word_segment(
  const struct Scanner *scanner,
  TSLexer *lexer,
  bool *quoted,
  bool force_extglob
) {
  while (!is_token_delimiter(lexer)) {
    enum ArithmeticValidation pattern =
      (force_extglob || extglob_enabled(scanner))
      ? skip_extglob_pattern(scanner, lexer, force_extglob)
      : ARITHMETIC_VALIDATION_INVALID;
    if (pattern == ARITHMETIC_VALIDATION_VALID) continue;
    if (pattern != ARITHMETIC_VALIDATION_INVALID) return pattern;
    int32_t character = lexer->lookahead;
    if (character != '\'') lexer->advance(lexer, false);
    if (character == '\\') {
      if (quoted != NULL) *quoted = true;
      if (!lexer_at_eof(lexer) && lexer->lookahead != SOURCE_BACKQUOTE_BOUNDARY)
        lexer->advance(lexer, false);
      continue;
    }
    if (character == '$' && lexer->lookahead == '$') {
      lexer->advance(lexer, false);
      continue;
    }
    if (character == '\'' || (character == '$' && lexer->lookahead == '\'')) {
      if (quoted != NULL) *quoted = true;
      bool dollar = character == '$';
      if (!scan_delimiter_single_quoted_segment(lexer, NULL, dollar))
        return ARITHMETIC_VALIDATION_INCOMPLETE;
      continue;
    }
    char closer = character == '"' || character == '`' ? (char)character
      : character == '$' ? (lexer->lookahead == '('      ? ')'
                               : lexer->lookahead == '{' ? '}'
                               : lexer->lookahead == '[' ? ']'
                                                         : 0)
                         : 0;
    if (closer != 0) {
      if (quoted != NULL && character == '"') *quoted = true;
      if (character == '$') lexer->advance(lexer, false);
      enum ArithmeticValidation result =
        skip_embedded_construct(scanner, lexer, closer, force_extglob);
      if (result != ARITHMETIC_VALIDATION_VALID || lookahead_is_pending(lexer))
        return result;
    }
  }
  return ARITHMETIC_VALIDATION_VALID;
}

static enum ArithmeticValidation skip_process_substitution(
  const struct Scanner *scanner,
  TSLexer *lexer,
  bool force_extglob
) {
  if (!is_one_of(lexer->lookahead, "<>")) return ARITHMETIC_VALIDATION_INVALID;
  size_t position = probe_position(lexer);
  lexer->advance(lexer, false);
  if (lexer->lookahead != '(') {
    probe_seek(lexer, position);
    return ARITHMETIC_VALIDATION_INVALID;
  }
  lexer->advance(lexer, false);
  return skip_embedded_construct(scanner, lexer, ')', force_extglob);
}

static enum ArithmeticValidation skip_command_word(
  const struct Scanner *scanner,
  TSLexer *lexer,
  bool *quoted,
  bool force_extglob
) {
  for (;;) {
    enum ArithmeticValidation result =
      skip_word_segment(scanner, lexer, quoted, force_extglob);
    if (result != ARITHMETIC_VALIDATION_VALID) return result;
    result = skip_process_substitution(scanner, lexer, force_extglob);
    if (result == ARITHMETIC_VALIDATION_INVALID)
      return ARITHMETIC_VALIDATION_VALID;
    if (result != ARITHMETIC_VALIDATION_VALID) return result;
  }
}

struct DelimiterSpelling {
  struct ByteBuffer value;
  bool remove_quotes;
  bool single_quoted;
  bool double_quoted;
  bool escaped;
};

static bool
append_delimiter_byte(struct DelimiterSpelling *spelling, uint8_t character) {
  if (spelling->remove_quotes) {
    if (spelling->escaped) {
      spelling->escaped = false;
      if (spelling->double_quoted && !is_one_of(character, "$`\"\\\n")) {
        if (!append_byte(&spelling->value, '\\')) return false;
      }
    } else if (character == '\'' && !spelling->double_quoted) {
      spelling->single_quoted = !spelling->single_quoted;
      return true;
    } else if (character == '"' && !spelling->single_quoted) {
      spelling->double_quoted = !spelling->double_quoted;
      return true;
    } else if (character == '\\' && !spelling->single_quoted) {
      spelling->escaped = true;
      return true;
    }
  }
  return append_byte(&spelling->value, character);
}

static bool append_delimiter_character(
  struct DelimiterSpelling *spelling,
  int32_t character
) {
  uint8_t bytes[4];
  size_t length;
  if (!encode_utf8_scalar(character, bytes, &length)) return false;
  for (size_t index = 0; index < length; index++) {
    if (!append_delimiter_byte(spelling, bytes[index])) return false;
  }
  return true;
}

static bool append_delimiter_quoted_value(
  struct DelimiterSpelling *spelling,
  TSLexer *lexer,
  bool dollar,
  bool parameter
) {
  struct ByteBuffer value = {0};
  bool complete = scan_delimiter_single_quoted_segment(lexer, &value, dollar);
  bool accepted = complete && !value.failed;
  spelling->value.failed |= value.failed;
  if (accepted && !parameter)
    accepted = append_delimiter_character(spelling, '\'');
  for (size_t index = 0; accepted && index < value.length; index++) {
    uint8_t ch = (uint8_t)value.data[index];
    if (dollar && !parameter && ch == '\'') {
      accepted = append_delimiter_character(spelling, '\'') &&
        append_delimiter_character(spelling, '\\') &&
        append_delimiter_character(spelling, '\'');
    }
    if (accepted) accepted = append_delimiter_byte(spelling, ch);
  }
  if (accepted && !parameter)
    accepted = append_delimiter_character(spelling, '\'');
  ts_free(value.data);
  return accepted;
}

static bool append_delimiter_backquote(
  const struct Scanner *scanner,
  TSLexer *lexer,
  struct DelimiterSpelling *spelling,
  bool force_extglob
) {
  struct LogicalLexer *input = lookahead_input(lexer);
  struct LogicalLexer source;
  if (
    input == NULL ||
    !logical_fork(
      &source,
      input,
      input->consumed,
      input->cursor.stage_count,
      NULL,
      0
    )
  ) {
    probe_fail(lexer);
    return false;
  }
  lexer->advance(lexer, false);
  enum ArithmeticValidation boundary =
    skip_embedded_construct(scanner, lexer, '`', force_extglob);
  if (boundary == ARITHMETIC_VALIDATION_RESOURCE_FAILURE) probe_fail(lexer);
  bool accepted =
    boundary == ARITHMETIC_VALIDATION_VALID && !lookahead_is_pending(lexer);
  if (accepted) {
    size_t end = lookahead_input(lexer)->consumed;
    while (
      accepted && source.result == SOURCE_CHARACTER && source.consumed < end
    ) {
      accepted = append_delimiter_character(spelling, source.lexer.lookahead);
      source.lexer.advance(&source.lexer, false);
    }
    accepted = accepted && source.result != SOURCE_FAILURE;
  }
  if (source.result == SOURCE_FAILURE) probe_fail(lexer);
  logical_clear(&source);
  return accepted;
}

struct DelimiterFrame {
  size_t end;
  struct ParameterQuote parameter_quote;
  bool quoted_parameter;
  bool double_quoted;
  bool inherited_quote;
};

struct DelimiterFrames {
  struct DelimiterFrame *data;
  size_t count;
  size_t capacity;
};

static enum DelimiterReadResult read_delimiter_construct(
  const struct Scanner *scanner,
  TSLexer *lexer,
  struct DelimiterSpelling *spelling,
  bool force_extglob,
  struct DelimiterFrames *frames,
  struct DelimiterFrame *frame,
  int32_t character,
  size_t start,
  bool pattern
) {
  int32_t opener = lexer->lookahead;
  lexer->advance(lexer, false);
  size_t content = probe_position(lexer);
  enum ArithmeticValidation boundary;
  if (pattern) {
    probe_seek(lexer, start);
    boundary = skip_extglob_pattern(scanner, lexer, force_extglob);
  } else {
    boundary = skip_embedded_construct(
      scanner,
      lexer,
      opener == '('     ? ')'
        : opener == '[' ? ']'
                        : '}',
      force_extglob
    );
  }
  if (boundary != ARITHMETIC_VALIDATION_VALID || lookahead_is_pending(lexer)) {
    return boundary == ARITHMETIC_VALIDATION_RESOURCE_FAILURE
      ? DELIMITER_READ_RESOURCE_FAILURE
      : DELIMITER_READ_INVALID;
  }
  size_t nested_end = lookahead_input(lexer)->consumed;
  probe_seek(lexer, content);
  bool braced_command =
    opener == '{' && braced_command_follows(lexer->lookahead);
  struct DelimiterFrame *next = source_grow(
    frames->data,
    &frames->capacity,
    frames->count + 1,
    sizeof(*next)
  );
  if (next == NULL) return DELIMITER_READ_RESOURCE_FAILURE;
  frames->data = next;
  frames->data[frames->count++] = *frame;
  bool inherited_quote =
    frame->inherited_quote || frame->double_quoted || frame->quoted_parameter;
  *frame = (struct DelimiterFrame){
    .end = nested_end,
    .quoted_parameter = inherited_quote && opener == '{' && !braced_command,
    .inherited_quote = inherited_quote,
  };
  bool accepted = append_delimiter_character(spelling, character) &&
    append_delimiter_character(spelling, opener);
  return accepted ? DELIMITER_READ_WORD : DELIMITER_READ_INVALID;
}

static bool
delimiter_frame_rejects(struct DelimiterFrame *frame, int32_t character) {
  return frame->quoted_parameter &&
    !frame->double_quoted &&
    !parameter_quote_step(&frame->parameter_quote, character);
}

static bool
append_delimiter_escape(struct DelimiterSpelling *spelling, TSLexer *lexer) {
  if (!append_delimiter_character(spelling, '\\')) return false;
  if (lexer_at_eof(lexer) || lexer->lookahead == SOURCE_BACKQUOTE_BOUNDARY)
    return true;
  bool accepted = append_delimiter_character(spelling, lexer->lookahead);
  lexer->advance(lexer, false);
  return accepted;
}

static bool delimiter_dollar_step(
  struct DelimiterFrame *frame,
  TSLexer *lexer,
  struct DelimiterSpelling *spelling,
  bool *accepted
) {
  if (lexer->lookahead == '$') {
    if (delimiter_frame_rejects(frame, '$')) {
      *accepted = false;
      return true;
    }
    *accepted = append_delimiter_character(spelling, '$') &&
      append_delimiter_character(spelling, '$');
    lexer->advance(lexer, false);
    return true;
  }
  if (frame->double_quoted) return false;
  if (lexer->lookahead == '\'') {
    bool dollar_parameter = frame->quoted_parameter &&
      frame->parameter_quote.state != PARAMETER_QUOTE_PATTERN;
    *accepted =
      append_delimiter_quoted_value(spelling, lexer, true, dollar_parameter);
    return true;
  }
  return lexer->lookahead == '"';
}

static enum DelimiterReadResult read_delimiter_spelling(
  const struct Scanner *scanner,
  TSLexer *lexer,
  size_t end,
  struct DelimiterSpelling *spelling,
  bool force_extglob
) {
  struct DelimiterFrames frames = {0};
  struct DelimiterFrame frame = {.end = end};
  bool accepted = true;
  enum DelimiterReadResult result = DELIMITER_READ_WORD;
  while (accepted && !lookahead_is_pending(lexer)) {
    if (lookahead_input(lexer)->consumed >= frame.end) {
      if (frames.count == 0) break;
      frame = frames.data[--frames.count];
      continue;
    }
    int32_t character = lexer->lookahead;
    if (delimiter_frame_rejects(&frame, character)) {
      accepted = false;
      break;
    }
    bool parameter = frame.quoted_parameter &&
      parameter_inherits_quotes(&frame.parameter_quote);
    bool quoted = frame.double_quoted || parameter;
    size_t start = probe_position(lexer);
    if (character == '`') {
      accepted =
        append_delimiter_backquote(scanner, lexer, spelling, force_extglob);
      continue;
    }
    lexer->advance(lexer, false);
    if (character == '\\') {
      accepted = append_delimiter_escape(spelling, lexer);
      continue;
    }
    if (character == '\'' && !quoted) {
      probe_seek(lexer, start);
      accepted = append_delimiter_quoted_value(spelling, lexer, false, false);
      continue;
    }
    if (character == '"') frame.double_quoted = !frame.double_quoted;
    if (
      character == '$' &&
      delimiter_dollar_step(&frame, lexer, spelling, &accepted)
    )
      continue;
    bool pattern =
      !quoted && is_extglob_operator(character) && lexer->lookahead == '(';
    bool substitution =
      (character == '$' && is_dollar_group_opener(lexer->lookahead)) ||
      (!quoted && is_one_of(character, "<>") && lexer->lookahead == '(');
    if (pattern || substitution) {
      enum DelimiterReadResult nested = read_delimiter_construct(
        scanner,
        lexer,
        spelling,
        force_extglob,
        &frames,
        &frame,
        character,
        start,
        pattern
      );
      if (nested == DELIMITER_READ_WORD) continue;
      if (nested == DELIMITER_READ_RESOURCE_FAILURE) result = nested;
      accepted = false;
      break;
    }
    accepted = append_delimiter_character(spelling, character);
  }
  ts_free(frames.data);
  if (spelling->escaped)
    accepted = accepted && append_byte(&spelling->value, '\\');
  if (
    result == DELIMITER_READ_RESOURCE_FAILURE ||
    spelling->value.failed ||
    lookahead_has_failed(lexer)
  )
    return DELIMITER_READ_RESOURCE_FAILURE;
  if (lookahead_is_pending(lexer)) return DELIMITER_READ_INCOMPLETE;
  return accepted ? DELIMITER_READ_WORD : DELIMITER_READ_INVALID;
}

static enum DelimiterReadResult read_here_document_delimiter(
  TSLexer *lexer,
  const struct Scanner *scanner,
  bool strip_tabs,
  struct HereDocument *document,
  bool force_extglob
) {
  size_t start = probe_position(lexer);
  bool quoted = false;
  enum ArithmeticValidation boundary =
    skip_command_word(scanner, lexer, &quoted, force_extglob);
  if (boundary != ARITHMETIC_VALIDATION_VALID || lookahead_is_pending(lexer)) {
    if (
      boundary == ARITHMETIC_VALIDATION_RESOURCE_FAILURE ||
      lookahead_has_failed(lexer)
    )
      return DELIMITER_READ_RESOURCE_FAILURE;
    return lexer_at_eof(lexer) || lookahead_is_pending(lexer)
      ? DELIMITER_READ_INCOMPLETE
      : DELIMITER_READ_INVALID;
  }
  size_t end = lookahead_input(lexer)->consumed;
  if (probe_position(lexer) == start) return DELIMITER_READ_INVALID;
  probe_seek(lexer, start);
  struct DelimiterSpelling spelling = {
    .value = {.limit = SCANNER_STATE_CAPACITY},
    .remove_quotes = quoted,
  };
  enum DelimiterReadResult result =
    read_delimiter_spelling(scanner, lexer, end, &spelling, force_extglob);
  if (result != DELIMITER_READ_WORD) {
    ts_free(spelling.value.data);
    return result;
  }
  *document = (struct HereDocument){
    .delimiter = (uint8_t *)spelling.value.data,
    .delimiter_length = spelling.value.length,
    .quoted = quoted,
    .strip_tabs = strip_tabs ||
      (scanner != NULL &&
        scanner->active.documents.count > 0 &&
        scanner->active.documents.data[0].strip_tabs),
  };
  return DELIMITER_READ_WORD;
}

static bool scan_here_document_delimiter(
  struct Scanner *scanner,
  TSLexer *lexer,
  bool strip_tabs
) {
  lexer->mark_end(lexer);
  struct HereDocument document;
  enum DelimiterReadResult result =
    read_here_document_delimiter(lexer, scanner, strip_tabs, &document, false);
  if (result != DELIMITER_READ_WORD) {
    if (result == DELIMITER_READ_RESOURCE_FAILURE) {
      probe_fail(lexer);
    }
    return false;
  }
  if (
    lookahead_is_pending(lexer) || !append_pending_document(scanner, document)
  ) {
    clear_document(&document);
    if (!lookahead_is_pending(lexer)) {
      probe_fail(lexer);
    }
    return false;
  }
  lexer->result_symbol = strip_tabs ? HERE_END_STRIP_BEGIN : HERE_END_BEGIN;
  return true;
}

static bool scan_here_end_commit(TSLexer *lexer) {
  if (!is_token_delimiter(lexer)) {
    return false;
  }

  return accept_token(lexer, HERE_END_COMMIT);
}

static bool reserved_word_delimiter(TSLexer *lexer) {
  if (!is_token_delimiter(lexer)) return false;
  if (!is_one_of(lexer->lookahead, "<>")) return true;
  if (lexer->advance == logical_advance)
    return logical_peek((struct LogicalLexer *)lexer) != '(';
  size_t position = probe_position(lexer);
  lexer->advance(lexer, false);
  bool delimiter = lexer->lookahead != '(';
  probe_seek(lexer, position);
  return delimiter;
}

static bool scan_delimited_character_token(
  TSLexer *lexer,
  enum TokenType symbol,
  bool extglob
) {
  return accept_character(lexer, symbol) &&
    reserved_word_delimiter(lexer) &&
    !(symbol == PIPELINE_NEGATION && extglob && lexer->lookahead == '(');
}

static bool classify_reserved_word(
  const char *word,
  const bool *valid_symbols,
  TSSymbol *symbol
) {
  const struct ReservedWord *reserved_word = find_reserved_word(word);
  if (reserved_word == NULL || !valid_symbols[reserved_word->symbol]) {
    return false;
  }

  *symbol = (TSSymbol)reserved_word->symbol;
  return true;
}

static bool
reserved_as_command(const struct ReservedWord *word, const bool *valid) {
  return word != NULL && (word->symbol != TIME_KEYWORD || valid[TIME_KEYWORD]);
}

static bool
read_reserved_word(TSLexer *lexer, char *word, const bool *valid_symbols) {
  unsigned length = 0;

  while (is_lowercase_letter(lexer->lookahead)) {
    if (length == RESERVED_WORD_LENGTH) {
      return false;
    }
    word[length] = (char)lexer->lookahead;
    length += 1;
    lexer->advance(lexer, false);
  }

  word[length] = '\0';
  if (valid_symbols != NULL) {
    TSSymbol symbol;
    if (classify_reserved_word(word, valid_symbols, &symbol)) {
      lexer->mark_end(lexer);
    }
  }

  if (length == 0 || !reserved_word_delimiter(lexer)) {
    return false;
  }

  return true;
}

static bool word_source_can_continue(const bool *valid_symbols) {
  return valid_symbols[LITERAL_BEGIN] ||
    valid_symbols[ASSIGNMENT_LITERAL_BEGIN] ||
    valid_symbols[PARAMETER_LITERAL_BEGIN] ||
    valid_symbols[WORD_FALLBACK_LITERAL_BEGIN] ||
    valid_symbols[ASSIGNMENT_FALLBACK_LITERAL_BEGIN] ||
    valid_symbols[PARAMETER_FALLBACK_LITERAL_BEGIN];
}

static enum TokenType timing_keyword(TSLexer *lexer);

static bool accept_reserved_word(TSLexer *lexer, TSSymbol symbol) {
  lexer->result_symbol =
    symbol == TIME_KEYWORD ? timing_keyword(lexer) : symbol;
  return true;
}

static bool scan_reserved_word(TSLexer *lexer, const bool *valid_symbols) {
  char word[RESERVED_WORD_LENGTH + 1];
  TSSymbol symbol;
  if (
    !read_reserved_word(lexer, word, valid_symbols) ||
    !classify_reserved_word(word, valid_symbols, &symbol)
  ) {
    return false;
  }
  return accept_reserved_word(lexer, symbol);
}

static bool scan_lowercase_dispatch(TSLexer *lexer, const bool *valid_symbols) {
  if (word_source_can_continue(valid_symbols)) {
    return false;
  }
  lexer->mark_end(lexer);
  return scan_reserved_word(lexer, valid_symbols);
}

static bool scan_name_or_reserved_word(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid_symbols
) {
  char word[RESERVED_WORD_LENGTH + 1];
  size_t length = 0;
  bool is_reserved_candidate = true;

  lexer->mark_end(lexer);
  do {
    if (
      is_reserved_candidate &&
      lexer->lookahead >= 'a' &&
      lexer->lookahead <= 'z' &&
      length < sizeof(word) - 1
    ) {
      word[length] = (char)lexer->lookahead;
      length += 1;
    } else {
      is_reserved_candidate = false;
    }
    lexer->advance(lexer, false);
  } while (is_name_character(lexer->lookahead));

  lexer->mark_end(lexer);

  word[is_reserved_candidate ? length : 0] = '\0';
  const struct ReservedWord *reserved_word = find_reserved_word(word);
  // Unavailable reserved tokens force recovery.
  TSSymbol symbol = TOKEN_COUNT;
  if (
    !classify_reserved_word(word, valid_symbols, &symbol) &&
    reserved_as_command(reserved_word, valid_symbols) &&
    valid_symbols[FNAME_TOKEN]
  ) {
    symbol = (TSSymbol)reserved_word->symbol;
  }

  bool subscripted = false;
  if (valid_symbols[ASSIGNMENT_NAME_TOKEN] && lexer->lookahead == '[') {
    if (!skip_subscript_body(scanner, lexer)) return false;
    subscripted = true;
  }
  bool appended = false;
  if (valid_symbols[ASSIGNMENT_NAME_TOKEN] && lexer->lookahead == '+') {
    lexer->advance(lexer, false);
    appended = true;
  }
  if (lexer->lookahead == '=') {
    if (!valid_symbols[ASSIGNMENT_NAME_TOKEN]) {
      return false;
    }
    lexer->result_symbol = ASSIGNMENT_NAME_TOKEN;
    return true;
  }

  if (
    subscripted ||
    appended ||
    is_name_character(lexer->lookahead) ||
    !reserved_word_delimiter(lexer)
  ) {
    return false;
  }

  if (symbol == TOKEN_COUNT) {
    return false;
  }
  return accept_reserved_word(lexer, symbol);
}

static bool scan_case_item_terminator(TSLexer *lexer) {
  if (lexer->lookahead != ';') {
    return false;
  }
  lexer->advance(lexer, false);

  return lexer->lookahead == ';' || lexer->lookahead == '&';
}

static bool
classify_comment_boundary(TSLexer *lexer, const bool *valid_symbols);

static bool classify_scanned_comment_boundary(
  TSLexer *lexer,
  const bool *valid_symbols,
  bool comment_reaches_input_end
);

static bool
closing_reserved_word_ends_term(const char *word, const bool *valid_symbols) {
  for (size_t index = 0; index < ARRAY_COUNT(CLOSING_WORDS); index += 1) {
    if (strcmp(word, CLOSING_WORDS[index].text) == 0) {
      return valid_symbols[CLOSING_WORDS[index].symbol];
    }
  }
  return false;
}

enum TermContinuation {
  TERM_SOURCE_CONTINUES,
  TERM_SOURCE_CLOSES,
  TERM_SOURCE_END,
  TERM_SOURCE_DEFER,
  TERM_SOURCE_FAILURE,
};

static bool right_parenthesis_closes_term(const bool *valid_symbols) {
  return valid_symbols[PUNCT_RIGHT_PARENTHESIS] || valid_symbols[COMMAND_CLOSE];
}

static enum TermContinuation classify_term_start(
  const struct CommandStart *start,
  const bool *valid_symbols
) {
  int32_t character = start->first_character;
  if (character == SOURCE_BACKQUOTE_BOUNDARY) {
    return TERM_SOURCE_END;
  }
  switch (character) {
    case ')':
      return right_parenthesis_closes_term(valid_symbols)
        ? TERM_SOURCE_CLOSES
        : TERM_SOURCE_CONTINUES;
    case ';':
      return valid_symbols[CASE_ITEM_END] &&
          (start->second_character == ';' || start->second_character == '&')
        ? TERM_SOURCE_CLOSES
        : TERM_SOURCE_CONTINUES;
    case '}':
      return valid_symbols[SUBSTITUTION_BRACE_CLOSE] ||
          (valid_symbols[RIGHT_BRACE] && start->first_is_delimited)
        ? TERM_SOURCE_CLOSES
        : TERM_SOURCE_CONTINUES;
    default:
      break;
  }
  return start->first_word_is_reserved_candidate &&
      start->first_is_delimited &&
      closing_reserved_word_ends_term(start->first_word, valid_symbols)
    ? TERM_SOURCE_CLOSES
    : TERM_SOURCE_CONTINUES;
}

static bool here_document_delimiter_line_follows(
  const struct Scanner *scanner,
  TSLexer *lexer
) {
  if (scanner->active.documents.count == 0) {
    return false;
  }

  lexer->advance(lexer, false);
  struct CommandStart start;
  return read_here_document_line(
           scanner,
           lexer,
           &scanner->active.documents.data[0],
           NULL,
           &start
         ) == HERE_DOCUMENT_LINE_DELIMITER;
}

static enum TermContinuation probe_here_document_continuation(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid_symbols
) {
  const struct HereDocument *document = &scanner->active.documents.data[0];
  while (true) {
    struct CommandStart start;
    enum HereDocumentLineKind kind =
      read_here_document_line(scanner, lexer, document, NULL, &start);
    switch (kind) {
      case HERE_DOCUMENT_LINE_LAYOUT:
        continue;
      case HERE_DOCUMENT_LINE_CONTENT:
        return classify_term_start(&start, valid_symbols);
      case HERE_DOCUMENT_LINE_DELIMITER:
        return TERM_SOURCE_DEFER;
      case HERE_DOCUMENT_LINE_END_OF_INPUT:
        return TERM_SOURCE_END;
      case HERE_DOCUMENT_LINE_INVALID:
        return TERM_SOURCE_FAILURE;
    }
  }
}

static bool scan_horizontal_blanks(TSLexer *lexer) {
  bool found = false;
  while (is_horizontal_blank(lexer->lookahead)) {
    found = true;
    lexer->advance(lexer, false);
  }
  return found;
}

static void skip_arithmetic_whitespace(TSLexer *lexer) {
  while (arithmetic_whitespace(lexer->lookahead)) lexer->advance(lexer, false);
}

static bool empty_pipeline_boundary(TSLexer *lexer) {
  scan_horizontal_blanks(lexer);
  int32_t character = lexer->lookahead;
  if (
    lexer_at_eof(lexer) ||
    character == SOURCE_BACKQUOTE_BOUNDARY ||
    character == '\n' ||
    character == '#'
  )
    return true;
  if (character != ';' && character != '&') return false;
  lexer->advance(lexer, false);
  return !is_one_of(lexer->lookahead, character == ';' ? ";&" : "&>");
}

enum TimeOption {
  TIME_OPTION_NONE,
  TIME_OPTION_POSIX,
  TIME_OPTION_END_OF_OPTIONS,
};

static enum TimeOption read_time_option(TSLexer *lexer) {
  if (lexer->lookahead != '-') return TIME_OPTION_NONE;
  lexer->advance(lexer, false);
  enum TimeOption option = lexer->lookahead == 'p' ? TIME_OPTION_POSIX
    : lexer->lookahead == '-'                      ? TIME_OPTION_END_OF_OPTIONS
                                                   : TIME_OPTION_NONE;
  if (option == TIME_OPTION_NONE) return option;
  lexer->advance(lexer, false);
  return reserved_word_delimiter(lexer) ? option : TIME_OPTION_NONE;
}

static enum TokenType timing_keyword(TSLexer *lexer) {
  for (unsigned index = 0; index < 2; index++) {
    if (!scan_horizontal_blanks(lexer) || lexer->lookahead != '-') break;
    enum TimeOption option = read_time_option(lexer);
    if (
      option == TIME_OPTION_NONE || (index != 0 && option == TIME_OPTION_POSIX)
    )
      return TIME_KEYWORD;
    if (option == TIME_OPTION_END_OF_OPTIONS) break;
  }
  return empty_pipeline_boundary(lexer) ? EMPTY_TIME_KEYWORD : TIME_KEYWORD;
}

static bool
scan_command_continuation_operator(TSLexer *lexer, const bool *valid_symbols) {
  int32_t character = lexer->lookahead;
  if (character != '|' && character != '&') {
    return false;
  }
  lexer->advance(lexer, false);
  enum TokenType symbol = PIPE_CONTINUATION;
  if (lexer->lookahead == character) {
    lexer->advance(lexer, false);
    symbol = AND_OR_CONTINUATION;
  } else if (character == '&') {
    return false;
  }
  if (!valid_symbols[symbol]) {
    return false;
  }
  lexer->result_symbol = (TSSymbol)symbol;
  return true;
}

static bool scan_pipe_boundary(TSLexer *lexer, const bool *valid_symbols) {
  if (valid_symbols[PATTERN_CONTINUATION]) {
    lexer->result_symbol = PATTERN_CONTINUATION;
    return true;
  }
  return scan_command_continuation_operator(lexer, valid_symbols);
}

static bool scan_ampersand_boundary(
  TSLexer *lexer,
  const bool *valid_symbols,
  bool crossed_layout
) {
  size_t position = probe_position(lexer);
  lexer->advance(lexer, false);
  bool redirect = lexer->lookahead == '>';
  probe_seek(lexer, position);
  if (redirect) {
    enum TokenType symbol = valid_symbols[REDIRECT_LIST_BEGIN]
      ? REDIRECT_LIST_BEGIN
      : REDIRECT_SEPARATOR_BEGIN;
    if (
      valid_symbols[symbol] && (symbol == REDIRECT_LIST_BEGIN || crossed_layout)
    ) {
      lexer->result_symbol = (TSSymbol)symbol;
      return true;
    }
    return false;
  }
  return scan_command_continuation_operator(lexer, valid_symbols);
}

static bool is_word_element_start(const TSLexer *lexer) {
  int32_t character = lexer->lookahead;
  if (lexer_at_eof(lexer) || (character == SOURCE_BACKQUOTE_BOUNDARY)) {
    return false;
  }
  switch (character) {
    case '\n':
    case '#':
    case ';':
    case '&':
    case '|':
    case '(':
    case ')':
      return false;
    default:
      return true;
  }
}

static enum TermContinuation finish_term_continuation(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid_symbols
);

static bool classify_shell_boundary(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid_symbols,
  bool crossed_layout
);

static bool classify_word_separator(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid_symbols
);

static bool scan_newline_boundary(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid_symbols,
  bool crossed_layout
) {
  if (newline_starts_pending_document(scanner, lexer)) {
    return false;
  }
  if (crossed_layout) {
    bool term_choice =
      valid_symbols[TERM_BOUNDARY] && valid_symbols[TERM_CONTINUATION];
    if (!term_choice) {
      lexer->mark_end(lexer);
    }
    enum TermContinuation continuation =
      finish_term_continuation(scanner, lexer, valid_symbols);
    if (
      continuation == TERM_SOURCE_DEFER || continuation == TERM_SOURCE_FAILURE
    ) {
      return false;
    }
    if (
      continuation == TERM_SOURCE_CONTINUES && valid_symbols[TERM_CONTINUATION]
    ) {
      lexer->result_symbol = TERM_CONTINUATION;
      return true;
    }
    if (
      continuation != TERM_SOURCE_CONTINUES &&
      valid_symbols[TERM_BOUNDARY] &&
      (term_choice || valid_symbols[PRE_NEWLINE_BLANK])
    ) {
      lexer->result_symbol = TERM_BOUNDARY;
      return true;
    }
    if (valid_symbols[PRE_NEWLINE_BLANK]) {
      lexer->result_symbol = PRE_NEWLINE_BLANK;
      return true;
    }
    return false;
  }
  if (!valid_symbols[SEPARATOR_NEWLINE]) {
    return false;
  }
  lexer->mark_end(lexer);
  lexer->advance(lexer, false);
  int32_t following = lexer->lookahead;
  enum TermContinuation continuation =
    finish_term_continuation(scanner, lexer, valid_symbols);
  if (continuation == TERM_SOURCE_CONTINUES) {
    lexer->result_symbol = SEPARATOR_NEWLINE;
    return true;
  }
  if (
    (continuation == TERM_SOURCE_CLOSES || continuation == TERM_SOURCE_END) &&
    valid_symbols[TERM_BOUNDARY] &&
    (!lexer_at_eof(lexer) ||
      is_horizontal_blank(following) ||
      following == '\n' ||
      following == '#')
  ) {
    lexer->result_symbol = TERM_BOUNDARY;
    return true;
  }
  return false;
}

static bool scan_comment_boundary(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid_symbols,
  bool crossed_layout
) {
  if (!crossed_layout && word_source_can_continue(valid_symbols)) {
    return false;
  }
  if (
    !valid_symbols[TERM_CONTINUATION] ||
    newline_starts_pending_document(scanner, lexer)
  ) {
    return classify_comment_boundary(lexer, valid_symbols);
  }
  advance_to_comment_end(lexer, NULL);
  bool reaches_end = comment_reaches_end(lexer);
  if (!reaches_end) {
    enum TermContinuation continuation =
      finish_term_continuation(scanner, lexer, valid_symbols);
    if (continuation == TERM_SOURCE_FAILURE) {
      return false;
    }
    if (continuation == TERM_SOURCE_CONTINUES) {
      lexer->result_symbol = TERM_CONTINUATION;
      return true;
    }
    // Keep the term's terminating lookahead for incremental reparsing.
    if (continuation != TERM_SOURCE_DEFER && valid_symbols[TERM_BOUNDARY]) {
      lexer->result_symbol = TERM_BOUNDARY;
      return true;
    }
  }
  return classify_scanned_comment_boundary(lexer, valid_symbols, reaches_end);
}

static bool scan_element_boundary(
  struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid_symbols
) {
  lexer->mark_end(lexer);
  bool crossed_layout = scan_horizontal_blanks(lexer);
  int32_t character = lexer->lookahead;
  if (character == '|') {
    return scan_pipe_boundary(lexer, valid_symbols);
  }
  if (character == '&') {
    return scan_ampersand_boundary(lexer, valid_symbols, crossed_layout);
  }
  if (character == ';') {
    if (scan_case_item_terminator(lexer)) {
      lexer->result_symbol = CASE_ITEM_END;
      return valid_symbols[CASE_ITEM_END];
    }
    return false;
  }
  if (character == '\n') {
    return scan_newline_boundary(scanner, lexer, valid_symbols, crossed_layout);
  }
  if (character == '#') {
    return scan_comment_boundary(scanner, lexer, valid_symbols, crossed_layout);
  }
  if (
    crossed_layout &&
    (valid_symbols[WORD_SEPARATOR_BEGIN] ||
      assignment_separator_is_valid(valid_symbols) ||
      valid_symbols[REDIRECT_SEPARATOR_BEGIN]) &&
    is_word_element_start(lexer)
  ) {
    return classify_word_separator(scanner, lexer, valid_symbols);
  }
  return classify_shell_boundary(scanner, lexer, valid_symbols, crossed_layout);
}

struct SeparatorTarget {
  bool redirect;
  bool assignment;
};

static bool scan_redirect_operator(TSLexer *lexer) {
  if (lexer->lookahead != '<' && lexer->lookahead != '>') return false;
  lexer->advance(lexer, false);
  return lexer->lookahead != '(';
}

static bool skip_subscript(
  const struct Scanner *scanner,
  TSLexer *lexer,
  bool word_boundary
) {
  size_t start = probe_position(lexer);
  if (!skip_subscript_body(scanner, lexer)) return false;
  if (word_boundary) {
    size_t end = probe_position(lexer);
    probe_seek(lexer, start);
    if (
      skip_command_word(scanner, lexer, NULL, false) !=
        ARITHMETIC_VALIDATION_VALID ||
      probe_position(lexer) < end
    )
      return false;
    probe_seek(lexer, end);
  }
  return true;
}

static enum TokenType
scan_redirect_descriptor(const struct Scanner *scanner, TSLexer *lexer) {
  enum TokenType symbol;
  if (is_decimal_digit(lexer->lookahead)) {
    symbol = FILE_DESCRIPTOR;
    uint32_t value = 0;
    do {
      uint32_t digit = (uint32_t)(lexer->lookahead - '0');
      if (value > (INT32_MAX - digit) / 10) return TOKEN_COUNT;
      value = value * 10 + digit;
      lexer->advance(lexer, false);
    } while (is_decimal_digit(lexer->lookahead));
  } else if (lexer->lookahead == '{') {
    symbol = IO_VARIABLE_OPEN;
    lexer->advance(lexer, false);
    if (!is_name_start_character(lexer->lookahead)) return TOKEN_COUNT;
    advance_name(lexer);
    if (lexer->lookahead == '[') {
      size_t start = probe_position(lexer);
      lexer->advance(lexer, false);
      if (lexer->lookahead == ']') return TOKEN_COUNT;
      probe_seek(lexer, start);
      if (!skip_subscript(scanner, lexer, true)) return TOKEN_COUNT;
    }
    if (lexer->lookahead != '}') return TOKEN_COUNT;
    lexer->advance(lexer, false);
  } else {
    return TOKEN_COUNT;
  }
  return scan_redirect_operator(lexer) ? symbol : TOKEN_COUNT;
}

static struct SeparatorTarget scan_separator_target(
  const struct Scanner *scanner,
  TSLexer *lexer,
  bool word_boundary
) {
  struct SeparatorTarget target = {0};
  int32_t character = lexer->lookahead;
  if (character == '&') {
    lexer->advance(lexer, false);
    target.redirect = lexer->lookahead == '>';
  } else if (character == '{' || is_decimal_digit(character)) {
    target.redirect = scan_redirect_descriptor(scanner, lexer) != TOKEN_COUNT;
  } else if (character == '<' || character == '>') {
    target.redirect = scan_redirect_operator(lexer);
  } else if (is_name_start_character(character)) {
    advance_name(lexer);
    if (
      lexer->lookahead == '[' && !skip_subscript(scanner, lexer, word_boundary)
    )
      return target;
    if (lexer->lookahead == '+') lexer->advance(lexer, false);
    target.assignment = lexer->lookahead == '=';
  }
  return target;
}

static bool classify_word_separator(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid_symbols
) {
  lexer->mark_end(lexer);
  bool scalar = !valid_symbols[ASSIGNMENT_SEPARATOR_BEGIN] &&
    valid_symbols[SCALAR_ASSIGNMENT_SEPARATOR_BEGIN];
  struct SeparatorTarget target = scan_separator_target(scanner, lexer, scalar);

  if (target.assignment) {
    enum TokenType symbol =
      scalar ? SCALAR_ASSIGNMENT_SEPARATOR_BEGIN : ASSIGNMENT_SEPARATOR_BEGIN;
    if (valid_symbols[symbol]) {
      lexer->result_symbol = symbol;
      return true;
    }
  }
  if (target.redirect && valid_symbols[REDIRECT_SEPARATOR_BEGIN]) {
    lexer->result_symbol = REDIRECT_SEPARATOR_BEGIN;
    return true;
  }
  if (valid_symbols[WORD_SEPARATOR_BEGIN]) {
    lexer->result_symbol = WORD_SEPARATOR_BEGIN;
    return true;
  }
  return false;
}

static enum TermContinuation
classify_following_command(TSLexer *lexer, const bool *valid_symbols) {
  struct CommandStart start = {
    .first_character = lexer->lookahead,
  };
  if (is_lowercase_letter(start.first_character)) {
    start.first_word_is_reserved_candidate =
      read_reserved_word(lexer, start.first_word, NULL);
    start.first_is_delimited = start.first_word_is_reserved_candidate;
  } else if (start.first_character == '}' || start.first_character == ';') {
    lexer->advance(lexer, false);
    start.second_character = lexer->lookahead;
    start.first_is_delimited = reserved_word_delimiter(lexer);
  }
  if (lookahead_has_failed(lexer)) {
    return TERM_SOURCE_FAILURE;
  }
  return classify_term_start(&start, valid_symbols);
}

static enum TermContinuation finish_term_continuation(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid_symbols
) {
  while (true) {
    scan_horizontal_blanks(lexer);
    if (lexer->lookahead == '#') {
      if (newline_starts_pending_document(scanner, lexer)) {
        return TERM_SOURCE_DEFER;
      }
      advance_to_comment_end(lexer, NULL);
      continue;
    }
    if (lexer->lookahead == '\n') {
      if (newline_starts_pending_document(scanner, lexer)) {
        return TERM_SOURCE_DEFER;
      }
      lexer->advance(lexer, false);
      if (scanner->active.documents.count > 0) {
        return probe_here_document_continuation(scanner, lexer, valid_symbols);
      }
      continue;
    }

    if (lookahead_has_failed(lexer)) {
      return TERM_SOURCE_FAILURE;
    }
    if (lexer_at_eof(lexer)) {
      return TERM_SOURCE_END;
    }
    return classify_following_command(lexer, valid_symbols);
  }
}

static bool classify_shell_boundary(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid_symbols,
  bool crossed_layout
) {
  int32_t character = lexer->lookahead;
  if (character == '|') {
    return scan_pipe_boundary(lexer, valid_symbols);
  }

  if (character == '&') {
    return scan_ampersand_boundary(lexer, valid_symbols, crossed_layout);
  }

  if (character == ')' && valid_symbols[PATTERN_END]) {
    lexer->result_symbol = PATTERN_END;
    return true;
  }

  if (character == ';' && valid_symbols[CASE_ITEM_END]) {
    if (!scan_case_item_terminator(lexer)) {
      return false;
    }
    lexer->result_symbol = CASE_ITEM_END;
    return true;
  }

  if (
    character == '#' &&
    (crossed_layout || !word_source_can_continue(valid_symbols)) &&
    classify_comment_boundary(lexer, valid_symbols)
  ) {
    return true;
  }

  if (
    valid_symbols[REDIRECT_LIST_BEGIN] &&
    (character == '<' ||
      character == '>' ||
      character == '{' ||
      is_decimal_digit(character)) &&
    scan_separator_target(scanner, lexer, false).redirect
  ) {
    lexer->result_symbol = REDIRECT_LIST_BEGIN;
    return true;
  }

  return is_lowercase_letter(character) &&
    !crossed_layout &&
    scan_reserved_word(lexer, valid_symbols);
}

static bool scan_shell_boundary(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid_symbols
) {
  lexer->mark_end(lexer);
  bool crossed_layout = is_horizontal_blank(lexer->lookahead) ||
    (lexer->lookahead == '\\' && valid_symbols[REDIRECT_LIST_BEGIN]);
  if (crossed_layout) {
    scan_horizontal_blanks(lexer);
  }

  return classify_shell_boundary(scanner, lexer, valid_symbols, crossed_layout);
}

static bool classify_scanned_comment_boundary(
  TSLexer *lexer,
  const bool *valid_symbols,
  bool comment_reaches_input_end
) {
  if (comment_reaches_input_end && valid_symbols[TRAILING_COMMENT_BOUNDARY]) {
    lexer->result_symbol = TRAILING_COMMENT_BOUNDARY;
    return true;
  }
  if (valid_symbols[COMMENT_BOUNDARY]) {
    lexer->result_symbol = COMMENT_BOUNDARY;
    return true;
  }
  return false;
}

static bool
classify_comment_boundary(TSLexer *lexer, const bool *valid_symbols) {
  if (
    !valid_symbols[COMMENT_BOUNDARY] &&
    !valid_symbols[TRAILING_COMMENT_BOUNDARY]
  ) {
    return false;
  }
  bool comment_reaches_input_end = false;
  if (valid_symbols[TRAILING_COMMENT_BOUNDARY]) {
    advance_to_comment_end(lexer, NULL);
    comment_reaches_input_end = comment_reaches_end(lexer);
  }
  return classify_scanned_comment_boundary(
    lexer,
    valid_symbols,
    comment_reaches_input_end
  );
}

static bool classify_layout_run(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid_symbols
) {
  scan_horizontal_blanks(lexer);
  int32_t character = lexer->lookahead;
  if (
    character == '#' &&
    (valid_symbols[COMMENT_BOUNDARY] ||
      valid_symbols[TRAILING_COMMENT_BOUNDARY])
  ) {
    return classify_comment_boundary(lexer, valid_symbols);
  }
  if (character == '\n' && valid_symbols[PRE_NEWLINE_BLANK]) {
    if (
      newline_starts_pending_document(scanner, lexer) ||
      here_document_delimiter_line_follows(scanner, lexer)
    ) {
      return false;
    }
    lexer->result_symbol = PRE_NEWLINE_BLANK;
    return true;
  }
  if (
    character == ';' &&
    valid_symbols[CASE_ITEM_END] &&
    scan_case_item_terminator(lexer)
  ) {
    lexer->result_symbol = CASE_ITEM_END;
    return true;
  }
  return false;
}

static enum ArithmeticOperatorCategory classify_arithmetic_operator(
  int32_t first,
  int32_t second,
  int32_t third,
  size_t *length
) {
  bool equals = second == '=';
  bool repeated = second == first;
  *length = 1;
  switch (first) {
    case '=':
      *length = equals ? 2 : 1;
      return equals ? ARITHMETIC_OPERATOR_CATEGORY_EQUALITY
                    : ARITHMETIC_OPERATOR_CATEGORY_ASSIGNMENT;
    case '!':
      *length = equals ? 2 : 1;
      return equals ? ARITHMETIC_OPERATOR_CATEGORY_EQUALITY
                    : ARITHMETIC_OPERATOR_CATEGORY_COUNT;
    case '|':
    case '&':
      *length = equals || repeated ? 2 : 1;
      if (equals) {
        return ARITHMETIC_OPERATOR_CATEGORY_ASSIGNMENT;
      }
      if (repeated) {
        return first == '|' ? ARITHMETIC_OPERATOR_CATEGORY_LOGICAL_OR
                            : ARITHMETIC_OPERATOR_CATEGORY_LOGICAL_AND;
      }
      return first == '|' ? ARITHMETIC_OPERATOR_CATEGORY_BITWISE_OR
                          : ARITHMETIC_OPERATOR_CATEGORY_BITWISE_AND;
    case '^':
    case '*':
    case '/':
    case '%':
      *length = equals || (first == '*' && repeated) ? 2 : 1;
      if (first == '*' && repeated) return ARITHMETIC_OPERATOR_CATEGORY_POWER;
      if (equals) {
        return ARITHMETIC_OPERATOR_CATEGORY_ASSIGNMENT;
      }
      return first == '^' ? ARITHMETIC_OPERATOR_CATEGORY_BITWISE_XOR
                          : ARITHMETIC_OPERATOR_CATEGORY_MULTIPLICATIVE;
    case '<':
    case '>':
      if (repeated) {
        *length = third == '=' ? 3 : 2;
        return third == '=' ? ARITHMETIC_OPERATOR_CATEGORY_ASSIGNMENT
                            : ARITHMETIC_OPERATOR_CATEGORY_SHIFT;
      }
      *length = equals ? 2 : 1;
      return ARITHMETIC_OPERATOR_CATEGORY_RELATIONAL;
    case '+':
    case '-':
      *length = equals || repeated ? 2 : 1;
      if (equals) {
        return ARITHMETIC_OPERATOR_CATEGORY_ASSIGNMENT;
      }
      return repeated ? ARITHMETIC_OPERATOR_CATEGORY_UPDATE
                      : ARITHMETIC_OPERATOR_CATEGORY_ADDITIVE;
    case ',':
      return ARITHMETIC_OPERATOR_CATEGORY_COMMA;
    case '?':
      return ARITHMETIC_OPERATOR_CATEGORY_QUESTION;
    case ':':
      return ARITHMETIC_OPERATOR_CATEGORY_COLON;
    default:
      return ARITHMETIC_OPERATOR_CATEGORY_COUNT;
  }
}

static bool arithmetic_operator_boundary_is_valid(const bool *valid_symbols) {
  for (
    size_t category = 0; category < ARITHMETIC_OPERATOR_CATEGORY_COUNT;
    category += 1
  ) {
    enum TokenType symbol = ARITHMETIC_OPERATOR_BOUNDARIES[category];
    if (valid_symbols[symbol]) {
      return true;
    }
  }
  return false;
}

static bool is_arithmetic_operator_start(int32_t character) {
  return is_one_of(character, "=!|&^<>+-*/%?:,");
}

static bool arithmetic_update_operand_may_follow(TSLexer *lexer) {
  skip_arithmetic_whitespace(lexer);
  return is_name_start_character(lexer->lookahead) ||
    is_one_of(lexer->lookahead, "$`");
}

static bool
scan_arithmetic_boundary(TSLexer *lexer, const bool *valid_symbols) {
  lexer->mark_end(lexer);
  skip_arithmetic_whitespace(lexer);

  if (valid_symbols[ARITHMETIC_CLOSING_BOUNDARY] && lexer->lookahead == ')') {
    lexer->result_symbol = ARITHMETIC_CLOSING_BOUNDARY;
    return true;
  }

  int32_t first = lexer->lookahead;
  lexer->advance(lexer, false);
  int32_t second = lexer->lookahead;
  lexer->advance(lexer, false);
  size_t length;
  enum ArithmeticOperatorCategory category =
    classify_arithmetic_operator(first, second, lexer->lookahead, &length);
  if (
    category == ARITHMETIC_OPERATOR_CATEGORY_UPDATE &&
    !valid_symbols[ARITHMETIC_UPDATE_OPERATOR_BOUNDARY] &&
    !arithmetic_update_operand_may_follow(lexer)
  )
    category = ARITHMETIC_OPERATOR_CATEGORY_ADDITIVE;
  if (category != ARITHMETIC_OPERATOR_CATEGORY_COUNT) {
    enum TokenType operator_symbol = ARITHMETIC_OPERATOR_BOUNDARIES[category];
    if (valid_symbols[operator_symbol]) {
      lexer->result_symbol = (TSSymbol)operator_symbol;
      return true;
    }
  }

  return false;
}

enum ValidationTokenKind {
  VALIDATION_TOKEN_NUMBER,
  VALIDATION_TOKEN_VARIABLE,
  VALIDATION_TOKEN_EXPANSION,
  VALIDATION_TOKEN_OPERATOR,
  VALIDATION_TOKEN_LEFT_PARENTHESIS,
  VALIDATION_TOKEN_RIGHT_PARENTHESIS,
};

enum {
  VALIDATION_OPERATOR_BANG = ARITHMETIC_OPERATOR_CATEGORY_COUNT,
  VALIDATION_OPERATOR_TILDE,
  VALIDATION_OPERATOR_REPEATED_SIGN,
};

static bool append_validation_token(
  struct ValidationTokenBuffer *tokens,
  uint8_t kind,
  uint8_t category
) {
  struct ValidationToken *data = source_grow(
    tokens->data,
    &tokens->capacity,
    tokens->length + 1,
    sizeof(struct ValidationToken)
  );
  if (data == NULL) {
    return false;
  }
  tokens->data = data;
  tokens->data[tokens->length] =
    (struct ValidationToken){.kind = kind, .category = category};
  tokens->length += 1;
  return true;
}

static bool record_arithmetic_expansion(
  struct ArithmeticScan *scan,
  enum ArithmeticValidation *result
) {
  if (append_validation_token(&scan->tokens, VALIDATION_TOKEN_EXPANSION, 0))
    return true;
  *result = ARITHMETIC_VALIDATION_RESOURCE_FAILURE;
  return false;
}

enum EmbeddedFrameKind {
  EMBEDDED_SOURCE,
  EMBEDDED_SUBSCRIPT,
  EMBEDDED_PARENTHESES,
  EMBEDDED_ARRAY,
  EMBEDDED_CONDITIONAL,
  EMBEDDED_BRACE_GROUP,
  EMBEDDED_COMMAND_SUBSTITUTION,
  EMBEDDED_SUBSHELL,
  EMBEDDED_FUNCTION_HEADER,
};

struct EmbeddedFrame {
  char closer;
  enum EmbeddedFrameKind kind;
  struct CommandTracker command;
  bool regex;
  bool pattern;
  uint8_t quote;
  struct ParameterQuote parameter_quote;
  struct LookaheadContext source_context;
};

struct EmbeddedSkip {
  struct EmbeddedFrame *frames;
  size_t frame_count;
  size_t frame_capacity;
  struct CaseTrackerBuffer cases;
  struct HereDocumentList pending;
  bool started;
  bool force_extglob;
  enum QuoteMode initial_quote;
};

static void clear_embedded_skip(struct EmbeddedSkip *skip) {
  ts_free(skip->frames);
  ts_free(skip->cases.data);
  clear_documents(&skip->pending);
  *skip = (struct EmbeddedSkip){0};
}

static void clear_arithmetic_scan(struct ArithmeticScan *scan) {
  ts_free(scan->tokens.data);
  if (scan->embedded != NULL) {
    clear_embedded_skip(scan->embedded);
    ts_free(scan->embedded);
  }
  *scan = (struct ArithmeticScan){0};
}

static size_t embedded_substitution_depth(const struct EmbeddedSkip *skip) {
  size_t depth = skip->frame_count;
  while (
    depth > 0 && skip->frames[depth - 1].kind != EMBEDDED_COMMAND_SUBSTITUTION
  ) {
    depth -= 1;
  }
  return depth;
}

static bool embedded_pop_frame(struct EmbeddedSkip *skip) {
  const struct EmbeddedFrame *frame = &skip->frames[skip->frame_count - 1];
  if (frame->kind == EMBEDDED_COMMAND_SUBSTITUTION) {
    for (size_t index = 0; index < skip->pending.count; index++) {
      if (skip->pending.data[index].declaration_depth >= skip->frame_count)
        return false;
    }
  }
  skip->frame_count--;
  return true;
}

static enum QuoteMode embedded_quote(const struct EmbeddedFrame *frame) {
  if (frame->kind == EMBEDDED_SOURCE && frame->closer == '}') {
    if (
      frame->parameter_quote.state == PARAMETER_QUOTE_PATTERN ||
      frame->parameter_quote.state == PARAMETER_QUOTE_ERROR
    )
      return quote_after_token(frame->quote, PARAMETER_PATTERN_OPERATOR_BEGIN);
    if (
      frame->parameter_quote.state == PARAMETER_QUOTE_ARITHMETIC ||
      frame->parameter_quote.state == PARAMETER_QUOTE_SUBSCRIPT
    )
      return quote_after_token(frame->quote, PARAMETER_SUBSTRING_BEGIN);
  }
  return frame->quote;
}

static bool embedded_push_frame(
  struct EmbeddedSkip *skip,
  char closer,
  enum EmbeddedFrameKind kind
) {
  enum QuoteMode parent = skip->frame_count > 0
    ? embedded_quote(&skip->frames[skip->frame_count - 1])
    : skip->initial_quote;
  enum QuoteMode quote = parent;
  if (kind == EMBEDDED_COMMAND_SUBSTITUTION) quote = QUOTE_PLAIN;
  else if (kind == EMBEDDED_SUBSCRIPT) quote = QUOTE_DOUBLE;
  else if (kind == EMBEDDED_SOURCE && closer == '"')
    quote = quote_double(parent);
  else if (kind == EMBEDDED_SOURCE && closer == '}')
    quote = quote_parameter(parent);
  else if (kind == EMBEDDED_SOURCE && closer == ']')
    quote = quote_after_token(parent, BRACKET_ARITHMETIC_OPEN);
  struct EmbeddedFrame *frames = source_grow(
    skip->frames,
    &skip->frame_capacity,
    skip->frame_count + 1,
    sizeof(struct EmbeddedFrame)
  );
  if (frames == NULL) {
    return false;
  }
  skip->frames = frames;
  skip->frames[skip->frame_count] = (struct EmbeddedFrame){
    .closer = closer,
    .kind = kind,
    .quote = quote,
  };
  reset_command_position(
    &skip->frames[skip->frame_count].command,
    COMMAND_POSITION_START
  );
  skip->frame_count += 1;
  return true;
}

static bool embedded_push_source(
  struct EmbeddedSkip *skip,
  TSLexer *lexer,
  char closer,
  bool quoted
) {
  if (!embedded_push_frame(
        skip,
        closer,
        closer == '`' ? EMBEDDED_COMMAND_SUBSTITUTION : EMBEDDED_SOURCE
      )) {
    return false;
  }
  return closer != '`' ||
    lookahead_backquote_begin(
      lexer,
      quoted,
      &skip->frames[skip->frame_count - 1].source_context
    );
}

static void embedded_note_word(struct EmbeddedSkip *skip, bool in_command) {
  if (!in_command) {
    return;
  }
  track_command_word_character(
    &skip->frames[skip->frame_count - 1].command.word,
    '\\'
  );
}

static bool embedded_extglob(
  const struct Scanner *scanner,
  const struct EmbeddedSkip *skip
) {
  if (skip->force_extglob || extglob_enabled(scanner)) return true;
  for (size_t index = 0; index < skip->frame_count; index++) {
    if (skip->frames[index].pattern) return true;
  }
  return false;
}

static enum ArithmeticValidation embedded_push_dollar_group(
  const struct Scanner *scanner,
  struct EmbeddedSkip *skip,
  TSLexer *lexer
) {
  bool command_context = lexer->lookahead == '(';
  char closer = dollar_group_closer(lexer->lookahead);
  lexer->advance(lexer, false);
  if (closer == '}' && braced_command_follows(lexer->lookahead)) {
    command_context = true;
    if (lexer->lookahead == '|') lexer->advance(lexer, false);
  }
  if (command_context && lexer->lookahead == '(') {
    return skip_ambiguous_substitution(
      scanner,
      lexer,
      embedded_extglob(scanner, skip)
    );
  }
  return embedded_push_frame(
           skip,
           closer,
           command_context ? EMBEDDED_COMMAND_SUBSTITUTION : EMBEDDED_SOURCE
         )
    ? ARITHMETIC_VALIDATION_VALID
    : ARITHMETIC_VALIDATION_RESOURCE_FAILURE;
}

static enum ArithmeticValidation read_embedded_here_document_delimiter(
  const struct Scanner *scanner,
  TSLexer *lexer,
  bool strip_tabs,
  struct HereDocument *document,
  bool force_extglob
) {
  while (is_horizontal_blank(lexer->lookahead)) {
    lexer->advance(lexer, false);
  }

  enum DelimiterReadResult result = read_here_document_delimiter(
    lexer,
    scanner,
    strip_tabs,
    document,
    force_extglob
  );
  if (result == DELIMITER_READ_WORD) {
    return ARITHMETIC_VALIDATION_VALID;
  }
  if (result == DELIMITER_READ_RESOURCE_FAILURE) {
    return ARITHMETIC_VALIDATION_RESOURCE_FAILURE;
  }
  return result == DELIMITER_READ_INCOMPLETE ? ARITHMETIC_VALIDATION_INCOMPLETE
                                             : ARITHMETIC_VALIDATION_INVALID;
}

static enum ArithmeticValidation skip_embedded_here_document_bodies(
  const struct Scanner *scanner,
  TSLexer *lexer,
  struct EmbeddedSkip *skip
) {
  const struct Scanner unquoted_scanner = {0};
  if (scanner == NULL) {
    scanner = &unquoted_scanner;
  }
  size_t depth = embedded_substitution_depth(skip);
  size_t retained = 0;
  enum ArithmeticValidation result = ARITHMETIC_VALIDATION_VALID;
  for (size_t index = 0; index < skip->pending.count; index += 1) {
    struct HereDocument *document = &skip->pending.data[index];
    if (
      result != ARITHMETIC_VALIDATION_VALID ||
      document->declaration_depth < depth
    ) {
      skip->pending.data[retained] = *document;
      retained += 1;
      continue;
    }
    while (true) {
      struct CommandStart start;
      enum HereDocumentLineKind kind =
        read_here_document_line(scanner, lexer, document, NULL, &start);
      if (kind == HERE_DOCUMENT_LINE_DELIMITER) {
        break;
      }
      if (kind == HERE_DOCUMENT_LINE_END_OF_INPUT) {
        result = ARITHMETIC_VALIDATION_INCOMPLETE;
        break;
      }
      if (kind == HERE_DOCUMENT_LINE_INVALID) {
        result = ARITHMETIC_VALIDATION_RESOURCE_FAILURE;
        break;
      }
    }
    clear_document(document);
  }
  skip->pending.count = retained;
  return result;
}

struct EmbeddedWalk {
  const struct Scanner *scanner;
  TSLexer *lexer;
  struct EmbeddedSkip *skip;
  enum ArithmeticValidation result;
};

static void embedded_walk_push(
  struct EmbeddedWalk *walk,
  char closer,
  enum EmbeddedFrameKind kind
) {
  if (!embedded_push_frame(walk->skip, closer, kind))
    walk->result = ARITHMETIC_VALIDATION_RESOURCE_FAILURE;
}

static bool regex_boundary(TSLexer *lexer, size_t depth) {
  return lexer_at_eof(lexer) ||
    lexer->lookahead == SOURCE_BACKQUOTE_BOUNDARY ||
    (depth == 0 &&
      is_token_delimiter(lexer) &&
      lexer->lookahead != '|' &&
      lexer->lookahead != '(');
}

static bool embedded_delimited(TSLexer *lexer, const char *spelling) {
  size_t position = probe_position(lexer);
  while (*spelling != '\0' && lexer->lookahead == *spelling) {
    lexer->advance(lexer, false);
    spelling++;
  }
  if (*spelling == '\0' && reserved_word_delimiter(lexer)) return true;
  probe_seek(lexer, position);
  return false;
}

static bool embedded_word_group(struct EmbeddedWalk *walk, bool in_command) {
  TSLexer *lexer = walk->lexer;
  int32_t character = lexer->lookahead;
  if (
    !is_one_of(character, "?*+@!<>") ||
    (!is_one_of(character, "<>") &&
      !embedded_extglob(walk->scanner, walk->skip))
  )
    return false;
  size_t position = probe_position(lexer);
  lexer->advance(lexer, false);
  if (lexer->lookahead != '(') {
    probe_seek(lexer, position);
    return false;
  }
  lexer->advance(lexer, false);
  embedded_note_word(walk->skip, in_command);
  embedded_walk_push(
    walk,
    ')',
    is_one_of(character, "<>") ? EMBEDDED_COMMAND_SUBSTITUTION
                               : EMBEDDED_PARENTHESES
  );
  return true;
}

static void embedded_backquote_boundary(
  struct EmbeddedWalk *walk,
  struct EmbeddedFrame *frame
) {
  TSLexer *lexer = walk->lexer;
  if (frame->closer != '`' || !logical_backquote_end(lookahead_input(lexer))) {
    walk->result = ARITHMETIC_VALIDATION_INCOMPLETE;
    return;
  }
  lexer->advance(lexer, false);
  if (!lookahead_context_end(lexer, &frame->source_context)) {
    walk->result = ARITHMETIC_VALIDATION_RESOURCE_FAILURE;
    return;
  }
  if (!embedded_pop_frame(walk->skip))
    walk->result = ARITHMETIC_VALIDATION_INVALID;
}

static void embedded_quoted_step(
  struct EmbeddedWalk *walk,
  struct EmbeddedFrame *frame,
  int32_t character
) {
  TSLexer *lexer = walk->lexer;
  if (frame->closer != '"' && character == '\'') {
    if (!scan_delimiter_single_quoted_segment(lexer, NULL, false))
      walk->result = ARITHMETIC_VALIDATION_INCOMPLETE;
    return;
  }
  if (character == '\\') {
    bool continuation;
    if (!skip_escape_run(lexer, &continuation)) {
      walk->result = ARITHMETIC_VALIDATION_INCOMPLETE;
    }
    return;
  }
  if (character == frame->closer) {
    lexer->advance(lexer, false);
    if (!embedded_pop_frame(walk->skip))
      walk->result = ARITHMETIC_VALIDATION_INVALID;
    return;
  }
  if (character == '`' || character == '"') {
    bool decode = frame->closer == '"' && embedded_quote(frame) == QUOTE_DOUBLE;
    lexer->advance(lexer, false);
    if (!embedded_push_source(walk->skip, lexer, (char)character, decode)) {
      walk->result = ARITHMETIC_VALIDATION_RESOURCE_FAILURE;
    }
    return;
  }
  if (character == '$') {
    lexer->advance(lexer, false);
    if (frame->closer != '"' && lexer->lookahead == '\'') {
      if (!scan_delimiter_single_quoted_segment(lexer, NULL, true))
        walk->result = ARITHMETIC_VALIDATION_INCOMPLETE;
    } else if (is_dollar_group_opener(lexer->lookahead)) {
      walk->result =
        embedded_push_dollar_group(walk->scanner, walk->skip, lexer);
    } else {
      skip_dollar_parameter(lexer, NULL);
    }
    return;
  }
  lexer->advance(lexer, false);
}

static void embedded_dollar(struct EmbeddedWalk *walk, bool in_command) {
  TSLexer *lexer = walk->lexer;
  lexer->advance(lexer, false);
  embedded_note_word(walk->skip, in_command);
  if (is_dollar_group_opener(lexer->lookahead)) {
    walk->result = embedded_push_dollar_group(walk->scanner, walk->skip, lexer);
    return;
  }
  if (lexer->lookahead == '\'') {
    if (!scan_delimiter_single_quoted_segment(lexer, NULL, true)) {
      walk->result = ARITHMETIC_VALIDATION_INCOMPLETE;
    }
    return;
  }
  skip_dollar_parameter(lexer, NULL);
}

static void embedded_redirect(
  struct EmbeddedWalk *walk,
  struct EmbeddedFrame *frame,
  int32_t character
) {
  TSLexer *lexer = walk->lexer;
  struct EmbeddedSkip *skip = walk->skip;
  begin_command_redirect(&frame->command);
  lexer->advance(lexer, false);
  if (character != '<' || lexer->lookahead != '<') {
    if (
      lexer->lookahead == '&' ||
      (character == '<' && lexer->lookahead == '>') ||
      (character == '>' && (lexer->lookahead == '>' || lexer->lookahead == '|'))
    ) {
      lexer->advance(lexer, false);
    }
    return;
  }
  lexer->advance(lexer, false);
  if (lexer->lookahead == '<') {
    lexer->advance(lexer, false);
    return;
  }
  bool strip_tabs = lexer->lookahead == '-';
  if (strip_tabs) {
    lexer->advance(lexer, false);
  }
  struct HereDocument document;
  walk->result = read_embedded_here_document_delimiter(
    walk->scanner,
    lexer,
    strip_tabs,
    &document,
    embedded_extglob(walk->scanner, walk->skip)
  );
  if (walk->result != ARITHMETIC_VALIDATION_VALID) {
    return;
  }
  document.declaration_depth = embedded_substitution_depth(skip);
  if (!append_document(&skip->pending, document)) {
    clear_document(&document);
    walk->result = ARITHMETIC_VALIDATION_RESOURCE_FAILURE;
    return;
  }
  frame->command.redirect_operand = false;
}

static void embedded_open_parenthesis(
  struct EmbeddedWalk *walk,
  struct EmbeddedFrame *frame,
  struct CaseTracker *active_case
) {
  walk->lexer->advance(walk->lexer, false);
  if (active_case != NULL && case_tracker_in_pattern(active_case->state)) {
    active_case->state = CASE_TRACKER_IN_PATTERN;
    reset_command_position(&frame->command, COMMAND_POSITION_START);
    return;
  }
  if (walk->lexer->lookahead == '(' && !frame->command.function_name) {
    walk->result = skip_ambiguous_substitution(
      walk->scanner,
      walk->lexer,
      embedded_extglob(walk->scanner, walk->skip)
    );
    if (walk->result == ARITHMETIC_VALIDATION_VALID)
      reset_command_position(&frame->command, COMMAND_POSITION_CLOSED);
    return;
  }
  enum EmbeddedFrameKind kind =
    frame->command.function_name ? EMBEDDED_FUNCTION_HEADER : EMBEDDED_SUBSHELL;
  embedded_walk_push(walk, ')', kind);
}

static void embedded_close_parenthesis(
  struct EmbeddedWalk *walk,
  struct EmbeddedFrame *frame,
  struct CaseTracker *active_case
) {
  struct EmbeddedSkip *skip = walk->skip;
  walk->lexer->advance(walk->lexer, false);
  if (active_case != NULL) {
    if (case_tracker_in_pattern(active_case->state)) {
      active_case->state = CASE_TRACKER_BODY;
      reset_command_position(&frame->command, COMMAND_POSITION_START);
    }
    return;
  }
  enum EmbeddedFrameKind kind = frame->kind;
  if (!embedded_pop_frame(skip)) walk->result = ARITHMETIC_VALIDATION_INVALID;
  pop_case_trackers_at_depth(&skip->cases, skip->frame_count + 1);
  if (
    skip->frame_count > 0 &&
    (kind == EMBEDDED_FUNCTION_HEADER || kind == EMBEDDED_SUBSHELL)
  ) {
    reset_command_position(
      &skip->frames[skip->frame_count - 1].command,
      kind == EMBEDDED_FUNCTION_HEADER ? COMMAND_POSITION_START
                                       : COMMAND_POSITION_CLOSED
    );
  }
}

static void embedded_plain_character(
  struct EmbeddedWalk *walk,
  struct EmbeddedFrame *frame,
  bool in_command,
  int32_t character
) {
  walk->lexer->advance(walk->lexer, false);
  if (!in_command || is_horizontal_blank(character)) {
    return;
  }
  if (
    character == '\n' ||
    character == ';' ||
    character == '&' ||
    character == '|'
  ) {
    enum CommandPosition position =
      character == '\n' && frame->command.position == COMMAND_POSITION_FOR_IN
      ? COMMAND_POSITION_FOR_IN
      : COMMAND_POSITION_START;
    if (character == '|') {
      position = walk->lexer->lookahead == '|' ? COMMAND_POSITION_START
                                               : COMMAND_POSITION_PIPE_COMMAND;
      if (is_one_of(walk->lexer->lookahead, "|&"))
        walk->lexer->advance(walk->lexer, false);
    }
    reset_command_position(&frame->command, position);
  } else {
    track_command_word_character(&frame->command.word, character);
  }
}

static void embedded_conditional_step(
  struct EmbeddedWalk *walk,
  struct EmbeddedFrame *frame,
  int32_t character
) {
  TSLexer *lexer = walk->lexer;
  if (!frame->command.word.active) {
    if (character == ']' && embedded_delimited(lexer, "]]")) {
      if (!embedded_pop_frame(walk->skip))
        walk->result = ARITHMETIC_VALIDATION_INVALID;
      return;
    }
    if (
      !frame->regex &&
      !frame->pattern &&
      ((character == '=' &&
         (embedded_delimited(lexer, "==") || embedded_delimited(lexer, "="))) ||
        (character == '!' && embedded_delimited(lexer, "!=")))
    ) {
      frame->pattern = true;
      return;
    }
    if (!frame->regex && character == '=' && embedded_delimited(lexer, "=~")) {
      frame->regex = true;
      return;
    }
  }
  if (character == '(') {
    lexer->advance(lexer, false);
    embedded_note_word(walk->skip, true);
    embedded_walk_push(
      walk,
      ')',
      frame->regex ? EMBEDDED_PARENTHESES : EMBEDDED_CONDITIONAL
    );
    return;
  }
  if (character == ')' && frame->closer == ')') {
    lexer->advance(lexer, false);
    if (!embedded_pop_frame(walk->skip))
      walk->result = ARITHMETIC_VALIDATION_INVALID;
    return;
  }
  if (!is_token_delimiter(lexer) || (frame->regex && character == '|'))
    track_command_word_character(&frame->command.word, character);
  lexer->advance(lexer, false);
}

static bool embedded_quote_step(
  struct EmbeddedWalk *walk,
  const struct EmbeddedFrame *frame,
  bool word_context,
  int32_t character
) {
  TSLexer *lexer = walk->lexer;
  struct EmbeddedSkip *skip = walk->skip;
  if (character == '\\') {
    bool continuation;
    if (!skip_escape_run(lexer, &continuation)) {
      walk->result = ARITHMETIC_VALIDATION_INCOMPLETE;
    } else if (!continuation) {
      embedded_note_word(skip, word_context);
    }
    return true;
  }
  if (character == '\'') {
    if (!scan_delimiter_single_quoted_segment(lexer, NULL, false)) {
      walk->result = ARITHMETIC_VALIDATION_INCOMPLETE;
      return true;
    }
    embedded_note_word(skip, word_context);
    return true;
  }
  if (character == '"' || character == '`') {
    lexer->advance(lexer, false);
    embedded_note_word(skip, word_context);
    if (!embedded_push_source(skip, lexer, (char)character, false)) {
      walk->result = ARITHMETIC_VALIDATION_RESOURCE_FAILURE;
    }
    return true;
  }
  if (character == '$') {
    embedded_dollar(walk, word_context);
    return true;
  }
  if (character == '#' && word_context && !frame->command.word.active) {
    if (!advance_to_comment_end(lexer, NULL)) {
      walk->result = ARITHMETIC_VALIDATION_RESOURCE_FAILURE;
    }
    return true;
  }
  return false;
}

static bool outside_case_header(const struct CaseTracker *active_case) {
  return active_case == NULL || active_case->state == CASE_TRACKER_BODY;
}

static bool embedded_left_bracket_step(
  struct EmbeddedWalk *walk,
  struct EmbeddedFrame *frame,
  bool in_body
) {
  TSLexer *lexer = walk->lexer;
  if (!in_body) return false;
  if (
    !frame->command.word.active &&
    command_reserved_position(frame->command.position) &&
    embedded_delimited(lexer, "[[")
  ) {
    reset_command_position(&frame->command, COMMAND_POSITION_CLOSED);
    embedded_walk_push(walk, '\0', EMBEDDED_CONDITIONAL);
    return true;
  }
  if (
    command_assignment_position(frame->command.position) &&
    !frame->command.redirect_operand &&
    frame->command.word.head == COMMAND_WORD_NAME
  ) {
    lexer->advance(lexer, false);
    frame->command.word.head = COMMAND_WORD_SUBSCRIPT;
    frame->command.word.name = false;
    frame->command.word.candidate = false;
    embedded_walk_push(walk, ']', EMBEDDED_SUBSCRIPT);
    return true;
  }
  return false;
}

static bool embedded_command_step(
  struct EmbeddedWalk *walk,
  struct EmbeddedFrame *frame,
  struct CaseTracker *active_case,
  int32_t character
) {
  TSLexer *lexer = walk->lexer;
  bool in_body = outside_case_header(active_case);
  if (character == '[' && embedded_left_bracket_step(walk, frame, in_body))
    return true;
  if (character == '&') {
    size_t position = probe_position(lexer);
    lexer->advance(lexer, false);
    if (lexer->lookahead == '>') {
      embedded_redirect(walk, frame, '>');
      return true;
    }
    probe_seek(lexer, position);
  }
  if ((character == '<' || character == '>') && in_body) {
    embedded_redirect(walk, frame, character);
    return true;
  }
  if (
    character == '{' &&
    !frame->command.word.active &&
    command_reserved_position(frame->command.position) &&
    in_body &&
    embedded_delimited(lexer, "{")
  ) {
    embedded_walk_push(walk, '}', EMBEDDED_BRACE_GROUP);
    return true;
  }
  if (character == '(') {
    embedded_open_parenthesis(walk, frame, active_case);
    return true;
  }
  if (character == ')') {
    embedded_close_parenthesis(walk, frame, active_case);
    return true;
  }
  if (character == ';' && active_case != NULL && in_body) {
    lexer->advance(lexer, false);
    if (lexer->lookahead == ';' || lexer->lookahead == '&') {
      lexer->advance(lexer, false);
      active_case->state = CASE_TRACKER_EXPECT_PATTERN;
    }
    reset_command_position(&frame->command, COMMAND_POSITION_START);
    return true;
  }
  return false;
}

static bool embedded_closer_step(
  struct EmbeddedWalk *walk,
  struct EmbeddedFrame *frame,
  bool in_command,
  const struct CaseTracker *active_case,
  int32_t character
) {
  TSLexer *lexer = walk->lexer;
  struct EmbeddedSkip *skip = walk->skip;
  if (
    (frame->kind == EMBEDDED_PARENTHESES || frame->kind == EMBEDDED_ARRAY) &&
    (character == '(' || character == ')')
  ) {
    lexer->advance(lexer, false);
    if (character == ')') {
      if (!embedded_pop_frame(skip))
        walk->result = ARITHMETIC_VALIDATION_INVALID;
    } else embedded_walk_push(walk, ')', EMBEDDED_PARENTHESES);
    return true;
  }
  if (!in_command && frame->closer == ']' && character == '[') {
    lexer->advance(lexer, false);
    embedded_walk_push(walk, ']', EMBEDDED_SUBSCRIPT);
    return true;
  }
  if (character == ']' && frame->closer == ']') {
    lexer->advance(lexer, false);
    if (!embedded_pop_frame(skip)) walk->result = ARITHMETIC_VALIDATION_INVALID;
    return true;
  }
  if (
    character == '}' &&
    frame->closer == '}' &&
    (!in_command ||
      (!frame->command.word.active &&
        !frame->command.redirect_operand &&
        command_reserved_position(frame->command.position) &&
        outside_case_header(active_case)))
  ) {
    if (!in_command || frame->kind == EMBEDDED_COMMAND_SUBSTITUTION) {
      lexer->advance(lexer, false);
    } else if (!embedded_delimited(lexer, "}")) {
      embedded_plain_character(walk, frame, in_command, character);
      return true;
    }
    if (!embedded_pop_frame(skip)) walk->result = ARITHMETIC_VALIDATION_INVALID;
    return true;
  }
  return false;
}

struct EmbeddedRoles {
  bool in_command;
  bool conditional;
  bool array;
  bool word_context;
};

static struct EmbeddedRoles embedded_roles(const struct EmbeddedFrame *frame) {
  struct EmbeddedRoles roles = {
    .conditional = frame->kind == EMBEDDED_CONDITIONAL,
    .array = frame->kind == EMBEDDED_ARRAY,
  };
  roles.in_command = frame->kind != EMBEDDED_SOURCE &&
    frame->kind != EMBEDDED_SUBSCRIPT &&
    frame->kind != EMBEDDED_PARENTHESES &&
    !roles.conditional &&
    !roles.array;
  roles.word_context = roles.in_command || roles.conditional || roles.array;
  return roles;
}

static void embedded_step(
  struct EmbeddedWalk *walk,
  struct EmbeddedFrame *frame,
  struct CaseTracker *active_case,
  int32_t character
) {
  TSLexer *lexer = walk->lexer;
  struct EmbeddedSkip *skip = walk->skip;
  struct EmbeddedRoles roles = embedded_roles(frame);
  bool in_command = roles.in_command;
  bool conditional = roles.conditional;
  bool array = roles.array;
  bool word_context = roles.word_context;
  if (frame->closer == '}' && !in_command) {
    if (!parameter_quote_step(&frame->parameter_quote, character)) {
      walk->result = ARITHMETIC_VALIDATION_RESOURCE_FAILURE;
      return;
    }
  }
  bool quoted_parameter = frame->kind == EMBEDDED_SOURCE &&
    frame->closer == '}' &&
    frame->quote == QUOTE_PARAMETER &&
    parameter_inherits_quotes(&frame->parameter_quote);
  if (character == SOURCE_BACKQUOTE_BOUNDARY) {
    embedded_backquote_boundary(walk, frame);
    return;
  }
  if (frame->closer == '"' || quoted_parameter) {
    embedded_quoted_step(walk, frame, character);
    return;
  }
  if (embedded_quote_step(walk, frame, word_context, character)) return;
  if (
    character == '\n' && (in_command || conditional) && skip->pending.count > 0
  ) {
    lexer->advance(lexer, false);
    walk->result =
      skip_embedded_here_document_bodies(walk->scanner, lexer, skip);
    reset_command_position(&frame->command, COMMAND_POSITION_START);
    return;
  }
  if (conditional) {
    embedded_conditional_step(walk, frame, character);
    return;
  }
  if (array && character == '[' && !frame->command.word.active) {
    embedded_note_word(skip, true);
    lexer->advance(lexer, false);
    embedded_walk_push(walk, ']', EMBEDDED_SUBSCRIPT);
    return;
  }
  if (array && !is_one_of(character, "()")) {
    embedded_plain_character(walk, frame, true, character);
    return;
  }
  if (in_command && embedded_command_step(walk, frame, active_case, character))
    return;
  if (embedded_closer_step(walk, frame, in_command, active_case, character))
    return;
  embedded_plain_character(walk, frame, in_command, character);
}

static bool begin_embedded_frames(
  const struct Scanner *scanner,
  TSLexer *lexer,
  char initial_closer,
  bool reset_quote,
  struct EmbeddedSkip *skip
) {
  skip->initial_quote = reset_quote ? QUOTE_DOUBLE : source_quote(scanner);
  bool braced_command =
    initial_closer == '}' && braced_command_follows(lexer->lookahead);
  if (braced_command && lexer->lookahead == '|') lexer->advance(lexer, false);
  if (!embedded_push_frame(
        skip,
        initial_closer,
        initial_closer == ')' || braced_command ? EMBEDDED_COMMAND_SUBSTITUTION
                                                : EMBEDDED_SOURCE
      ))
    return false;
  skip->started = true;
  if (initial_closer != '`') return true;
  skip->frames[0].kind = EMBEDDED_COMMAND_SUBSTITUTION;
  return lookahead_backquote_begin(
    lexer,
    scanner != NULL &&
      top_context_opener(scanner) == DQ_OPEN &&
      source_quote(scanner) == QUOTE_DOUBLE,
    &skip->frames[0].source_context
  );
}

struct EmbeddedCheckpoint {
  size_t position;
  size_t depth;
  struct EmbeddedFrame frame;
  size_t case_count;
  uint8_t case_state;
};

static void embedded_checkpoint_save(
  struct EmbeddedCheckpoint *checkpoint,
  const struct EmbeddedSkip *skip,
  size_t position
) {
  checkpoint->position = position;
  checkpoint->depth = skip->frame_count;
  checkpoint->frame = skip->frames[skip->frame_count - 1];
  checkpoint->case_count = skip->cases.length;
  if (checkpoint->case_count > 0) {
    checkpoint->case_state = skip->cases.data[checkpoint->case_count - 1].state;
  }
}

static void embedded_checkpoint_restore(
  const struct EmbeddedCheckpoint *checkpoint,
  struct EmbeddedSkip *skip,
  TSLexer *lexer
) {
  probe_seek(lexer, checkpoint->position);
  if (checkpoint->depth > 0) {
    skip->frames[checkpoint->depth - 1] = checkpoint->frame;
  }
  skip->cases.length = checkpoint->case_count;
  if (checkpoint->case_count > 0) {
    skip->cases.data[checkpoint->case_count - 1].state = checkpoint->case_state;
  }
}

static void embedded_close_word(
  TSLexer *lexer,
  struct EmbeddedFrame *frame,
  struct EmbeddedRoles roles
) {
  if (
    (roles.conditional || roles.array) &&
    is_token_delimiter(lexer) &&
    (!frame->regex || regex_boundary(lexer, 0))
  ) {
    if (frame->command.word.active) {
      frame->regex = false;
      frame->pattern = false;
    }
    reset_command_word(&frame->command.word);
  }
}

static enum ArithmeticValidation resume_embedded_construct(
  const struct Scanner *scanner,
  TSLexer *lexer,
  char initial_closer,
  bool reset_quote,
  struct EmbeddedSkip *skip
) {
  struct EmbeddedWalk walk = {
    .scanner = scanner,
    .lexer = lexer,
    .skip = skip,
    .result = ARITHMETIC_VALIDATION_VALID,
  };
  struct LookaheadLexer *lookahead = (struct LookaheadLexer *)lexer;
  struct EmbeddedCheckpoint checkpoint = {.position = lookahead->position};

  if (
    !skip->started &&
    !begin_embedded_frames(scanner, lexer, initial_closer, reset_quote, skip)
  ) {
    lookahead_fail(lookahead);
    return ARITHMETIC_VALIDATION_RESOURCE_FAILURE;
  }

  while (walk.result == ARITHMETIC_VALIDATION_VALID && skip->frame_count > 0) {
    if (lexer_at_eof(lexer)) {
      walk.result = ARITHMETIC_VALIDATION_INCOMPLETE;
      break;
    }

    struct EmbeddedFrame *frame = &skip->frames[skip->frame_count - 1];
    struct EmbeddedRoles roles = embedded_roles(frame);
    int32_t character = lexer->lookahead;
    embedded_checkpoint_save(&checkpoint, skip, lookahead->position);
    if (
      (roles.word_context || frame->kind == EMBEDDED_PARENTHESES) &&
      embedded_word_group(&walk, roles.word_context)
    )
      continue;
    embedded_close_word(lexer, frame, roles);
    bool array_assignment = roles.in_command &&
      character == '(' &&
      frame->command.word.head == COMMAND_WORD_ASSIGNMENT;

    if (
      roles.in_command &&
      is_token_delimiter(lexer) &&
      !finish_command_word(
        &skip->cases,
        skip->frame_count,
        &frame->command,
        character == '<' || character == '>'
      )
    ) {
      walk.result = ARITHMETIC_VALIDATION_RESOURCE_FAILURE;
      break;
    }
    struct CaseTracker *active_case = roles.in_command
      ? active_case_tracker(&skip->cases, skip->frame_count)
      : NULL;
    if (array_assignment && outside_case_header(active_case)) {
      lexer->advance(lexer, false);
      embedded_walk_push(&walk, ')', EMBEDDED_ARRAY);
    } else {
      embedded_step(&walk, frame, active_case, character);
    }
  }

  if (!lookahead->failed && lookahead->requested != SIZE_MAX) {
    embedded_checkpoint_restore(&checkpoint, skip, lexer);
  }
  if (walk.result == ARITHMETIC_VALIDATION_RESOURCE_FAILURE) {
    lookahead_fail(lookahead);
  }
  return walk.result;
}

static enum ArithmeticValidation skip_embedded_construct(
  const struct Scanner *scanner,
  TSLexer *lexer,
  char initial_closer,
  bool force_extglob
) {
  if (initial_closer == ')' && lexer->lookahead == '(') {
    return skip_ambiguous_substitution(scanner, lexer, force_extglob);
  }
  struct EmbeddedSkip skip = {.force_extglob = force_extglob};
  enum ArithmeticValidation result =
    resume_embedded_construct(scanner, lexer, initial_closer, false, &skip);
  clear_embedded_skip(&skip);
  return result;
}

static enum ArithmeticValidation skip_extglob_pattern(
  const struct Scanner *scanner,
  TSLexer *lexer,
  bool force_extglob
) {
  size_t start = probe_position(lexer);
  if (!is_extglob_operator(lexer->lookahead))
    return ARITHMETIC_VALIDATION_INVALID;
  lexer->advance(lexer, false);
  if (lexer->lookahead != '(') {
    probe_seek(lexer, start);
    return ARITHMETIC_VALIDATION_INVALID;
  }
  lexer->advance(lexer, false);
  struct EmbeddedSkip skip = {.force_extglob = force_extglob};
  if (!embedded_push_frame(&skip, ')', EMBEDDED_PARENTHESES))
    return ARITHMETIC_VALIDATION_RESOURCE_FAILURE;
  skip.started = true;
  enum ArithmeticValidation result =
    resume_embedded_construct(scanner, lexer, ')', false, &skip);
  clear_embedded_skip(&skip);
  return result;
}

static enum ArithmeticValidation
skip_subscript_source(const struct Scanner *scanner, TSLexer *lexer) {
  struct EmbeddedSkip skip = {0};
  if (!embedded_push_frame(&skip, ']', EMBEDDED_SUBSCRIPT))
    return ARITHMETIC_VALIDATION_RESOURCE_FAILURE;
  skip.started = true;
  enum ArithmeticValidation result =
    resume_embedded_construct(scanner, lexer, ']', false, &skip);
  clear_embedded_skip(&skip);
  return result;
}

static enum ArithmeticWord read_arithmetic_word(TSLexer *lexer) {
  enum ArithmeticWord state = ARITHMETIC_WORD_START;
  unsigned base = 0;
  bool decimal = true;
  do {
    int32_t ch = lexer->lookahead;
    if (!is_decimal_digit(ch)) decimal = false;
    if (decimal && base <= 64) base = base * 10 + (unsigned)(ch - '0');
    state = arithmetic_word_after(state, ch);
    lexer->advance(lexer, false);
  } while (is_name_character(lexer->lookahead));
  if (lexer->lookahead == '#' && decimal) {
    lexer->advance(lexer, false);
    bool any = false, valid = base >= 2 && base <= 64;
    while (is_name_character(lexer->lookahead) || lexer->lookahead == '@') {
      int32_t ch = lexer->lookahead;
      unsigned digit = is_decimal_digit(ch) ? (unsigned)(ch - '0')
        : ch >= 'a' && ch <= 'z'            ? (unsigned)(ch - 'a') + 10
        : ch >= 'A' && ch <= 'Z' ? (unsigned)(ch - 'A') + (base <= 36 ? 10 : 36)
        : ch == '@'              ? 62
                                 : 63;
      valid = valid && digit < base;
      any = true;
      lexer->advance(lexer, false);
    }
    state = any && valid ? ARITHMETIC_WORD_DECIMAL : ARITHMETIC_WORD_FRAGMENT;
  }
  if (
    state == ARITHMETIC_WORD_HEX_PREFIX &&
    !is_one_of(lexer->lookahead, "$'\"`\\")
  )
    return ARITHMETIC_WORD_HEX;
  return state;
}

static bool
validate_number_source(TSLexer *lexer, struct ArithmeticScan *scan) {
  if (!arithmetic_word_is_number(read_arithmetic_word(lexer))) {
    scan->source_only = true;
  }
  return append_validation_token(&scan->tokens, VALIDATION_TOKEN_NUMBER, 0);
}

static bool validate_operator_source(
  TSLexer *lexer,
  struct ArithmeticScan *scan,
  int32_t first
) {
  int32_t second = lexer->lookahead;
  size_t position = probe_position(lexer);
  lexer->advance(lexer, false);
  int32_t third = lexer->lookahead;
  size_t length;
  enum ArithmeticOperatorCategory classified =
    classify_arithmetic_operator(first, second, third, &length);
  if (
    classified == ARITHMETIC_OPERATOR_CATEGORY_UPDATE &&
    !(scan->tokens.length > 0 &&
      scan->tokens.data[scan->tokens.length - 1].kind ==
        VALIDATION_TOKEN_VARIABLE) &&
    !arithmetic_update_operand_may_follow(lexer)
  ) {
    classified = ARITHMETIC_OPERATOR_CATEGORY_ADDITIVE;
    length = 1;
  }
  probe_seek(lexer, position);
  uint8_t category = classified != ARITHMETIC_OPERATOR_CATEGORY_COUNT
    ? (uint8_t)classified
    : first == '~' ? VALIDATION_OPERATOR_TILDE
    : first == '!' ? VALIDATION_OPERATOR_BANG
                   : VALIDATION_OPERATOR_REPEATED_SIGN;
  for (; length > 1; length -= 1) {
    lexer->advance(lexer, false);
  }
  return append_validation_token(
    &scan->tokens,
    VALIDATION_TOKEN_OPERATOR,
    category
  );
}

static bool begin_embedded_skip(struct ArithmeticScan *scan, char closer) {
  scan->embedded_closer = closer;
  scan->embedded = ts_calloc(1, sizeof(struct EmbeddedSkip));
  if (scan->embedded != NULL)
    scan->embedded->force_extglob = scan->force_extglob;
  return scan->embedded != NULL;
}

static bool arithmetic_limit_reached(const TSLexer *lexer, size_t limit) {
  const struct LookaheadLexer *probe = (const struct LookaheadLexer *)lexer;
  size_t consumed = probe->length == 0
    ? probe->views[0].input->consumed
    : probe->characters[probe->position].raw_cut;
  return limit > 0 && consumed >= limit;
}

static bool skip_arithmetic_subscript(
  const struct Scanner *scanner,
  TSLexer *lexer,
  bool stop_semicolon,
  size_t limit
) {
  size_t brackets = 1;
  size_t parentheses = 0;
  while (!lexer_at_eof(lexer)) {
    if (arithmetic_limit_reached(lexer, limit)) return false;
    enum BracketAtom atom = skip_bracket_quoted_atom(scanner, lexer);
    if (atom == BRACKET_ATOM_END) return false;
    if (atom == BRACKET_ATOM_MEMBER) continue;
    int32_t character = lexer->lookahead;
    if (
      character == SOURCE_BACKQUOTE_BOUNDARY ||
      (character == ';' && stop_semicolon)
    )
      return false;
    if (character == '[') {
      if (brackets == SIZE_MAX) return false;
      brackets++;
    } else if (character == ']') {
      brackets--;
    } else if (character == '(') {
      if (parentheses == SIZE_MAX) return false;
      parentheses++;
    } else if (character == ')') {
      if (parentheses == 0) return false;
      parentheses--;
    }
    lexer->advance(lexer, false);
    if (brackets == 0) return parentheses == 0;
  }
  return false;
}

static bool
scan_substring_end(const struct Scanner *scanner, TSLexer *lexer, bool offset) {
  size_t parentheses = 0;
  size_t questions = 0;
  while (!lexer_at_eof(lexer)) {
    enum BracketAtom atom = skip_bracket_quoted_atom(scanner, lexer);
    if (atom == BRACKET_ATOM_END) return false;
    if (atom == BRACKET_ATOM_MEMBER) continue;
    int32_t ch = lexer->lookahead;
    if (ch == '}') return true;
    if (ch == SOURCE_BACKQUOTE_BOUNDARY) return false;
    if (offset) {
      if (ch == '(') {
        if (parentheses == SIZE_MAX) return false;
        parentheses++;
      } else if (ch == ')' && parentheses > 0) {
        parentheses--;
      } else if (parentheses == 0) {
        if (ch == '?') {
          if (questions == SIZE_MAX) return false;
          questions++;
        } else if (ch == ':') {
          if (questions == 0) return true;
          questions--;
        }
      }
    }
    lexer->advance(lexer, false);
  }
  return false;
}

static bool continue_arithmetic_embedded(
  const struct Scanner *scanner,
  TSLexer *lexer,
  struct ArithmeticScan *scan,
  enum ArithmeticValidation *result
) {
  enum ArithmeticValidation nested = !scan->embedded->started &&
      scan->embedded_closer == ')' &&
      lexer->lookahead == '('
    ? skip_ambiguous_substitution(scanner, lexer, scan->force_extglob)
    : resume_embedded_construct(
        scanner,
        lexer,
        scan->embedded_closer,
        !scan->bracket_delimited,
        scan->embedded
      );
  if (lookahead_is_pending(lexer)) {
    *result = nested;
    return false;
  }
  clear_embedded_skip(scan->embedded);
  ts_free(scan->embedded);
  scan->embedded = NULL;
  if (nested != ARITHMETIC_VALIDATION_VALID) {
    *result = nested;
    return false;
  }
  return record_arithmetic_expansion(scan, result);
}

static bool validate_arithmetic_right_parenthesis(
  TSLexer *lexer,
  struct ArithmeticScan *scan,
  enum ArithmeticValidation *result
) {
  lexer->advance(lexer, false);
  if (scan->group_depth > 0 || scan->limit > 0) {
    if (scan->group_depth > 0) scan->group_depth -= 1;
    if (!append_validation_token(
          &scan->tokens,
          VALIDATION_TOKEN_RIGHT_PARENTHESIS,
          0
        )) {
      *result = ARITHMETIC_VALIDATION_RESOURCE_FAILURE;
      return false;
    }
    return true;
  }
  *result = lexer_at_eof(lexer) ? ARITHMETIC_VALIDATION_INCOMPLETE
    : lexer->lookahead == ')'   ? ARITHMETIC_VALIDATION_VALID
                                : ARITHMETIC_VALIDATION_INVALID;
  return false;
}

static bool skip_subscript_text(
  const struct Scanner *scanner,
  TSLexer *lexer,
  bool bracket_delimited,
  bool stop_semicolon,
  size_t limit
) {
  return bracket_delimited
    ? skip_subscript_source(scanner, lexer) == ARITHMETIC_VALIDATION_VALID
    : skip_arithmetic_subscript(scanner, lexer, stop_semicolon, limit);
}

static bool validate_arithmetic_name(
  const struct Scanner *scanner,
  TSLexer *lexer,
  struct ArithmeticScan *scan
) {
  advance_name(lexer);
  if (lexer->lookahead == '[') {
    size_t position = probe_position(lexer);
    lexer->advance(lexer, false);
    if (!skip_subscript_text(
          scanner,
          lexer,
          scan->bracket_delimited,
          scan->stop_semicolon,
          scan->limit
        ))
      probe_seek(lexer, position);
  }
  return append_validation_token(&scan->tokens, VALIDATION_TOKEN_VARIABLE, 0);
}

static bool validate_arithmetic_dollar(
  TSLexer *lexer,
  struct ArithmeticScan *scan,
  enum ArithmeticValidation *result
) {
  lexer->advance(lexer, false);
  int32_t introducer = lexer->lookahead;
  if (introducer == '\'') {
    scan->source_only = true;
    if (!scan_delimiter_single_quoted_segment(lexer, NULL, true)) {
      *result = ARITHMETIC_VALIDATION_INCOMPLETE;
      return false;
    }
    return true;
  }
  if (is_dollar_group_opener(introducer)) {
    lexer->advance(lexer, false);
    if (!begin_embedded_skip(scan, dollar_group_closer(introducer))) {
      *result = ARITHMETIC_VALIDATION_RESOURCE_FAILURE;
      return false;
    }
    return true;
  }
  if (is_name_start_character(introducer)) {
    advance_name(lexer);
  } else if (
    is_decimal_digit(introducer) || is_special_parameter_character(introducer)
  ) {
    lexer->advance(lexer, false);
  } else if (lexer_at_eof(lexer)) {
    *result = ARITHMETIC_VALIDATION_INCOMPLETE;
    return false;
  } else {
    scan->source_only = true;
    return true;
  }
  return record_arithmetic_expansion(scan, result);
}

static bool validate_arithmetic_left_parenthesis(
  TSLexer *lexer,
  struct ArithmeticScan *scan
) {
  if (scan->group_depth == SIZE_MAX) return false;
  scan->group_depth += 1;
  lexer->advance(lexer, false);
  return append_validation_token(
    &scan->tokens,
    VALIDATION_TOKEN_LEFT_PARENTHESIS,
    0
  );
}

static bool validate_arithmetic_source_text(
  TSLexer *lexer,
  struct ArithmeticScan *scan,
  int32_t character,
  enum ArithmeticValidation *result
) {
  scan->source_only = true;
  if (character == '\'') {
    if (scan_delimiter_single_quoted_segment(lexer, NULL, false)) return true;
    *result = ARITHMETIC_VALIDATION_INCOMPLETE;
    return false;
  }
  lexer->advance(lexer, false);
  if (character == '"') {
    if (begin_embedded_skip(scan, '"')) return true;
    *result = ARITHMETIC_VALIDATION_RESOURCE_FAILURE;
    return false;
  }
  if (character == '\\' && !lexer_at_eof(lexer)) lexer->advance(lexer, false);
  return true;
}

static enum ArithmeticValidation validate_arithmetic_content(
  const struct Scanner *scanner,
  TSLexer *lexer,
  struct ArithmeticScan *scan
) {
  enum ArithmeticValidation result;

  while (true) {
    if (scan->embedded != NULL) {
      if (!continue_arithmetic_embedded(scanner, lexer, scan, &result))
        return result;
      continue;
    }
    int32_t character = lexer->lookahead;

    if (arithmetic_limit_reached(lexer, scan->limit))
      return ARITHMETIC_VALIDATION_VALID;

    if (lexer_at_eof(lexer) || character == SOURCE_BACKQUOTE_BOUNDARY) {
      return ARITHMETIC_VALIDATION_INCOMPLETE;
    }

    if (arithmetic_whitespace(character)) {
      lexer->advance(lexer, false);
      continue;
    }

    if (character == ';' && scan->stop_semicolon)
      return ARITHMETIC_VALIDATION_VALID;

    if (character == '(') {
      if (!validate_arithmetic_left_parenthesis(lexer, scan)) {
        return ARITHMETIC_VALIDATION_RESOURCE_FAILURE;
      }
      continue;
    }

    if (character == ')') {
      if (!validate_arithmetic_right_parenthesis(lexer, scan, &result))
        return result;
      continue;
    }

    if (is_decimal_digit(character)) {
      if (!validate_number_source(lexer, scan)) {
        return ARITHMETIC_VALIDATION_RESOURCE_FAILURE;
      }
      continue;
    }

    if (is_name_start_character(character)) {
      if (!validate_arithmetic_name(scanner, lexer, scan)) {
        return ARITHMETIC_VALIDATION_RESOURCE_FAILURE;
      }
      continue;
    }

    if (character == '$') {
      if (!validate_arithmetic_dollar(lexer, scan, &result)) return result;
      continue;
    }

    if (character == '`') {
      lexer->advance(lexer, false);
      if (!begin_embedded_skip(scan, '`')) {
        return ARITHMETIC_VALIDATION_RESOURCE_FAILURE;
      }
      continue;
    }

    if (is_arithmetic_operator_start(character) || character == '~') {
      lexer->advance(lexer, false);
      if (!validate_operator_source(lexer, scan, character)) {
        return ARITHMETIC_VALIDATION_RESOURCE_FAILURE;
      }
      continue;
    }

    if (!validate_arithmetic_source_text(lexer, scan, character, &result))
      return result;
  }
}

struct StructuredValidation {
  const struct ValidationToken *tokens;
  size_t count;
};

static bool validation_token_is_operator(
  const struct StructuredValidation *validation,
  size_t index,
  uint8_t category
) {
  return (
    index < validation->count &&
    validation->tokens[index].kind == VALIDATION_TOKEN_OPERATOR &&
    validation->tokens[index].category == category
  );
}

enum StructuredContext {
  STRUCTURED_CONTEXT_GROUP,
  STRUCTURED_CONTEXT_TERNARY,
};

static size_t structured_assignment_head_end(
  const struct StructuredValidation *validation,
  size_t index
) {
  if (
    index >= validation->count ||
    validation->tokens[index].kind != VALIDATION_TOKEN_VARIABLE ||
    !validation_token_is_operator(
      validation,
      index + 1,
      ARITHMETIC_OPERATOR_CATEGORY_ASSIGNMENT
    )
  ) {
    return SIZE_MAX;
  }
  index += 1;
  return index + 1;
}

static bool push_structured_context(
  uint8_t **contexts,
  size_t *count,
  size_t *capacity,
  enum StructuredContext context
) {
  uint8_t *grown =
    source_grow(*contexts, capacity, *count + 1, sizeof(**contexts));
  if (grown == NULL) {
    return false;
  }
  *contexts = grown;
  (*contexts)[*count] = (uint8_t)context;
  *count += 1;
  return true;
}

struct StructuredCursor {
  uint8_t *contexts;
  size_t context_count;
  size_t context_capacity;
  size_t index;
  bool expecting_operand;
  bool at_expression_start;
};

static bool structured_cursor_push(
  struct StructuredCursor *cursor,
  enum StructuredContext context
) {
  return push_structured_context(
    &cursor->contexts,
    &cursor->context_count,
    &cursor->context_capacity,
    context
  );
}

static bool structured_cursor_pop(
  struct StructuredCursor *cursor,
  enum StructuredContext context
) {
  if (
    cursor->context_count == 0 ||
    cursor->contexts[cursor->context_count - 1] != context
  )
    return false;
  cursor->context_count -= 1;
  return true;
}

static enum ArithmeticValidation structured_operand_step(
  const struct StructuredValidation *validation,
  struct StructuredCursor *cursor
) {
  const struct ValidationToken *token = &validation->tokens[cursor->index];
  if (
    validation_token_is_operator(
      validation,
      cursor->index,
      ARITHMETIC_OPERATOR_CATEGORY_UPDATE
    )
  ) {
    if (
      cursor->index + 1 >= validation->count ||
      validation->tokens[cursor->index + 1].kind != VALIDATION_TOKEN_VARIABLE
    )
      return ARITHMETIC_VALIDATION_INVALID;
    cursor->expecting_operand = false;
    cursor->index += 2;
    return ARITHMETIC_VALIDATION_VALID;
  }
  if (cursor->at_expression_start) {
    size_t after_head =
      structured_assignment_head_end(validation, cursor->index);
    if (after_head != SIZE_MAX) {
      cursor->index = after_head;
      return ARITHMETIC_VALIDATION_VALID;
    }
  }
  if (
    token->kind == VALIDATION_TOKEN_NUMBER ||
    token->kind == VALIDATION_TOKEN_VARIABLE ||
    token->kind == VALIDATION_TOKEN_EXPANSION
  ) {
    cursor->expecting_operand = false;
    cursor->index += 1;
    if (
      token->kind == VALIDATION_TOKEN_VARIABLE &&
      validation_token_is_operator(
        validation,
        cursor->index,
        ARITHMETIC_OPERATOR_CATEGORY_UPDATE
      )
    )
      cursor->index += 1;
    return ARITHMETIC_VALIDATION_VALID;
  }
  if (token->kind == VALIDATION_TOKEN_LEFT_PARENTHESIS) {
    if (!structured_cursor_push(cursor, STRUCTURED_CONTEXT_GROUP))
      return ARITHMETIC_VALIDATION_RESOURCE_FAILURE;
    cursor->at_expression_start = true;
    cursor->index += 1;
    return ARITHMETIC_VALIDATION_VALID;
  }
  if (
    token->kind == VALIDATION_TOKEN_OPERATOR &&
    (token->category == ARITHMETIC_OPERATOR_CATEGORY_ADDITIVE ||
      token->category == VALIDATION_OPERATOR_BANG ||
      token->category == VALIDATION_OPERATOR_TILDE)
  ) {
    cursor->at_expression_start = false;
    cursor->index += 1;
    return ARITHMETIC_VALIDATION_VALID;
  }
  return ARITHMETIC_VALIDATION_INVALID;
}

static enum ArithmeticValidation structured_operator_step(
  const struct StructuredValidation *validation,
  struct StructuredCursor *cursor
) {
  const struct ValidationToken *token = &validation->tokens[cursor->index];
  if (token->kind == VALIDATION_TOKEN_RIGHT_PARENTHESIS) {
    if (!structured_cursor_pop(cursor, STRUCTURED_CONTEXT_GROUP))
      return ARITHMETIC_VALIDATION_INVALID;
    cursor->index += 1;
    return ARITHMETIC_VALIDATION_VALID;
  }
  if (token->kind != VALIDATION_TOKEN_OPERATOR)
    return ARITHMETIC_VALIDATION_INVALID;
  if (
    token->category >= ARITHMETIC_OPERATOR_CATEGORY_LOGICAL_OR &&
    token->category <= ARITHMETIC_OPERATOR_CATEGORY_COMMA
  ) {
    cursor->expecting_operand = true;
    cursor->at_expression_start =
      token->category == ARITHMETIC_OPERATOR_CATEGORY_COMMA;
    cursor->index += 1;
    return ARITHMETIC_VALIDATION_VALID;
  }
  if (token->category == ARITHMETIC_OPERATOR_CATEGORY_QUESTION) {
    if (!structured_cursor_push(cursor, STRUCTURED_CONTEXT_TERNARY))
      return ARITHMETIC_VALIDATION_RESOURCE_FAILURE;
  } else if (token->category == ARITHMETIC_OPERATOR_CATEGORY_COLON) {
    if (!structured_cursor_pop(cursor, STRUCTURED_CONTEXT_TERNARY))
      return ARITHMETIC_VALIDATION_INVALID;
  } else {
    return ARITHMETIC_VALIDATION_INVALID;
  }
  cursor->expecting_operand = true;
  cursor->at_expression_start =
    token->category == ARITHMETIC_OPERATOR_CATEGORY_QUESTION;
  cursor->index += 1;
  return ARITHMETIC_VALIDATION_VALID;
}

static enum ArithmeticValidation
validate_structured_expression(const struct StructuredValidation *validation) {
  struct StructuredCursor cursor = {
    .expecting_operand = true,
    .at_expression_start = true,
  };
  enum ArithmeticValidation result = ARITHMETIC_VALIDATION_VALID;
  while (
    result == ARITHMETIC_VALIDATION_VALID && cursor.index < validation->count
  ) {
    result = cursor.expecting_operand
      ? structured_operand_step(validation, &cursor)
      : structured_operator_step(validation, &cursor);
  }
  if (
    result == ARITHMETIC_VALIDATION_VALID &&
    (cursor.expecting_operand || cursor.context_count != 0)
  )
    result = ARITHMETIC_VALIDATION_INVALID;
  ts_free(cursor.contexts);
  return result;
}

static bool increase_substitution_depth(struct Scanner *scanner) {
  if (scanner->substitution_depth == SIZE_MAX) {
    return false;
  }

  scanner->substitution_depth += 1;
  if (!scanner_state_fits(scanner)) {
    scanner->substitution_depth -= 1;
    return false;
  }
  return true;
}

static bool finish_command_substitution_body_begin(
  struct Scanner *scanner,
  TSLexer *lexer
) {
  if (!increase_substitution_depth(scanner)) {
    return false;
  }

  lexer->result_symbol = COMMAND_SUBSTITUTION_BODY_BEGIN;
  return true;
}

static enum TokenType classify_arithmetic_source(
  const struct Scanner *scanner,
  TSLexer *lexer,
  struct ArithmeticScan *scan,
  enum ArithmeticValidation *result
) {
  *result = validate_arithmetic_content(scanner, lexer, scan);

  enum TokenType symbol = TOKEN_COUNT;
  if (*result == ARITHMETIC_VALIDATION_VALID) {
    struct StructuredValidation validation = {
      .tokens = scan->tokens.data,
      .count = scan->tokens.length,
    };
    enum ArithmeticValidation structured = scan->source_only
      ? ARITHMETIC_VALIDATION_INVALID
      : validate_structured_expression(&validation);
    if (structured == ARITHMETIC_VALIDATION_RESOURCE_FAILURE) {
      *result = structured;
    } else if (structured == ARITHMETIC_VALIDATION_VALID) {
      symbol = ARITHMETIC_LEFT_PARENTHESIS;
    } else {
      symbol = ARITHMETIC_SOURCE_LEFT_PARENTHESIS;
    }
  } else if (*result == ARITHMETIC_VALIDATION_INCOMPLETE) {
    symbol = ARITHMETIC_LEFT_PARENTHESIS;
  }

  if (*result == ARITHMETIC_VALIDATION_RESOURCE_FAILURE) {
    probe_fail(lexer);
  }
  return symbol;
}

static enum TokenType classify_arithmetic_scan(
  const struct Scanner *scanner,
  TSLexer *lexer,
  struct ArithmeticScan *scan,
  enum ArithmeticValidation *result
) {
  enum TokenType symbol =
    classify_arithmetic_source(scanner, lexer, scan, result);
  clear_arithmetic_scan(scan);
  return symbol;
}

static bool ambiguous_command_boundary(
  const struct Scanner *scanner,
  TSLexer *lexer,
  size_t start
) {
  probe_seek(lexer, start);
  struct EmbeddedSkip skip = {0};
  if (!embedded_push_frame(&skip, ')', EMBEDDED_PARENTHESES)) return false;
  skip.started = true;
  enum ArithmeticValidation result =
    resume_embedded_construct(scanner, lexer, ')', false, &skip);
  /* Comment skipping forks the lookahead view, so compare raw offsets. */
  size_t end = lexer_raw_position(lexer);
  clear_embedded_skip(&skip);
  if (result != ARITHMETIC_VALIDATION_VALID || lookahead_is_pending(lexer))
    return false;
  probe_seek(lexer, start);
  result = resume_embedded_construct(scanner, lexer, ')', false, &skip);
  clear_embedded_skip(&skip);
  return result == ARITHMETIC_VALIDATION_VALID &&
    lexer_raw_position(lexer) == end;
}

static bool scan_arithmetic_left_parenthesis(
  struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid_symbols
) {
  lexer->mark_end(lexer);
  lexer->advance(lexer, false);
  struct ArithmeticScan scan = {
    .bracket_delimited = bracket_delimited_arithmetic(scanner)
  };
  enum ArithmeticValidation result;
  enum TokenType symbol =
    classify_arithmetic_scan(scanner, lexer, &scan, &result);
  if (lookahead_is_pending(lexer)) {
    return false;
  }
  if (result == ARITHMETIC_VALIDATION_INCOMPLETE) {
    symbol = valid_symbols[ARITHMETIC_LEFT_PARENTHESIS]
      ? ARITHMETIC_LEFT_PARENTHESIS
      : ARITHMETIC_SOURCE_LEFT_PARENTHESIS;
  }

  if (symbol == TOKEN_COUNT) {
    return false;
  }
  if (!valid_symbols[symbol]) return false;

  lexer->result_symbol = (TSSymbol)symbol;
  return true;
}

static bool scan_substitution_open(
  struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  lexer->advance(lexer, false);
  lexer->mark_end(lexer);
  enum TokenType symbol = COMMAND_OPEN;
  if (lexer->lookahead == '(') {
    size_t start = probe_position(lexer);
    lexer->advance(lexer, false);
    struct ArithmeticScan scan = {0};
    enum ArithmeticValidation result;
    classify_arithmetic_scan(scanner, lexer, &scan, &result);
    if (lookahead_is_pending(lexer)) return false;
    symbol = result == ARITHMETIC_VALIDATION_INVALID
      ? (ambiguous_command_boundary(scanner, lexer, start) ? COMMAND_OPEN
                                                           : TOKEN_COUNT)
      : ARITHMETIC_EXPANSION_OPEN;
  }
  lexer->result_symbol = symbol;
  return symbol == TOKEN_COUNT || valid[symbol];
}

static bool pattern_range_endpoint(const bool *valid) {
  return !valid[PUNCT_RIGHT_BRACKET] &&
    !valid[PATTERN_INITIAL_RIGHT_BRACKET_BEGIN];
}

static bool pattern_element_here(
  struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  size_t start = probe_position(lexer);
  lexer->advance(lexer, false);
  bool marked = is_one_of(lexer->lookahead, ":.=");
  probe_seek(lexer, start);
  if (!marked) return false;
  size_t position = lexer_raw_position(lexer);
  size_t element = bracket_cache(scanner)->element_remaining;
  if (element <= position) {
    struct BracketScan scan = bracket_scan(pattern_mode(
      scanner,
      parameter_pattern_context(scanner),
      valid[ASSIGNMENT_PATTERN_BRACKET_CHARACTER]
    ));
    uint32_t chains = 0;
    bool complete;
    scan_bracket_members(
      scanner,
      lexer,
      &scan,
      pattern_range_endpoint(valid) ? BRACKET_PHASE_RANGE
                                    : BRACKET_PHASE_MEMBERS,
      &chains,
      &complete,
      true
    );
    probe_seek(lexer, start);
    if (lookahead_is_pending(lexer)) return false;
    record_bracket_scan(scanner, &scan, true);
    element = scan.element + 1;
  }
  return element == position + 1;
}

static bool scan_pattern_special_left_bracket(
  struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  if (lexer->lookahead != '[' || !pattern_element_here(scanner, lexer, valid))
    return false;
  lexer->advance(lexer, false);
  lexer->mark_end(lexer);
  lexer->result_symbol = PATTERN_SPECIAL_LEFT_BRACKET;
  return true;
}

static bool scan_dollar_expansion_start(TSLexer *lexer) {
  if (lexer->lookahead != '$') {
    return false;
  }

  lexer->advance(lexer, false);
  if (
    is_parameter_start_character(lexer->lookahead) ||
    is_one_of(lexer->lookahead, "({[")
  ) {
    return accept_token(lexer, DOLLAR_EXPANSION_START);
  }

  return false;
}

static bool
scan_braced_numeric_parameter_start(TSLexer *lexer, const bool *valid_symbols) {
  if (!is_decimal_digit(lexer->lookahead)) {
    return false;
  }

  lexer->mark_end(lexer);
  bool has_digit = false;
  bool has_multiple_digits = false;
  bool has_nonzero_digit = false;

  while (is_decimal_digit(lexer->lookahead)) {
    if (has_digit) {
      has_multiple_digits = true;
    }
    has_digit = true;
    if (lexer->lookahead != '0') {
      has_nonzero_digit = true;
    }
    lexer->advance(lexer, false);
  }

  if (has_nonzero_digit && valid_symbols[BRACED_POSITIONAL_PARAMETER_START]) {
    return accept_token(lexer, BRACED_POSITIONAL_PARAMETER_START);
  }

  if (
    !has_nonzero_digit &&
    has_multiple_digits &&
    valid_symbols[BRACED_PARAMETER_NUMBER_START]
  ) {
    lexer->result_symbol = BRACED_PARAMETER_NUMBER_START;
    return true;
  }

  return false;
}

static bool
command_element_boundary_symbols_are_valid(const bool *valid_symbols) {
  return (
    assignment_separator_is_valid(valid_symbols) ||
    valid_symbols[REDIRECT_SEPARATOR_BEGIN] ||
    valid_symbols[PIPE_CONTINUATION] ||
    valid_symbols[AND_OR_CONTINUATION] ||
    valid_symbols[TERM_CONTINUATION]
  );
}

static bool element_boundary_symbols_are_valid(const bool *valid_symbols) {
  return valid_symbols[WORD_SEPARATOR_BEGIN] ||
    command_element_boundary_symbols_are_valid(valid_symbols);
}

static bool here_document_end_is_ready(
  const struct Scanner *scanner,
  const TSLexer *lexer
) {
  return scanner->active.documents.count > 0 &&
    ((!scanner->active.at_line_start &&
       scanner->here_document_end_line_consumed) ||
      lexer_at_eof(lexer));
}

static bool
scan_here_document_end_commit(struct Scanner *scanner, TSLexer *lexer) {
  if (!here_document_end_is_ready(scanner, lexer)) {
    return false;
  }
  scanner->here_document_end_line_consumed = false;
  lexer->mark_end(lexer);
  lexer->result_symbol = HERE_DOCUMENT_END_COMMIT;
  finish_active_document(scanner);
  return true;
}

static bool scan_here_document_content_line_start(
  struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid_symbols
) {
  if (
    !scanner->active.at_line_start ||
    !valid_symbols[HERE_DOCUMENT_CONTENT_LINE_START]
  ) {
    return false;
  }
  lexer->mark_end(lexer);
  scanner->active.at_line_start = false;
  lexer->result_symbol = HERE_DOCUMENT_CONTENT_LINE_START;
  return true;
}

static bool scan_here_document_body_newline(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid_symbols
) {
  lexer->mark_end(lexer);
  if (
    finish_term_continuation(scanner, lexer, valid_symbols) !=
    TERM_SOURCE_CONTINUES
  ) {
    return false;
  }
  lexer->result_symbol = SEPARATOR_NEWLINE;
  return true;
}

static bool scan_here_document_sequence_end(
  struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid_symbols
) {
  if (!scanner->sequence_end_pending) {
    return false;
  }

  scanner->sequence_end_pending = false;
  restore_suspended_documents(scanner);
  lexer->mark_end(lexer);
  finish_term_continuation(scanner, lexer, valid_symbols);
  lexer->result_symbol = HERE_DOCUMENT_SEQUENCE_END;
  return true;
}

static bool element_boundary_starts(TSLexer *lexer, const bool *valid) {
  return element_boundary_symbols_are_valid(valid) &&
    (is_horizontal_blank(lexer->lookahead) ||
      is_one_of(lexer->lookahead, ";&|\n#"));
}

static bool shell_boundary_starts(TSLexer *lexer, const bool *valid) {
  int32_t character = lexer->lookahead;
  bool comment_boundary =
    valid[COMMENT_BOUNDARY] || valid[TRAILING_COMMENT_BOUNDARY];
  bool shell_boundary = valid[PATTERN_CONTINUATION] ||
    valid[PATTERN_END] ||
    valid[PIPE_CONTINUATION] ||
    valid[AND_OR_CONTINUATION] ||
    valid[REDIRECT_LIST_BEGIN] ||
    valid[CASE_ITEM_END] ||
    comment_boundary;
  return shell_boundary &&
    (is_horizontal_blank(character) ||
      (character == '|' &&
        (valid[PATTERN_CONTINUATION] ||
          valid[PIPE_CONTINUATION] ||
          valid[AND_OR_CONTINUATION])) ||
      (character == '&' && valid[AND_OR_CONTINUATION]) ||
      (character == ')' && valid[PATTERN_END]) ||
      (character == ';' && valid[CASE_ITEM_END]) ||
      (character == '#' && comment_boundary) ||
      ((character == '<' ||
         character == '>' ||
         character == '{' ||
         character == '&' ||
         is_decimal_digit(character)) &&
        valid[REDIRECT_LIST_BEGIN]));
}

struct FunctionNameShape {
  bool plain;
  bool name_prefix;
  bool subscripted;
  bool appended;
};

static bool accept_function_name(
  TSLexer *lexer,
  const bool *valid,
  bool explicit_name,
  bool plain,
  const char *word
) {
  lexer->mark_end(lexer);
  if (!explicit_name) {
    if (plain && reserved_as_command(find_reserved_word(word), valid))
      return false;
    scan_horizontal_blanks(lexer);
    if (lexer->lookahead != '(') return false;
  }
  lexer->result_symbol = explicit_name ? EXPLICIT_FNAME_BEGIN : FNAME_TOKEN;
  return true;
}

static bool scan_bash_function_name(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  bool explicit_name = valid[EXPLICIT_FNAME_BEGIN];
  if (
    (!explicit_name && !valid[FNAME_TOKEN]) ||
    lexer_at_eof(lexer) ||
    lexer->lookahead == '#'
  )
    return false;
  size_t start = probe_position(lexer);
  char word[RESERVED_WORD_LENGTH + 1] = {0};
  size_t length = 0;
  struct FunctionNameShape shape = {
    .plain = true,
    .name_prefix = !explicit_name && is_name_start_character(lexer->lookahead),
  };
  while (!lexer_at_eof(lexer)) {
    if (is_one_of(lexer->lookahead, "$'\"\\")) return false;
    enum ArithmeticValidation substitution =
      skip_process_substitution(scanner, lexer, false);
    if (substitution == ARITHMETIC_VALIDATION_VALID) {
      shape = (struct FunctionNameShape){0};
      continue;
    }
    if (substitution != ARITHMETIC_VALIDATION_INVALID) return false;
    if (is_token_delimiter(lexer)) break;
    int32_t ch = lexer->lookahead;
    if (ch == '=' && (shape.name_prefix || shape.subscripted || shape.appended))
      return false;
    if (shape.name_prefix && ch == '[') {
      if (!skip_subscript_body(scanner, lexer)) return false;
      shape.plain = false;
      shape.name_prefix = false;
      shape.subscripted = true;
      continue;
    }
    if (extglob_enabled(scanner) && is_extglob_operator(ch)) {
      enum ArithmeticValidation pattern =
        skip_extglob_pattern(scanner, lexer, false);
      if (pattern == ARITHMETIC_VALIDATION_VALID) {
        shape = (struct FunctionNameShape){0};
        continue;
      }
      if (pattern != ARITHMETIC_VALIDATION_INVALID) return false;
    }
    shape.appended = ch == '+' && (shape.name_prefix || shape.subscripted);
    shape.subscripted = false;
    shape.name_prefix = shape.name_prefix && is_name_character(ch);
    enum BracketAtom atom = skip_bracket_quoted_atom(scanner, lexer);
    if (atom == BRACKET_ATOM_END) return false;
    if (atom == BRACKET_ATOM_MEMBER) {
      shape.plain = false;
    } else {
      if (!is_ascii(ch)) shape.plain = false;
      if (length < sizeof(word) - 1) word[length++] = (char)ch;
      else shape.plain = false;
      lexer->advance(lexer, false);
    }
  }
  if (length == 0 && shape.plain) return false;
  /* Nested lookahead can switch views, so cached positions do not order source. */
  size_t end = probe_position(lexer);
  size_t end_source = lexer_raw_position(lexer);
  probe_seek(lexer, start);
  while (lexer_raw_position(lexer) < end_source) {
    if (lexer_at_eof(lexer) || is_one_of(lexer->lookahead, "$'\"\\"))
      return false;
    lexer->advance(lexer, false);
  }
  probe_seek(lexer, end);
  return accept_function_name(lexer, valid, explicit_name, shape.plain, word);
}

static bool read_ascii_word(
  TSLexer *lexer,
  size_t end,
  char word[RESERVED_WORD_LENGTH + 1]
) {
  size_t length = 0;
  word[0] = '\0';
  while (
    end == SIZE_MAX ? !is_token_delimiter(lexer) : probe_position(lexer) != end
  ) {
    if (length == RESERVED_WORD_LENGTH || !is_ascii(lexer->lookahead)) {
      word[0] = '\0';
      return false;
    }
    word[length++] = (char)lexer->lookahead;
    word[length] = '\0';
    lexer->advance(lexer, false);
  }
  return true;
}

static bool scan_coproc_word(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  if (!is_word_element_start(lexer)) return false;
  size_t start = probe_position(lexer);
  struct SeparatorTarget target = scan_separator_target(scanner, lexer, false);
  if (probe_position(lexer) != start) probe_seek(lexer, start);
  if (target.assignment || target.redirect) return false;
  if (is_name_start_character(lexer->lookahead)) {
    advance_name(lexer);
    if (lexer->lookahead == '[') {
      if (!skip_subscript_body(scanner, lexer)) return false;
    }
  }
  if (
    skip_command_word(scanner, lexer, NULL, false) !=
    ARITHMETIC_VALIDATION_VALID
  )
    return false;
  size_t end = probe_position(lexer);
  if (end == start || lookahead_is_pending(lexer)) return false;
  char name[RESERVED_WORD_LENGTH + 1];
  probe_seek(lexer, start);
  read_ascii_word(lexer, end, name);
  const struct ReservedWord *reserved = find_reserved_word(name);
  if (reserved != NULL && reserved->symbol != TIME_KEYWORD) {
    lexer->result_symbol = TOKEN_COUNT;
    return !valid[reserved->symbol];
  }
  probe_seek(lexer, end);
  scan_horizontal_blanks(lexer);
  lexer->result_symbol = COPROC_NAME_START;
  if (lexer->lookahead == '(') return true;
  char word[RESERVED_WORD_LENGTH + 1];
  if (!read_ascii_word(lexer, SIZE_MAX, word)) return false;
  if (
    !reserved_word_delimiter(lexer) ||
    (strcmp(word, "!") == 0 && lexer->lookahead == '(')
  )
    return false;
  reserved = find_reserved_word(word);
  if (reserved == NULL || reserved->symbol == TIME_KEYWORD) return false;
  switch (reserved->symbol) {
    case LEFT_BRACE:
    case CONDITIONAL_OPEN_BEGIN:
    case IF_KEYWORD:
    case FOR_KEYWORD:
    case SELECT_KEYWORD:
    case CASE_KEYWORD:
    case WHILE_KEYWORD:
    case UNTIL_KEYWORD:
      return true;
    default:
      lexer->result_symbol = COPROC_BARE_COMMAND_START;
      return true;
  }
}

static enum DispatchResult dispatch_retreat(TSLexer *lexer, size_t position) {
  probe_seek(lexer, position);
  return DISPATCH_NEXT;
}

static enum DispatchResult dispatch_substitution_open(
  struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  if (!valid[ARITHMETIC_EXPANSION_OPEN] || lexer->lookahead != '(')
    return DISPATCH_NEXT;
  return dispatch_outcome(scan_substitution_open(scanner, lexer, valid));
}

static bool source_context_push(struct Scanner *scanner, enum TokenType opener);

static bool declaration_subscript_braces_nested(
  const struct Scanner *scanner,
  TSLexer *lexer,
  size_t end
) {
  advance_name(lexer);
  if (lexer->lookahead != '[') return true;
  size_t depth = 0;
  while (probe_position(lexer) < end) {
    enum BracketAtom atom = skip_bracket_quoted_atom(scanner, lexer);
    if (atom == BRACKET_ATOM_END) return false;
    if (atom == BRACKET_ATOM_MEMBER) continue;
    int32_t ch = lexer->lookahead;
    if (ch == '{') {
      size_t position = probe_position(lexer);
      if (scan_brace_expansion(scanner, lexer, NULL)) continue;
      probe_seek(lexer, position);
    }
    if (ch == '[') depth++;
    else if (ch == ']') {
      if (depth == 0) return false;
      depth--;
    }
    lexer->advance(lexer, false);
  }
  return depth == 0 && probe_position(lexer) == end;
}

static enum DispatchResult dispatch_declaration_assignment_start(
  struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  if (
    (!valid[DECLARATION_ASSIGNMENT_START] &&
      !valid[COPROC_DECLARATION_ASSIGNMENT_START]) ||
    !is_name_start_character(lexer->lookahead)
  )
    return DISPATCH_NEXT;
  bool lead = !valid[DECLARATION_ASSIGNMENT_START];
  size_t position = probe_position(lexer);
  lexer->mark_end(lexer);
  if (scan_separator_target(scanner, lexer, !lead).assignment) {
    size_t end = probe_position(lexer);
    lexer->advance(lexer, false);
    bool array = lexer->lookahead == '(';
    if (!array) {
      probe_seek(lexer, position);
      if (!declaration_subscript_braces_nested(scanner, lexer, end))
        return dispatch_retreat(lexer, position);
    }
    lexer->result_symbol =
      lead ? COPROC_DECLARATION_ASSIGNMENT_START : DECLARATION_ASSIGNMENT_START;
    return dispatch_outcome(
      array || source_context_push(scanner, DECLARATION_ASSIGNMENT_START)
    );
  }
  return dispatch_retreat(lexer, position);
}

static enum DispatchResult
dispatch_time_option_start(TSLexer *lexer, const bool *valid) {
  if (!valid[TIME_OPTION_START] && !valid[TIME_END_START]) return DISPATCH_NEXT;
  size_t position = probe_position(lexer);
  lexer->mark_end(lexer);
  if (scan_horizontal_blanks(lexer)) {
    enum TimeOption option = read_time_option(lexer);
    if (
      option == TIME_OPTION_END_OF_OPTIONS ||
      (option == TIME_OPTION_POSIX && valid[TIME_OPTION_START])
    ) {
      lexer->result_symbol =
        valid[TIME_OPTION_START] ? TIME_OPTION_START : TIME_END_START;
      return DISPATCH_ACCEPTED;
    }
  }
  return dispatch_retreat(lexer, position);
}

static enum DispatchResult
dispatch_conditional_junction_boundary(TSLexer *lexer, const bool *valid) {
  if (!valid[CONDITIONAL_AND_BOUNDARY] && !valid[CONDITIONAL_OR_BOUNDARY])
    return DISPATCH_NEXT;
  size_t position = probe_position(lexer);
  lexer->mark_end(lexer);
  skip_arithmetic_whitespace(lexer);
  while (lexer->lookahead == '#' && advance_to_comment_end(lexer, NULL))
    skip_arithmetic_whitespace(lexer);
  int32_t ch = lexer->lookahead;
  enum TokenType symbol =
    ch == '&' ? CONDITIONAL_AND_BOUNDARY : CONDITIONAL_OR_BOUNDARY;
  if ((ch == '&' || ch == '|') && valid[symbol]) {
    lexer->advance(lexer, false);
    if (lexer->lookahead == ch) {
      lexer->result_symbol = symbol;
      return DISPATCH_ACCEPTED;
    }
  }
  return dispatch_retreat(lexer, position);
}

static enum DispatchResult dispatch_coproc_name_start(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  if (!valid[COPROC_NAME_START] && !valid[COPROC_BARE_COMMAND_START])
    return DISPATCH_NEXT;
  size_t position = probe_position(lexer);
  bool recognized = scan_coproc_word(scanner, lexer, valid);
  probe_seek(lexer, position);
  if (!recognized) return DISPATCH_NEXT;
  lexer->mark_end(lexer);
  return DISPATCH_ACCEPTED;
}

static enum DispatchResult
dispatch_function_parentheses_start(TSLexer *lexer, const bool *valid) {
  if (!valid[FUNCTION_PARENTHESES_START]) return DISPATCH_NEXT;
  size_t position = probe_position(lexer);
  lexer->mark_end(lexer);
  scan_horizontal_blanks(lexer);
  if (lexer->lookahead == '(') {
    lexer->advance(lexer, false);
    scan_horizontal_blanks(lexer);
    if (lexer->lookahead == ')') {
      lexer->result_symbol = FUNCTION_PARENTHESES_START;
      return DISPATCH_ACCEPTED;
    }
  }
  return dispatch_retreat(lexer, position);
}

static enum DispatchResult dispatch_array_element_start(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  if (!valid[ARRAY_ELEMENT_START] || lexer->lookahead != '[')
    return DISPATCH_NEXT;
  lexer->mark_end(lexer);
  if (!skip_subscript_body(scanner, lexer)) return DISPATCH_REJECTED;
  if (lexer->lookahead == '+') lexer->advance(lexer, false);
  if (lexer->lookahead != '=') return DISPATCH_REJECTED;
  lexer->result_symbol = ARRAY_ELEMENT_START;
  return DISPATCH_ACCEPTED;
}

static enum DispatchResult dispatch_subscript_start(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  if (
    !valid[SUBSCRIPT_ALL_ELEMENTS_BEGIN] &&
    !valid[SUBSCRIPT_EXPRESSION_START] &&
    !valid[SUBSCRIPT_SOURCE_START]
  )
    return DISPATCH_NEXT;
  if (
    lexer_at_eof(lexer) ||
    lexer->lookahead == ']' ||
    lexer->lookahead == SOURCE_BACKQUOTE_BOUNDARY
  )
    return DISPATCH_REJECTED;
  struct LookaheadLexer *probe = (struct LookaheadLexer *)lexer;
  size_t position = probe->position;
  if (
    valid[SUBSCRIPT_ALL_ELEMENTS_BEGIN] && is_one_of(lexer->lookahead, "@*")
  ) {
    lexer->advance(lexer, false);
    if (lexer->lookahead == ']') {
      return dispatch_outcome(
        accept_token(lexer, SUBSCRIPT_ALL_ELEMENTS_BEGIN)
      );
    }
    lookahead_seek(probe, position);
  }
  lexer->mark_end(lexer);
  enum ArithmeticValidation complete = skip_subscript_source(scanner, lexer);
  if (lookahead_is_pending(lexer)) return DISPATCH_REJECTED;
  if (complete == ARITHMETIC_VALIDATION_RESOURCE_FAILURE) {
    lookahead_fail(probe);
    return DISPATCH_REJECTED;
  }
  enum TokenType symbol = SUBSCRIPT_SOURCE_START;
  if (complete == ARITHMETIC_VALIDATION_VALID) {
    size_t limit = probe->characters[probe->position - 1].raw_cut;
    lookahead_seek(probe, position);
    struct ArithmeticScan scan = {.limit = limit, .bracket_delimited = true};
    enum ArithmeticValidation result;
    enum TokenType classified =
      classify_arithmetic_scan(scanner, lexer, &scan, &result);
    if (
      lookahead_is_pending(lexer) ||
      result == ARITHMETIC_VALIDATION_RESOURCE_FAILURE
    )
      return DISPATCH_REJECTED;
    if (
      classified == ARITHMETIC_LEFT_PARENTHESIS &&
      result == ARITHMETIC_VALIDATION_VALID
    )
      symbol = SUBSCRIPT_EXPRESSION_START;
  }
  if (!valid[symbol]) return DISPATCH_REJECTED;
  lexer->result_symbol = symbol;
  return DISPATCH_ACCEPTED;
}

static enum DispatchResult
dispatch_subscript_closing_boundary(TSLexer *lexer, const bool *valid) {
  if (!valid[SUBSCRIPT_CLOSING_BOUNDARY]) return DISPATCH_NEXT;
  size_t position = probe_position(lexer);
  lexer->mark_end(lexer);
  skip_arithmetic_whitespace(lexer);
  if (
    lexer->lookahead == ']' ||
    lexer_at_eof(lexer) ||
    lexer->lookahead == SOURCE_BACKQUOTE_BOUNDARY
  ) {
    lexer->result_symbol = SUBSCRIPT_CLOSING_BOUNDARY;
    return DISPATCH_ACCEPTED;
  }
  return dispatch_retreat(lexer, position);
}

static enum TokenType arithmetic_start_symbol(
  const struct Scanner *scanner,
  TSLexer *lexer,
  struct ArithmeticScan *scan,
  const bool *valid,
  enum TokenType expression,
  enum TokenType source
) {
  enum ArithmeticValidation result;
  enum TokenType classified =
    classify_arithmetic_scan(scanner, lexer, scan, &result);
  if (lookahead_is_pending(lexer) || result != ARITHMETIC_VALIDATION_VALID)
    return TOKEN_COUNT;
  enum TokenType symbol =
    classified == ARITHMETIC_LEFT_PARENTHESIS ? expression : source;
  return valid[symbol] ? symbol : TOKEN_COUNT;
}

static enum DispatchResult dispatch_arithmetic_field_start(
  struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  if (
    !valid[ARITHMETIC_FIELD_EXPRESSION_START] &&
    !valid[ARITHMETIC_FIELD_SOURCE_START]
  )
    return DISPATCH_NEXT;
  if (scanner->context_count == 0) return DISPATCH_REJECTED;
  struct SourceContext *context =
    &scanner->contexts[scanner->context_count - 1];
  if (!is_arithmetic_field_context(context->opener)) return DISPATCH_REJECTED;
  struct LookaheadLexer *probe = (struct LookaheadLexer *)lexer;
  if (probe->length == 0 && !lookahead_append(probe, 0))
    return DISPATCH_REJECTED;
  size_t position = probe->position;
  lexer->mark_end(lexer);
  bool bracket = context->opener == BRACKET_ARITHMETIC_OPEN;
  size_t limit;
  if (bracket) {
    enum ArithmeticValidation result =
      skip_embedded_construct(scanner, lexer, ']', false);
    if (result != ARITHMETIC_VALIDATION_VALID || lookahead_is_pending(lexer))
      return DISPATCH_REJECTED;
    limit = probe->characters[probe->position - 1].raw_cut;
  } else {
    if (!scan_substring_end(
          scanner,
          lexer,
          context->opener == PARAMETER_SUBSTRING_BEGIN
        ))
      return DISPATCH_REJECTED;
    limit = probe->characters[probe->position].raw_cut;
  }
  if (limit == probe->characters[position].raw_cut) return DISPATCH_REJECTED;
  lookahead_seek(probe, position);
  struct ArithmeticScan scan = {.limit = limit, .bracket_delimited = bracket};
  enum TokenType symbol = arithmetic_start_symbol(
    scanner,
    lexer,
    &scan,
    valid,
    ARITHMETIC_FIELD_EXPRESSION_START,
    ARITHMETIC_FIELD_SOURCE_START
  );
  if (symbol == TOKEN_COUNT) return DISPATCH_REJECTED;
  context->arithmetic_field_remaining = limit;
  lexer->result_symbol = symbol;
  return DISPATCH_ACCEPTED;
}

static enum DispatchResult dispatch_arithmetic_field_closing_boundary(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  if (!valid[ARITHMETIC_FIELD_CLOSING_BOUNDARY]) return DISPATCH_NEXT;
  size_t position = probe_position(lexer);
  lexer->mark_end(lexer);
  skip_arithmetic_whitespace(lexer);
  size_t remaining = arithmetic_field_remaining(scanner);
  if (remaining == 0 || arithmetic_limit_reached(lexer, remaining)) {
    lexer->result_symbol = ARITHMETIC_FIELD_CLOSING_BOUNDARY;
    return DISPATCH_ACCEPTED;
  }
  return dispatch_retreat(lexer, position);
}

static enum DispatchResult dispatch_for_closing_boundary(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  if (!valid[FOR_CLOSING_BOUNDARY]) return DISPATCH_NEXT;
  size_t position = probe_position(lexer);
  lexer->mark_end(lexer);
  skip_arithmetic_whitespace(lexer);
  if (
    lexer->lookahead == ';' ||
    (lexer->lookahead == ')' &&
      scanner->context_count > 0 &&
      top_context_opener(scanner) == FOR_ARITHMETIC_OPEN)
  ) {
    lexer->result_symbol = FOR_CLOSING_BOUNDARY;
    return DISPATCH_ACCEPTED;
  }
  return dispatch_retreat(lexer, position);
}

static enum DispatchResult dispatch_for_expression_start(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  if (!valid[FOR_EXPRESSION_START] && !valid[FOR_SOURCE_START])
    return DISPATCH_NEXT;
  lexer->mark_end(lexer);
  struct ArithmeticScan scan = {.stop_semicolon = true};
  for (size_t index = scanner->context_count; index > 0; index--) {
    const struct SourceContext *context = &scanner->contexts[index - 1];
    if (context->opener != PUNCT_LEFT_PARENTHESIS) break;
    scan.group_depth += context->count;
  }
  enum TokenType symbol = arithmetic_start_symbol(
    scanner,
    lexer,
    &scan,
    valid,
    FOR_EXPRESSION_START,
    FOR_SOURCE_START
  );
  if (symbol == TOKEN_COUNT) return DISPATCH_REJECTED;
  lexer->result_symbol = symbol;
  return DISPATCH_ACCEPTED;
}

static enum DispatchResult dispatch_arithmetic_command_open(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  if (!valid[ARITHMETIC_COMMAND_OPEN] || lexer->lookahead != '(')
    return DISPATCH_NEXT;
  size_t position = probe_position(lexer);
  lexer->advance(lexer, false);
  lexer->mark_end(lexer);
  if (lexer->lookahead == '(') {
    lexer->advance(lexer, false);
    struct ArithmeticScan scan = {0};
    enum ArithmeticValidation result;
    enum TokenType classified =
      classify_arithmetic_source(scanner, lexer, &scan, &result);
    bool unclosed_group = scan.group_depth > 0;
    clear_arithmetic_scan(&scan);
    if (lookahead_is_pending(lexer)) return DISPATCH_REJECTED;
    if (classified != TOKEN_COUNT && result == ARITHMETIC_VALIDATION_VALID) {
      lexer->result_symbol = ARITHMETIC_COMMAND_OPEN;
      return DISPATCH_ACCEPTED;
    }
    if (result == ARITHMETIC_VALIDATION_INCOMPLETE && unclosed_group) {
      lexer->result_symbol = TOKEN_COUNT;
      return DISPATCH_ACCEPTED;
    }
  }
  return dispatch_retreat(lexer, position);
}

static enum DispatchResult dispatch_arithmetic_subscript_open(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  if (!valid[ARITHMETIC_SUBSCRIPT_OPEN] || lexer->lookahead != '[')
    return DISPATCH_NEXT;
  lexer->advance(lexer, false);
  lexer->mark_end(lexer);
  if (!skip_subscript_text(
        scanner,
        lexer,
        bracket_delimited_arithmetic(scanner),
        arithmetic_for_context(scanner),
        arithmetic_field_remaining(scanner)
      ))
    return DISPATCH_REJECTED;
  lexer->result_symbol = ARITHMETIC_SUBSCRIPT_OPEN;
  return DISPATCH_ACCEPTED;
}

static enum DispatchResult dispatch_name_or_reserved_word(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  if (
    (!valid[ASSIGNMENT_NAME_TOKEN] && !valid[FNAME_TOKEN]) ||
    !is_name_start_character(lexer->lookahead)
  )
    return DISPATCH_NEXT;
  size_t position = probe_position(lexer);
  if (scan_name_or_reserved_word(scanner, lexer, valid))
    return DISPATCH_ACCEPTED;
  return dispatch_retreat(lexer, position);
}

static enum DispatchResult dispatch_function_name(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  if (!valid[FNAME_TOKEN] && !valid[EXPLICIT_FNAME_BEGIN]) return DISPATCH_NEXT;
  size_t position = probe_position(lexer);
  if (scan_bash_function_name(scanner, lexer, valid)) return DISPATCH_ACCEPTED;
  return dispatch_retreat(lexer, position);
}

static enum DispatchResult dispatch_here_document(
  struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  if (valid[COMMAND_SUBSTITUTION_BODY_BEGIN]) {
    lexer->mark_end(lexer);
    return dispatch_outcome(
      finish_command_substitution_body_begin(scanner, lexer)
    );
  }
  if (
    valid[HERE_DOCUMENT_SEQUENCE_END] &&
    scan_here_document_sequence_end(scanner, lexer, valid)
  )
    return DISPATCH_ACCEPTED;
  if (
    valid[HERE_DOCUMENT_END_COMMIT] &&
    scanner->active.documents.count > 0 &&
    scan_here_document_end_commit(scanner, lexer)
  )
    return DISPATCH_ACCEPTED;
  if (scanner->active.documents.count > 0 && scanner->active.at_line_start)
    return dispatch_outcome(
      scan_here_document_content_line_start(scanner, lexer, valid)
    );
  return DISPATCH_NEXT;
}

static enum DispatchResult
dispatch_arithmetic_boundary(TSLexer *lexer, const bool *valid) {
  bool arithmetic_boundary = arithmetic_operator_boundary_is_valid(valid) ||
    valid[ARITHMETIC_CLOSING_BOUNDARY];
  if (
    !arithmetic_boundary ||
    !(is_arithmetic_operator_start(lexer->lookahead) ||
      lexer->lookahead == ')' ||
      lexer->lookahead == ';' ||
      arithmetic_whitespace(lexer->lookahead))
  )
    return DISPATCH_NEXT;
  return dispatch_outcome(scan_arithmetic_boundary(lexer, valid));
}

static enum DispatchResult dispatch_here_document_body_newline(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  if (
    scanner->active.documents.count == 0 ||
    lexer->lookahead != '\n' ||
    !valid[SEPARATOR_NEWLINE] ||
    newline_starts_pending_document(scanner, lexer) ||
    valid[HERE_END_BEGIN] ||
    valid[HERE_END_STRIP_BEGIN] ||
    valid[HERE_END_COMMIT] ||
    valid[FUNCTION_BODY_CONTINUATION_BOUNDARY]
  )
    return DISPATCH_NEXT;
  return dispatch_outcome(
    scan_here_document_body_newline(scanner, lexer, valid)
  );
}

static enum DispatchResult
dispatch_here_end(struct Scanner *scanner, TSLexer *lexer, const bool *valid) {
  if (valid[HERE_END_BEGIN] || valid[HERE_END_STRIP_BEGIN])
    return dispatch_outcome(
      scan_here_document_delimiter(scanner, lexer, valid[HERE_END_STRIP_BEGIN])
    );
  if (valid[HERE_END_COMMIT] && scan_here_end_commit(lexer))
    return DISPATCH_ACCEPTED;
  return DISPATCH_NEXT;
}

static enum DispatchResult
dispatch_dollar_single_quote_escape(TSLexer *lexer, const bool *valid) {
  if (!valid[DOLLAR_SINGLE_QUOTE_ESCAPE] || lexer->lookahead != '\\')
    return DISPATCH_NEXT;
  return dispatch_outcome(scan_dollar_single_quote_token(lexer));
}

static enum DispatchResult dispatch_arithmetic_left_parenthesis(
  struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  if (
    (!valid[ARITHMETIC_LEFT_PARENTHESIS] &&
      !valid[ARITHMETIC_SOURCE_LEFT_PARENTHESIS]) ||
    lexer->lookahead != '('
  )
    return DISPATCH_NEXT;
  return dispatch_outcome(
    scan_arithmetic_left_parenthesis(scanner, lexer, valid)
  );
}

static enum DispatchResult dispatch_function_body_continuation_boundary(
  TSLexer *lexer,
  const bool *valid
) {
  if (!valid[FUNCTION_BODY_CONTINUATION_BOUNDARY]) return DISPATCH_NEXT;
  return dispatch_outcome(
    accept_token(lexer, FUNCTION_BODY_CONTINUATION_BOUNDARY)
  );
}

static enum DispatchResult dispatch_here_document_sequence_begin(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  if (
    !valid[HERE_DOCUMENT_SEQUENCE_BEGIN] ||
    !has_startable_pending_document(scanner)
  )
    return DISPATCH_NEXT;
  size_t position = probe_position(lexer);
  lexer->mark_end(lexer);
  scan_horizontal_blanks(lexer);
  if (document_header_newline_follows(scanner, lexer)) {
    lexer->result_symbol = HERE_DOCUMENT_SEQUENCE_BEGIN;
    return DISPATCH_ACCEPTED;
  }
  return dispatch_retreat(lexer, position);
}

static enum DispatchResult dispatch_boundaries(
  struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  if (element_boundary_starts(lexer, valid))
    return dispatch_outcome(scan_element_boundary(scanner, lexer, valid));
  if (valid[PRE_NEWLINE_BLANK] && is_horizontal_blank(lexer->lookahead)) {
    scan_horizontal_blanks(lexer);
    lexer->mark_end(lexer);
    return dispatch_outcome(classify_layout_run(scanner, lexer, valid));
  }
  if (shell_boundary_starts(lexer, valid))
    return dispatch_outcome(scan_shell_boundary(scanner, lexer, valid));
  return DISPATCH_NEXT;
}

static enum DispatchResult dispatch_pattern_pieces(
  struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  if (lexer->lookahead == '$' && valid[DOLLAR_EXPANSION_START])
    return dispatch_outcome(scan_dollar_expansion_start(lexer));
  if (lexer->lookahead == ':' && valid[PATTERN_CHARACTER_CLASS_END_COLON])
    return dispatch_outcome(
      accept_character(lexer, PATTERN_CHARACTER_CLASS_END_COLON) &&
      lexer->lookahead == ']'
    );
  if (lexer->lookahead == '[' && valid[PATTERN_SPECIAL_LEFT_BRACKET])
    return dispatch_outcome(
      scan_pattern_special_left_bracket(scanner, lexer, valid)
    );
  if (
    (valid[PATTERN_BRACKET_HYPHEN] || valid[PATTERN_BRACKET_RANGE_OPERATOR]) &&
    lexer->lookahead == '-'
  )
    return dispatch_outcome(scan_pattern_bracket_hyphen(scanner, lexer, valid));
  const enum TokenType bracket_characters[] = {
    PARAMETER_PATTERN_BRACKET_CHARACTER,
    ASSIGNMENT_PATTERN_BRACKET_CHARACTER,
    PATTERN_BRACKET_CHARACTER,
  };
  for (size_t index = 0; index < ARRAY_COUNT(bracket_characters); index += 1) {
    if (
      valid[bracket_characters[index]] &&
      scan_pattern_bracket_character(scanner, lexer, bracket_characters[index])
    )
      return DISPATCH_ACCEPTED;
  }
  return DISPATCH_NEXT;
}

static enum DispatchResult dispatch_reserved_characters(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  if (lexer->lookahead == '{')
    return dispatch_outcome(
      valid[LEFT_BRACE] &&
      scan_delimited_character_token(lexer, LEFT_BRACE, false)
    );
  if (lexer->lookahead == '}') {
    bool reachable = valid[RIGHT_BRACE] &&
      (!valid[TERM_CONTINUATION] ||
        !(valid[WORD_SEPARATOR_BEGIN] ||
          assignment_separator_is_valid(valid) ||
          valid[REDIRECT_SEPARATOR_BEGIN]));
    return dispatch_outcome(
      (reachable || valid[FNAME_TOKEN]) &&
      scan_delimited_character_token(lexer, RIGHT_BRACE, false)
    );
  }
  if (
    is_decimal_digit(lexer->lookahead) &&
    (valid[BRACED_PARAMETER_NUMBER_START] ||
      valid[BRACED_POSITIONAL_PARAMETER_START])
  )
    return dispatch_outcome(scan_braced_numeric_parameter_start(lexer, valid));
  if (lexer->lookahead == '!') {
    if (
      !(valid[PIPELINE_NEGATION] ||
        valid[EMPTY_BANG_BEGIN] ||
        valid[FNAME_TOKEN]) ||
      !scan_delimited_character_token(
        lexer,
        PIPELINE_NEGATION,
        extglob_enabled(scanner)
      )
    )
      return DISPATCH_REJECTED;
    if (!(valid[PIPELINE_NEGATION] || valid[EMPTY_BANG_BEGIN]))
      return DISPATCH_ACCEPTED;
    enum TokenType symbol =
      empty_pipeline_boundary(lexer) ? EMPTY_BANG_BEGIN : PIPELINE_NEGATION;
    lexer->result_symbol = symbol;
    return dispatch_outcome(valid[symbol]);
  }
  return dispatch_outcome(
    is_lowercase_letter(lexer->lookahead) &&
    scan_lowercase_dispatch(lexer, valid)
  );
}

static bool
scan_dispatch(struct Scanner *scanner, TSLexer *lexer, const bool *valid) {
  enum DispatchResult result =
    dispatch_substitution_open(scanner, lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_declaration_assignment_start(scanner, lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_time_option_start(lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_conditional_junction_boundary(lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_coproc_name_start(scanner, lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_function_parentheses_start(lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_array_element_start(scanner, lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_subscript_start(scanner, lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_subscript_closing_boundary(lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_arithmetic_field_start(scanner, lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_arithmetic_field_closing_boundary(scanner, lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_for_closing_boundary(scanner, lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_for_expression_start(scanner, lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_arithmetic_command_open(scanner, lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_arithmetic_subscript_open(scanner, lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_name_or_reserved_word(scanner, lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_function_name(scanner, lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_here_document(scanner, lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_arithmetic_boundary(lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_here_document_body_newline(scanner, lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_here_end(scanner, lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_dollar_single_quote_escape(lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_arithmetic_left_parenthesis(scanner, lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_function_body_continuation_boundary(lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_here_document_sequence_begin(scanner, lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_boundaries(scanner, lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_pattern_pieces(scanner, lexer, valid);
  if (result == DISPATCH_NEXT)
    result = dispatch_reserved_characters(scanner, lexer, valid);
  return result == DISPATCH_ACCEPTED;
}

static void scan_ambiguous_arithmetic(
  struct LookaheadLexer *lookahead,
  struct AmbiguousSubstitution *substitution
) {
  if (substitution->scan_started) {
    lookahead_seek(lookahead, substitution->resume);
  } else {
    lookahead_seek(lookahead, substitution->start);
    lookahead->lexer.advance(&lookahead->lexer, false);
    substitution->scan_started = true;
  }
  enum TokenType symbol = classify_arithmetic_source(
    &substitution->context,
    &lookahead->lexer,
    &substitution->scan,
    &substitution->result
  );
  substitution->resume = lookahead->position;
  if (!lookahead_is_pending(&lookahead->lexer)) {
    substitution->arithmetic = symbol != TOKEN_COUNT;
    substitution->scan_complete = true;
    clear_arithmetic_scan(&substitution->scan);
  }
}

static void scan_ambiguous_command(
  struct LookaheadLexer *lookahead,
  struct AmbiguousSubstitution *substitution
) {
  if (substitution->command == NULL) {
    substitution->command = ts_calloc(1, sizeof(struct EmbeddedSkip));
    substitution->command_resume = substitution->start;
    if (substitution->command != NULL)
      substitution->command->force_extglob = substitution->force_extglob;
  }
  if (substitution->command == NULL) {
    lookahead_fail(lookahead);
    return;
  }
  lookahead_seek(lookahead, substitution->command_resume);
  substitution->result = resume_embedded_construct(
    substitution->raw ? NULL : &substitution->context,
    &lookahead->lexer,
    ')',
    false,
    substitution->command
  );
  substitution->command_resume = lookahead->position;
}

static void complete_ambiguous_substitutions(struct LookaheadLexer *lookahead) {
  while (!lookahead->failed && lookahead->active != SIZE_MAX) {
    lookahead->requested = SIZE_MAX;
    size_t index = lookahead->active;
    struct AmbiguousSubstitution substitution = lookahead->substitutions[index];
    if (!substitution.scan_complete) {
      scan_ambiguous_arithmetic(lookahead, &substitution);
    }
    if (!lookahead_is_pending(&lookahead->lexer)) {
      if (!substitution.arithmetic) {
        scan_ambiguous_command(lookahead, &substitution);
      } else if (substitution.result == ARITHMETIC_VALIDATION_VALID) {
        lookahead->lexer.advance(&lookahead->lexer, false);
      }
      if (!lookahead_is_pending(&lookahead->lexer)) {
        substitution.end = lookahead->position;
        substitution.complete = true;
        if (substitution.command != NULL) {
          clear_embedded_skip(substitution.command);
          ts_free(substitution.command);
          substitution.command = NULL;
        }
      }
    }
    lookahead->substitutions[index] = substitution;
    lookahead->active =
      substitution.complete ? substitution.parent : lookahead->requested;
  }
  lookahead->requested = SIZE_MAX;
}

static bool lookahead_init(struct LookaheadLexer *lookahead, TSLexer *lexer) {
  *lookahead = (struct LookaheadLexer){0};
  if (lexer->advance != logical_advance) {
    return false;
  }
  *lookahead = (struct LookaheadLexer){
    .lexer = *lexer,
    .source = lexer,
    .requested = SIZE_MAX,
    .active = SIZE_MAX,
  };
  lookahead->lexer.advance = lookahead_advance;
  lookahead->lexer.mark_end = lookahead_mark_end;
  lookahead->lexer.eof = lookahead_eof;
  lookahead->views = ts_calloc(1, sizeof(*lookahead->views));
  if (lookahead->views == NULL) {
    lookahead_fail(lookahead);
    return false;
  }
  lookahead->view_count = 1;
  lookahead->view_capacity = 1;
  lookahead->views[0].input = (struct LogicalLexer *)lexer;
  return true;
}

static bool lookahead_begin(struct LookaheadLexer *lookahead, TSLexer *lexer) {
  return lookahead_init(lookahead, lexer) && lookahead_append(lookahead, 0);
}

static void lookahead_clear(struct LookaheadLexer *lookahead) {
  ts_free(lookahead->characters);
  for (size_t index = 0; index < lookahead->substitution_count; index += 1) {
    clear_arithmetic_scan(&lookahead->substitutions[index].scan);
    if (lookahead->substitutions[index].command != NULL) {
      clear_embedded_skip(lookahead->substitutions[index].command);
      ts_free(lookahead->substitutions[index].command);
    }
  }
  ts_free(lookahead->substitutions);
  for (size_t index = 1; index < lookahead->view_count; index += 1) {
    logical_clear(lookahead->views[index].input);
    ts_free(lookahead->views[index].input);
  }
  ts_free(lookahead->views);
  *lookahead = (struct LookaheadLexer){0};
}

static bool scan_with_lookahead(
  struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid_symbols
) {
  struct LookaheadLexer lookahead;
  if (!lookahead_init(&lookahead, lexer)) {
    return false;
  }
  bool accepted = scan_dispatch(scanner, &lookahead.lexer, valid_symbols);
  lexer->result_symbol = lookahead.lexer.result_symbol;
  accepted = accepted && !lookahead.failed;
  lookahead_clear(&lookahead);
  return accepted;
}

static bool scanner_source_ready(struct Scanner *scanner) {
  if (scanner->source.stage_count > 0) {
    return true;
  }
  scanner->source.stages = ts_malloc(sizeof(*scanner->source.stages));
  if (scanner->source.stages == NULL) {
    return false;
  }
  scanner->source.stages[0] = source_stage(SOURCE_REMOVE_CONTINUATIONS);
  scanner->source.stage_count = 1;
  return true;
}

static bool append_source_context(
  struct Scanner *scanner,
  enum TokenType opener,
  size_t stage_count,
  bool local_disabled
) {
  if (scanner->context_count >= SIZE_MAX / sizeof(*scanner->contexts)) {
    return false;
  }
  struct SourceContext *contexts = ts_realloc(
    scanner->contexts,
    (scanner->context_count + 1) * sizeof(*contexts)
  );
  if (contexts == NULL) {
    return false;
  }
  scanner->contexts = contexts;
  contexts[scanner->context_count++] = (struct SourceContext){
    .opener = opener,
    .stage_count = stage_count,
    .count = 1,
    .substitution_depth =
      is_here_document_context(opener) ? scanner->substitution_depth : 0,
    .local_disabled = local_disabled,
    .quote = QUOTE_PLAIN,
  };
  return true;
}

static struct SourceStage *
grow_source_stages(struct Scanner *scanner, size_t added) {
  size_t count = scanner->source.stage_count;
  if (count > SIZE_MAX / sizeof(*scanner->source.stages) - added) {
    return NULL;
  }
  struct SourceStage *stages =
    ts_realloc(scanner->source.stages, (count + added) * sizeof(*stages));
  if (stages == NULL) {
    return NULL;
  }
  scanner->source.stages = stages;
  scanner->source.stage_count += added;
  return stages + count - 1;
}

static bool
source_context_push(struct Scanner *scanner, enum TokenType opener) {
  enum QuoteMode parent_quote = source_quote(scanner);
  enum QuoteMode quote = quote_after_token(parent_quote, opener);
  size_t depth = 0;
  for (size_t index = 0; index < scanner->context_count; index += 1) {
    size_t count = scanner->contexts[index].count;
    if (count == 0 || count >= SIZE_MAX - depth) {
      return false;
    }
    depth += count;
  }
  size_t count = scanner->source.stage_count;
  struct SourceStage *local = &scanner->source.stages[count - 1];
  struct SourceContext *previous =
    scanner->context_count == 0 ? NULL : top_context(scanner);
  if (
    previous != NULL &&
    !collating_cached(&previous->bracket) &&
    previous->bracket.element_remaining == 0 &&
    opener != REGEX_START &&
    !is_word_context(opener) &&
    !is_arithmetic_field_context(opener) &&
    previous->opener == opener &&
    previous->quote == quote &&
    previous->stage_count == count &&
    previous->local_disabled == local->disabled
  ) {
    previous->count += 1;
  } else if (!append_source_context(scanner, opener, count, local->disabled)) {
    return false;
  }
  top_context(scanner)->quote = quote;
  if (opener == BACKQUOTE_START || opener == DOUBLE_QUOTED_BACKQUOTE_START) {
    struct SourceStage *stages = grow_source_stages(scanner, 2);
    if (stages == NULL) {
      return false;
    }
    backquote_stages(
      opener == DOUBLE_QUOTED_BACKQUOTE_START && parent_quote == QUOTE_DOUBLE,
      stages
    );
    scanner->backquote_depth += 1;
  } else if (is_here_document_context(opener)) {
    if (scanner->active.documents.count == 0) return false;
    struct SourceStage *stages = grow_source_stages(scanner, 3);
    if (stages == NULL) return false;
    here_document_body_stages(scanner->active.documents.data, stages);
  } else if (opener == SQ_OPEN || opener == DOLLAR_SQ_OPEN) {
    local->disabled = true;
  } else if (
    opener == DQ_OPEN ||
    opener == COMMAND_OPEN ||
    opener == ARITHMETIC_EXPANSION_OPEN ||
    opener == BRACKET_ARITHMETIC_OPEN
  ) {
    local->disabled = false;
  }
  return scanner_state_fits(scanner);
}

static bool source_context_pop(struct Scanner *scanner) {
  if (scanner->context_count == 0) {
    return false;
  }
  struct SourceContext *top = &scanner->contexts[scanner->context_count - 1];
  if (top->count == 0) {
    return false;
  }
  struct SourceContext context = *top;
  top->bracket = (struct BracketCache){0};
  if (--top->count == 0) {
    scanner->context_count -= 1;
  }
  scanner->source.stage_count = context.stage_count;
  scanner->source.stages[context.stage_count - 1].disabled =
    context.local_disabled;
  if (
    context.opener == BACKQUOTE_START ||
    context.opener == DOUBLE_QUOTED_BACKQUOTE_START
  ) {
    if (scanner->backquote_depth == 0) {
      return false;
    }
    scanner->backquote_depth -= 1;
  }
  return true;
}

static bool source_context_pop_comment(struct Scanner *scanner) {
  return top_context_opener(scanner) != COMMENT_START ||
    source_context_pop(scanner);
}

static bool begin_here_document_end(
  struct Scanner *scanner,
  TSLexer *lexer,
  const struct HereDocumentBoundary *bound,
  const bool *valid
) {
  enum TokenType symbol = bound->document->quoted
    ? QUOTED_HERE_DOCUMENT_END_BEGIN
    : HERE_DOCUMENT_END_BEGIN;
  if (!valid[symbol]) {
    return false;
  }
  while (scanner->context_count > bound->context + 1) {
    if (!source_context_pop(scanner)) {
      return false;
    }
  }
  while (scanner->suspended_frame_count > bound->frame) {
    clear_documents(&scanner->active.documents);
    restore_suspended_documents(scanner);
  }
  scanner->substitution_depth =
    scanner->contexts[bound->context].substitution_depth;
  scanner->backquote_depth = scanner->active.backquote_depth;
  discard_enclosed_pending_documents(scanner);
  scanner->active.documents.data[0].ending = true;
  scanner->active.at_line_start = false;
  scanner->sequence_end_pending = false;
  lexer->result_symbol = (TSSymbol)symbol;
  return true;
}

static bool
track_regex_depth(struct SourceContext *context, enum TokenType symbol) {
  context->regex_started = true;
  if (symbol == REGEX_OPEN || symbol == ERE_MEMBER_OPEN_BEGIN) {
    if (context->regex_depth == SIZE_MAX) return false;
    context->regex_depth++;
  } else if (
    symbol == REGEX_CLOSE ||
    symbol == ERE_MEMBER_CLOSE_BEGIN ||
    symbol == ERE_ORDINARY_CLOSE
  ) {
    if (context->regex_depth == 0) return false;
    context->regex_depth--;
  }
  return true;
}

static const struct SourceContext *
substitution_context(const struct Scanner *scanner) {
  for (size_t index = scanner->context_count; index > 0; index--) {
    const struct SourceContext *context = &scanner->contexts[index - 1];
    if (
      context->opener == COMMAND_OPEN ||
      context->opener == CURRENT_SHELL_OPEN ||
      context->opener == REPLY_OPEN
    )
      return context;
    if (source_context_has_input(context->opener)) break;
  }
  return NULL;
}

static bool pop_substitution_context(struct Scanner *scanner) {
  const struct SourceContext *context = substitution_context(scanner);
  if (scanner->substitution_depth == 0 || context == NULL) return false;
  size_t count = (size_t)(context - scanner->contexts) + 1;
  while (scanner->context_count > count) {
    if (!source_context_pop(scanner)) return false;
  }
  if (!source_context_pop(scanner)) return false;
  scanner->substitution_depth--;
  return true;
}

static bool commit_substitution_end(struct Scanner *scanner) {
  return !has_startable_pending_document(scanner) &&
    pop_substitution_context(scanner);
}

static bool commit_line_end(struct Scanner *scanner, enum TokenType symbol) {
  if (!source_context_pop_comment(scanner)) return false;
  const struct SourceContext *raw = raw_word_context(scanner);
  if (raw != NULL)
    scanner->contexts[raw - scanner->contexts].raw_element_start = true;
  if (symbol == HERE_DOCUMENT_LINE_END) {
    if (!activate_startable_pending_documents(scanner)) return false;
  }
  if (scanner->active.documents.count > 0) scanner->active.at_line_start = true;
  return true;
}

static bool
commit_parameter_operator(struct Scanner *scanner, enum TokenType symbol) {
  if (scanner->context_count == 0) return false;
  if (top_context(scanner)->count > 1) {
    top_context(scanner)->count--;
    return source_context_push(scanner, symbol);
  }
  top_context(scanner)->quote =
    quote_after_token(top_context(scanner)->quote, symbol);
  top_context(scanner)->opener = symbol;
  return true;
}

static bool clear_parameter_quote(struct Scanner *scanner) {
  if (scanner->context_count == 0) return false;
  struct SourceContext *context = top_context(scanner);
  if (context->count > 1) {
    context->count--;
    if (!append_source_context(
          scanner,
          context->opener,
          context->stage_count,
          context->local_disabled
        ))
      return false;
  }
  top_context(scanner)->quote = QUOTE_PLAIN;
  return true;
}

static bool commit_backquote_end(struct Scanner *scanner) {
  if (
    has_startable_pending_document(scanner) ||
    !source_context_pop_comment(scanner) ||
    !source_context_pop(scanner)
  ) {
    return false;
  }
  discard_enclosed_pending_documents(scanner);
  return true;
}

static bool
source_context_commit(struct Scanner *scanner, enum TokenType symbol) {
  if (symbol == PARAMETER_NAMES_INDIRECTION_BEGIN)
    symbol = PARAMETER_INDIRECTION_BEGIN;
  if (symbol == PUNCT_LEFT_PARENTHESIS && arithmetic_for_context(scanner))
    return source_context_push(scanner, symbol);
  if (
    symbol == PUNCT_RIGHT_PARENTHESIS &&
    top_context_opener(scanner) == PUNCT_LEFT_PARENTHESIS
  )
    return source_context_pop(scanner);
  if (
    top_context_opener(scanner) == REGEX_START &&
    !track_regex_depth(top_context(scanner), symbol)
  )
    return false;

  switch (symbol) {
    case PARAMETER_PATTERN_OPERATOR_BEGIN:
    case PARAMETER_CASE_BEGIN:
      return clear_parameter_quote(scanner);
    case PARAMETER_INDIRECTION_BEGIN:
    case PARAMETER_REPLACE_BEGIN:
    case REPLACEMENT_SEPARATOR_BEGIN:
    case PARAMETER_SUBSTRING_BEGIN:
    case SUBSTRING_SEPARATOR_BEGIN:
      return commit_parameter_operator(scanner, symbol);
    case SQ_OPEN:
    case DQ_OPEN:
    case DOLLAR_SQ_OPEN:
    case PARAMETER_OPEN:
    case CURRENT_SHELL_OPEN:
    case REPLY_OPEN:
    case EXTGLOB_OPEN:
    case SUBSCRIPT_OPEN:
    case ARITHMETIC_SUBSCRIPT_OPEN:
    case BRACE_LITERAL_OPEN:
    case BRACE_OPEN:
    case COMMAND_OPEN:
    case ARITHMETIC_EXPANSION_OPEN:
    case BRACKET_ARITHMETIC_OPEN:
    case ARITHMETIC_COMMAND_OPEN:
    case FOR_ARITHMETIC_OPEN:
    case BACKQUOTE_START:
    case DOUBLE_QUOTED_BACKQUOTE_START:
    case WORD_TILDE_START:
    case ASSIGNMENT_TILDE_START:
    case PARAMETER_TILDE_START:
    case WORD_FALLBACK_LITERAL_BEGIN:
    case ASSIGNMENT_FALLBACK_LITERAL_BEGIN:
    case PARAMETER_FALLBACK_LITERAL_BEGIN:
      return source_context_push(scanner, symbol);
    case SQ_CLOSE:
    case DQ_CLOSE:
    case DOLLAR_SQ_CLOSE:
    case PARAMETER_CLOSE:
    case EXTGLOB_CLOSE:
    case SUBSCRIPT_CLOSE:
    case BRACE_CLOSE:
    case ARITHMETIC_EXPANSION_END:
    case BRACKET_ARITHMETIC_CLOSE:
      return source_context_pop(scanner);
    case BACKQUOTE_END:
      return commit_backquote_end(scanner);
    case COMMAND_SUBSTITUTION_END:
      return commit_substitution_end(scanner);
    case HERE_DOCUMENT_LINE_END:
    case NEWLINE:
    case COMMENT_LINE_END:
    case LOGICAL_NEWLINE_BEGIN:
      return commit_line_end(scanner, symbol);
    default:
      return true;
  }
}

static bool continuation_before_mark(const struct LogicalLexer *input) {
  for (size_t index = 0; index < input->cursor.removal_count; index += 1) {
    const struct SourceRemoval *removal = &input->cursor.removals[index];
    if (
      removal->kind == SOURCE_REMOVED_CONTINUATION &&
      removal->slash >= 0 &&
      (size_t)removal->slash + input->base < input->mark
    )
      return true;
  }
  return false;
}

static const struct SourceCharacter *
last_marked_character(const struct LogicalLexer *input) {
  const struct SourceCharacter *last = NULL;
  for (size_t index = 0; index < input->cursor.logical_count; index += 1) {
    const struct SourceCharacter *character = &input->cursor.logical[index];
    if (
      character->origin.end > 0 &&
      (size_t)character->origin.end + input->base <= input->mark
    )
      last = character;
  }
  return last;
}

static bool begin_lexical_emission(
  struct Scanner *scanner,
  const struct LogicalLexer *input,
  enum TokenType symbol,
  const bool *valid,
  bool recovering
) {
  if (input->mark == 0) {
    return false;
  }
  scanner->emission = (struct LexicalEmission){
    .symbol = symbol,
    .remaining = input->mark,
    .active = true,
  };
  enum TokenType whole = WHOLE_SOURCES[symbol];
  if (
    whole != 0 &&
    valid[whole] &&
    (recovering || !continuation_before_mark(input))
  )
    scanner->emission.symbol = whole;
  symbol = lexical_source_symbol(symbol);
  const struct SourceCharacter *last = last_marked_character(input);
  if (
    symbol == PARAMETER_VALUE_OPERATOR_BEGIN &&
    last != NULL &&
    last->value == '?' &&
    !clear_parameter_quote(scanner)
  )
    return false;
  if (
    symbol == ASSIGNMENT_LITERAL_BEGIN ||
    symbol == ASSIGNMENT_FALLBACK_LITERAL_BEGIN
  ) {
    scanner->emission.allows_assignment_tilde =
      last != NULL && last->value == ':';
    const struct SourceContext *context = assignment_argument_context(scanner);
    if (context != NULL) {
      scanner->emission.allows_assignment_tilde =
        (scanner->emission.allows_assignment_tilde &&
          context->assignment_head_remaining <= input->mark) ||
        (context->assignment_head_remaining > 0 &&
          context->assignment_head_remaining == input->mark);
    }
  }
  const struct SourceContext *raw = raw_word_context(scanner);
  if (raw != NULL && symbol != SOURCE_BEGIN) {
    bool start = symbol == LOGICAL_BLANK_BEGIN ||
      symbol == CLOSING_BLANK_BEGIN ||
      symbol == NEWLINE;
    if (
      last != NULL &&
      (symbol == LITERAL_BEGIN ||
        symbol == ASSIGNMENT_LITERAL_BEGIN ||
        symbol == BRACE_TEXT_BEGIN)
    )
      start = last->value == '(' ||
        is_horizontal_blank(last->value) ||
        last->value == '\n';
    scanner->contexts[raw - scanner->contexts].raw_element_start = start;
  }
  if (symbol == COMMENT_START) {
    if (!source_context_push(scanner, COMMENT_START)) {
      return false;
    }
    scanner->source.stages[scanner->source.stage_count - 1].disabled = true;
  }
  return true;
}

static bool
removal_has_slash(const struct SourceCursor *cursor, int64_t slash) {
  for (size_t index = 0; index < cursor->removal_count; index += 1) {
    const struct SourceRemoval *removal = &cursor->removals[index];
    if (
      removal->kind == SOURCE_REMOVED_CONTINUATION && removal->slash == slash
    ) {
      return true;
    }
  }
  return false;
}

static bool
removal_has_newline(const struct SourceCursor *cursor, int64_t newline) {
  for (size_t index = 0; index < cursor->removal_count; index += 1) {
    const struct SourceRemoval *removal = &cursor->removals[index];
    if (
      removal->kind == SOURCE_REMOVED_CONTINUATION &&
      removal->origin.character == newline
    ) {
      return true;
    }
  }
  return false;
}

static bool emit_whole_run(
  size_t remaining,
  struct SourceCursor *cursor,
  TSLexer *lexer,
  size_t *count
) {
  bool accepted = true;
  while (accepted && *count < remaining) {
    accepted = !lexer->eof(lexer) && source_feed(cursor, lexer->lookahead);
    if (accepted) {
      lexer->advance(lexer, false);
      *count += 1;
    }
  }
  lexer->mark_end(lexer);
  return accepted;
}

static bool emit_nul_run(
  size_t remaining,
  struct SourceCursor *cursor,
  TSLexer *lexer,
  size_t *count
) {
  bool accepted;
  do {
    accepted = source_feed(cursor, 0);
    lexer->advance(lexer, false);
    *count += 1;
  } while (
    accepted &&
    *count < remaining &&
    lexer->lookahead == 0 &&
    !lexer->eof(lexer)
  );
  lexer->mark_end(lexer);
  return accepted;
}

static bool emit_escape_run(
  struct LexicalEmission *emission,
  struct SourceCursor *cursor,
  TSLexer *lexer,
  enum TokenType *symbol
) {
  bool accepted = source_feed(cursor, '\\');
  lexer->advance(lexer, false);
  lexer->mark_end(lexer);
  while (accepted && lexer->lookahead == 0 && !lexer->eof(lexer)) {
    accepted = source_feed(cursor, 0);
    lexer->advance(lexer, false);
  }
  if (accepted && lexer->lookahead == '\n') {
    accepted = source_feed(cursor, '\n');
    lexer->advance(lexer, false);
    if (accepted && removal_has_slash(cursor, 0)) {
      *symbol = LINE_CONTINUATION;
      emission->removed_newline = true;
    }
  }
  return accepted;
}

static bool emit_text_run(
  size_t remaining,
  bool punctuation,
  struct SourceCursor *cursor,
  TSLexer *lexer,
  enum TokenType *symbol,
  size_t *count
) {
  do {
    if (lexer->eof(lexer) || !source_feed(cursor, lexer->lookahead)) {
      return false;
    }
    bool removed_newline =
      lexer->lookahead == '\n' && removal_has_newline(cursor, (int64_t)*count);
    lexer->advance(lexer, false);
    *count += 1;
    lexer->mark_end(lexer);
    if (removed_newline) {
      *symbol = REMOVED_NEWLINE;
      return true;
    }
  } while (
    *count < remaining &&
    lexer->lookahead != '\\' &&
    lexer->lookahead != '\n' &&
    !punctuation
  );
  return true;
}

static bool emit_physical_run(
  struct LexicalEmission *emission,
  const struct LexicalSource *source,
  struct SourceCursor *cursor,
  TSLexer *lexer,
  enum TokenType *symbol,
  size_t *cut
) {
  bool punctuation = source->kind == LEXICAL_SOURCE_PHYSICAL;
  bool accepted;
  size_t count = 0;
  if (source->kind == LEXICAL_SOURCE_WHOLE) {
    accepted = emit_whole_run(emission->remaining, cursor, lexer, &count);
  } else if (lexer->lookahead == 0 && !lexer->eof(lexer)) {
    accepted = emit_nul_run(emission->remaining, cursor, lexer, &count);
    *symbol = REMOVED_SOURCE;
  } else if (emission->removed_newline) {
    accepted = source_feed(cursor, '\n') && removal_has_newline(cursor, 0);
    lexer->advance(lexer, false);
    lexer->mark_end(lexer);
    count = 1;
    *symbol = REMOVED_NEWLINE;
    emission->removed_newline = false;
  } else if (punctuation && emission->remaining == 1) {
    accepted = !lexer->eof(lexer) && source_feed(cursor, lexer->lookahead);
    lexer->advance(lexer, false);
    lexer->mark_end(lexer);
    count = 1;
    *symbol = source->piece;
  } else if (lexer->lookahead == '\\') {
    accepted = emit_escape_run(emission, cursor, lexer, symbol);
    count = 1;
  } else {
    accepted = emit_text_run(
      emission->remaining,
      punctuation,
      cursor,
      lexer,
      symbol,
      &count
    );
  }
  *cut = count;
  return accepted;
}

static size_t cut_remaining(size_t remaining, size_t cut) {
  return remaining > cut ? remaining - cut : 0;
}

static void cut_bracket_cache(struct BracketCache *cache, size_t cut) {
  cache->element_remaining = cut_remaining(cache->element_remaining, cut);
  cache->collating_absent_start =
    cut_remaining(cache->collating_absent_start, cut);
  cache->collating_absent_end = cut_remaining(cache->collating_absent_end, cut);
  cache->collating_closer_from =
    cut_remaining(cache->collating_closer_from, cut);
  cache->collating_closer_end = cut_remaining(cache->collating_closer_end, cut);
  if (cache->collating_closer_from + 2 > cache->collating_closer_end) {
    cache->collating_closer_from = 0;
    cache->collating_closer_end = 0;
  }
}

static void consume_context_remaining(struct Scanner *scanner, size_t cut) {
  cut_bracket_cache(&scanner->bracket, cut);
  for (size_t index = 0; index < scanner->context_count; index++) {
    struct SourceContext *context = &scanner->contexts[index];
    cut_bracket_cache(&context->bracket, cut);
    if (is_word_context(context->opener)) {
      context->brace_suppressed_remaining =
        context->brace_suppressed_remaining > cut
        ? context->brace_suppressed_remaining - cut
        : 0;
      context->assignment_head_remaining =
        context->assignment_head_remaining > cut
        ? context->assignment_head_remaining - cut
        : 0;
      context->word_remaining =
        context->word_remaining > cut ? context->word_remaining - cut : 0;
      if (context->word_remaining == 0) {
        context->brace_free = false;
        context->pattern_region = false;
        context->raw_argument = false;
        context->raw_element_start = false;
      }
    }
    if (is_arithmetic_field_context(context->opener))
      context->arithmetic_field_remaining =
        context->arithmetic_field_remaining > cut
        ? context->arithmetic_field_remaining - cut
        : 0;
  }
}

static bool
finish_physical_emission(struct Scanner *scanner, bool punctuation) {
  struct LexicalEmission *emission = &scanner->emission;
  enum TokenType completed = lexical_source_symbol(emission->symbol);
  if (punctuation) {
    scanner->assignment_tilde_allowed = completed == PUNCT_EQUALS;
  } else if (completed != SOURCE_BEGIN) {
    scanner->assignment_tilde_allowed =
      completed == ASSIGNMENT_APPEND_BEGIN || emission->allows_assignment_tilde;
  }
  if (completed == HERE_DOCUMENT_END_LINE_END) {
    scanner->here_document_end_line_consumed = true;
  }
  bool opens_fallback = is_bracket_fallback_context(completed);
  if (emission->tracks_brackets && !opens_fallback) {
    if (!in_bracket_fallback(scanner)) {
      return false;
    }
    top_context(scanner)->bracket_chains = emission->bracket_chains;
  }
  uint32_t chains = emission->bracket_chains;
  *emission = (struct LexicalEmission){0};
  if (!source_context_commit(scanner, completed)) {
    return false;
  }
  if (opens_fallback) {
    top_context(scanner)->bracket_chains = chains;
  }
  return true;
}

static bool emit_physical_source(
  struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  struct LexicalEmission *emission = &scanner->emission;
  if (
    emission->symbol >= TOKEN_COUNT ||
    (emission->symbol != SOURCE_BEGIN &&
      LEXICAL_SOURCES[emission->symbol].kind == LEXICAL_SOURCE_NONE)
  ) {
    return false;
  }
  const struct LexicalSource *source = &LEXICAL_SOURCES[emission->symbol];
  if (emission->removed_newline) {
    if (
      (lexer->lookahead != '\n' && lexer->lookahead != 0) ||
      !valid[REMOVED_NEWLINE]
    ) {
      return false;
    }
  } else if (emission->remaining == 0) {
    return false;
  }

  struct SourceCursor cursor;
  if (!source_cursor_resume(&cursor, &scanner->source, NULL, NULL)) {
    return false;
  }
  bool punctuation = source->kind == LEXICAL_SOURCE_PHYSICAL;
  enum TokenType symbol = emission->symbol == SOURCE_BEGIN ? REMOVED_SOURCE
    : punctuation                                          ? source->prefix
                                                           : source->piece;
  size_t cut = 0;
  bool accepted =
    emit_physical_run(emission, source, &cursor, lexer, &symbol, &cut) &&
    cut <= emission->remaining &&
    valid[symbol] &&
    source_snapshot_at(&cursor, cut, &scanner->source);
  source_cursor_clear(&cursor);
  if (!accepted) {
    return false;
  }
  emission->remaining -= cut;
  consume_context_remaining(scanner, cut);
  lexer->result_symbol = (TSSymbol)symbol;
  return emission->remaining > 0 ||
    finish_physical_emission(scanner, punctuation);
}

struct LexicalOperator {
  const char *spelling;
  enum TokenType symbol;
};

static const struct LexicalOperator LEXICAL_OPERATORS[] = {
  {"?", PARAMETER_VALUE_OPERATOR_BEGIN},
  {"##", PARAMETER_PATTERN_OPERATOR_BEGIN},
  {"#", PARAMETER_PATTERN_OPERATOR_BEGIN},
  {"+=", ASSIGNMENT_APPEND_BEGIN},
  {"((", FOR_ARITHMETIC_OPEN},
  {"<<<", HERE_STRING_BEGIN},
  {"&>>", ANDDGREAT_BEGIN},
  {"&>", ANDGREAT_BEGIN},
  {"|&", PIPE_AND_BEGIN},
  {";;&", DSEMI_AND_BEGIN},
  {"**", ARITHMETIC_POWER_OPERATOR_BEGIN},
  {",", ARITHMETIC_COMMA_OPERATOR_BEGIN},
  {"++", ARITHMETIC_UPDATE_OPERATOR_BEGIN},
  {"--", ARITHMETIC_UPDATE_OPERATOR_BEGIN},
  {"/", PARAMETER_REPLACE_BEGIN},
  {"//", PARAMETER_REPLACE_BEGIN},
  {"/#", PARAMETER_REPLACE_BEGIN},
  {"/%", PARAMETER_REPLACE_BEGIN},
  {"^", PARAMETER_CASE_BEGIN},
  {"^^", PARAMETER_CASE_BEGIN},
  {",", PARAMETER_CASE_BEGIN},
  {",,", PARAMETER_CASE_BEGIN},
  {"~", PARAMETER_CASE_BEGIN},
  {"~~", PARAMETER_CASE_BEGIN},
  {"@", PARAMETER_TRANSFORM_BEGIN},
  {":", PARAMETER_SUBSTRING_BEGIN},
  {"&&", AND_IF_BEGIN},
  {"||", OR_IF_BEGIN},
  {";;", DSEMI_BEGIN},
  {";&", SEMI_AND_BEGIN},
  {"<&", LESSAND_BEGIN},
  {">&", GREATAND_BEGIN},
  {">>", DGREAT_BEGIN},
  {"<>", LESSGREAT_BEGIN},
  {">|", CLOBBER_BEGIN},
  {"<<", DLESS_OPERATOR_BEGIN},
  {"<<-", DLESSDASH_OPERATOR_BEGIN},
  {":-", PARAMETER_VALUE_OPERATOR_BEGIN},
  {":=", PARAMETER_VALUE_OPERATOR_BEGIN},
  {":?", PARAMETER_VALUE_OPERATOR_BEGIN},
  {":+", PARAMETER_VALUE_OPERATOR_BEGIN},
  {"=", PARAMETER_VALUE_OPERATOR_BEGIN},
  {"+", PARAMETER_VALUE_OPERATOR_BEGIN},
  {"%%", PARAMETER_PATTERN_OPERATOR_BEGIN},
  {"%", PARAMETER_PATTERN_OPERATOR_BEGIN},
  {"+", ARITHMETIC_UNARY_OPERATOR_BEGIN},
  {"-", ARITHMETIC_UNARY_OPERATOR_BEGIN},
  {"!", ARITHMETIC_UNARY_OPERATOR_BEGIN},
  {"~", ARITHMETIC_UNARY_OPERATOR_BEGIN},
  {"<<=", ARITHMETIC_ASSIGNMENT_OPERATOR_BEGIN},
  {">>=", ARITHMETIC_ASSIGNMENT_OPERATOR_BEGIN},
  {"*=", ARITHMETIC_ASSIGNMENT_OPERATOR_BEGIN},
  {"/=", ARITHMETIC_ASSIGNMENT_OPERATOR_BEGIN},
  {"%=", ARITHMETIC_ASSIGNMENT_OPERATOR_BEGIN},
  {"+=", ARITHMETIC_ASSIGNMENT_OPERATOR_BEGIN},
  {"-=", ARITHMETIC_ASSIGNMENT_OPERATOR_BEGIN},
  {"&=", ARITHMETIC_ASSIGNMENT_OPERATOR_BEGIN},
  {"^=", ARITHMETIC_ASSIGNMENT_OPERATOR_BEGIN},
  {"|=", ARITHMETIC_ASSIGNMENT_OPERATOR_BEGIN},
  {"=", ARITHMETIC_ASSIGNMENT_OPERATOR_BEGIN},
  {"?", ARITHMETIC_QUESTION_OPERATOR_BEGIN},
  {":", ARITHMETIC_COLON_OPERATOR_BEGIN},
  {"||", ARITHMETIC_LOGICAL_OR_OPERATOR_BEGIN},
  {"&&", ARITHMETIC_LOGICAL_AND_OPERATOR_BEGIN},
  {"|", ARITHMETIC_BITWISE_OR_OPERATOR_BEGIN},
  {"^", ARITHMETIC_BITWISE_XOR_OPERATOR_BEGIN},
  {"&", ARITHMETIC_BITWISE_AND_OPERATOR_BEGIN},
  {"==", ARITHMETIC_EQUALITY_OPERATOR_BEGIN},
  {"!=", ARITHMETIC_EQUALITY_OPERATOR_BEGIN},
  {"<=", ARITHMETIC_RELATIONAL_OPERATOR_BEGIN},
  {">=", ARITHMETIC_RELATIONAL_OPERATOR_BEGIN},
  {"<", ARITHMETIC_RELATIONAL_OPERATOR_BEGIN},
  {">", ARITHMETIC_RELATIONAL_OPERATOR_BEGIN},
  {"<<", ARITHMETIC_SHIFT_OPERATOR_BEGIN},
  {">>", ARITHMETIC_SHIFT_OPERATOR_BEGIN},
  {"+", ARITHMETIC_ADDITIVE_OPERATOR_BEGIN},
  {"-", ARITHMETIC_ADDITIVE_OPERATOR_BEGIN},
  {"*", ARITHMETIC_MULTIPLICATIVE_OPERATOR_BEGIN},
  {"/", ARITHMETIC_MULTIPLICATIVE_OPERATOR_BEGIN},
  {"%", ARITHMETIC_MULTIPLICATIVE_OPERATOR_BEGIN},
};

enum {
  LEXICAL_OPERATOR_COUNT = sizeof(LEXICAL_OPERATORS) /
  sizeof(LEXICAL_OPERATORS[0])
};

static bool arithmetic_operator_token(enum TokenType symbol) {
  return (symbol >= ARITHMETIC_UNARY_OPERATOR_BEGIN &&
           symbol <= ARITHMETIC_MULTIPLICATIVE_OPERATOR_BEGIN) ||
    symbol == ARITHMETIC_POWER_OPERATOR_BEGIN ||
    symbol == ARITHMETIC_COMMA_OPERATOR_BEGIN ||
    symbol == ARITHMETIC_UPDATE_OPERATOR_BEGIN;
}

static bool lexical_operator(TSLexer *lexer, const bool *valid) {
  bool candidates[LEXICAL_OPERATOR_COUNT];
  for (size_t index = 0; index < LEXICAL_OPERATOR_COUNT; index += 1) {
    enum TokenType candidate = LEXICAL_OPERATORS[index].symbol;
    candidates[index] = valid[candidate] ||
      (valid[ARITHMETIC_SOURCE_OPERATOR_BEGIN] &&
        arithmetic_operator_token(candidate));
  }
  enum TokenType symbol = TOKEN_COUNT;
  for (size_t length = 0;; length += 1) {
    bool matched = false;
    for (size_t index = 0; index < LEXICAL_OPERATOR_COUNT; index += 1) {
      const struct LexicalOperator *candidate = &LEXICAL_OPERATORS[index];
      if (candidates[index]) {
        candidates[index] = candidate->spelling[length] != '\0' &&
          candidate->spelling[length] == lexer->lookahead;
        matched = matched || candidates[index];
      }
    }
    if (!matched || lexer_at_eof(lexer)) {
      break;
    }
    lexer->advance(lexer, false);
    for (size_t index = 0; index < LEXICAL_OPERATOR_COUNT; index += 1) {
      if (
        candidates[index] &&
        LEXICAL_OPERATORS[index].spelling[length + 1] == '\0'
      ) {
        enum TokenType candidate = LEXICAL_OPERATORS[index].symbol;
        bool sign_prefix = length == 0 &&
          (candidate == ARITHMETIC_ADDITIVE_OPERATOR_BEGIN ||
            candidate == ARITHMETIC_UNARY_OPERATOR_BEGIN ||
            candidate == ARITHMETIC_MULTIPLICATIVE_OPERATOR_BEGIN) &&
          lexer->lookahead == LEXICAL_OPERATORS[index].spelling[0] &&
          is_one_of(lexer->lookahead, "+-*");
        if (!sign_prefix) {
          symbol = valid[ARITHMETIC_SOURCE_OPERATOR_BEGIN] &&
              arithmetic_operator_token(candidate)
            ? ARITHMETIC_SOURCE_OPERATOR_BEGIN
            : candidate;
          lexer->mark_end(lexer);
        }
        break;
      }
    }
  }
  if (symbol == TOKEN_COUNT) {
    return false;
  }
  lexer->result_symbol = (TSSymbol)symbol;
  return true;
}

static bool lexical_name(TSLexer *lexer, enum TokenType symbol) {
  if (!is_name_start_character(lexer->lookahead)) {
    return false;
  }
  advance_name(lexer);
  if (symbol == NAME_BEGIN && !is_token_delimiter(lexer)) {
    return false;
  }
  return accept_token(lexer, symbol);
}

static bool lexical_arithmetic_word(TSLexer *lexer, const bool *valid) {
  if (!is_name_character(lexer->lookahead)) {
    return false;
  }
  enum ArithmeticWord word = read_arithmetic_word(lexer);
  enum TokenType symbol = word == ARITHMETIC_WORD_NAME
    ? ARITHMETIC_VARIABLE_BEGIN
    : arithmetic_word_is_number(word) ? ARITHMETIC_NUMBER_BEGIN
                                      : ARITHMETIC_SOURCE_FRAGMENT_BEGIN;
  if (!valid[symbol]) {
    return false;
  }
  return accept_token(lexer, symbol);
}

static bool
quoted_escape_character(int32_t character, bool double_quoted, bool parameter) {
  return character == '\\' ||
    character == '$' ||
    character == '`' ||
    (double_quoted && character == '"') ||
    (parameter && is_one_of(character, "'}"));
}

static bool lexical_escape(TSLexer *lexer, enum TokenType symbol) {
  if (lexer->lookahead != '\\') {
    return false;
  }
  lexer->advance(lexer, false);
  int32_t character = lexer->lookahead;
  if (
    lexer_at_eof(lexer) ||
    character == '\n' ||
    character == SOURCE_BACKQUOTE_BOUNDARY
  ) {
    return false;
  }
  bool parameter = symbol == DOUBLE_QUOTED_PARAMETER_ESCAPE_BEGIN;
  bool quoted = symbol == DOUBLE_QUOTE_ESCAPE_BEGIN || parameter;
  if (
    symbol != ESCAPED_CHARACTER_BEGIN &&
    !quoted_escape_character(character, quoted, parameter)
  ) {
    return false;
  }
  return accept_character(lexer, symbol);
}

static bool lexical_text(struct LogicalLexer *input, enum TokenType symbol) {
  TSLexer *lexer = &input->lexer;
  bool consumed = false;
  bool parameter = symbol == DOUBLE_QUOTED_PARAMETER_TEXT_BEGIN;
  bool quoted = symbol == DOUBLE_QUOTE_TEXT_BEGIN || parameter;
  while (!lexer_at_eof(lexer)) {
    int32_t character = lexer->lookahead;
    if (character == SOURCE_BACKQUOTE_BOUNDARY) {
      break;
    }
    if (symbol == SINGLE_QUOTE_CONTENT_BEGIN) {
      if (character == '\'') {
        break;
      }
    } else if (symbol == DOLLAR_SINGLE_QUOTE_TEXT_BEGIN) {
      if (character == '\'' || character == '\\') {
        break;
      }
    } else if (
      symbol == HERE_DOCUMENT_END_TEXT_BEGIN ||
      symbol == QUOTED_HERE_DOCUMENT_TEXT ||
      symbol == QUOTED_HERE_DOCUMENT_END_TEXT
    ) {
      if (character == '\n') {
        break;
      }
    } else {
      if (
        (quoted && character == '"') ||
        character == '`' ||
        (parameter && is_one_of(character, "'}")) ||
        (symbol == HERE_DOCUMENT_TEXT_BEGIN && character == '\n')
      ) {
        break;
      }
      if (character == '$') {
        int32_t next = logical_peek(input);
        if (
          is_parameter_start_character(next) ||
          next == '{' ||
          next == '(' ||
          next == '[' ||
          (parameter && (next == '\'' || next == '"'))
        ) {
          break;
        }
      }
      if (
        character == '\\' &&
        quoted_escape_character(logical_peek(input), quoted, parameter)
      ) {
        break;
      }
    }
    lexer->advance(lexer, false);
    lexer->mark_end(lexer);
    consumed = true;
  }
  lexer->result_symbol = (TSSymbol)symbol;
  return consumed;
}

struct LexicalPunctuation {
  int32_t character;
  enum TokenType symbol;
};

static const struct LexicalPunctuation LEXICAL_PUNCTUATION[] = {
  {'}', IO_VARIABLE_CLOSE},
  {'\'', SQ_CLOSE},
  {'\'', DOLLAR_SQ_CLOSE},
  {'"', DQ_CLOSE},
  {'\'', SQ_OPEN},
  {'\'', DOLLAR_SQ_OPEN},
  {'"', DQ_OPEN},
  {'{', PARAMETER_OPEN},
  {'}', PARAMETER_CLOSE},
  {'(', COMMAND_OPEN},
  {'(', PUNCT_LEFT_PARENTHESIS},
  {')', COMMAND_CLOSE},
  {')', PUNCT_RIGHT_PARENTHESIS},
  {';', PUNCT_SEMICOLON},
  {'&', PUNCT_AMPERSAND},
  {'|', PUNCT_PIPE},
  {'<', PUNCT_LESS},
  {'>', PUNCT_GREATER},
  {'=', PUNCT_EQUALS},
  {']', PUNCT_RIGHT_BRACKET},
  {':', PUNCT_COLON},
  {'.', PUNCT_DOT},
  {'~', WORD_TILDE_START},
  {'~', ASSIGNMENT_TILDE_START},
  {'~', PARAMETER_TILDE_START},
  {'\n', LOGICAL_NEWLINE_BEGIN},
  {SOURCE_BACKQUOTE_BOUNDARY, BACKQUOTE_END},
  {'`', DOUBLE_QUOTED_BACKQUOTE_START},
  {'`', BACKQUOTE_START},
};

static bool lexical_punctuation(TSLexer *lexer, const bool *valid) {
  for (size_t index = 0; index < ARRAY_COUNT(LEXICAL_PUNCTUATION); index += 1) {
    const struct LexicalPunctuation *punctuation = &LEXICAL_PUNCTUATION[index];
    if (
      lexer->lookahead == punctuation->character && valid[punctuation->symbol]
    ) {
      if (
        punctuation->symbol == BACKQUOTE_END &&
        !logical_backquote_end((struct LogicalLexer *)lexer)
      ) {
        return false;
      }
      lexer->advance(lexer, false);
      if (
        (punctuation->symbol == PUNCT_SEMICOLON &&
          (lexer->lookahead == ';' || lexer->lookahead == '&')) ||
        (punctuation->symbol == PUNCT_AMPERSAND &&
          is_one_of(lexer->lookahead, "&>"))
      ) {
        return false;
      }
      return accept_token(lexer, punctuation->symbol);
    }
  }
  if (lexer->lookahead == '$' && valid[DOLLAR_SQ_DOLLAR]) {
    return accept_character(lexer, DOLLAR_SQ_DOLLAR) &&
      lexer->lookahead == '\'';
  }
  if (valid[NUMERIC_PARAMETER_DIGIT] && is_decimal_digit(lexer->lookahead)) {
    return accept_character(lexer, NUMERIC_PARAMETER_DIGIT);
  }
  return false;
}

static bool parameter_length_operand_follows(TSLexer *lexer) {
  lexer->advance(lexer, false);
  int32_t character = lexer->lookahead;
  if (is_name_start_character(character)) {
    advance_name(lexer);
    return lexer->lookahead == '}' || lexer->lookahead == '[';
  }
  if (is_decimal_digit(character)) {
    do {
      lexer->advance(lexer, false);
    } while (is_decimal_digit(lexer->lookahead));
  } else if (is_special_parameter_character(character)) {
    lexer->advance(lexer, false);
  } else {
    return false;
  }
  return lexer->lookahead == '}';
}

static bool parameter_subscript_context(const struct Scanner *scanner) {
  bool subscript = false;
  for (size_t index = scanner->context_count; index > 0; index--) {
    enum TokenType opener = scanner->contexts[index - 1].opener;
    if (opener == SUBSCRIPT_OPEN || opener == ARITHMETIC_SUBSCRIPT_OPEN) {
      subscript = true;
      continue;
    }
    return subscript &&
      (opener == PARAMETER_OPEN || opener == PARAMETER_INDIRECTION_BEGIN);
  }
  return false;
}

static bool lexical_arithmetic_fragment(
  const struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  TSLexer *lexer = &input->lexer;
  int32_t ch = lexer->lookahead;
  if (
    !valid[ARITHMETIC_SOURCE_FRAGMENT_BEGIN] ||
    lexer_at_eof(lexer) ||
    ch == SOURCE_BACKQUOTE_BOUNDARY ||
    arithmetic_whitespace(ch) ||
    (ch == ';' && arithmetic_for_context(scanner)) ||
    (ch == '[' && valid[SUBSCRIPT_OPEN]) ||
    (ch == ']' &&
      (valid[SUBSCRIPT_CLOSE] || valid[SUBSCRIPT_CLOSING_BOUNDARY])) ||
    (ch == ']' &&
      top_context_opener(scanner) == BRACKET_ARITHMETIC_OPEN &&
      arithmetic_field_remaining(scanner) == 0) ||
    is_one_of(ch, "()'\"`\\") ||
    (ch == '$' &&
      (is_parameter_start_character(logical_peek(input)) ||
        is_one_of(logical_peek(input), "([{'\""))) ||
    is_arithmetic_operator_start(ch) ||
    ch == '~'
  )
    return false;
  return accept_character(lexer, ARITHMETIC_SOURCE_FRAGMENT_BEGIN);
}

static bool after_redirect_target(const bool *valid) {
  return valid[REDIRECT_SEPARATOR_BEGIN] &&
    !valid[WORD_SEPARATOR_BEGIN] &&
    !assignment_separator_is_valid(valid);
}

/* Only header states may read blanks before a pending here-document;
   otherwise subtree reuse can retain stale structure. */
static bool pending_document_header_follows(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  if (
    valid[HERE_DOCUMENT_SEQUENCE_BEGIN] ||
    valid[HERE_DOCUMENT_LINE_END] ||
    valid[COMMENT_START] ||
    !has_startable_pending_document(scanner)
  )
    return false;
  struct LookaheadLexer probe;
  if (!lookahead_init(&probe, lexer)) return true;
  bool follows =
    probe.failed || document_header_newline_follows(scanner, &probe.lexer);
  lookahead_clear(&probe);
  return follows;
}

static bool closing_layout_follows(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  if (lexer_at_eof(lexer)) return true;
  if (lexer->lookahead == ')') return right_parenthesis_closes_term(valid);
  if (lexer->lookahead == SOURCE_BACKQUOTE_BOUNDARY)
    return valid[BACKQUOTE_END];
  if (lexer->lookahead == '}' && valid[SUBSTITUTION_BRACE_CLOSE]) return true;
  struct LookaheadLexer probe;
  if (!lookahead_init(&probe, lexer)) return false;
  bool follows = false;
  if (valid[HERE_DOCUMENT_LINE_END]) {
    follows = document_header_newline_follows(scanner, &probe.lexer);
  } else if (lexer->lookahead == '}' && valid[RIGHT_BRACE]) {
    probe.lexer.advance(&probe.lexer, false);
    follows = reserved_word_delimiter(&probe.lexer);
  } else {
    char word[RESERVED_WORD_LENGTH + 1];
    follows = read_reserved_word(&probe.lexer, word, NULL) &&
      closing_reserved_word_ends_term(word, valid);
  }
  follows = follows && !probe.failed;
  lookahead_clear(&probe);
  return follows;
}

static enum DispatchResult lexical_blank(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  if (
    is_horizontal_blank(lexer->lookahead) &&
    (valid[LOGICAL_BLANK_BEGIN] || valid[CLOSING_BLANK_BEGIN])
  ) {
    scan_horizontal_blanks(lexer);
    lexer->mark_end(lexer);
    if (after_redirect_target(valid) && is_word_element_start(lexer))
      return DISPATCH_REJECTED;
    bool closing = valid[CLOSING_BLANK_BEGIN] &&
      closing_layout_follows(scanner, lexer, valid);
    bool ordinary = !closing &&
      valid[LOGICAL_BLANK_BEGIN] &&
      !pending_document_header_follows(scanner, lexer, valid);
    if (!ordinary && !closing) return DISPATCH_REJECTED;
    struct LookaheadLexer lookahead;
    if (!lookahead_init(&lookahead, lexer)) return DISPATCH_REJECTED;
    scan_separator_target(scanner, &lookahead.lexer, false);
    bool failed = lookahead.failed;
    lookahead_clear(&lookahead);
    if (failed) return DISPATCH_REJECTED;
    lexer->result_symbol = ordinary ? LOGICAL_BLANK_BEGIN : CLOSING_BLANK_BEGIN;
    return DISPATCH_ACCEPTED;
  }
  if (
    valid[ARITHMETIC_BLANK_BEGIN] &&
    lexer->lookahead != '\n' &&
    arithmetic_whitespace(lexer->lookahead)
  ) {
    do {
      lexer->advance(lexer, false);
    } while (
      lexer->lookahead != '\n' && arithmetic_whitespace(lexer->lookahead)
    );
    return dispatch_outcome(accept_token(lexer, ARITHMETIC_BLANK_BEGIN));
  }
  return DISPATCH_NEXT;
}

static bool
lexical_parameter_character(struct LogicalLexer *input, const bool *valid) {
  TSLexer *lexer = &input->lexer;
  if (lexer->lookahead == '#' && valid[PARAMETER_LENGTH_OPERATOR_BEGIN]) {
    bool length = parameter_length_operand_follows(lexer);
    logical_rewind(input);
    if (length) {
      return accept_character(lexer, PARAMETER_LENGTH_OPERATOR_BEGIN);
    }
  }
  static const struct LexicalPunctuation characters[] = {
    {'*', PATTERN_STAR_BEGIN},
    {'?', PATTERN_QUESTION_BEGIN},
    {'!', PATTERN_NEGATION_BEGIN},
    {'^', PATTERN_NEGATION_BEGIN},
    {']', PATTERN_INITIAL_RIGHT_BRACKET_BEGIN},
    {'#', SPECIAL_PARAMETER_HASH_BEGIN},
    {'-', PARAMETER_HYPHEN_BEGIN},
    {'?', PARAMETER_QUESTION_BEGIN},
  };
  for (size_t index = 0; index < ARRAY_COUNT(characters); index += 1) {
    if (
      valid[characters[index].symbol] &&
      lexer->lookahead == characters[index].character
    ) {
      return accept_character(lexer, characters[index].symbol);
    }
  }
  if (
    valid[SPECIAL_PARAMETER_BEGIN] &&
    is_special_parameter_character(lexer->lookahead)
  )
    return accept_character(lexer, SPECIAL_PARAMETER_BEGIN);
  if (
    valid[UNBRACED_POSITIONAL_PARAMETER_BEGIN] &&
    lexer->lookahead >= '1' &&
    lexer->lookahead <= '9'
  )
    return accept_character(lexer, UNBRACED_POSITIONAL_PARAMETER_BEGIN);
  return false;
}

static bool
lexical_arithmetic_sign(struct LogicalLexer *input, const bool *valid) {
  TSLexer *lexer = &input->lexer;
  if (
    !(valid[ARITHMETIC_UNARY_OPERATOR_BEGIN] ||
      (valid[ARITHMETIC_ADDITIVE_OPERATOR_BEGIN] &&
        !valid[ARITHMETIC_UPDATE_OPERATOR_BEGIN])) ||
    !is_one_of(lexer->lookahead, "+-")
  )
    return false;
  int32_t sign = lexer->lookahead;
  lexer->advance(lexer, false);
  lexer->mark_end(lexer);
  if (lexer->lookahead == sign) {
    lexer->advance(lexer, false);
    if (!arithmetic_update_operand_may_follow(lexer)) {
      lexer->result_symbol = valid[ARITHMETIC_UNARY_OPERATOR_BEGIN]
        ? ARITHMETIC_UNARY_OPERATOR_BEGIN
        : ARITHMETIC_ADDITIVE_OPERATOR_BEGIN;
      return true;
    }
  }
  logical_rewind(input);
  return false;
}

static bool lexical_classify(
  const struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  TSLexer *lexer = &input->lexer;
  if (lexer->lookahead == '}' && parameter_subscript_context(scanner))
    return false;
  if (lexical_arithmetic_sign(input, valid)) return true;
  if (lexical_operator(lexer, valid)) {
    return true;
  }
  logical_rewind(input);
  if (lexical_punctuation(lexer, valid)) {
    return true;
  }
  logical_rewind(input);
  const enum TokenType names[] = {NAME_BEGIN, VARIABLE_NAME_BEGIN};
  for (size_t index = 0; index < ARRAY_COUNT(names); index += 1) {
    if (valid[names[index]] && lexical_name(lexer, names[index])) {
      return true;
    }
    logical_rewind(input);
  }
  if (
    (valid[ARITHMETIC_NUMBER_BEGIN] ||
      valid[ARITHMETIC_VARIABLE_BEGIN] ||
      valid[ARITHMETIC_SOURCE_FRAGMENT_BEGIN]) &&
    lexical_arithmetic_word(lexer, valid)
  ) {
    return true;
  }
  logical_rewind(input);
  if (lexical_arithmetic_fragment(scanner, input, valid)) return true;
  const enum TokenType escapes[] = {
    ESCAPED_CHARACTER_BEGIN,
    DOUBLE_QUOTE_ESCAPE_BEGIN,
    DOUBLE_QUOTED_PARAMETER_ESCAPE_BEGIN,
    HERE_DOCUMENT_ESCAPE_BEGIN
  };
  for (size_t index = 0; index < ARRAY_COUNT(escapes); index += 1) {
    if (valid[escapes[index]] && lexical_escape(lexer, escapes[index])) {
      return true;
    }
    logical_rewind(input);
  }
  enum DispatchResult blank = lexical_blank(scanner, lexer, valid);
  if (blank != DISPATCH_NEXT) return blank == DISPATCH_ACCEPTED;
  if (lexical_parameter_character(input, valid)) return true;
  const enum TokenType texts[] = {
    SINGLE_QUOTE_CONTENT_BEGIN,
    DOUBLE_QUOTE_TEXT_BEGIN,
    DOUBLE_QUOTED_PARAMETER_TEXT_BEGIN,
    DOLLAR_SINGLE_QUOTE_TEXT_BEGIN,
    QUOTED_HERE_DOCUMENT_TEXT,
    QUOTED_HERE_DOCUMENT_END_TEXT,
    HERE_DOCUMENT_END_TEXT_BEGIN,
    HERE_DOCUMENT_TEXT_BEGIN
  };
  for (size_t index = 0; index < ARRAY_COUNT(texts); index += 1) {
    if (valid[texts[index]] && lexical_text(input, texts[index])) {
      return true;
    }
  }
  return false;
}

static bool pattern_structured_start(struct LogicalLexer *input) {
  int32_t character = input->lexer.lookahead;
  if (character == '\\') {
    int32_t next = logical_peek(input);
    return next != SOURCE_BACKQUOTE_BOUNDARY && next != LOOKAHEAD_END;
  }
  if (character != '$') {
    return character == '\'' || character == '"' || character == '`';
  }
  int32_t follower = logical_peek(input);
  return is_parameter_start_character(follower) ||
    is_one_of(follower, "({[") ||
    follower == '\'';
}

static bool is_tilde_context(enum TokenType opener) {
  return opener == WORD_TILDE_START ||
    opener == ASSIGNMENT_TILDE_START ||
    opener == PARAMETER_TILDE_START;
}

static struct BracketScan
literal_bracket_scan(const struct Scanner *scanner, enum TokenType literal) {
  return bracket_scan(pattern_mode(
    scanner,
    literal == PARAMETER_LITERAL_BEGIN || parameter_pattern_context(scanner),
    literal == ASSIGNMENT_LITERAL_BEGIN
  ));
}

static bool lexical_pattern_probe(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  struct BracketScan *scan,
  uint32_t *chains,
  bool *complete
) {
  struct LogicalPosition position = logical_position(input);
  struct LookaheadLexer lookahead = {0};
  bool accepted = lookahead_begin(&lookahead, &input->lexer) &&
    scan_pattern_bracket(scanner, &lookahead.lexer, scan, chains, complete) &&
    !lookahead_is_pending(&lookahead.lexer);
  if (accepted) record_bracket_scan(scanner, scan, *complete);
  lookahead_clear(&lookahead);
  logical_restore_position(input, &position);
  return accepted;
}

static bool bash_word_boundary(
  const struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
);

static bool lexical_pattern_content(
  const struct Scanner *scanner,
  struct LogicalLexer *input,
  enum TokenType symbol,
  const bool *valid
) {
  TSLexer *lexer = &input->lexer;
  bool parameter = symbol == PARAMETER_PATTERN_CLASS_CONTENT_BEGIN ||
    symbol == PARAMETER_PATTERN_COLLATING_CHARACTER_BEGIN ||
    symbol == PARAMETER_PATTERN_EQUIVALENCE_CHARACTER_BEGIN ||
    parameter_pattern_context(scanner);
  bool text = symbol == PATTERN_CLASS_CONTENT_BEGIN ||
    symbol == PARAMETER_PATTERN_CLASS_CONTENT_BEGIN;
  int32_t marker = text ? ':'
    : symbol == PATTERN_COLLATING_CHARACTER_BEGIN ||
      symbol == PARAMETER_PATTERN_COLLATING_CHARACTER_BEGIN
    ? '.'
    : '=';
  enum TokenType closer = text ? PATTERN_CHARACTER_CLASS_END_COLON
    : marker == '.'            ? PUNCT_DOT
                               : PUNCT_EQUALS;
  bool has_content = valid[closer];
  bool consumed = false;
  while (
    !pattern_boundary(scanner, lexer, parameter) &&
    !pattern_structured_start(input) &&
    !bash_word_boundary(scanner, input, valid)
  ) {
    int32_t character = lexer->lookahead;
    if (
      (has_content && character == marker && logical_peek(input) == ']') ||
      (character == ']' && marker != '.')
    ) {
      break;
    }
    lexer->advance(lexer, false);
    lexer->mark_end(lexer);
    consumed = true;
    has_content = true;
    if (!text) {
      break;
    }
  }
  lexer->result_symbol = (TSSymbol)symbol;
  return consumed;
}

static bool brace_endpoint(TSLexer *lexer, bool *numeric) {
  *numeric = lexer->lookahead == '-' ||
    lexer->lookahead == '+' ||
    is_decimal_digit(lexer->lookahead);
  if (*numeric) {
    if (lexer->lookahead == '-' || lexer->lookahead == '+')
      lexer->advance(lexer, false);
    if (!is_decimal_digit(lexer->lookahead)) return false;
    do {
      lexer->advance(lexer, false);
    } while (is_decimal_digit(lexer->lookahead));
    return true;
  }
  if (!is_name_start_character(lexer->lookahead) || lexer->lookahead == '_')
    return false;
  lexer->advance(lexer, false);
  return true;
}

static bool brace_sequence(TSLexer *lexer) {
  bool first, second;
  if (!brace_endpoint(lexer, &first) || lexer->lookahead != '.') return false;
  lexer->advance(lexer, false);
  if (lexer->lookahead != '.') return false;
  lexer->advance(lexer, false);
  if (!brace_endpoint(lexer, &second) || first != second) return false;
  if (lexer->lookahead == '.') {
    lexer->advance(lexer, false);
    if (lexer->lookahead != '.') return false;
    lexer->advance(lexer, false);
    if (!brace_endpoint(lexer, &second) || !second) return false;
  }
  return lexer->lookahead == '}';
}

static bool skip_brace_body(const struct Scanner *scanner, TSLexer *lexer) {
  return skip_embedded_construct(scanner, lexer, '}', false) ==
    ARITHMETIC_VALIDATION_VALID;
}

static bool
skip_brace_parameter(const struct Scanner *scanner, TSLexer *lexer) {
  size_t start = probe_position(lexer);
  lexer->advance(lexer, false);
  bool command = braced_command_follows(lexer->lookahead);
  if (!skip_brace_body(scanner, lexer)) return false;
  if (command) return true;
  size_t syntax_end = probe_position(lexer);
  probe_seek(lexer, start);
  lexer->advance(lexer, false);
  size_t depth = 1;
  while (
    !lexer_at_eof(lexer) &&
    lexer->lookahead != SOURCE_BACKQUOTE_BOUNDARY &&
    depth > 0
  ) {
    int32_t ch = lexer->lookahead;
    enum ArithmeticValidation process =
      skip_process_substitution(scanner, lexer, false);
    if (process == ARITHMETIC_VALIDATION_VALID) continue;
    if (process != ARITHMETIC_VALIDATION_INVALID) return false;
    if (probe_position(lexer) >= syntax_end && is_token_delimiter(lexer)) break;
    if (ch == '$') {
      size_t dollar = probe_position(lexer);
      lexer->advance(lexer, false);
      if (lexer->lookahead == '{') {
        lexer->advance(lexer, false);
        if (braced_command_follows(lexer->lookahead)) {
          if (!skip_brace_body(scanner, lexer)) return false;
        } else {
          if (probe_position(lexer) >= syntax_end) {
            size_t content = probe_position(lexer);
            if (!skip_brace_body(scanner, lexer)) return false;
            syntax_end = probe_position(lexer);
            probe_seek(lexer, content);
          }
          depth++;
        }
        continue;
      }
      probe_seek(lexer, dollar);
    }
    enum BracketAtom atom = skip_bracket_quoted_atom(scanner, lexer);
    if (atom == BRACKET_ATOM_END) return false;
    if (atom == BRACKET_ATOM_MEMBER) continue;
    if (ch == '{') depth++;
    else if (ch == '}') depth--;
    lexer->advance(lexer, false);
  }
  return !lookahead_is_pending(lexer);
}

static bool scan_brace_expansion(
  const struct Scanner *scanner,
  TSLexer *lexer,
  bool *nested_parentheses
) {
  struct LookaheadLexer *lookahead = (struct LookaheadLexer *)lexer;
  if (lexer->lookahead != '{') return false;
  if (nested_parentheses != NULL) *nested_parentheses = true;
  size_t parentheses = 0;
  size_t start = lookahead->position;
  lexer->advance(lexer, false);
  if (brace_sequence(lexer)) {
    lexer->advance(lexer, false);
    return !lookahead_is_pending(lexer);
  }
  lookahead_seek(lookahead, start);
  lexer->advance(lexer, false);
  size_t depth = 1, word_end = 0;
  bool comma = false;
  bool raw = raw_word_context(scanner) != NULL;
  bool element_start = false;
  while (!lexer_at_eof(lexer) && depth > 0) {
    int32_t ch = lexer->lookahead;
    size_t position = lookahead->position;
    if (raw && element_start && ch == '#' && position >= word_end) {
      if (!advance_to_comment_end(lexer, NULL)) break;
      continue;
    }
    enum ArithmeticValidation substitution =
      skip_process_substitution(scanner, lexer, false);
    if (substitution == ARITHMETIC_VALIDATION_VALID) {
      element_start = false;
      continue;
    }
    if (
      substitution != ARITHMETIC_VALIDATION_INVALID ||
      (is_token_delimiter(lexer) &&
        lookahead->position >= word_end &&
        !bracket_word_contains(scanner, lexer))
    )
      break;
    if (
      position >= word_end && (raw || !bracket_word_contains(scanner, lexer))
    ) {
      enum ArithmeticValidation pattern = extglob_enabled(scanner)
        ? skip_extglob_pattern(scanner, lexer, false)
        : ARITHMETIC_VALIDATION_INVALID;
      if (pattern == ARITHMETIC_VALIDATION_VALID)
        word_end = lookahead->position;
      lookahead_seek(lookahead, position);
    }
    if (ch == '\\') {
      bool continuation;
      if (!skip_escape_run(lexer, &continuation)) break;
    } else if (is_quote_or_expansion_start(ch)) {
      bool parameter = false;
      if (ch == '$') {
        lexer->advance(lexer, false);
        parameter = lexer->lookahead == '{';
        if (!parameter) probe_seek(lexer, position);
      }
      if (
        parameter ? !skip_brace_parameter(scanner, lexer)
                  : !skip_bracket_member_expansion(scanner, lexer)
      )
        break;
    } else {
      if (ch == '(') parentheses++;
      else if (ch == ')') {
        if (parentheses > 0) parentheses--;
        else if (nested_parentheses != NULL) *nested_parentheses = false;
      }
      if (ch == '{') depth++;
      else if (ch == '}') depth--;
      else if (ch == ',' && depth == 1) comma = true;
      lexer->advance(lexer, false);
    }
    element_start = is_horizontal_blank(ch) || ch == '\n';
  }
  if (nested_parentheses != NULL && parentheses > 0)
    *nested_parentheses = false;
  return depth == 0 && comma && !lookahead_is_pending(lexer);
}

static bool brace_expansion_follows(
  const struct Scanner *scanner,
  struct LogicalLexer *input
) {
  if (
    word_source_context(scanner, true) == NULL ||
    brace_suppressed(scanner, &input->lexer)
  )
    return false;
  struct LogicalPosition position = logical_position(input);
  struct LookaheadLexer lookahead = {0};
  bool complete = lookahead_begin(&lookahead, &input->lexer) &&
    scan_brace_expansion(scanner, &lookahead.lexer, NULL);
  lookahead_clear(&lookahead);
  logical_restore_position(input, &position);
  return complete;
}

static enum TokenType first_valid_symbol(
  const bool *valid,
  const enum TokenType *symbols,
  size_t count
) {
  for (size_t index = 0; index < count; index++) {
    if (valid[symbols[index]]) return symbols[index];
  }
  return TOKEN_COUNT;
}

static bool parameter_extglob_follows(
  const struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  if (
    !valid[EXTGLOB_OPERATOR_BEGIN] ||
    !extglob_enabled(scanner) ||
    bracket_payload_contains(scanner, &input->lexer)
  )
    return false;
  if (!valid[PARAMETER_LITERAL_BEGIN]) return true;
  struct LogicalPosition position = logical_position(input);
  struct LookaheadLexer lookahead = {0};
  bool complete = false;
  enum PatternMode mode = pattern_context(scanner) == PARAMETER_REPLACE_BEGIN
    ? PATTERN_REPLACEMENT
    : PATTERN_PARAMETER;
  if (lookahead_begin(&lookahead, &input->lexer)) {
    TSLexer *probe = &lookahead.lexer;
    probe->advance(probe, false);
    size_t depth = 0;
    struct BracketScan scan = bracket_scan(mode);
    while (!is_bracket_literal_boundary(scanner, probe, mode)) {
      enum BracketAtom atom = skip_bracket_quoted_atom(scanner, probe);
      if (atom == BRACKET_ATOM_END) break;
      if (atom == BRACKET_ATOM_MEMBER) continue;
      if (probe->lookahead == '[') {
        size_t start = lookahead.position;
        uint32_t chains = 0;
        bool bracket_complete = false;
        if (
          scan_pattern_bracket(
            scanner,
            probe,
            &scan,
            &chains,
            &bracket_complete
          ) &&
          bracket_complete
        ) {
          probe->advance(probe, false);
          continue;
        }
        lookahead_seek(&lookahead, start);
      }
      if (probe->lookahead == '(') {
        if (depth == SIZE_MAX) break;
        depth++;
      } else if (probe->lookahead == ')' && --depth == 0) {
        complete = !lookahead_is_pending(probe);
        break;
      }
      probe->advance(probe, false);
    }
  }
  lookahead_clear(&lookahead);
  logical_restore_position(input, &position);
  return complete;
}

static bool extglob_pattern_follows(
  const struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  return is_extglob_operator(input->lexer.lookahead) &&
    logical_peek(input) == '(' &&
    parameter_extglob_follows(scanner, input, valid);
}

static bool extglob_pattern_nested(
  struct Scanner *scanner,
  struct LookaheadLexer *lookahead,
  size_t end,
  bool *brace_free
) {
  TSLexer *probe = &lookahead->lexer;
  lookahead_seek(lookahead, 2);
  size_t depth = 0;
  *brace_free = true;
  while (lookahead->position < end) {
    int32_t ch = probe->lookahead;
    if (ch == '{' || ch == '}') *brace_free = false;
    enum ArithmeticValidation substitution =
      skip_process_substitution(scanner, probe, false);
    if (substitution == ARITHMETIC_VALIDATION_VALID) continue;
    enum BracketAtom atom = skip_bracket_quoted_atom(scanner, probe);
    if (atom == BRACKET_ATOM_END) break;
    if (atom == BRACKET_ATOM_MEMBER) continue;
    if (ch == '{') {
      size_t start = lookahead->position;
      bool parentheses = true;
      if (scan_brace_expansion(scanner, probe, &parentheses)) {
        if (lookahead->position > end || !parentheses) return false;
        continue;
      }
      lookahead_seek(lookahead, start);
      depth++;
    } else if (ch == '}' && depth > 0) {
      depth--;
    } else if (depth == 0 && brace_boundary(scanner, probe)) {
      return false;
    }
    probe->advance(probe, false);
  }
  return true;
}

static bool
extglob_source_nested(struct Scanner *scanner, struct LogicalLexer *input) {
  const struct SourceContext *word = word_source_context(scanner, true);
  if (word == NULL) return true;
  enum TokenType context = pattern_context(scanner);
  /* Extglob lookahead already checked patterns outside brace alternatives. */
  if (
    word->word_remaining > 0 &&
    (word->brace_free ||
      (extglob_context(scanner) &&
        context != BRACE_OPEN &&
        context != BRACE_LITERAL_OPEN))
  )
    return true;
  size_t word_index = (size_t)(word - scanner->contexts);
  struct LogicalPosition position = logical_position(input);
  struct LookaheadLexer lookahead = {0};
  bool nested = true;
  if (lookahead_begin(&lookahead, &input->lexer)) {
    TSLexer *probe = &lookahead.lexer;
    if (
      skip_extglob_pattern(scanner, probe, false) == ARITHMETIC_VALIDATION_VALID
    ) {
      size_t end = lookahead.position;
      size_t remaining = lookahead.characters[end].raw_cut;
      bool cache = remaining >= scanner->contexts[word_index].word_remaining;
      if (cache) {
        scanner->contexts[word_index].word_remaining = remaining;
        scanner->contexts[word_index].brace_free = false;
        scanner->contexts[word_index].pattern_region = true;
      }
      bool brace_free;
      nested = extglob_pattern_nested(scanner, &lookahead, end, &brace_free);
      if (cache && nested && !lookahead_is_pending(probe))
        scanner->contexts[word_index].brace_free = brace_free;
    }
  }
  lookahead_clear(&lookahead);
  logical_restore_position(input, &position);
  return nested;
}

static bool accept_word_start(
  const struct Scanner *scanner,
  struct LogicalLexer *input,
  enum TokenType symbol,
  size_t length
) {
  TSLexer *lexer = &input->lexer;
  uint32_t chains = fallback_chains(scanner);
  for (; length > 1; length -= 1) {
    chains =
      bracket_chains_after_literal(chains, bracket_input(lexer->lookahead));
    lexer->advance(lexer, false);
  }
  input->bracket_chains =
    bracket_chains_after_literal(chains, bracket_input(lexer->lookahead));
  return accept_character(lexer, symbol);
}

static bool bash_word_start(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  TSLexer *lexer = &input->lexer;
  int32_t ch = lexer->lookahead, next = logical_peek(input);
  enum TokenType symbol = TOKEN_COUNT;
  size_t length = 1;
  if (ch == '$' && is_one_of(next, "?*@!")) {
    struct LogicalPosition position = logical_position(input);
    lexer->advance(lexer, false);
    bool pattern = extglob_pattern_follows(scanner, input, valid);
    logical_restore_position(input, &position);
    if (pattern) {
      const enum TokenType literals[] = {
        LITERAL_BEGIN,
        ASSIGNMENT_LITERAL_BEGIN,
        PARAMETER_LITERAL_BEGIN,
        EXTGLOB_TEXT_BEGIN,
        BRACE_TEXT_BEGIN
      };
      enum TokenType literal =
        first_valid_symbol(valid, literals, ARRAY_COUNT(literals));
      if (literal != TOKEN_COUNT)
        return accept_word_start(scanner, input, literal, 1);
    }
  }
  if (ch == '$' && next == '"') {
    symbol = DOLLAR_DQ_DOLLAR;
  } else if (process_substitution_follows(input)) {
    symbol = ch == '<' ? PROCESS_IN_START : PROCESS_OUT_START;
  } else if (extglob_pattern_follows(scanner, input, valid)) {
    symbol = EXTGLOB_OPERATOR_BEGIN;
    if (!extglob_source_nested(scanner, input)) {
      const enum TokenType literals[] = {
        BRACE_TEXT_BEGIN,
        EXTGLOB_TEXT_BEGIN,
        LITERAL_BEGIN,
        ASSIGNMENT_LITERAL_BEGIN,
        PATTERN_CLASS_CONTENT_BEGIN,
        PATTERN_BRACKET_CHARACTER,
        ASSIGNMENT_PATTERN_BRACKET_CHARACTER,
        PATTERN_COLLATING_CHARACTER_BEGIN,
        PATTERN_EQUIVALENCE_CHARACTER_BEGIN
      };
      symbol = first_valid_symbol(valid, literals, ARRAY_COUNT(literals));
      if (
        symbol != TOKEN_COUNT &&
        symbol != PATTERN_BRACKET_CHARACTER &&
        symbol != ASSIGNMENT_PATTERN_BRACKET_CHARACTER &&
        symbol != PATTERN_COLLATING_CHARACTER_BEGIN &&
        symbol != PATTERN_EQUIVALENCE_CHARACTER_BEGIN
      )
        length = 2;
    }
  } else if (
    ch == '{' && valid[BRACE_OPEN] && brace_expansion_follows(scanner, input)
  ) {
    symbol = BRACE_OPEN;
  }
  if (symbol == TOKEN_COUNT) return false;
  return valid[symbol] && accept_word_start(scanner, input, symbol, length);
}

static bool bash_word_boundary(
  const struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  int32_t ch = input->lexer.lookahead, next = logical_peek(input);
  return (ch == '$' && next == '"') ||
    process_substitution_follows(input) ||
    extglob_pattern_follows(scanner, input, valid) ||
    (ch == '{' && valid[BRACE_OPEN] && brace_expansion_follows(scanner, input));
}

enum RegexDelimiterStep {
  REGEX_DELIMITER_LITERAL,
  REGEX_DELIMITER_CONSUMED,
  REGEX_DELIMITER_STOP,
};

struct RegexDelimiterScan {
  int32_t kind;
  int32_t compound;
  bool first;
  bool minimum;
  bool comma;
  bool content;
  bool complete;
};

static enum BracketAtom regex_substitution_atom(
  const struct Scanner *scanner,
  struct LookaheadLexer *lookahead,
  enum BracketAtom atom,
  int32_t ch
) {
  TSLexer *lexer = &lookahead->lexer;
  if (atom != BRACKET_ATOM_PLAIN || (ch != '<' && ch != '>')) return atom;
  size_t start = lookahead->position;
  lexer->advance(lexer, false);
  if (lexer->lookahead != '(') {
    lookahead_seek(lookahead, start);
    return atom;
  }
  lexer->advance(lexer, false);
  struct EmbeddedSkip skip = {0};
  enum ArithmeticValidation result =
    resume_embedded_construct(scanner, lexer, ')', false, &skip);
  clear_embedded_skip(&skip);
  return result == ARITHMETIC_VALIDATION_VALID ? BRACKET_ATOM_MEMBER
                                               : BRACKET_ATOM_END;
}

static enum RegexDelimiterStep
regex_interval_step(struct RegexDelimiterScan *scan, int32_t ch) {
  if (ch == '}') {
    scan->complete = scan->minimum;
    return REGEX_DELIMITER_STOP;
  }
  if (ch == ',') {
    if (!scan->minimum || scan->comma) return REGEX_DELIMITER_STOP;
    scan->comma = true;
  } else if (is_decimal_digit(ch)) {
    scan->minimum = true;
  } else {
    return REGEX_DELIMITER_STOP;
  }
  return REGEX_DELIMITER_LITERAL;
}

static enum RegexDelimiterStep
regex_marker_step(struct RegexDelimiterScan *scan, TSLexer *lexer, int32_t ch) {
  if (ch != scan->kind) return REGEX_DELIMITER_LITERAL;
  lexer->advance(lexer, false);
  if (lexer->lookahead == ']') {
    scan->complete = scan->content;
    return REGEX_DELIMITER_STOP;
  }
  scan->content = true;
  return REGEX_DELIMITER_CONSUMED;
}

static enum RegexDelimiterStep regex_bracket_step(
  struct RegexDelimiterScan *scan,
  TSLexer *lexer,
  int32_t ch
) {
  if (scan->compound != 0) {
    if (ch != scan->compound) return REGEX_DELIMITER_LITERAL;
    lexer->advance(lexer, false);
    if (lexer->lookahead == ']') {
      scan->compound = 0;
      lexer->advance(lexer, false);
    }
    scan->first = false;
    return REGEX_DELIMITER_CONSUMED;
  }
  if (ch == ']' && !scan->first) {
    scan->complete = true;
    return REGEX_DELIMITER_STOP;
  }
  if (ch == '[') {
    lexer->advance(lexer, false);
    if (is_one_of(lexer->lookahead, ":.=")) {
      scan->compound = lexer->lookahead;
      lexer->advance(lexer, false);
    }
    scan->first = false;
    return REGEX_DELIMITER_CONSUMED;
  }
  return REGEX_DELIMITER_LITERAL;
}

static bool regex_delimited(
  const struct Scanner *scanner,
  struct LogicalLexer *input,
  int32_t kind
) {
  struct LogicalPosition position = logical_position(input);
  struct LookaheadLexer lookahead = {0};
  bool complete = false;
  if (lookahead_begin(&lookahead, &input->lexer)) {
    TSLexer *lexer = &lookahead.lexer;
    size_t depth = scanner->contexts[scanner->context_count - 1].regex_depth;
    struct RegexDelimiterScan scan = {.kind = kind, .first = kind == '['};
    lexer->advance(lexer, false);
    if (scan.first && lexer->lookahead == '^') lexer->advance(lexer, false);
    if (kind != '[' && kind != '{') lexer->advance(lexer, false);
    while (!lexer_at_eof(lexer)) {
      int32_t ch = lexer->lookahead;
      enum BracketAtom atom = regex_substitution_atom(
        scanner,
        &lookahead,
        skip_bracket_quoted_atom(scanner, lexer),
        ch
      );
      if (atom == BRACKET_ATOM_END) break;
      if (atom == BRACKET_ATOM_MEMBER) {
        scan.first = false;
        scan.minimum = true;
        scan.content = true;
        continue;
      }
      if (regex_boundary(lexer, depth) && ch != '(') break;
      if (ch == '(') {
        if (depth == SIZE_MAX) break;
        depth++;
      } else if (ch == ')') {
        if (depth == 0) break;
        depth--;
      }
      enum RegexDelimiterStep step = kind == '{'
        ? regex_interval_step(&scan, ch)
        : kind != '[' ? regex_marker_step(&scan, lexer, ch)
                      : regex_bracket_step(&scan, lexer, ch);
      if (step == REGEX_DELIMITER_STOP) break;
      if (step == REGEX_DELIMITER_CONSUMED) continue;
      scan.first = false;
      scan.content = true;
      lexer->advance(lexer, false);
    }
    complete = scan.complete && !lookahead_is_pending(lexer);
  }
  lookahead_clear(&lookahead);
  logical_restore_position(input, &position);
  return complete;
}

static bool regex_bash_part_starts(struct LogicalLexer *input) {
  int32_t ch = input->lexer.lookahead, next = logical_peek(input);
  return pattern_structured_start(input) ||
    (ch == '$' && next == '"') ||
    process_substitution_follows(input);
}

static struct SourceContext *regex_context(struct Scanner *scanner) {
  if (scanner->context_count == 0) return NULL;
  struct SourceContext *context =
    &scanner->contexts[scanner->context_count - 1];
  return context->opener == REGEX_START ? context : NULL;
}

static bool regex_tokens_are_valid(const bool *valid) {
  bool active = valid[REGEX_OPEN] ||
    valid[REGEX_CLOSE] ||
    valid[REGEX_END] ||
    valid[REGEX_SOURCE_GROUP_END];
  for (size_t symbol = ERE_CHARACTER_BEGIN; symbol < REGEX_OPEN; symbol++)
    active = active || valid[symbol];
  return active;
}

static enum DispatchResult regex_end_token(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  const struct SourceContext *context = regex_context(scanner);
  TSLexer *lexer = &input->lexer;
  if (
    !regex_boundary(lexer, context->regex_depth) ||
    process_substitution_follows(input)
  )
    return DISPATCH_NEXT;
  if (valid[REGEX_SOURCE_GROUP_END] && context->regex_depth == 0) {
    return dispatch_outcome(accept_token(lexer, REGEX_SOURCE_GROUP_END));
  }
  if (valid[REGEX_END] && context->regex_depth == 0) {
    lexer->mark_end(lexer);
    lexer->result_symbol = REGEX_END;
    return dispatch_outcome(source_context_pop(scanner));
  }
  return DISPATCH_REJECTED;
}

static enum DispatchResult
regex_marker_token(struct LogicalLexer *input, const bool *valid) {
  static const struct LexicalPunctuation markers[] = {
    {':', ERE_COLON},
    {'.', ERE_DOT},
    {'=', ERE_EQUAL},
    {']', ERE_COMPOUND_CLOSE},
    {']', ERE_BRACKET_CLOSE},
    {'}', ERE_INTERVAL_CLOSE},
    {',', ERE_COMMA},
    {'^', ERE_NEGATION},
  };
  TSLexer *lexer = &input->lexer;
  int32_t ch = lexer->lookahead;
  bool payload = valid[ERE_COMPOUND_CHARACTER_BEGIN] ||
    valid[ERE_COMPOUND_MULTI_BEGIN] ||
    valid[ERE_EQUIVALENCE_CHARACTER_BEGIN] ||
    valid[ERE_EQUIVALENCE_MULTI_BEGIN] ||
    valid[ERE_CLASS_NAME_BEGIN];
  for (size_t i = 0; i < ARRAY_COUNT(markers); i++) {
    enum TokenType symbol = markers[i].symbol;
    if (
      valid[symbol] &&
      ch == markers[i].character &&
      (!is_one_of(ch, ":.=") || !payload || logical_peek(input) == ']')
    )
      return dispatch_outcome(accept_character(lexer, symbol));
  }
  return DISPATCH_NEXT;
}

static enum DispatchResult regex_bracket_open_token(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid,
  bool *compound_fragment
) {
  TSLexer *lexer = &input->lexer;
  if (lexer->lookahead != '[') return DISPATCH_NEXT;
  int32_t next = logical_peek(input);
  enum TokenType symbol = next == ':' ? ERE_CLASS_OPEN
    : next == '.'                     ? ERE_COLLATING_OPEN
                                      : ERE_EQUIVALENCE_OPEN;
  if (is_one_of(next, ":.=") && valid[symbol]) {
    if (regex_delimited(scanner, input, next))
      return dispatch_outcome(accept_character(lexer, symbol));
    *compound_fragment = true;
  }
  if (valid[ERE_BRACKET_OPEN] && regex_delimited(scanner, input, '['))
    return dispatch_outcome(accept_character(lexer, ERE_BRACKET_OPEN));
  return DISPATCH_NEXT;
}

static enum DispatchResult regex_hyphen_token(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  TSLexer *lexer = &input->lexer;
  int32_t ch = lexer->lookahead;
  if (valid[ERE_INITIAL_CLOSE_BEGIN] && ch == ']')
    return dispatch_outcome(accept_character(lexer, ERE_INITIAL_CLOSE_BEGIN));
  if (ch != '-') return DISPATCH_NEXT;
  int32_t next = logical_peek(input);
  if (valid[ERE_INITIAL_HYPHEN])
    return dispatch_outcome(accept_character(lexer, ERE_INITIAL_HYPHEN));
  if (valid[ERE_RANGE_END_HYPHEN])
    return dispatch_outcome(accept_character(lexer, ERE_RANGE_END_HYPHEN));
  if (valid[ERE_LITERAL_HYPHEN] && next == ']')
    return dispatch_outcome(accept_character(lexer, ERE_LITERAL_HYPHEN));
  if (!valid[ERE_HYPHEN] || next == ']') return DISPATCH_NEXT;
  struct LogicalPosition position = logical_position(input);
  lexer->advance(lexer, false);
  int32_t after = logical_peek(input);
  bool endpoint = !regex_bash_part_starts(input);
  if (endpoint && next == '[' && is_one_of(after, ":.="))
    endpoint = after == '.' && regex_delimited(scanner, input, '.');
  logical_restore_position(input, &position);
  if (endpoint) return dispatch_outcome(accept_character(lexer, ERE_HYPHEN));
  return DISPATCH_NEXT;
}

static enum DispatchResult regex_compound_element_token(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  if (
    !valid[ERE_COMPOUND_CHARACTER_BEGIN] &&
    !valid[ERE_COMPOUND_MULTI_BEGIN] &&
    !valid[ERE_EQUIVALENCE_CHARACTER_BEGIN] &&
    !valid[ERE_EQUIVALENCE_MULTI_BEGIN]
  )
    return DISPATCH_NEXT;
  struct SourceContext *context = regex_context(scanner);
  TSLexer *lexer = &input->lexer;
  int32_t ch = lexer->lookahead;
  const bool equivalence = valid[ERE_EQUIVALENCE_CHARACTER_BEGIN] ||
    valid[ERE_EQUIVALENCE_MULTI_BEGIN];
  const int32_t marker = equivalence ? '=' : '.';
  size_t count = 0, depth = context->regex_depth;
  while (!regex_boundary(lexer, depth) && !regex_bash_part_starts(input)) {
    int32_t character = lexer->lookahead, following = logical_peek(input);
    if (following == ']' && character == marker) break;
    if (character == '(') {
      if (depth == SIZE_MAX) return DISPATCH_REJECTED;
      depth++;
    } else if (character == ')') {
      if (depth == 0) break;
      depth--;
    }
    lexer->advance(lexer, false);
    if (count < 2) count++;
  }
  if (count == 0) return DISPATCH_REJECTED;
  enum TokenType symbol = equivalence
    ? (count == 1 ? ERE_EQUIVALENCE_CHARACTER_BEGIN
                  : ERE_EQUIVALENCE_MULTI_BEGIN)
    : (count == 1 ? ERE_COMPOUND_CHARACTER_BEGIN : ERE_COMPOUND_MULTI_BEGIN);
  if (
    count == 1 &&
    is_one_of(ch, "-]") &&
    lexer->lookahead == marker &&
    logical_peek(input) == ']'
  )
    symbol = equivalence ? ERE_FRAGMENT_BEGIN : ERE_META_CHARACTER_BEGIN;
  if (!valid[symbol]) return DISPATCH_REJECTED;
  context->regex_depth = depth;
  return dispatch_outcome(accept_token(lexer, symbol));
}

static enum DispatchResult regex_group_token(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  TSLexer *lexer = &input->lexer;
  int32_t ch = lexer->lookahead;
  if (ch != '(' && ch != ')') return DISPATCH_NEXT;
  if (ch == ')' && regex_context(scanner)->regex_depth == 0)
    return DISPATCH_REJECTED;
  enum TokenType member =
    ch == '(' ? ERE_MEMBER_OPEN_BEGIN : ERE_MEMBER_CLOSE_BEGIN;
  if (valid[member]) return dispatch_outcome(accept_character(lexer, member));
  enum TokenType group = ch == '(' ? REGEX_OPEN : REGEX_CLOSE;
  if (valid[group]) return dispatch_outcome(accept_character(lexer, group));
  if (ch == ')' && valid[ERE_ORDINARY_CLOSE])
    return dispatch_outcome(accept_character(lexer, ERE_ORDINARY_CLOSE));
  return DISPATCH_NEXT;
}

static enum DispatchResult
regex_name_or_count_token(struct LogicalLexer *input, const bool *valid) {
  TSLexer *lexer = &input->lexer;
  int32_t ch = lexer->lookahead;
  if (valid[ERE_CLASS_NAME_BEGIN] && is_name_start_character(ch) && ch != '_') {
    do {
      lexer->advance(lexer, false);
    } while (is_name_character(lexer->lookahead) && lexer->lookahead != '_');
    return dispatch_outcome(accept_token(lexer, ERE_CLASS_NAME_BEGIN));
  }
  if (valid[ERE_COUNT_BEGIN] && is_decimal_digit(ch)) {
    do {
      lexer->advance(lexer, false);
    } while (is_decimal_digit(lexer->lookahead));
    return dispatch_outcome(accept_token(lexer, ERE_COUNT_BEGIN));
  }
  return DISPATCH_NEXT;
}

static enum DispatchResult regex_atom_token(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid,
  bool compound_fragment
) {
  static const struct LexicalPunctuation operators[] = {
    {'*', ERE_STAR},
    {'+', ERE_PLUS},
    {'?', ERE_QUESTION},
    {'.', ERE_WILDCARD_BEGIN},
    {'^', ERE_LEFT_ANCHOR_BEGIN},
    {'$', ERE_RIGHT_ANCHOR_BEGIN},
  };
  const struct SourceContext *context = regex_context(scanner);
  TSLexer *lexer = &input->lexer;
  int32_t ch = lexer->lookahead;
  if (
    valid[ERE_COLLATING_CHARACTER_BEGIN] &&
    !compound_fragment &&
    !is_one_of(ch, "-]")
  )
    return dispatch_outcome(
      accept_character(lexer, ERE_COLLATING_CHARACTER_BEGIN)
    );
  if (valid[ERE_MODIFIER_BEGIN] && ch == '?')
    return dispatch_outcome(accept_character(lexer, ERE_MODIFIER_BEGIN));
  if (
    ch == '{' &&
    valid[ERE_INTERVAL_OPEN] &&
    regex_delimited(scanner, input, '{')
  )
    return dispatch_outcome(accept_character(lexer, ERE_INTERVAL_OPEN));
  for (size_t i = 0; i < ARRAY_COUNT(operators); i++)
    if (valid[operators[i].symbol] && ch == operators[i].character)
      return dispatch_outcome(accept_character(lexer, operators[i].symbol));
  if (ch == '|') {
    struct LogicalPosition position = logical_position(input);
    lexer->advance(lexer, false);
    bool empty = regex_boundary(lexer, context->regex_depth) ||
      lexer->lookahead == ')' ||
      lexer->lookahead == '|';
    logical_restore_position(input, &position);
    enum TokenType symbol = valid[ERE_BAR] && !empty ? ERE_BAR : ERE_SOURCE_BAR;
    return dispatch_outcome(valid[symbol] && accept_character(lexer, symbol));
  }
  if (ch == '}' && valid[ERE_ORDINARY_BRACE])
    return dispatch_outcome(accept_character(lexer, ERE_ORDINARY_BRACE));
  if (valid[ERE_CHARACTER_BEGIN] && !is_one_of(ch, "([{*+?|.^$"))
    return dispatch_outcome(accept_character(lexer, ERE_CHARACTER_BEGIN));
  if (!valid[ERE_FRAGMENT_BEGIN]) return DISPATCH_REJECTED;
  int32_t closing = ch == '[' ? ']' : ch == '{' ? '}' : 0;
  do {
    int32_t consumed = lexer->lookahead;
    lexer->advance(lexer, false);
    if (closing == 0 || consumed == closing) break;
  } while (
    !regex_boundary(lexer, context->regex_depth) &&
    !is_one_of(lexer->lookahead, "()") &&
    !regex_bash_part_starts(input)
  );
  return dispatch_outcome(accept_token(lexer, ERE_FRAGMENT_BEGIN));
}

static bool lexical_regex_classify(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  const struct SourceContext *context = regex_context(scanner);
  if (context == NULL || !regex_tokens_are_valid(valid)) return false;
  enum DispatchResult result = regex_end_token(scanner, input, valid);
  if (result != DISPATCH_NEXT) return result == DISPATCH_ACCEPTED;
  if (regex_bash_part_starts(input)) return false;
  if (
    input->lexer.lookahead == '~' &&
    !context->regex_started &&
    valid[WORD_TILDE_START]
  )
    return accept_character(&input->lexer, WORD_TILDE_START);
  bool compound_fragment = false;
  result = regex_marker_token(input, valid);
  if (result == DISPATCH_NEXT)
    result =
      regex_bracket_open_token(scanner, input, valid, &compound_fragment);
  if (result == DISPATCH_NEXT)
    result = regex_hyphen_token(scanner, input, valid);
  if (result == DISPATCH_NEXT)
    result = regex_compound_element_token(scanner, input, valid);
  if (result == DISPATCH_NEXT)
    result = regex_group_token(scanner, input, valid);
  if (result == DISPATCH_NEXT) result = regex_name_or_count_token(input, valid);
  if (result == DISPATCH_NEXT)
    result = regex_atom_token(scanner, input, valid, compound_fragment);
  return result == DISPATCH_ACCEPTED;
}

/* A subscript shields operators only when it closes before the parameter's
   closing brace; `pending` is the lowest depth holding an unshielded one. */
static bool
parameter_names_follow(const struct Scanner *scanner, TSLexer *lexer) {
  bool prefix = false;
  size_t depth = 0;
  size_t pending = 0;
  lexer->advance(lexer, false);
  while (!lexer_at_eof(lexer) && !lookahead_is_pending(lexer)) {
    int32_t character = lexer->lookahead;
    if (character == '}' || character == SOURCE_BACKQUOTE_BOUNDARY)
      return false;
    if (is_one_of(character, "*@")) {
      size_t start = probe_position(lexer);
      lexer->advance(lexer, false);
      if (lexer->lookahead == '}') return prefix && pending == 0;
      probe_seek(lexer, start);
    }
    if (is_one_of(character, ":-+=?#%/^,@")) {
      if (depth == 0) return false;
      if (pending == 0 || depth < pending) pending = depth;
    } else if (character == '[') {
      depth += 1;
    } else if (character == ']' && depth > 0) {
      depth -= 1;
      if (pending > depth) pending = 0;
    }
    if (is_one_of(character, "'\"`$")) {
      if (!skip_bracket_member_expansion(scanner, lexer)) return false;
    } else {
      lexer->advance(lexer, false);
      if (character == '\\') {
        if (lexer_at_eof(lexer)) return false;
        int32_t escaped = lexer->lookahead;
        lexer->advance(lexer, false);
        if (is_one_of(escaped, "*@") && lexer->lookahead == '}')
          return pending == 0;
      }
    }
    prefix = true;
  }
  return false;
}

static bool lexical_parameter_names_text(struct LogicalLexer *input) {
  TSLexer *lexer = &input->lexer;
  bool consumed = false;
  while (
    !lexer_at_eof(lexer) &&
    lexer->lookahead != SOURCE_BACKQUOTE_BOUNDARY &&
    !is_one_of(lexer->lookahead, "}'\"`")
  ) {
    int32_t character = lexer->lookahead;
    if (character == '\\') {
      struct LogicalPosition position = logical_position(input);
      lexer->advance(lexer, false);
      if (!is_one_of(lexer->lookahead, "*@") || logical_peek(input) != '}') {
        logical_restore_position(input, &position);
        break;
      }
      lexer->mark_end(lexer);
      consumed = true;
      break;
    }
    int32_t next = logical_peek(input);
    if (
      (is_one_of(character, "*@") && next == '}') ||
      (character == '$' &&
        (is_parameter_start_character(next) || is_one_of(next, "([{'\"")))
    )
      break;
    lexer->advance(lexer, false);
    lexer->mark_end(lexer);
    consumed = true;
  }
  if (consumed) lexer->result_symbol = PARAMETER_NAMES_TEXT_BEGIN;
  return consumed;
}

static bool lexical_parameter_operator(
  const struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  TSLexer *lexer = &input->lexer;
  int32_t ch = lexer->lookahead;
  enum TokenType context = top_context_opener(scanner);
  if (ch == '!' && valid[PARAMETER_NAMES_INDIRECTION_BEGIN]) {
    struct LookaheadLexer probe;
    bool names = lookahead_begin(&probe, lexer) &&
      parameter_names_follow(scanner, &probe.lexer);
    lookahead_clear(&probe);
    logical_rewind(input);
    if (names)
      return accept_character(lexer, PARAMETER_NAMES_INDIRECTION_BEGIN);
  }
  if (
    ch == '!' &&
    valid[PARAMETER_INDIRECTION_BEGIN] &&
    (is_name_character(logical_peek(input)) ||
      is_one_of(logical_peek(input), "*@#!?$"))
  )
    return accept_character(lexer, PARAMETER_INDIRECTION_BEGIN);
  if (
    is_one_of(ch, "*@") &&
    context == PARAMETER_INDIRECTION_BEGIN &&
    logical_peek(input) == '}' &&
    valid[PARAMETER_NAMES_BEGIN]
  )
    return accept_character(lexer, PARAMETER_NAMES_BEGIN);
  if (valid[PARAMETER_NAMES_TEXT_BEGIN] && lexical_parameter_names_text(input))
    return true;
  if (
    ch == '/' &&
    context == PARAMETER_REPLACE_BEGIN &&
    valid[REPLACEMENT_SEPARATOR_BEGIN]
  )
    return accept_character(lexer, REPLACEMENT_SEPARATOR_BEGIN);
  if (
    ch == ':' &&
    valid[SUBSTRING_SEPARATOR_BEGIN] &&
    context == PARAMETER_SUBSTRING_BEGIN &&
    arithmetic_field_remaining(scanner) == 0
  )
    return accept_character(lexer, SUBSTRING_SEPARATOR_BEGIN);
  if (valid[PARAMETER_TRANSFORM_CODE_BEGIN] && is_one_of(ch, "UuLQEPAKka"))
    return accept_character(lexer, PARAMETER_TRANSFORM_CODE_BEGIN);
  return false;
}

static bool
lexical_brace_expansion(struct LogicalLexer *input, const bool *valid) {
  TSLexer *lexer = &input->lexer;
  if (valid[BRACE_SEQUENCE_START]) {
    lexer->mark_end(lexer);
    if (brace_sequence(lexer)) {
      lexer->result_symbol = BRACE_SEQUENCE_START;
      return true;
    }
    logical_rewind(input);
  }
  if (valid[BRACE_ENDPOINT_BEGIN] || valid[BRACE_INCREMENT_BEGIN]) {
    bool numeric;
    if (brace_endpoint(lexer, &numeric))
      return accept_token(
        lexer,
        valid[BRACE_ENDPOINT_BEGIN] ? BRACE_ENDPOINT_BEGIN
                                    : BRACE_INCREMENT_BEGIN
      );
    logical_rewind(input);
  }
  if (
    lexer->lookahead == '.' &&
    logical_peek(input) == '.' &&
    valid[BRACE_SEPARATOR_BEGIN]
  ) {
    lexer->advance(lexer, false);
    return accept_character(lexer, BRACE_SEPARATOR_BEGIN);
  }
  return false;
}

static bool lexical_bash_classify(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  TSLexer *lexer = &input->lexer;
  if (valid[DECLARATION_END] && process_substitution_follows(input))
    return accept_token(lexer, DECLARATION_END);
  if (valid[ARRAY_ASSIGNMENT_OPEN] && lexer->lookahead == '(')
    return accept_character(lexer, ARRAY_ASSIGNMENT_OPEN);
  if (valid[ARRAY_ASSIGNMENT_CLOSE] && lexer->lookahead == ')')
    return accept_character(lexer, ARRAY_ASSIGNMENT_CLOSE);
  if (lexical_regex_classify(scanner, input, valid)) return true;
  logical_rewind(input);
  if (valid[FOR_SEMICOLON] && lexer->lookahead == ';')
    return accept_character(lexer, FOR_SEMICOLON);
  if (valid[EXPLICIT_FNAME_BEGIN]) return false;
  if (bash_word_start(scanner, input, valid)) return true;
  if (lexical_parameter_operator(scanner, input, valid)) return true;
  int32_t ch = lexer->lookahead;
  if (ch == '{' && (valid[CURRENT_SHELL_OPEN] || valid[REPLY_OPEN])) {
    int32_t next = logical_peek(input);
    enum TokenType symbol = next == '|' ? REPLY_OPEN : CURRENT_SHELL_OPEN;
    if (braced_command_follows(next) && valid[symbol])
      return accept_character(lexer, symbol);
  }
  static const struct LexicalPunctuation punctuation[] = {
    {'{', BRACE_LITERAL_OPEN},
    {'(', EXTGLOB_OPEN},
    {')', EXTGLOB_CLOSE},
    {'|', EXTGLOB_BAR},
    {'}', SUBSTITUTION_BRACE_CLOSE},
    {'[', BRACKET_ARITHMETIC_OPEN},
    {'[', SUBSCRIPT_OPEN},
    {']', SUBSCRIPT_CLOSE},
    {'}', BRACE_CLOSE},
    {',', BRACE_COMMA},
  };
  for (size_t i = 0; i < ARRAY_COUNT(punctuation); i++) {
    if (ch == punctuation[i].character && valid[punctuation[i].symbol]) {
      enum TokenType symbol = punctuation[i].symbol;
      if (
        (symbol == BRACE_LITERAL_OPEN ||
          symbol == BRACE_CLOSE ||
          symbol == BRACE_COMMA) &&
        brace_suppressed(scanner, lexer)
      )
        continue;
      return accept_character(lexer, symbol);
    }
  }
  if (
    ch == ']' &&
    valid[BRACKET_ARITHMETIC_CLOSE] &&
    arithmetic_field_remaining(scanner) == 0
  )
    return accept_character(lexer, BRACKET_ARITHMETIC_CLOSE);
  if (lexical_brace_expansion(input, valid)) return true;
  return false;
}

static bool lexical_pattern_literal(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  enum TokenType symbol,
  const bool *valid
) {
  TSLexer *lexer = &input->lexer;
  bool parameter_boundary =
    symbol == PARAMETER_LITERAL_BEGIN || parameter_pattern_context(scanner);
  bool assignment = symbol == ASSIGNMENT_LITERAL_BEGIN;
  enum TokenType fallback_symbol = fallback_literal_for(symbol);
  bool tilde =
    symbol != EXTGLOB_TEXT_BEGIN && is_tilde_context(pattern_context(scanner));
  bool consumed = false;
  uint32_t chains = fallback_chains(scanner);
  struct BracketScan scan = literal_bracket_scan(scanner, symbol);
  bool enters_fallback = false;
  const struct SourceContext *raw = raw_word_context(scanner);
  bool element_start = raw != NULL && raw->raw_element_start;
  bool outer = raw != NULL && pattern_source_context(scanner) == raw;
  while (
    (extglob_context(scanner)
        ? !lexer_at_eof(lexer) && lexer->lookahead != SOURCE_BACKQUOTE_BOUNDARY
        : !pattern_boundary(scanner, lexer, parameter_boundary)) &&
    !pattern_structured_start(input)
  ) {
    int32_t character = lexer->lookahead;
    if (
      raw != NULL &&
      ((outer && (is_horizontal_blank(character) || character == '\n')) ||
        (element_start && character == '#'))
    )
      break;
    if (
      brace_boundary(scanner, lexer) ||
      (symbol == BRACE_TEXT_BEGIN &&
        character == '{' &&
        !brace_suppressed(scanner, lexer))
    )
      break;
    if (extglob_context(scanner) && is_one_of(character, "|()")) break;
    if (
      parameter_boundary &&
      character == '/' &&
      pattern_context(scanner) == PARAMETER_REPLACE_BEGIN
    )
      break;
    if (bash_word_boundary(scanner, input, valid)) break;
    if (
      character == '*' ||
      character == '?' ||
      (tilde && (character == '/' || (assignment && character == ':')))
    ) {
      break;
    }
    enum BracketInput kind = bracket_input(character);
    if (character == '[') {
      if (
        consumed && (symbol == EXTGLOB_TEXT_BEGIN || symbol == BRACE_TEXT_BEGIN)
      )
        break;
      uint32_t after = chains;
      bool complete;
      if (
        !lexical_pattern_probe(scanner, input, &scan, &after, &complete) ||
        complete
      ) {
        break;
      }
      enters_fallback = !in_bracket_fallback(scanner) && valid[fallback_symbol];
      kind = scan.opener;
    }
    element_start =
      character == '(' || is_horizontal_blank(character) || character == '\n';
    chains = bracket_chains_after_literal(chains, kind);
    lexer->advance(lexer, false);
    bool tilde_prefix = assignment &&
      assignment_tilde_follows(scanner, lexer, PATTERN_ASSIGNMENT, character);
    lexer->mark_end(lexer);
    consumed = true;
    if (tilde_prefix) {
      break;
    }
  }
  input->bracket_chains = chains;
  lexer->result_symbol = (TSSymbol)(enters_fallback ? fallback_symbol : symbol);
  return consumed;
}

static bool bracket_fallback_ends(
  const struct Scanner *scanner,
  TSLexer *lexer,
  enum TokenType context
) {
  enum TokenType parent = pattern_context(scanner);
  int32_t ch = lexer->lookahead;
  return brace_boundary(scanner, lexer) ||
    pattern_boundary(
      scanner,
      lexer,
      context == PARAMETER_FALLBACK_LITERAL_BEGIN ||
        parameter_pattern_context(scanner)
    ) ||
    (extglob_context(scanner) && is_one_of(ch, "|()")) ||
    (parent == PARAMETER_REPLACE_BEGIN && ch == '/') ||
    (context == ASSIGNMENT_FALLBACK_LITERAL_BEGIN &&
      ch == '~' &&
      scanner->assignment_tilde_allowed) ||
    (is_tilde_context(parent) &&
      (ch == '/' || (parent == ASSIGNMENT_TILDE_START && ch == ':')));
}

static enum DispatchResult lexical_bracket_fallback_end(
  const struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  enum TokenType context = top_context_opener(scanner);
  if (
    !is_bracket_fallback_context(context) ||
    !bracket_fallback_ends(scanner, lexer, context)
  )
    return DISPATCH_NEXT;
  static const enum TokenType ends[] = {
    WORD_BRACKET_FALLBACK_END,
    ASSIGNMENT_BRACKET_FALLBACK_END,
    PARAMETER_BRACKET_FALLBACK_END
  };
  enum TokenType end = first_valid_symbol(valid, ends, ARRAY_COUNT(ends));
  if (end == TOKEN_COUNT) return DISPATCH_REJECTED;
  return dispatch_outcome(accept_token(lexer, end));
}

static enum DispatchResult lexical_pattern_bracket_open(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  TSLexer *lexer = &input->lexer;
  if (
    lexer->lookahead != '[' ||
    (!valid[WORD_PATTERN_BRACKET_OPEN] &&
      !valid[PARAMETER_PATTERN_BRACKET_OPEN])
  )
    return DISPATCH_NEXT;
  enum TokenType literal = valid[PARAMETER_PATTERN_BRACKET_OPEN]
    ? PARAMETER_LITERAL_BEGIN
    : valid[ASSIGNMENT_LITERAL_BEGIN] ? ASSIGNMENT_LITERAL_BEGIN
                                      : LITERAL_BEGIN;
  uint32_t chains = fallback_chains(scanner);
  bool complete;
  struct BracketScan scan = literal_bracket_scan(scanner, literal);
  if (!lexical_pattern_probe(scanner, input, &scan, &chains, &complete))
    return DISPATCH_REJECTED;
  if (!complete) return DISPATCH_NEXT;
  return dispatch_outcome(accept_character(
    lexer,
    valid[PARAMETER_PATTERN_BRACKET_OPEN] ? PARAMETER_PATTERN_BRACKET_OPEN
                                          : WORD_PATTERN_BRACKET_OPEN
  ));
}

static enum DispatchResult lexical_pattern_bracket_member(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  TSLexer *lexer = &input->lexer;
  enum TokenType member = valid[PARAMETER_PATTERN_BRACKET_CHARACTER]
    ? PARAMETER_PATTERN_BRACKET_CHARACTER
    : valid[ASSIGNMENT_PATTERN_BRACKET_CHARACTER]
    ? ASSIGNMENT_PATTERN_BRACKET_CHARACTER
    : PATTERN_BRACKET_CHARACTER;
  if (!valid[member]) return DISPATCH_NEXT;
  int32_t character = lexer->lookahead;
  if (
    pattern_boundary(
      scanner,
      lexer,
      member == PARAMETER_PATTERN_BRACKET_CHARACTER
    ) ||
    pattern_structured_start(input) ||
    character == ']' ||
    character == '-' ||
    ((character == '!' || character == '^') && valid[PATTERN_NEGATION_BEGIN])
  )
    return DISPATCH_REJECTED;
  if (character == '[' && valid[PATTERN_SPECIAL_LEFT_BRACKET]) {
    struct LookaheadLexer probe = {0};
    bool element = lookahead_begin(&probe, lexer) &&
      pattern_element_here(scanner, &probe.lexer, valid);
    lookahead_clear(&probe);
    logical_rewind(input);
    if (element) return DISPATCH_REJECTED;
  }
  return dispatch_outcome(accept_character(lexer, member));
}

static bool lexical_pattern_classify(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  TSLexer *lexer = &input->lexer;
  if (lexer->lookahead == '#' && valid[SPECIAL_PARAMETER_HASH_BEGIN]) {
    return false;
  }
  enum DispatchResult result =
    lexical_bracket_fallback_end(scanner, lexer, valid);
  if (result != DISPATCH_NEXT) return result == DISPATCH_ACCEPTED;
  static const enum TokenType contents[] = {
    PARAMETER_PATTERN_CLASS_CONTENT_BEGIN,
    PATTERN_CLASS_CONTENT_BEGIN,
    PARAMETER_PATTERN_COLLATING_CHARACTER_BEGIN,
    PATTERN_COLLATING_CHARACTER_BEGIN,
    PARAMETER_PATTERN_EQUIVALENCE_CHARACTER_BEGIN,
    PATTERN_EQUIVALENCE_CHARACTER_BEGIN,
  };
  for (size_t index = 0; index < ARRAY_COUNT(contents); index += 1) {
    if (
      valid[contents[index]] &&
      lexical_pattern_content(scanner, input, contents[index], valid)
    ) {
      return true;
    }
  }
  result = lexical_pattern_bracket_open(scanner, input, valid);
  if (result == DISPATCH_NEXT)
    result = lexical_pattern_bracket_member(scanner, input, valid);
  if (result != DISPATCH_NEXT) return result == DISPATCH_ACCEPTED;
  if (
    lexer->lookahead == '~' &&
    (valid[WORD_TILDE_START] ||
      valid[ASSIGNMENT_TILDE_START] ||
      valid[PARAMETER_TILDE_START])
  ) {
    return false;
  }
  static const enum TokenType literals[] = {
    EXTGLOB_TEXT_BEGIN,
    BRACE_TEXT_BEGIN,
    ASSIGNMENT_LITERAL_BEGIN,
    PARAMETER_LITERAL_BEGIN,
    LITERAL_BEGIN,
  };
  for (size_t index = 0; index < ARRAY_COUNT(literals); index += 1) {
    if (
      valid[literals[index]] &&
      lexical_pattern_literal(scanner, input, literals[index], valid)
    ) {
      return true;
    }
  }
  return false;
}

static bool begin_bracket_word(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  enum TokenType symbol
) {
  struct LogicalPosition position = logical_position(input);
  struct LookaheadLexer probe = {0};
  size_t remaining = 0;
  bool complete = true;
  bool array = symbol == ARRAY_WORD_START;
  if (
    array ? input->lexer.lookahead == '['
          : is_name_start_character(input->lexer.lookahead)
  ) {
    complete = lookahead_begin(&probe, &input->lexer);
    if (complete) {
      TSLexer *lexer = &probe.lexer;
      if (!array) {
        advance_name(lexer);
      }
      if (lexer->lookahead == '[') {
        lexer->advance(lexer, false);
        complete =
          skip_subscript_source(scanner, lexer) == ARITHMETIC_VALIDATION_VALID;
        if (complete) remaining = probe.characters[probe.position].raw_cut;
      }
      complete = complete && !lookahead_is_pending(lexer);
    }
  }
  lookahead_clear(&probe);
  logical_restore_position(input, &position);
  if (!complete) return false;
  if (remaining > 0) {
    if (!source_context_push(
          scanner,
          array ? ARRAY_WORD_START : COMMAND_WORD_START
        ))
      return false;
    top_context(scanner)->word_remaining = remaining;
  }
  return accept_token(&input->lexer, symbol);
}

static bool braced_command_context(const struct Scanner *scanner) {
  for (size_t count = scanner->context_count; count > 0; count--) {
    switch (scanner->contexts[count - 1].opener) {
      case CURRENT_SHELL_OPEN:
      case REPLY_OPEN:
        return true;
      case BACKQUOTE_START:
      case DOUBLE_QUOTED_BACKQUOTE_START:
        return false;
      default:
        break;
    }
  }
  return false;
}

static bool
scan_plain_word(struct Scanner *scanner, struct LogicalLexer *input) {
  if (
    is_one_of(input->lexer.lookahead, "~{") ||
    is_bracket_word_context(top_context_opener(scanner))
  )
    return false;
  if (!source_context_push(scanner, BRACE_WORD_START)) return false;
  bool valid[TOKEN_COUNT] = {
    [LITERAL_BEGIN] = true,
    [WORD_FALLBACK_LITERAL_BEGIN] = true,
    [EXTGLOB_OPERATOR_BEGIN] = true,
    [BRACE_OPEN] = true
  };
  bool accepted =
    lexical_pattern_literal(scanner, input, LITERAL_BEGIN, valid) &&
    input->lexer.result_symbol == LITERAL_BEGIN &&
    pattern_boundary(scanner, &input->lexer, false) &&
    !process_substitution_follows(input);
  if (!source_context_pop(scanner)) return false;
  if (accepted) input->lexer.result_symbol = PLAIN_WORD_BEGIN;
  else logical_rewind(input);
  return accepted;
}

static enum DispatchResult classify_retreat(struct LogicalLexer *input) {
  logical_rewind(input);
  return DISPATCH_NEXT;
}

static enum DispatchResult classify_braced_command_close(
  const struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  if (
    input->lexer.lookahead != '}' ||
    !valid[COMMAND_WORD_START] ||
    !valid[LEFT_BRACE] ||
    !braced_command_context(scanner)
  )
    return DISPATCH_NEXT;
  if (valid[SUBSTITUTION_BRACE_CLOSE])
    return dispatch_outcome(
      accept_character(&input->lexer, SUBSTITUTION_BRACE_CLOSE)
    );
  if (valid[RIGHT_BRACE])
    return dispatch_outcome(accept_character(&input->lexer, RIGHT_BRACE));
  return DISPATCH_REJECTED;
}

static enum DispatchResult classify_conditional_word_end(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  if (!valid[CONDITIONAL_WORD_END] || !reserved_word_delimiter(&input->lexer))
    return DISPATCH_NEXT;
  input->lexer.mark_end(&input->lexer);
  input->lexer.result_symbol = CONDITIONAL_WORD_END;
  return dispatch_outcome(source_context_pop(scanner));
}

static enum DispatchResult
classify_conditional_close(struct LogicalLexer *input, const bool *valid) {
  if (
    (!valid[CONDITIONAL_WORD_START] &&
      !valid[CONDITIONAL_PATTERN_START] &&
      !valid[REGEX_START]) ||
    input->lexer.lookahead != ']'
  )
    return DISPATCH_NEXT;
  input->lexer.advance(&input->lexer, false);
  if (input->lexer.lookahead == ']') {
    input->lexer.advance(&input->lexer, false);
    if (
      reserved_word_delimiter(&input->lexer) &&
      (!valid[REGEX_START] || regex_boundary(&input->lexer, 0))
    )
      return DISPATCH_REJECTED;
  }
  return classify_retreat(input);
}

static enum DispatchResult classify_brace_word_start(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  if (!valid[BRACE_WORD_START]) return DISPATCH_NEXT;
  input->lexer.mark_end(&input->lexer);
  input->lexer.result_symbol = BRACE_WORD_START;
  if (
    scanner->context_count > 0 &&
    (is_bracket_word_context(top_context_opener(scanner)) ||
      top_context_opener(scanner) == ASSIGNMENT_ARGUMENT_START)
  ) {
    top_context(scanner)->opener = BRACE_WORD_START;
    return DISPATCH_ACCEPTED;
  }
  return dispatch_outcome(source_context_push(scanner, BRACE_WORD_START));
}

static enum DispatchResult classify_here_document_end_line_end(
  struct LogicalLexer *input,
  const bool *valid
) {
  if (!valid[HERE_DOCUMENT_END_LINE_END] || input->lexer.lookahead != '\n')
    return DISPATCH_NEXT;
  return dispatch_outcome(
    accept_character(&input->lexer, HERE_DOCUMENT_END_LINE_END)
  );
}

static enum DispatchResult classify_tilde_end(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  if (scanner->context_count == 0) return DISPATCH_NEXT;
  enum TokenType context = top_context_opener(scanner);
  int32_t character = input->lexer.lookahead;
  enum TokenType end =
    context == ASSIGNMENT_TILDE_START ? ASSIGNMENT_TILDE_END : WORD_TILDE_END;
  if (
    !is_tilde_context(context) ||
    !valid[end] ||
    !(
      character == '/' ||
      (context == ASSIGNMENT_TILDE_START && character == ':') ||
      pattern_boundary(scanner, &input->lexer, context == PARAMETER_TILDE_START)
    )
  )
    return DISPATCH_NEXT;
  input->lexer.mark_end(&input->lexer);
  input->lexer.result_symbol = (TSSymbol)end;
  return dispatch_outcome(source_context_pop(scanner));
}

static enum DispatchResult
classify_time_option(struct LogicalLexer *input, const bool *valid) {
  if (
    (!valid[TIME_OPTION_BEGIN] && !valid[TIME_END_BEGIN]) ||
    input->lexer.lookahead != '-'
  )
    return DISPATCH_NEXT;
  enum TimeOption option = read_time_option(&input->lexer);
  enum TokenType symbol =
    option == TIME_OPTION_POSIX ? TIME_OPTION_BEGIN : TIME_END_BEGIN;
  if (option == TIME_OPTION_NONE || !valid[symbol]) {
    return classify_retreat(input);
  }
  if (option == TIME_OPTION_POSIX) {
    /* Edits to a following `--` must invalidate this option token. */
    struct LogicalPosition position = logical_position(input);
    if (
      scan_horizontal_blanks(&input->lexer) && input->lexer.lookahead == '-'
    ) {
      input->lexer.advance(&input->lexer, false);
      if (input->lexer.lookahead == '-') {
        input->lexer.advance(&input->lexer, false);
        reserved_word_delimiter(&input->lexer);
      }
    }
    logical_restore_position(input, &position);
  }
  return dispatch_outcome(accept_token(&input->lexer, symbol));
}

static enum DispatchResult classify_redirect_descriptor(
  const struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  if (
    (!valid[FILE_DESCRIPTOR] &&
      !valid[IO_VARIABLE_OPEN] &&
      !valid[WORD_START] &&
      !valid[COMMAND_WORD_START]) ||
    (input->lexer.lookahead != '{' && !is_decimal_digit(input->lexer.lookahead))
  )
    return DISPATCH_NEXT;
  struct LookaheadLexer probe = {0};
  enum TokenType symbol = TOKEN_COUNT;
  bool complete = lookahead_begin(&probe, &input->lexer);
  if (complete) {
    symbol = scan_redirect_descriptor(scanner, &probe.lexer);
    complete = !lookahead_is_pending(&probe.lexer);
  }
  lookahead_clear(&probe);
  logical_rewind(input);
  if (!complete) return DISPATCH_REJECTED;
  if (symbol == TOKEN_COUNT) return DISPATCH_NEXT;
  if (!valid[symbol]) return DISPATCH_REJECTED;
  do {
    input->lexer.advance(&input->lexer, false);
  } while (
    symbol == FILE_DESCRIPTOR && is_decimal_digit(input->lexer.lookahead)
  );
  return dispatch_outcome(accept_token(&input->lexer, symbol));
}

static enum DispatchResult classify_control(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  struct Scanner control;
  if (!scanner_copy(scanner, &control)) return DISPATCH_REJECTED;
  bool recognized = scan_with_lookahead(&control, &input->lexer, valid);
  if (!recognized) {
    clear_scanner(&control);
    return classify_retreat(input);
  }
  if (
    input->lexer.result_symbol >= TOKEN_COUNT ||
    !valid[input->lexer.result_symbol]
  ) {
    clear_scanner(&control);
    return DISPATCH_REJECTED;
  }
  clear_scanner(scanner);
  *scanner = control;
  if (input->lexer.result_symbol == COPROC_NAME_START) {
    logical_rewind(input);
    return dispatch_outcome(
      begin_bracket_word(scanner, input, COPROC_NAME_START)
    );
  }
  return DISPATCH_ACCEPTED;
}

static enum DispatchResult classify_regex_start(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  if (
    !valid[REGEX_START] ||
    lexer_at_eof(&input->lexer) ||
    is_horizontal_blank(input->lexer.lookahead) ||
    input->lexer.lookahead == '\n' ||
    input->lexer.lookahead == '#'
  )
    return DISPATCH_NEXT;
  input->lexer.mark_end(&input->lexer);
  input->lexer.result_symbol = REGEX_START;
  return dispatch_outcome(source_context_push(scanner, REGEX_START));
}

static const struct LexicalOperator CONDITIONAL_OPERATORS[] = {
  {"[[", CONDITIONAL_OPEN_BEGIN},
  {"]]", CONDITIONAL_CLOSE_BEGIN},
  {"!", CONDITIONAL_NOT_BEGIN},
  {"=", CONDITIONAL_MATCH_BEGIN},
  {"==", CONDITIONAL_MATCH_BEGIN},
  {"!=", CONDITIONAL_MATCH_BEGIN},
  {"=~", CONDITIONAL_REGEX_BEGIN},
  {"<", CONDITIONAL_BINARY_BEGIN},
  {">", CONDITIONAL_BINARY_BEGIN},
  {"-eq", CONDITIONAL_BINARY_BEGIN},
  {"-ne", CONDITIONAL_BINARY_BEGIN},
  {"-lt", CONDITIONAL_BINARY_BEGIN},
  {"-le", CONDITIONAL_BINARY_BEGIN},
  {"-gt", CONDITIONAL_BINARY_BEGIN},
  {"-ge", CONDITIONAL_BINARY_BEGIN},
  {"-nt", CONDITIONAL_BINARY_BEGIN},
  {"-ot", CONDITIONAL_BINARY_BEGIN},
  {"-ef", CONDITIONAL_BINARY_BEGIN},
};

static enum DispatchResult classify_conditional_operator(
  const struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  for (size_t index = 0; index < ARRAY_COUNT(CONDITIONAL_OPERATORS); index++) {
    const struct LexicalOperator *entry = &CONDITIONAL_OPERATORS[index];
    bool reserved_closer =
      entry->symbol == CONDITIONAL_CLOSE_BEGIN && valid[FNAME_TOKEN];
    if (!valid[entry->symbol] && !reserved_closer) continue;
    size_t i = 0;
    while (
      entry->spelling[i] != '\0' && input->lexer.lookahead == entry->spelling[i]
    ) {
      input->lexer.advance(&input->lexer, false);
      i++;
    }
    bool punctuation = entry->spelling[0] == '<' || entry->spelling[0] == '>';
    if (
      entry->spelling[i] == '\0' &&
      (punctuation || reserved_word_delimiter(&input->lexer)) &&
      !(entry->symbol == CONDITIONAL_NOT_BEGIN &&
        extglob_enabled(scanner) &&
        input->lexer.lookahead == '(')
    ) {
      return dispatch_outcome(accept_token(&input->lexer, entry->symbol));
    }
    logical_rewind(input);
  }
  return DISPATCH_NEXT;
}

static enum DispatchResult
classify_conditional_unary(struct LogicalLexer *input, const bool *valid) {
  if (!valid[CONDITIONAL_UNARY_BEGIN] || input->lexer.lookahead != '-')
    return DISPATCH_NEXT;
  input->lexer.advance(&input->lexer, false);
  if (is_one_of(input->lexer.lookahead, "abcdefghkLnoprstuvwxGONRSzo")) {
    input->lexer.advance(&input->lexer, false);
    if (reserved_word_delimiter(&input->lexer)) {
      return dispatch_outcome(
        accept_token(&input->lexer, CONDITIONAL_UNARY_BEGIN)
      );
    }
  }
  return classify_retreat(input);
}

static enum DispatchResult classify_conditional_word_start(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  if (
    (!valid[CONDITIONAL_WORD_START] && !valid[CONDITIONAL_PATTERN_START]) ||
    !is_word_element_start(&input->lexer) ||
    reserved_word_delimiter(&input->lexer)
  )
    return DISPATCH_NEXT;
  input->lexer.mark_end(&input->lexer);
  enum TokenType symbol = valid[CONDITIONAL_PATTERN_START]
    ? CONDITIONAL_PATTERN_START
    : CONDITIONAL_WORD_START;
  input->lexer.result_symbol = symbol;
  return dispatch_outcome(source_context_push(scanner, symbol));
}

static bool declaration_builtin(const char *name) {
  static const char *const names[] = {
    "alias",
    "declare",
    "typeset",
    "local",
    "export",
    "readonly",
  };
  for (size_t index = 0; index < ARRAY_COUNT(names); index += 1) {
    if (strcmp(name, names[index]) == 0) return true;
  }
  return false;
}

static enum DispatchResult
classify_declaration_name(struct LogicalLexer *input, const bool *valid) {
  if (!valid[DECLARATION_NAME_BEGIN]) return DISPATCH_NEXT;
  char name[RESERVED_WORD_LENGTH + 1];
  if (
    read_reserved_word(&input->lexer, name, NULL) && declaration_builtin(name)
  )
    return dispatch_outcome(
      accept_token(&input->lexer, DECLARATION_NAME_BEGIN)
    );
  return classify_retreat(input);
}

static size_t raw_argument_range(
  const struct Scanner *scanner,
  struct LogicalLexer *input,
  bool lead
) {
  if (!is_name_start_character(input->lexer.lookahead)) return 0;
  struct LogicalPosition saved = logical_position(input);
  struct LookaheadLexer probe = {0};
  size_t remaining = 0;
  if (lookahead_begin(&probe, &input->lexer)) {
    TSLexer *lexer = &probe.lexer;
    advance_name(lexer);
    bool head = true;
    if (lexer->lookahead == '[') head = skip_subscript(scanner, lexer, !lead);
    if (lexer->lookahead == '+') lexer->advance(lexer, false);
    if (head && lexer->lookahead == '=') {
      lexer->advance(lexer, false);
      if (lead) remaining = probe.characters[probe.position].raw_cut;
      if (lexer->lookahead == '(') {
        lexer->advance(lexer, false);
        bool start = true;
        while (
          !lexer_at_eof(lexer) && lexer->lookahead != SOURCE_BACKQUOTE_BOUNDARY
        ) {
          int32_t ch = lexer->lookahead;
          if (ch == ')') {
            lexer->advance(lexer, false);
            remaining = probe.characters[probe.position].raw_cut;
            break;
          }
          if (start && ch == '#') {
            if (!advance_to_comment_end(lexer, NULL)) break;
            continue;
          }
          if (start && ch == '[') {
            size_t position = probe.position;
            if (
              skip_subscript_body(scanner, lexer) && lexer->lookahead == '='
            ) {
              lexer->advance(lexer, false);
              start = false;
              continue;
            }
            lookahead_seek(&probe, position);
          }
          enum ArithmeticValidation substitution =
            skip_process_substitution(scanner, lexer, false);
          if (substitution == ARITHMETIC_VALIDATION_VALID) {
            start = false;
            continue;
          }
          if (extglob_enabled(scanner) && is_extglob_operator(ch)) {
            size_t position = probe.position;
            if (
              skip_extglob_pattern(scanner, lexer, false) ==
              ARITHMETIC_VALIDATION_VALID
            ) {
              start = false;
              continue;
            }
            lookahead_seek(&probe, position);
          }
          enum BracketAtom atom = skip_bracket_quoted_atom(scanner, lexer);
          if (atom == BRACKET_ATOM_END) break;
          if (atom == BRACKET_ATOM_MEMBER) {
            start = false;
            continue;
          }
          if (is_one_of(ch, "(;|&<>")) break;
          start = is_horizontal_blank(ch) || ch == '\n';
          lexer->advance(lexer, false);
        }
      }
    }
    if (lookahead_is_pending(lexer)) remaining = 0;
  }
  lookahead_clear(&probe);
  logical_restore_position(input, &saved);
  return remaining;
}

static enum DispatchResult classify_raw_argument(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  if (valid[RAW_COMMAND_NAME_BEGIN]) {
    char name[RESERVED_WORD_LENGTH + 1];
    if (
      read_reserved_word(&input->lexer, name, NULL) &&
      (strcmp(name, "eval") == 0 || strcmp(name, "let") == 0)
    )
      return dispatch_outcome(
        accept_token(&input->lexer, RAW_COMMAND_NAME_BEGIN)
      );
    logical_rewind(input);
  }
  bool lead = !valid[RAW_ARGUMENT_START] && valid[COPROC_RAW_ARGUMENT_START];
  if (
    (!valid[RAW_ARGUMENT_START] && !lead) ||
    is_horizontal_blank(input->lexer.lookahead) ||
    process_substitution_follows(input)
  )
    return DISPATCH_NEXT;
  size_t remaining = raw_argument_range(scanner, input, lead);
  if (lead && remaining == 0) return DISPATCH_NEXT;
  if (remaining > 0) {
    if (!source_context_push(scanner, COMMAND_WORD_START))
      return DISPATCH_REJECTED;
    top_context(scanner)->word_remaining = remaining;
    top_context(scanner)->raw_argument = true;
  }
  return dispatch_outcome(accept_token(
    &input->lexer,
    lead ? COPROC_RAW_ARGUMENT_START : RAW_ARGUMENT_START
  ));
}

static size_t assignment_argument_head_range(
  const struct Scanner *scanner,
  struct LogicalLexer *input
) {
  if (!is_name_start_character(input->lexer.lookahead)) return 0;
  struct LogicalPosition position = logical_position(input);
  advance_name(&input->lexer);
  size_t remaining = 0;
  if (input->lexer.lookahead == '[') {
    struct LookaheadLexer probe = {0};
    if (lookahead_begin(&probe, &input->lexer)) {
      TSLexer *lexer = &probe.lexer;
      bool head =
        skip_subscript(scanner, lexer, raw_word_context(scanner) == NULL);
      if (lexer->lookahead == '+') lexer->advance(lexer, false);
      if (head && lexer->lookahead == '=') {
        lexer->advance(lexer, false);
        remaining = probe.characters[probe.position].raw_cut;
      }
      if (lookahead_is_pending(lexer)) remaining = 0;
    }
    lookahead_clear(&probe);
  } else {
    if (input->lexer.lookahead == '+')
      input->lexer.advance(&input->lexer, false);
    if (input->lexer.lookahead == '=') {
      input->lexer.advance(&input->lexer, false);
      remaining = input->consumed;
    }
  }
  logical_restore_position(input, &position);
  return remaining;
}

static enum DispatchResult classify_assignment_argument_start(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  if (!valid[ASSIGNMENT_ARGUMENT_START]) return DISPATCH_NEXT;
  size_t remaining = assignment_argument_head_range(scanner, input);
  if (remaining == 0) return DISPATCH_NEXT;
  if (is_bracket_word_context(top_context_opener(scanner))) {
    top_context(scanner)->opener = ASSIGNMENT_ARGUMENT_START;
  } else if (!source_context_push(scanner, ASSIGNMENT_ARGUMENT_START))
    return DISPATCH_REJECTED;
  top_context(scanner)->assignment_head_remaining = remaining;
  scanner->assignment_tilde_allowed = false;
  return dispatch_outcome(
    accept_token(&input->lexer, ASSIGNMENT_ARGUMENT_START)
  );
}

static enum DispatchResult classify_word_start(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  if (
    (!valid[PLAIN_WORD_BEGIN] &&
      !valid[WORD_START] &&
      !valid[COMMAND_WORD_START] &&
      !valid[ARRAY_WORD_START]) ||
    !is_word_element_start(&input->lexer) ||
    (is_token_delimiter(&input->lexer) && !process_substitution_follows(input))
  )
    return DISPATCH_NEXT;
  if (valid[PLAIN_WORD_BEGIN] && scan_plain_word(scanner, input))
    return DISPATCH_ACCEPTED;
  if (valid[COMMAND_WORD_START] || valid[ARRAY_WORD_START])
    return dispatch_outcome(begin_bracket_word(
      scanner,
      input,
      valid[ARRAY_WORD_START] ? ARRAY_WORD_START : COMMAND_WORD_START
    ));
  return dispatch_outcome(accept_token(&input->lexer, WORD_START));
}

static enum DispatchResult classify_newline(
  const struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  if (input->lexer.lookahead != '\n') return DISPATCH_NEXT;
  enum TokenType symbol = valid[HERE_DOCUMENT_LINE_END] &&
      newline_starts_pending_document(scanner, &input->lexer)
    ? HERE_DOCUMENT_LINE_END
    : valid[COMMENT_LINE_END] ? COMMENT_LINE_END
    : valid[NEWLINE]          ? NEWLINE
                              : TOKEN_COUNT;
  if (symbol == TOKEN_COUNT) return DISPATCH_NEXT;
  return dispatch_outcome(accept_character(&input->lexer, symbol));
}

static enum DispatchResult
classify_comment(struct LogicalLexer *input, const bool *valid) {
  if (!valid[COMMENT_START] || input->lexer.lookahead != '#')
    return DISPATCH_NEXT;
  if (!advance_to_comment_end(&input->lexer, NULL)) return DISPATCH_REJECTED;
  return dispatch_outcome(accept_token(&input->lexer, COMMENT_START));
}

static enum DispatchResult classify_lexical(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  bool lexical_valid[TOKEN_COUNT];
  memcpy(lexical_valid, valid, sizeof(lexical_valid));
  lexical_valid[ASSIGNMENT_TILDE_START] = valid[ASSIGNMENT_TILDE_START] &&
    scanner->assignment_tilde_allowed &&
    assignment_value_position(scanner, &input->lexer);
  if (lexical_pattern_classify(scanner, input, lexical_valid))
    return DISPATCH_ACCEPTED;
  logical_rewind(input);
  if (lexical_classify(scanner, input, lexical_valid)) return DISPATCH_ACCEPTED;
  return classify_retreat(input);
}

static enum DispatchResult classify_word_end(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  enum TokenType opener = top_context_opener(scanner);
  enum TokenType end = opener == ASSIGNMENT_ARGUMENT_START
    ? ASSIGNMENT_ARGUMENT_END
    : BRACE_WORD_END;
  if (
    !valid[end] ||
    (opener != ASSIGNMENT_ARGUMENT_START && opener != BRACE_WORD_START)
  )
    return DISPATCH_NEXT;
  input->lexer.mark_end(&input->lexer);
  input->lexer.result_symbol = end;
  return dispatch_outcome(source_context_pop(scanner));
}

static bool classify_logical_source(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  const struct SourceContext *raw = raw_word_context(scanner);
  bool outer = raw != NULL && pattern_source_context(scanner) == raw;
  if (
    valid[RAW_LAYOUT_START] &&
    raw != NULL &&
    ((outer &&
       (is_horizontal_blank(input->lexer.lookahead) ||
         input->lexer.lookahead == '\n')) ||
      (raw->raw_element_start && input->lexer.lookahead == '#'))
  )
    return accept_token(&input->lexer, RAW_LAYOUT_START);
  enum DispatchResult result =
    classify_braced_command_close(scanner, input, valid);
  if (result == DISPATCH_NEXT)
    result = classify_conditional_word_end(scanner, input, valid);
  if (result == DISPATCH_NEXT)
    result = classify_conditional_close(input, valid);
  if (result == DISPATCH_NEXT)
    result = classify_brace_word_start(scanner, input, valid);
  if (result == DISPATCH_NEXT)
    result = classify_here_document_end_line_end(input, valid);
  if (result == DISPATCH_NEXT)
    result = classify_tilde_end(scanner, input, valid);
  if (result == DISPATCH_NEXT) result = classify_time_option(input, valid);
  if (result == DISPATCH_NEXT)
    result = classify_redirect_descriptor(scanner, input, valid);
  if (result == DISPATCH_NEXT) {
    if (lexical_bash_classify(scanner, input, valid)) return true;
    logical_rewind(input);
    result = classify_control(scanner, input, valid);
  }
  if (result == DISPATCH_NEXT)
    result = classify_regex_start(scanner, input, valid);
  if (result == DISPATCH_NEXT)
    result = classify_conditional_operator(scanner, input, valid);
  if (result == DISPATCH_NEXT)
    result = classify_conditional_unary(input, valid);
  if (result == DISPATCH_NEXT)
    result = classify_conditional_word_start(scanner, input, valid);
  if (result == DISPATCH_NEXT) result = classify_declaration_name(input, valid);
  if (result == DISPATCH_NEXT)
    result = classify_raw_argument(scanner, input, valid);
  if (result == DISPATCH_NEXT)
    result = classify_assignment_argument_start(scanner, input, valid);
  if (result == DISPATCH_NEXT)
    result = classify_word_start(scanner, input, valid);
  if (result == DISPATCH_NEXT) result = classify_newline(scanner, input, valid);
  if (result == DISPATCH_NEXT) result = classify_comment(input, valid);
  if (result == DISPATCH_NEXT) result = classify_lexical(scanner, input, valid);
  if (result == DISPATCH_NEXT)
    result = classify_word_end(scanner, input, valid);
  return result == DISPATCH_ACCEPTED;
}

static bool recovery_quote_context(const struct Scanner *scanner) {
  for (size_t index = scanner->context_count; index > 0; index -= 1) {
    enum TokenType opener = scanner->contexts[index - 1].opener;
    if (opener == PARAMETER_OPEN || opener == PARAMETER_INDIRECTION_BEGIN) {
      continue;
    }
    return opener == DQ_OPEN ||
      opener == HERE_DOCUMENT_BODY_START ||
      (index == scanner->context_count && opener == SQ_OPEN);
  }
  return false;
}

static const struct SourceContext *
recovery_body_context(const struct Scanner *scanner) {
  size_t frame = 0;
  for (size_t index = 0; index < scanner->context_count; index++) {
    const struct SourceContext *context = &scanner->contexts[index];
    if (
      is_here_document_context(context->opener) &&
      frame++ == scanner->suspended_frame_count
    )
      return context;
  }
  return NULL;
}

static void
select_body_recovery_symbols(bool *valid, const struct HereDocument *doc) {
  memset(valid, 0, TOKEN_COUNT * sizeof(*valid));
  valid[HERE_DOCUMENT_END_BEGIN] = true;
  valid[QUOTED_HERE_DOCUMENT_END_BEGIN] = true;
  valid[HERE_DOCUMENT_END_COMMIT] = true;
  valid[HERE_DOCUMENT_CONTENT_LINE_START] = !doc->ending;
  valid[HERE_DOCUMENT_END_LINE_END] = doc->ending;
  valid[HERE_DOCUMENT_END_TEXT_BEGIN] = doc->ending && !doc->quoted;
  valid[QUOTED_HERE_DOCUMENT_END_TEXT] = doc->ending && doc->quoted;
  valid[HERE_DOCUMENT_TEXT_BEGIN] = !doc->ending && !doc->quoted;
  valid[QUOTED_HERE_DOCUMENT_TEXT] = !doc->ending && doc->quoted;
  valid[HERE_DOCUMENT_ESCAPE_BEGIN] = !doc->ending && !doc->quoted;
  valid[DOLLAR_EXPANSION_START] = !doc->ending && !doc->quoted;
  valid[BACKQUOTE_START] = !doc->ending && !doc->quoted;
  valid[NEWLINE] = !doc->ending;
  valid[SOURCE_BEGIN] = true;
}

static void
select_quoted_recovery_symbols(const struct Scanner *scanner, bool *valid) {
  for (size_t index = 0; index < TOKEN_COUNT; index += 1) {
    if (LEXICAL_SOURCES[index].kind != LEXICAL_SOURCE_NONE) {
      valid[index] = false;
    }
  }
  enum TokenType opener = top_context_opener(scanner);
  if (opener == SQ_OPEN) {
    valid[WORD_START] = false;
    valid[SQ_CLOSE] = true;
    valid[SINGLE_QUOTE_CONTENT_BEGIN] = true;
    return;
  }
  valid[DOLLAR_EXPANSION_START] = true;
  if (opener == DQ_OPEN) {
    valid[DOUBLE_QUOTED_BACKQUOTE_START] = true;
    valid[DQ_CLOSE] = true;
    valid[DOUBLE_QUOTE_TEXT_BEGIN] = true;
    valid[DOUBLE_QUOTE_ESCAPE_BEGIN] = true;
    return;
  }
  valid[WORD_START] = false;
  valid[SQ_OPEN] = true;
  valid[BACKQUOTE_START] = true;
  valid[PARAMETER_CLOSE] = true;
  valid[VARIABLE_NAME_BEGIN] = true;
  valid[SPECIAL_PARAMETER_BEGIN] = true;
  valid[SPECIAL_PARAMETER_HASH_BEGIN] = true;
  valid[PARAMETER_VALUE_OPERATOR_BEGIN] = true;
  valid[PARAMETER_PATTERN_OPERATOR_BEGIN] = true;
  valid[DOUBLE_QUOTED_PARAMETER_TEXT_BEGIN] = true;
  valid[DOUBLE_QUOTED_PARAMETER_ESCAPE_BEGIN] = true;
  valid[DQ_OPEN] = true;
}

static void
select_recovery_symbols(const struct Scanner *scanner, bool *valid) {
  static const bool base_symbols[TOKEN_COUNT] = {
    [LEFT_BRACE] = true,
    [PIPELINE_NEGATION] = true,
    [IF_KEYWORD] = true,
    [FOR_KEYWORD] = true,
    [IN_KEYWORD] = true,
    [CASE_KEYWORD] = true,
    [WHILE_KEYWORD] = true,
    [UNTIL_KEYWORD] = true,
    [RIGHT_BRACE] = true,
    [THEN_KEYWORD] = true,
    [ELIF_KEYWORD] = true,
    [ELSE_KEYWORD] = true,
    [FI_KEYWORD] = true,
    [DO_KEYWORD] = true,
    [DONE_KEYWORD] = true,
    [ESAC_KEYWORD] = true,
    [TIME_KEYWORD] = true,
    [EMPTY_TIME_KEYWORD] = true,
    [COPROC_KEYWORD] = true,
    [CONDITIONAL_CLOSE_BEGIN] = true,
    [BACKQUOTE_END] = true,
    [PUNCT_LEFT_PARENTHESIS] = true,
    [ARITHMETIC_COMMAND_OPEN] = true,
    [PUNCT_RIGHT_PARENTHESIS] = true,
    [PUNCT_SEMICOLON] = true,
    [PUNCT_AMPERSAND] = true,
    [PUNCT_PIPE] = true,
    [OR_IF_BEGIN] = true,
    [AND_IF_BEGIN] = true,
    [DSEMI_BEGIN] = true,
    [SEMI_AND_BEGIN] = true,
    [LOGICAL_NEWLINE_BEGIN] = true,
    [LOGICAL_BLANK_BEGIN] = true,
#define LEXICAL_RECOVERY_SYMBOL(begin, piece) [piece] = true,
    BASH_LEXICAL_SOURCE_TOKENS(LEXICAL_RECOVERY_SYMBOL)
#undef LEXICAL_RECOVERY_SYMBOL
#define PHYSICAL_RECOVERY_SYMBOL(begin, prefix, character) \
  [prefix] = true, [character] = true,
      BASH_PHYSICAL_SOURCE_TOKENS(PHYSICAL_RECOVERY_SYMBOL)
#undef PHYSICAL_RECOVERY_SYMBOL
#define WHOLE_RECOVERY_SYMBOL(begin, whole) [whole] = true,
        BASH_WHOLE_SOURCE_TOKENS(WHOLE_RECOVERY_SYMBOL)
#undef WHOLE_RECOVERY_SYMBOL
          [LINE_CONTINUATION] = true,
    [REMOVED_NEWLINE] = true,
    [SOURCE_BEGIN] = true,
    [REMOVED_SOURCE] = true,
    [HERE_DOCUMENT_END_BEGIN] = true,
    [QUOTED_HERE_DOCUMENT_END_BEGIN] = true,
    [WORD_START] = true,
    [LITERAL_BEGIN] = true,
    [WORD_FALLBACK_LITERAL_BEGIN] = true,
    [WORD_PATTERN_BRACKET_OPEN] = true,
    [PATTERN_STAR_BEGIN] = true,
    [PATTERN_QUESTION_BEGIN] = true,
    [ESCAPED_CHARACTER_BEGIN] = true,
    [SQ_OPEN] = true,
    [DQ_OPEN] = true,
    [DOLLAR_SQ_DOLLAR] = true,
    [DOLLAR_EXPANSION_START] = true,
    [BACKQUOTE_START] = true,
    [WORD_TILDE_START] = true,
  };
  memcpy(valid, base_symbols, sizeof(base_symbols));

  valid[COMMAND_CLOSE] =
    scanner->substitution_depth > 0 && !has_startable_pending_document(scanner);
  valid[HERE_DOCUMENT_SEQUENCE_END] = scanner->sequence_end_pending;
  if (scanner->emission.active || scanner->sequence_end_pending) return;
  if (scanner->active.documents.count > 0) {
    const struct SourceContext *body_context = recovery_body_context(scanner);
    const struct HereDocument *doc = &scanner->active.documents.data[0];
    if (body_context == NULL) {
      valid
        [doc->quoted ? QUOTED_HERE_DOCUMENT_BODY_START
                     : HERE_DOCUMENT_BODY_START] = true;
      return;
    }
    if (body_context == &scanner->contexts[scanner->context_count - 1]) {
      select_body_recovery_symbols(valid, doc);
      return;
    }
  }
  enum TokenType opener = top_context_opener(scanner);
  if (
    opener == PARAMETER_SUBSTRING_BEGIN || opener == SUBSTRING_SEPARATOR_BEGIN
  ) {
    valid[LOGICAL_NEWLINE_BEGIN] = false;
    valid[NEWLINE] = true;
    valid[ARITHMETIC_BLANK_BEGIN] = true;
  }
  if (recovery_quote_context(scanner))
    select_quoted_recovery_symbols(scanner, valid);
}

static bool classify_recovery_source(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  const bool *valid
) {
  if (top_context_opener(scanner) == DQ_OPEN && input->lexer.lookahead == '"') {
    bool closing[TOKEN_COUNT];
    memcpy(closing, valid, sizeof(closing));
    closing[WORD_START] = false;
    return classify_logical_source(scanner, input, closing);
  }
  if (
    scanner->sequence_end_pending ||
    recovery_quote_context(scanner) ||
    is_here_document_context(top_context_opener(scanner))
  ) {
    return classify_logical_source(scanner, input, valid);
  }
  if (input->lexer.lookahead == '(' && logical_peek(input) == '(')
    return classify_logical_source(scanner, input, valid);
  if (is_horizontal_blank(input->lexer.lookahead)) {
    scan_horizontal_blanks(&input->lexer);
    bool separator = is_one_of(input->lexer.lookahead, ";|&\n");
    logical_rewind(input);
    if (!separator) return false;
  }
  const struct LexicalPunctuation reserved_punctuation[] = {
    {'{', LEFT_BRACE},
    {'}', RIGHT_BRACE},
    {'!', PIPELINE_NEGATION},
  };
  for (
    size_t index = 0; index < ARRAY_COUNT(reserved_punctuation); index += 1
  ) {
    const struct LexicalPunctuation *entry = &reserved_punctuation[index];
    if (input->lexer.lookahead == entry->character && valid[entry->symbol]) {
      if (
        scan_delimited_character_token(
          &input->lexer,
          entry->symbol,
          extglob_enabled(scanner)
        )
      ) {
        return true;
      }
      logical_rewind(input);
      break;
    }
  }
  if (
    is_lowercase_letter(input->lexer.lookahead) &&
    scan_reserved_word(&input->lexer, valid)
  ) {
    return true;
  }
  logical_rewind(input);
  if (lexical_classify(scanner, input, valid)) {
    return true;
  }
  logical_rewind(input);
  bool lexical_valid[TOKEN_COUNT];
  memcpy(lexical_valid, valid, sizeof(lexical_valid));
  lexical_valid[WORD_START] = false;
  return classify_logical_source(scanner, input, lexical_valid);
}

static bool track_bracket_fallback(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  enum TokenType symbol,
  const bool *valid
) {
  struct LexicalEmission *emission = &scanner->emission;
  if (is_bracket_fallback_context(lexical_source_symbol(symbol))) {
    emission->bracket_chains = input->bracket_chains;
    emission->tracks_brackets = true;
    return true;
  }
  if (!in_bracket_fallback(scanner)) {
    return true;
  }
  enum TokenType literal = literal_for_fallback(top_context_opener(scanner));
  if (!valid[literal]) {
    return true;
  }
  uint32_t chains = fallback_chains(scanner);
  switch (symbol) {
    case LITERAL_BEGIN:
    case ASSIGNMENT_LITERAL_BEGIN:
    case PARAMETER_LITERAL_BEGIN:
      chains = input->bracket_chains;
      break;
    case PATTERN_STAR_BEGIN:
    case PATTERN_QUESTION_BEGIN:
    case ESCAPED_CHARACTER_BEGIN:
    case SQ_OPEN:
    case DQ_OPEN:
    case DOLLAR_SQ_DOLLAR:
    case DOLLAR_DQ_DOLLAR:
    case DOLLAR_EXPANSION_START:
    case BACKQUOTE_START:
    case PROCESS_IN_START:
    case PROCESS_OUT_START:
    case EXTGLOB_OPERATOR_BEGIN:
    case BRACE_OPEN:
      chains = bracket_chains_after(chains, BRACKET_INPUT_MEMBER);
      break;
    case WORD_PATTERN_BRACKET_OPEN:
    case PARAMETER_PATTERN_BRACKET_OPEN: {
      struct LogicalPosition position = logical_position(input);
      logical_rewind(input);
      bool complete;
      struct BracketScan scan = literal_bracket_scan(scanner, literal);
      bool scanned =
        lexical_pattern_probe(scanner, input, &scan, &chains, &complete);
      logical_restore_position(input, &position);
      if (!scanned || !complete) {
        return false;
      }
      break;
    }
    default:
      return true;
  }
  emission->bracket_chains = chains;
  emission->tracks_brackets = true;
  return true;
}

static bool here_document_boundary_pending(
  const struct Scanner *scanner,
  const struct LogicalLexer *input,
  const bool *valid,
  size_t leading
) {
  if (scanner->sequence_end_pending && valid[HERE_DOCUMENT_SEQUENCE_END])
    return true;
  if (scanner->active.documents.count == 0) return false;
  if (
    valid[HERE_DOCUMENT_END_COMMIT] &&
    here_document_end_is_ready(scanner, &input->lexer)
  )
    return scanner->here_document_end_line_consumed || leading == 0;
  return scanner->active.at_line_start &&
    (valid[HERE_DOCUMENT_END_BEGIN] ||
      valid[QUOTED_HERE_DOCUMENT_END_BEGIN] ||
      valid[HERE_DOCUMENT_CONTENT_LINE_START]);
}

static bool finish_classified_source(
  struct Scanner *scanner,
  struct LogicalLexer *input,
  TSLexer *lexer,
  const bool *valid,
  bool recovering
) {
  enum TokenType symbol = (enum TokenType)input->lexer.result_symbol;
  lexer->result_symbol = (TSSymbol)symbol;
  bool accepted = true;
  if (symbol == DQ_OPEN && top_context_opener(scanner) == DQ_OPEN) return false;
  if (symbol == COMMAND_CLOSE && has_startable_pending_document(scanner))
    return false;
  if (
    recovering &&
    symbol == PUNCT_RIGHT_PARENTHESIS &&
    has_startable_pending_document(scanner)
  ) {
    const struct SourceContext *context = substitution_context(scanner);
    if (context != NULL && context->opener == COMMAND_OPEN) {
      if (!pop_substitution_context(scanner)) return false;
      discard_enclosed_pending_documents(scanner);
    }
  }
  if (symbol == PARAMETER_OPEN) {
    const struct SourceContext *word = word_source_context(scanner, true);
    if (word != NULL && word->brace_suppressed_remaining == 0) {
      size_t index = (size_t)(word - scanner->contexts);
      struct LogicalPosition saved = logical_position(input);
      logical_rewind(input);
      struct LookaheadLexer probe = {0};
      if (
        lookahead_begin(&probe, &input->lexer) &&
        skip_brace_parameter(scanner, &probe.lexer)
      )
        scanner->contexts[index].brace_suppressed_remaining =
          lexer_raw_position(&probe.lexer);
      lookahead_clear(&probe);
      logical_restore_position(input, &saved);
    }
  }
  if (
    symbol == HERE_DOCUMENT_END_COMMIT ||
    symbol == WORD_BRACKET_FALLBACK_END ||
    symbol == ASSIGNMENT_BRACKET_FALLBACK_END ||
    symbol == PARAMETER_BRACKET_FALLBACK_END
  ) {
    accepted = source_context_pop(scanner);
  }
  if (
    symbol < TOKEN_COUNT && LEXICAL_SOURCES[symbol].kind != LEXICAL_SOURCE_NONE
  ) {
    accepted =
      begin_lexical_emission(scanner, input, symbol, valid, recovering) &&
      track_bracket_fallback(scanner, input, symbol, valid);
  }
  return accepted;
}

/* Zero-width closers and here-document body starts precede any reading
   of logical source. */
static enum DispatchResult scan_structural_token(
  struct Scanner *scanner,
  TSLexer *lexer,
  const bool *valid
) {
  const enum TokenType ends[] = {
    COMMAND_SUBSTITUTION_END,
    ARITHMETIC_EXPANSION_END,
  };
  enum TokenType end = first_valid_symbol(valid, ends, ARRAY_COUNT(ends));
  if (end != TOKEN_COUNT) {
    lexer->result_symbol = (TSSymbol)end;
    return dispatch_outcome(source_context_commit(scanner, end));
  }
  if (scanner->active.documents.count > 0) {
    enum TokenType body = scanner->active.documents.data[0].quoted
      ? QUOTED_HERE_DOCUMENT_BODY_START
      : HERE_DOCUMENT_BODY_START;
    if (valid[body]) {
      scanner->active.at_line_start = true;
      lexer->result_symbol = (TSSymbol)body;
      return dispatch_outcome(source_context_push(scanner, body));
    }
  }
  return DISPATCH_NEXT;
}

static bool release_logical_source(
  struct LogicalLexer *input,
  struct HereDocumentInput *documents,
  struct NativeInput *native,
  bool accepted
) {
  logical_clear(input);
  here_document_input_clear(documents);
  native_input_clear(native);
  return accepted;
}

static bool scan_logical_source(
  struct Scanner *scanner,
  const struct Scanner *initial,
  TSLexer *lexer,
  const bool *valid,
  bool recovering
) {
  struct NativeInput native = {.lexer = lexer};
  struct HereDocumentInput documents;
  if (!here_document_input_init(&documents, &native, initial)) {
    native_input_clear(&native);
    return false;
  }
  native.boundary = here_document_input_read;
  native.boundary_payload = &documents;
  struct LogicalLexer input;
  if (!logical_init(&input, &native, &scanner->source))
    return release_logical_source(&input, &documents, &native, false);
  size_t leading = logical_lookahead_position(&input);
  if (
    top_context_opener(scanner) == DECLARATION_ASSIGNMENT_START &&
    !valid[COMMAND_OPEN] &&
    !valid[ARITHMETIC_EXPANSION_OPEN] &&
    pattern_boundary(scanner, &input.lexer, false) &&
    !process_substitution_follows(&input)
  ) {
    if (!source_context_pop(scanner))
      return release_logical_source(&input, &documents, &native, false);
  }
  bool accepted = false;
  enum TokenType word_end =
    top_context_opener(scanner) == ASSIGNMENT_ARGUMENT_START
    ? ASSIGNMENT_ARGUMENT_END
    : BRACE_WORD_END;
  bool word_boundary = valid[word_end] &&
    (top_context_opener(scanner) == BRACE_WORD_START ||
      top_context_opener(scanner) == ASSIGNMENT_ARGUMENT_START) &&
    pattern_boundary(scanner, &input.lexer, false) &&
    !process_substitution_follows(&input);
  bool flush = leading > 0 &&
    valid[SOURCE_BEGIN] &&
    !here_document_boundary_pending(scanner, &input, valid, leading);
  if (documents.end != NULL && documents.end->end == 0) {
    accepted = begin_here_document_end(scanner, lexer, documents.end, valid);
  } else if (word_boundary && !flush) {
    lexer->result_symbol = word_end;
    accepted = source_context_pop(scanner);
  } else if (flush) {
    scanner->emission = (struct LexicalEmission){
      .symbol = SOURCE_BEGIN,
      .remaining = leading,
      .active = true,
    };
    lexer->result_symbol = SOURCE_BEGIN;
    accepted = true;
  } else if (
    recovering ? classify_recovery_source(scanner, &input, valid)
               : classify_logical_source(scanner, &input, valid)
  ) {
    accepted =
      finish_classified_source(scanner, &input, lexer, valid, recovering);
  }
  return release_logical_source(
    &input,
    &documents,
    &native,
    accepted && !native.failed && !input.cursor.failed
  );
}

static bool scan_source(
  struct Scanner *scanner,
  const struct Scanner *initial,
  TSLexer *lexer,
  const bool *valid,
  bool recovering
) {
  if (!scanner_source_ready(scanner)) {
    return false;
  }
  lexer->mark_end(lexer);
  if (scanner->emission.active) {
    return emit_physical_source(scanner, lexer, valid);
  }
  enum DispatchResult structural = scan_structural_token(scanner, lexer, valid);
  if (structural != DISPATCH_NEXT) return structural == DISPATCH_ACCEPTED;
  return scan_logical_source(scanner, initial, lexer, valid, recovering);
}

static bool
bash_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  if (payload == NULL) {
    return false;
  }
  bool recovering = true;
  for (size_t index = 0; index < TOKEN_COUNT; index += 1) {
    if (!valid_symbols[index]) {
      recovering = false;
      break;
    }
  }
  bool contextual_symbols[TOKEN_COUNT];
  if (recovering) {
    select_recovery_symbols(payload, contextual_symbols);
    valid_symbols = contextual_symbols;
  }
  struct Scanner next;
  if (!scanner_copy(payload, &next)) {
    return false;
  }
  while (
    next.context_count > 0 &&
    is_bracket_word_context(next.contexts[next.context_count - 1].opener) &&
    next.contexts[next.context_count - 1].word_remaining == 0
  ) {
    if (!source_context_pop(&next)) {
      clear_scanner(&next);
      return false;
    }
  }
  if (
    !scan_source(&next, payload, lexer, valid_symbols, recovering) ||
    lexer->result_symbol >= TOKEN_COUNT ||
    !valid_symbols[lexer->result_symbol] ||
    !scanner_state_fits(&next)
  ) {
    clear_scanner(&next);
    return false;
  }
  clear_scanner(payload);
  *(struct Scanner *)payload = next;
  return true;
}

#endif
