#include <assert.h>
#include <limits.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include SCANNER_TEST_ENTRY

#define ARRAY_LENGTH(array) (sizeof(array) / sizeof((array)[0]))

enum { MOCK_INPUT_CAPACITY = 64 };

#ifdef TREE_SITTER_REUSE_ALLOCATOR
static size_t reuse_allocation_calls;
static size_t reuse_live_allocations;
static size_t reuse_fail_allocation_call;

static void *reuse_malloc(size_t size) {
  if (++reuse_allocation_calls == reuse_fail_allocation_call) return NULL;
  void *result = malloc(size);
  reuse_live_allocations += result != NULL;
  return result;
}

static void *reuse_calloc(size_t count, size_t size) {
  if (++reuse_allocation_calls == reuse_fail_allocation_call) return NULL;
  void *result = calloc(count, size);
  reuse_live_allocations += result != NULL;
  return result;
}

static void *reuse_realloc(void *pointer, size_t size) {
  if (++reuse_allocation_calls == reuse_fail_allocation_call) return NULL;
  bool fresh = pointer == NULL;
  void *result = realloc(pointer, size);
  reuse_live_allocations += fresh && result != NULL;
  return result;
}

static void reuse_free(void *pointer) {
  if (pointer != NULL) {
    assert(reuse_live_allocations > 0);
    reuse_live_allocations -= 1;
  }
  free(pointer);
}

void *(*ts_current_malloc)(size_t) = reuse_malloc;
void *(*ts_current_calloc)(size_t, size_t) = reuse_calloc;
void *(*ts_current_realloc)(void *, size_t) = reuse_realloc;
void (*ts_current_free)(void *) = reuse_free;
#endif

static unsigned snapshot(struct Scanner *scanner, char *state) {
  const unsigned char guard = 0x55;
  struct {
    unsigned char before;
    char bytes[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
    unsigned char after;
  } guarded;
  memset(&guarded, guard, sizeof(guarded));
  unsigned length = bash_scanner_serialize(scanner, guarded.bytes);
  assert(length > 0 && length <= TREE_SITTER_SERIALIZATION_BUFFER_SIZE);
  assert(guarded.before == guard);
  assert(guarded.after == guard);
  memcpy(state, guarded.bytes, length);
  return length;
}

struct MockLexer {
  TSLexer lexer;
  const int32_t *input;
  size_t length;
  size_t offset;
  size_t mark;
  uint32_t column;
};

static void mock_advance(TSLexer *lexer, bool skip) {
  (void)skip;
  struct MockLexer *mock = (struct MockLexer *)lexer;
  if (mock->offset >= mock->length) {
    return;
  }

  if (mock->input[mock->offset] == '\n') {
    mock->column = 0;
  } else {
    mock->column += 1;
  }
  mock->offset += 1;
  lexer->lookahead =
    mock->offset < mock->length ? mock->input[mock->offset] : 0;
}

static void mock_mark_end(TSLexer *lexer) {
  struct MockLexer *mock = (struct MockLexer *)lexer;
  mock->mark = mock->offset;
}

static uint32_t mock_get_column(TSLexer *lexer) {
  return ((struct MockLexer *)lexer)->column;
}

static bool mock_eof(const TSLexer *lexer) {
  const struct MockLexer *mock = (const struct MockLexer *)lexer;
  return mock->offset >= mock->length;
}

static void
init_mock_lexer(struct MockLexer *mock, const int32_t *input, size_t length) {
  *mock = (struct MockLexer){
    .lexer =
      {
        .lookahead = length == 0 ? 0 : input[0],
        .result_symbol = UINT16_MAX,
        .advance = mock_advance,
        .mark_end = mock_mark_end,
        .get_column = mock_get_column,
        .eof = mock_eof,
      },
    .input = input,
    .length = length,
  };
}

static struct HereDocument
make_document(const char *delimiter, bool quoted, bool strip_tabs) {
  size_t length = strlen(delimiter);
  uint8_t *copy = ts_malloc(length);
  assert(copy != NULL);
  memcpy(copy, delimiter, length);
  return (struct HereDocument){
    .delimiter = copy,
    .delimiter_length = length,
    .quoted = quoted,
    .strip_tabs = strip_tabs,
  };
}

static void assert_scanner_matches_snapshot(
  struct Scanner *scanner,
  const char *expected,
  unsigned expected_length
) {
  char actual[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
  assert(snapshot(scanner, actual) == expected_length);
  assert(memcmp(actual, expected, expected_length) == 0);
}

static void
test_here_document_activation_preserves_queues_and_suspended_frames(void) {
  for (size_t retained = 0; retained < 2; retained += 1) {
    struct Scanner scanner = {0};
    assert(scanner_source_ready(&scanner));
    scanner.backquote_depth = 1;
    assert(
      append_pending_document(&scanner, make_document("ROOT", false, false))
    );
    assert(activate_startable_pending_documents(&scanner));
    scanner.active.at_line_start = true;
    scanner.backquote_depth = 2;
    assert(
      append_pending_document(&scanner, make_document("OUT", false, true))
    );
    assert(activate_startable_pending_documents(&scanner));
    scanner.active.at_line_start = true;
    if (retained > 0) {
      assert(
        append_pending_document(&scanner, make_document("KEEP", true, false))
      );
    }
    scanner.backquote_depth = 4;
    assert(
      append_pending_document(&scanner, make_document("FIRST", true, false))
    );
    assert(
      append_pending_document(&scanner, make_document("SECOND", false, true))
    );
#ifdef TREE_SITTER_REUSE_ALLOCATOR
    char before[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
    unsigned before_length = snapshot(&scanner, before);
    size_t first_allocation = reuse_allocation_calls;
#endif
    assert(activate_startable_pending_documents(&scanner));
#ifdef TREE_SITTER_REUSE_ALLOCATOR
    size_t allocation_count = reuse_allocation_calls - first_allocation;
    assert(allocation_count > 0);
#endif
    char after[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
    unsigned after_length = snapshot(&scanner, after);
    bash_scanner_deserialize(&scanner, after, after_length);
    assert_scanner_matches_snapshot(&scanner, after, after_length);
    assert(scanner.pending.count == retained);
    if (retained > 0) {
      assert(scanner.pending.data[0].delimiter_length == 4);
      assert(memcmp(scanner.pending.data[0].delimiter, "KEEP", 4) == 0);
      assert(scanner.pending.data[0].declaration_depth == 2);
      assert(scanner.pending.data[0].quoted);
    }
    assert(scanner.suspended_frame_count == 2);
    assert(scanner.active.documents.count == 2);
    assert(scanner.active.backquote_depth == 4);
    assert(!scanner.active.at_line_start);
    assert(scanner.active.documents.data[0].delimiter_length == 5);
    assert(memcmp(scanner.active.documents.data[0].delimiter, "FIRST", 5) == 0);
    assert(scanner.active.documents.data[0].quoted);
    finish_active_document(&scanner);
    assert(scanner.active.documents.count == 1);
    assert(scanner.active.documents.data[0].delimiter_length == 6);
    assert(
      memcmp(scanner.active.documents.data[0].delimiter, "SECOND", 6) == 0
    );
    assert(scanner.active.documents.data[0].strip_tabs);
    finish_active_document(&scanner);
    assert(scanner.active.documents.count == 0);
    assert(scanner.sequence_end_pending);
    restore_suspended_documents(&scanner);
    assert(scanner.suspended_frame_count == 1);
    assert(scanner.active.documents.count == 1);
    assert(scanner.active.documents.data[0].delimiter_length == 3);
    assert(memcmp(scanner.active.documents.data[0].delimiter, "OUT", 3) == 0);
    assert(scanner.active.documents.data[0].strip_tabs);
    assert(scanner.active.backquote_depth == 2);
    assert(scanner.active.at_line_start);
    finish_active_document(&scanner);
    restore_suspended_documents(&scanner);
    assert(scanner.suspended_frame_count == 0);
    assert(scanner.active.documents.count == 1);
    assert(scanner.active.documents.data[0].delimiter_length == 4);
    assert(memcmp(scanner.active.documents.data[0].delimiter, "ROOT", 4) == 0);
    assert(scanner.active.backquote_depth == 1);
    assert(scanner.active.at_line_start);
    clear_scanner(&scanner);

#ifdef TREE_SITTER_REUSE_ALLOCATOR
    for (size_t failure = 1; failure <= allocation_count; failure += 1) {
      bash_scanner_deserialize(&scanner, before, before_length);
      reuse_fail_allocation_call = reuse_allocation_calls + failure;
      assert(!activate_startable_pending_documents(&scanner));
      reuse_fail_allocation_call = 0;
      assert_scanner_matches_snapshot(&scanner, before, before_length);
      clear_scanner(&scanner);
      assert(reuse_live_allocations == 0);
    }
#endif
  }
}

static void
test_pending_documents_preserve_state_up_to_serialization_capacity(void) {
  struct Scanner scanner = {0};
  assert(scanner_source_ready(&scanner));
  bool full = false;
  for (
    size_t count = 0; count < TREE_SITTER_SERIALIZATION_BUFFER_SIZE; count++
  ) {
    char state[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
    unsigned length = snapshot(&scanner, state);
    bash_scanner_deserialize(&scanner, state, length);
    assert_scanner_matches_snapshot(&scanner, state, length);
    assert(scanner.pending.count == count);
    struct HereDocument document = make_document("E", false, false);
    if (!append_pending_document(&scanner, document)) {
      clear_document(&document);
      assert_scanner_matches_snapshot(&scanner, state, length);
      assert(count > 16);
      full = true;
      break;
    }
  }
  assert(full);
  clear_scanner(&scanner);
}

static void
test_here_document_input_stops_before_nested_source_can_cross_its_end(void) {
  const struct {
    const char *source;
    const char *expected;
    size_t end;
    bool tabs;
    bool nested;
    bool line_start;
  } cases[] = {
    {"before\nEND\n}\nEND\n", "before\n", 7, false, false, true},
    {"before\n\tE\\\nND\n}\nEND\n", "before\n", 7, true, false, true},
    {"before\\\nEND\nEND\n", "beforeEND\n", 12, false, false, true},
    {"before\nEND x\nEND\n", "before\nEND x\n", 13, false, false, true},
    {"before\nEND\nINNER\n", "before\n", 7, false, true, true},
    {"END\nEND\n", "END\n", 4, false, false, false},
  };
  for (size_t index = 0; index < ARRAY_LENGTH(cases); index += 1) {
    struct Scanner scanner = {0};
    assert(scanner_source_ready(&scanner));
    assert(append_pending_document(
      &scanner,
      make_document("END", false, cases[index].tabs)
    ));
    assert(activate_startable_pending_documents(&scanner));
    assert(source_context_push(&scanner, HERE_DOCUMENT_BODY_START));
    scanner.source.stages[2].at_line_start = cases[index].line_start;
    assert(source_context_push(&scanner, COMMAND_OPEN));
    scanner.substitution_depth = 1;
    if (cases[index].nested) {
      assert(
        append_pending_document(&scanner, make_document("INNER", true, false))
      );
      assert(activate_startable_pending_documents(&scanner));
      assert(source_context_push(&scanner, QUOTED_HERE_DOCUMENT_BODY_START));
    } else {
      assert(source_context_push(&scanner, SQ_OPEN));
    }
    int32_t source[MOCK_INPUT_CAPACITY];
    size_t length = strlen(cases[index].source);
    assert(length <= ARRAY_LENGTH(source));
    for (size_t character = 0; character < length; character += 1) {
      source[character] = (unsigned char)cases[index].source[character];
    }
    struct MockLexer lexer;
    init_mock_lexer(&lexer, source, length);
    struct NativeInput native = {.lexer = &lexer.lexer};
    struct HereDocumentInput documents;
    assert(here_document_input_init(&documents, &native, &scanner));
    native.boundary = here_document_input_read;
    native.boundary_payload = &documents;
    struct LogicalLexer input;
    assert(logical_init(&input, &native, &scanner.source));
    for (
      size_t character = 0; character < strlen(cases[index].expected);
      character += 1
    ) {
      assert(input.result == SOURCE_CHARACTER);
      assert(input.lexer.lookahead == cases[index].expected[character]);
      input.lexer.advance(&input.lexer, false);
    }
    assert(input.result == SOURCE_END);
    assert(input.consumed == cases[index].end);
    assert(documents.end != NULL);
    assert(documents.end->context == 0);
    assert(documents.end->end == cases[index].end);
    assert(!native.failed);
    logical_clear(&input);
    here_document_input_clear(&documents);
    native_input_clear(&native);
    clear_scanner(&scanner);
  }
}

static void test_recovery_preserves_reserved_tokens_and_separator_layout(void) {
  const struct {
    const char *source;
    enum TokenType begin;
    enum TokenType source_token;
    size_t end;
  } cases[] = {
    {"fi\n", FI_KEYWORD, FI_KEYWORD_BEGIN_WHOLE, 2},
    {"f\\\ni\n", FI_KEYWORD, FI_KEYWORD_BEGIN_WHOLE, 4},
    {"then;", THEN_KEYWORD, THEN_KEYWORD_BEGIN_WHOLE, 4},
    {"else\n", ELSE_KEYWORD, ELSE_KEYWORD_BEGIN_WHOLE, 4},
    {"done\n", DONE_KEYWORD, DONE_KEYWORD_BEGIN_WHOLE, 4},
    {"esac\n", ESAC_KEYWORD, ESAC_KEYWORD_BEGIN_WHOLE, 4},
    {"time echo\n", TIME_KEYWORD, TIME_KEYWORD_BEGIN_WHOLE, 4},
    {"ti\\\nme echo\n", TIME_KEYWORD, TIME_KEYWORD_BEGIN_WHOLE, 6},
    {"time -p echo\n", TIME_KEYWORD, TIME_KEYWORD_BEGIN_WHOLE, 4},
    {"time -- -p\n", TIME_KEYWORD, TIME_KEYWORD_BEGIN_WHOLE, 4},
    {"time\n", EMPTY_TIME_KEYWORD, EMPTY_TIME_KEYWORD_BEGIN_WHOLE, 4},
    {"time -p --\n", EMPTY_TIME_KEYWORD, EMPTY_TIME_KEYWORD_BEGIN_WHOLE, 4},
    {"ti\\\nme -p --\n", EMPTY_TIME_KEYWORD, EMPTY_TIME_KEYWORD_BEGIN_WHOLE, 6},
    {"timeout\n", LITERAL_BEGIN, LITERAL_BEGIN_PIECE, 7},
    {"time-p\n", LITERAL_BEGIN, LITERAL_BEGIN_PIECE, 6},
    {"coproc C { :; }\n", COPROC_KEYWORD, COPROC_KEYWORD_BEGIN_WHOLE, 6},
    {"coproc echo\n", COPROC_KEYWORD, COPROC_KEYWORD_BEGIN_WHOLE, 6},
    {"cop\\\nroc echo\n", COPROC_KEYWORD, COPROC_KEYWORD_BEGIN_WHOLE, 8},
    {"coproc\n", COPROC_KEYWORD, COPROC_KEYWORD_BEGIN_WHOLE, 6},
    {"coprocess\n", LITERAL_BEGIN, LITERAL_BEGIN_PIECE, 9},
    {"]]\n", CONDITIONAL_CLOSE_BEGIN, CONDITIONAL_CLOSE_BEGIN_PIECE, 2},
    {"]]tail\n", LITERAL_BEGIN, LITERAL_BEGIN_PIECE, 6},
    {"finish\n", LITERAL_BEGIN, LITERAL_BEGIN_PIECE, 6},
    {" ;", LOGICAL_BLANK_BEGIN, LOGICAL_BLANK_BEGIN_PIECE, 1},
    {" \t|", LOGICAL_BLANK_BEGIN, LOGICAL_BLANK_BEGIN_PIECE, 2},
    {"\t&", LOGICAL_BLANK_BEGIN, LOGICAL_BLANK_BEGIN_PIECE, 1},
    {" \n", LOGICAL_BLANK_BEGIN, LOGICAL_BLANK_BEGIN_PIECE, 1},
  };
  bool valid[TOKEN_COUNT];
  for (size_t index = 0; index < TOKEN_COUNT; index += 1) valid[index] = true;
  for (size_t index = 0; index < ARRAY_LENGTH(cases); index += 1) {
    struct Scanner scanner = {0};
    int32_t source[MOCK_INPUT_CAPACITY];
    size_t length = strlen(cases[index].source);
    assert(length <= ARRAY_LENGTH(source));
    for (size_t offset = 0; offset < length; offset += 1) {
      source[offset] = cases[index].source[offset];
    }
    struct MockLexer lexer;
    init_mock_lexer(&lexer, source, length);
    assert(bash_scanner_scan(&scanner, &lexer.lexer, valid));
    assert(lexer.lexer.result_symbol == cases[index].begin);
    assert(lexer.mark == 0);
    char state[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
    unsigned state_length = snapshot(&scanner, state);
    bash_scanner_deserialize(&scanner, state, state_length);
    init_mock_lexer(&lexer, source, length);
    assert(bash_scanner_scan(&scanner, &lexer.lexer, valid));
    assert(lexer.lexer.result_symbol == cases[index].source_token);
    assert(lexer.mark == cases[index].end);
    assert(!scanner.emission.active);
    assert(scanner.context_count == 0);
    clear_scanner(&scanner);
  }
}

static void test_pending_here_document_sequence_preserves_state(void) {
  const struct {
    const char *source;
    bool pending;
    bool enabled;
    bool accepted;
  } cases[] = {
    {"", true, true, false},
    {" \t", true, true, false},
    {"\n", true, true, true},
    {" \n", true, true, true},
    {"#comment", true, true, false},
    {" #comment\n", true, true, true},
    {";", true, true, false},
    {" argument\n", true, true, false},
    {" >file\n", true, true, false},
    {"", false, true, false},
    {"\n", false, true, false},
    {"", true, false, false},
  };
  for (size_t index = 0; index < ARRAY_LENGTH(cases); index += 1) {
    struct Scanner scanner = {0};
    assert(scanner_source_ready(&scanner));
    if (cases[index].pending) {
      assert(
        append_pending_document(&scanner, make_document("END", false, false))
      );
    }
    char before[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
    unsigned length = snapshot(&scanner, before);
    int32_t source[MOCK_INPUT_CAPACITY];
    size_t source_length = strlen(cases[index].source);
    assert(source_length <= ARRAY_LENGTH(source));
    for (size_t offset = 0; offset < source_length; offset += 1) {
      source[offset] = cases[index].source[offset];
    }
    struct MockLexer lexer;
    init_mock_lexer(&lexer, source, source_length);
    bool valid[TOKEN_COUNT] = {false};
    valid[HERE_DOCUMENT_SEQUENCE_BEGIN] = cases[index].enabled;
    assert(
      bash_scanner_scan(&scanner, &lexer.lexer, valid) == cases[index].accepted
    );
    assert_scanner_matches_snapshot(&scanner, before, length);
    if (cases[index].accepted) {
      assert(lexer.lexer.result_symbol == HERE_DOCUMENT_SEQUENCE_BEGIN);
      assert(lexer.mark == 0);
    }
    clear_scanner(&scanner);
  }
}

static void test_delimiter_quote_removal_retains_quoted_newlines(void) {
  const struct {
    const char *source;
    const char *expected;
  } cases[] = {
    {"\"${x:-$'\\\nab'}\"\n", "${x:-\nab}"},
    {"\"${x:-$'a\\\nb'}\"\n", "${x:-a\nb}"},
    {"$'\\\nab'\n", "\\\nab"},
    {"$\\\n'\\\nab'\n", "\\\nab"},
    {"\"${x:-$\\\n'\\\nab'}\"\n", "${x:-\nab}"},
    {"'\\\nab'\n", "\\\nab"},
    {"\"a\\\nb\"\n", "ab"},
  };
  for (size_t index = 0; index < ARRAY_LENGTH(cases); index++) {
    struct Scanner scanner = {0};
    assert(scanner_source_ready(&scanner));
    int32_t source[MOCK_INPUT_CAPACITY];
    size_t length = strlen(cases[index].source);
    assert(length <= ARRAY_LENGTH(source));
    for (size_t offset = 0; offset < length; offset++)
      source[offset] = (unsigned char)cases[index].source[offset];
    struct MockLexer lexer;
    init_mock_lexer(&lexer, source, length);
    struct NativeInput native = {.lexer = &lexer.lexer};
    struct LogicalLexer input;
    assert(logical_init(&input, &native, &scanner.source));
    struct LookaheadLexer probe;
    assert(lookahead_init(&probe, &input.lexer));
    assert(lookahead_append(&probe, 0));
    struct HereDocument document;
    assert(
      read_here_document_delimiter(
        &probe.lexer,
        &scanner,
        false,
        &document,
        false
      ) == DELIMITER_READ_WORD
    );
    assert(document.quoted);
    assert(document.delimiter_length == strlen(cases[index].expected));
    assert(
      memcmp(
        document.delimiter,
        cases[index].expected,
        document.delimiter_length
      ) == 0
    );
    assert(append_pending_document(&scanner, document));
    char state[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
    unsigned state_length = snapshot(&scanner, state);
    struct Scanner restored = {0};
    bash_scanner_deserialize(&restored, state, state_length);
    assert_scanner_matches_snapshot(&restored, state, state_length);
    clear_scanner(&restored);
    lookahead_clear(&probe);
    logical_clear(&input);
    native_input_clear(&native);
    clear_scanner(&scanner);
  }
}

static void
test_delimiter_read_preserves_bytes_and_distinguishes_failures(void) {
  char oversized[SCANNER_STATE_CAPACITY + 3];
  memset(oversized, 'a', SCANNER_STATE_CAPACITY + 1);
  oversized[SCANNER_STATE_CAPACITY + 1] = '\n';
  oversized[SCANNER_STATE_CAPACITY + 2] = 0;
  char controls[SCANNER_STATE_CAPACITY / 2 + 2] = {0};
  memset(controls, 0x01, sizeof(controls) - 1);
  char quoted_controls[sizeof(controls) + 3];
  quoted_controls[0] = '\'';
  memcpy(quoted_controls + 1, controls, sizeof(controls) - 1);
  memcpy(quoted_controls + sizeof(controls), "'\n", 3);
  const struct {
    const char *source;
    int32_t character;
    enum DelimiterReadResult expected;
    const char *delimiter;
  } cases[] = {
    {"@\n", -1, DELIMITER_READ_INVALID, NULL},
    {"@", -1, DELIMITER_READ_INVALID, NULL},
    {"'@'\n", -1, DELIMITER_READ_INVALID, NULL},
    {"\"@\"\n", -1, DELIMITER_READ_INVALID, NULL},
    {"\\@\n", -1, DELIMITER_READ_INVALID, NULL},
    {"$'@'\n", -1, DELIMITER_READ_INVALID, NULL},
    {"$'\\c@'\n", -1, DELIMITER_READ_INVALID, NULL},
    {"$'\\0@'\n", -1, DELIMITER_READ_INVALID, NULL},
    {"\"${x:-$'@'}\"\n", -1, DELIMITER_READ_INVALID, NULL},
    {"$(echo @)\n", -1, DELIMITER_READ_INVALID, NULL},
    {"`echo @`\n", -1, DELIMITER_READ_INVALID, NULL},
    {"$'\\ud800'\n", 0, DELIMITER_READ_INVALID, NULL},
    {"$'\\U00110000'\n", 0, DELIMITER_READ_INVALID, NULL},
    {"$'\\x80'\n", 0, DELIMITER_READ_WORD, "\x80"},
    {"$'\\777'\n", 0, DELIMITER_READ_WORD, "\xff"},
    {"$'\\xc3'\n", 0, DELIMITER_READ_WORD, "\xc3"},
    {"$'\\xe3\\x81'\n", 0, DELIMITER_READ_WORD, "\xe3\x81"},
    {"$'\\xc0\\xaf'\n", 0, DELIMITER_READ_WORD, "\xc0\xaf"},
    {"$'\\xed\\xa0\\x80'\n", 0, DELIMITER_READ_WORD, "\xed\xa0\x80"},
    {"$'\\xf4\\x90\\x80\\x80'\n", 0, DELIMITER_READ_WORD, "\xf4\x90\x80\x80"},
    {"$'\\xc3A'\n",
      0,
      DELIMITER_READ_WORD,
      "\xc3"
      "A"},
    {"$'\\xc3\\0\\xa9'\n", 0, DELIMITER_READ_WORD, "\xc3"},
    {"$'\\0'\n", 0, DELIMITER_READ_WORD, ""},
    {"$'E\\0\\x80'\n", 0, DELIMITER_READ_WORD, "E"},
    {"$'\\xc3\\xa9'\n", 0, DELIMITER_READ_WORD, "\xc3\xa9"},
    {"$'\\xc3'$'\\xa9'\n", 0, DELIMITER_READ_WORD, "\xc3\xa9"},
    {"$'\\xc3\\0'$'\\xa9'\n", 0, DELIMITER_READ_WORD, "\xc3\xa9"},
    {"\"${x:-$'\\x80'}\"\n", 0, DELIMITER_READ_WORD, "${x:-\x80}"},
    {"$'\\cA\\cz\\c[\\c]\\c^\\c_\\c?\\c9'\n",
      0,
      DELIMITER_READ_WORD,
      "\x01\x1a\x1b\x1d\x1e\x1f\x7f\x19"},
    {"$'\\c@'\n", '@', DELIMITER_READ_WORD, ""},
    {"$'\\c@'\n", 0x00e9, DELIMITER_READ_WORD, "\x03\xa9"},
    {"$'\\c@'\n", 0x3042, DELIMITER_READ_WORD, "\x03\x81\x82"},
    {"$'\\c@'\n", 0x1f600, DELIMITER_READ_WORD, "\x10\x9f\x98\x80"},
    {"$'E\\c@tail'\n", 0x0800, DELIMITER_READ_WORD, "E"},
    {"$'\\c@'tail\n", 0x0800, DELIMITER_READ_WORD, "tail"},
    {"\"${x:-$'\\c@'}\"\n", 0x00e9, DELIMITER_READ_WORD, "${x:-\x03\xa9}"},
    {"$'\\c\\@'\n", 0x00e9, DELIMITER_READ_WORD, "\x1c\xc3\xa9"},
    {"$'\\c\\\\'\n", 0, DELIMITER_READ_WORD, "\x1c"},
    {"$'E\\c'\n", 0, DELIMITER_READ_WORD, "E\\c"},
    {"@\n", 0xfffd, DELIMITER_READ_WORD, "\xef\xbf\xbd"},
    {"E\\", -1, DELIMITER_READ_WORD, "E\\"},
    {"\\", -1, DELIMITER_READ_WORD, "\\"},
    {"'E'\\", -1, DELIMITER_READ_WORD, "E\\"},
    {"E\\@", 'F', DELIMITER_READ_WORD, "EF"},
    {"${\t :; }\n", 0, DELIMITER_READ_WORD, "${\t :; }"},
    {"${| \t:; }\n", 0, DELIMITER_READ_WORD, "${| \t:; }"},
    {"${\n\t:; }\n", 0, DELIMITER_READ_WORD, "${\n\t:; }"},
    {"${| \t\n:; }\n", 0, DELIMITER_READ_WORD, "${| \t\n:; }"},
    {oversized, 'a', DELIMITER_READ_RESOURCE_FAILURE, NULL},
    {quoted_controls, 0, DELIMITER_READ_WORD, controls},
  };
  for (size_t index = 0; index < ARRAY_LENGTH(cases); index++) {
    struct Scanner scanner = {0};
    assert(scanner_source_ready(&scanner));
    int32_t source[SCANNER_STATE_CAPACITY + 2];
    size_t length = strlen(cases[index].source);
    assert(length <= ARRAY_LENGTH(source));
    for (size_t offset = 0; offset < length; offset++)
      source[offset] = cases[index].source[offset] == '@'
        ? cases[index].character
        : (unsigned char)cases[index].source[offset];
    struct MockLexer lexer;
    init_mock_lexer(&lexer, source, length);
    struct NativeInput native = {.lexer = &lexer.lexer};
    struct LogicalLexer input;
    assert(logical_init(&input, &native, &scanner.source));
    struct LookaheadLexer probe;
    assert(lookahead_init(&probe, &input.lexer));
    assert(lookahead_append(&probe, 0));
    struct HereDocument document;
    assert(
      read_here_document_delimiter(
        &probe.lexer,
        &scanner,
        false,
        &document,
        false
      ) == cases[index].expected
    );
    bool accepted = cases[index].expected == DELIMITER_READ_WORD;
    if (accepted) {
      const char *delimiter = cases[index].delimiter;
      assert(document.delimiter_length == strlen(delimiter));
      assert(memcmp(document.delimiter, delimiter, strlen(delimiter)) == 0);
      clear_document(&document);
    }
    assert(!native.failed);
    assert(!lookahead_has_failed(&probe.lexer));
    lookahead_seek(&probe, 0);
    assert(
      scan_here_document_delimiter(&scanner, &probe.lexer, false) == accepted
    );
    assert(scanner.pending.count == (accepted ? 1 : 0));
    if (accepted) {
      char state[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
      unsigned state_length = snapshot(&scanner, state);
      struct Scanner restored = {0};
      bash_scanner_deserialize(&restored, state, state_length);
      assert_scanner_matches_snapshot(&restored, state, state_length);
      assert(restored.pending.count == 1);
      const struct HereDocument *document = &restored.pending.data[0];
      const char *delimiter = cases[index].delimiter;
      assert(document->delimiter_length == strlen(delimiter));
      assert(memcmp(document->delimiter, delimiter, strlen(delimiter)) == 0);
      clear_scanner(&restored);
    }
    bool resource_failure =
      cases[index].expected == DELIMITER_READ_RESOURCE_FAILURE;
    assert(native.failed == resource_failure);
    assert(lookahead_has_failed(&probe.lexer) == resource_failure);
    lookahead_clear(&probe);
    logical_clear(&input);
    native_input_clear(&native);
    clear_scanner(&scanner);
  }
}

#ifdef TREE_SITTER_REUSE_ALLOCATOR
static void
test_delimiter_allocation_failures_preserve_the_failure_reason(void) {
  const char *spelling = "'a'\"${x:-$'b'}\"`printf c`\n";
  int32_t source[MOCK_INPUT_CAPACITY];
  size_t length = strlen(spelling);
  for (size_t offset = 0; offset < length; offset++)
    source[offset] = (unsigned char)spelling[offset];
  size_t allocation_count = 0;
  for (size_t failure = 0; failure <= allocation_count; failure++) {
    struct Scanner scanner = {0};
    assert(scanner_source_ready(&scanner));
    struct MockLexer lexer;
    init_mock_lexer(&lexer, source, length);
    struct NativeInput native = {.lexer = &lexer.lexer};
    struct LogicalLexer input;
    assert(logical_init(&input, &native, &scanner.source));
    struct LookaheadLexer probe;
    assert(lookahead_init(&probe, &input.lexer));
    assert(lookahead_append(&probe, 0));
    size_t first_allocation = reuse_allocation_calls;
    if (failure != 0) reuse_fail_allocation_call = first_allocation + failure;
    struct HereDocument document;
    enum DelimiterReadResult result = read_here_document_delimiter(
      &probe.lexer,
      &scanner,
      false,
      &document,
      false
    );
    reuse_fail_allocation_call = 0;
    if (failure == 0) {
      assert(result == DELIMITER_READ_WORD);
      allocation_count = reuse_allocation_calls - first_allocation;
      assert(allocation_count > 0);
      clear_document(&document);
    } else {
      assert(reuse_allocation_calls >= first_allocation + failure);
      assert(result == DELIMITER_READ_RESOURCE_FAILURE);
    }
    lookahead_clear(&probe);
    logical_clear(&input);
    native_input_clear(&native);
    clear_scanner(&scanner);
    assert(reuse_live_allocations == 0);
  }
}
#endif

static void
test_here_document_end_restores_its_source_and_serialized_depth(void) {
  struct Scanner scanner = {0};
  assert(scanner_source_ready(&scanner));
  scanner.substitution_depth = 2;
  assert(append_pending_document(&scanner, make_document("OUT", false, false)));
  assert(activate_startable_pending_documents(&scanner));
  assert(source_context_push(&scanner, HERE_DOCUMENT_BODY_START));
  assert(source_context_push(&scanner, COMMAND_OPEN));
  scanner.substitution_depth = 3;
  assert(
    append_pending_document(&scanner, make_document("INNER", true, false))
  );
  assert(activate_startable_pending_documents(&scanner));
  assert(source_context_push(&scanner, QUOTED_HERE_DOCUMENT_BODY_START));
  char before[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
  unsigned before_length = snapshot(&scanner, before);
  clear_scanner(&scanner);
  bash_scanner_deserialize(&scanner, before, before_length);

  const int32_t source[] = {'O', 'U', 'T', '\n'};
  struct MockLexer lexer;
  init_mock_lexer(&lexer, source, ARRAY_LENGTH(source));
  bool valid[TOKEN_COUNT] = {false};
  valid[HERE_DOCUMENT_END_BEGIN] = true;
#ifdef TREE_SITTER_REUSE_ALLOCATOR
  size_t first_allocation = reuse_allocation_calls;
#endif
  assert(bash_scanner_scan(&scanner, &lexer.lexer, valid));
#ifdef TREE_SITTER_REUSE_ALLOCATOR
  size_t allocation_count = reuse_allocation_calls - first_allocation;
#endif
  assert(lexer.lexer.result_symbol == HERE_DOCUMENT_END_BEGIN);
  assert(lexer.mark == 0);
  assert(scanner.context_count == 1);
  assert(scanner.source.stage_count == 4);
  assert(scanner.substitution_depth == 2);
  assert(scanner.suspended_frame_count == 0);
  assert(scanner.active.documents.count == 1);
  assert(scanner.active.documents.data[0].delimiter_length == 3);
  assert(memcmp(scanner.active.documents.data[0].delimiter, "OUT", 3) == 0);
  assert(!scanner.active.documents.data[0].quoted);
  assert(!scanner.active.documents.data[0].strip_tabs);
  assert(scanner.active.documents.data[0].ending);

  char after[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
  unsigned after_length = snapshot(&scanner, after);
  clear_scanner(&scanner);
  bash_scanner_deserialize(&scanner, after, after_length);
  assert_scanner_matches_snapshot(&scanner, after, after_length);
  assert(scanner.active.documents.data[0].ending);
  valid[HERE_DOCUMENT_END_BEGIN] = false;
  valid[HERE_DOCUMENT_END_TEXT_BEGIN] = true;
  init_mock_lexer(&lexer, source, ARRAY_LENGTH(source));
  assert(bash_scanner_scan(&scanner, &lexer.lexer, valid));
  assert(lexer.lexer.result_symbol == HERE_DOCUMENT_END_TEXT_BEGIN);
  clear_scanner(&scanner);

#ifdef TREE_SITTER_REUSE_ALLOCATOR
  valid[HERE_DOCUMENT_END_TEXT_BEGIN] = false;
  valid[HERE_DOCUMENT_END_BEGIN] = true;
  for (size_t failure = 1; failure <= allocation_count; failure += 1) {
    bash_scanner_deserialize(&scanner, before, before_length);
    reuse_fail_allocation_call = reuse_allocation_calls + failure;
    init_mock_lexer(&lexer, source, ARRAY_LENGTH(source));
    assert(!bash_scanner_scan(&scanner, &lexer.lexer, valid));
    reuse_fail_allocation_call = 0;
    assert_scanner_matches_snapshot(&scanner, before, before_length);
    clear_scanner(&scanner);
    assert(reuse_live_allocations == 0);
  }
#endif
}

static void
test_scanner_copy_owns_nested_state_and_preserves_source_on_failure(void) {
  struct Scanner scanner = {0};
  assert(scanner_source_ready(&scanner));
  scanner.backquote_depth = 1;
  assert(append_pending_document(&scanner, make_document("OUT", false, true)));
  assert(activate_startable_pending_documents(&scanner));
  scanner.backquote_depth = 2;
  assert(append_pending_document(&scanner, make_document("IN", true, false)));
  assert(activate_startable_pending_documents(&scanner));
  assert(
    append_pending_document(&scanner, make_document("NEXT", false, false))
  );
  assert(source_context_push(&scanner, DQ_OPEN));
  assert(source_context_push(&scanner, COMMAND_OPEN));
  struct SourceCursor cursor;
  assert(source_cursor_init(
    &cursor,
    scanner.source.stages,
    scanner.source.stage_count,
    NULL,
    NULL
  ));
  assert(source_feed(&cursor, 'a'));
  assert(source_feed(&cursor, '\\'));
  assert(source_checkpoint(&cursor, &scanner.source));
  source_cursor_clear(&cursor);
  assert(scanner.source.raw_position == 2);
  assert(scanner.source.stages[0].has_pending);
  char before[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
  unsigned before_length = snapshot(&scanner, before);
#ifdef TREE_SITTER_REUSE_ALLOCATOR
  size_t first_allocation = reuse_allocation_calls;
#endif
  struct Scanner copy;
  assert(scanner_copy(&scanner, &copy));
#ifdef TREE_SITTER_REUSE_ALLOCATOR
  size_t allocation_count = reuse_allocation_calls - first_allocation;
#endif
  assert_scanner_matches_snapshot(&copy, before, before_length);
  clear_scanner(&scanner);
  assert_scanner_matches_snapshot(&copy, before, before_length);
  clear_scanner(&copy);
#ifdef TREE_SITTER_REUSE_ALLOCATOR
  assert(reuse_live_allocations == 0);
  for (size_t failure = 1; failure <= allocation_count; failure += 1) {
    bash_scanner_deserialize(&scanner, before, before_length);
    size_t live_before = reuse_live_allocations;
    reuse_fail_allocation_call = reuse_allocation_calls + failure;
    assert(!scanner_copy(&scanner, &copy));
    reuse_fail_allocation_call = 0;
    assert_scanner_matches_snapshot(&scanner, before, before_length);
    assert(reuse_live_allocations == live_before);
    clear_scanner(&copy);
    clear_scanner(&scanner);
    assert(reuse_live_allocations == 0);
  }
#endif
}

static void test_nested_context_round_trip_and_reset(void) {
  struct Scanner *scanner = bash_scanner_create();
  struct Scanner *copy = bash_scanner_create();
  assert(scanner != NULL && copy != NULL);
  assert(scanner_source_ready(scanner));
  assert(source_context_push(scanner, DQ_OPEN));
  assert(source_context_push(scanner, COMMAND_OPEN));
  assert(source_context_push(scanner, SQ_OPEN));
  char original[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
  char restored[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
  unsigned length = snapshot(scanner, original);
  bash_scanner_deserialize(copy, original, length);
  assert(copy->context_count == 3);
  assert(snapshot(copy, restored) == length);
  assert(memcmp(original, restored, length) == 0);
  bash_scanner_deserialize(copy, NULL, 0);
  assert(copy->context_count == 0 && copy->source.stage_count == 0);
  bash_scanner_destroy(copy);
  bash_scanner_destroy(scanner);
}

static void
test_substitution_end_closes_its_owner_and_retains_outer_documents(void) {
  const enum TokenType openers[] =
    {COMMAND_OPEN, CURRENT_SHELL_OPEN, REPLY_OPEN};
  bool valid[TOKEN_COUNT] = {0};
  valid[COMMAND_SUBSTITUTION_END] = true;
  for (size_t index = 0; index < ARRAY_LENGTH(openers); index++) {
    struct Scanner scanner = {0};
    assert(scanner_source_ready(&scanner));
    assert(
      append_pending_document(&scanner, make_document("OUT", false, false))
    );
    assert(source_context_push(&scanner, DQ_OPEN));
    assert(source_context_push(&scanner, openers[index]));
    assert(source_context_push(&scanner, openers[index]));
    scanner.substitution_depth = 2;
    assert(source_context_push(&scanner, BRACE_WORD_START));
    assert(source_context_push(&scanner, PARAMETER_OPEN));
    struct MockLexer lexer;
    init_mock_lexer(&lexer, NULL, 0);
    assert(bash_scanner_scan(&scanner, &lexer.lexer, valid));
    assert(lexer.lexer.result_symbol == COMMAND_SUBSTITUTION_END);
    assert(scanner.substitution_depth == 1);
    assert(scanner.context_count == 2);
    assert(top_context_opener(&scanner) == openers[index]);
    assert(top_context(&scanner)->count == 1);
    char state[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
    unsigned length = snapshot(&scanner, state);
    bash_scanner_deserialize(&scanner, state, length);
    assert_scanner_matches_snapshot(&scanner, state, length);
    init_mock_lexer(&lexer, NULL, 0);
    assert(bash_scanner_scan(&scanner, &lexer.lexer, valid));
    assert(scanner.substitution_depth == 0);
    assert(scanner.context_count == 1);
    assert(top_context_opener(&scanner) == DQ_OPEN);
    assert(source_quote(&scanner) == QUOTE_DOUBLE);
    assert(scanner.pending.count == 1);
    assert(scanner.pending.data[0].delimiter_length == 3);
    assert(memcmp(scanner.pending.data[0].delimiter, "OUT", 3) == 0);
    clear_scanner(&scanner);
  }
}

static void test_substitution_end_does_not_cross_input_boundaries(void) {
  const enum TokenType barriers[] = {BACKQUOTE_START, HERE_DOCUMENT_BODY_START};
  bool valid[TOKEN_COUNT] = {0};
  valid[COMMAND_SUBSTITUTION_END] = true;
  for (size_t index = 0; index < ARRAY_LENGTH(barriers); index++) {
    struct Scanner scanner = {0};
    assert(scanner_source_ready(&scanner));
    assert(source_context_push(&scanner, COMMAND_OPEN));
    scanner.substitution_depth = 1;
    if (barriers[index] == HERE_DOCUMENT_BODY_START) {
      assert(
        append_pending_document(&scanner, make_document("OUT", false, false))
      );
      assert(activate_startable_pending_documents(&scanner));
    }
    assert(source_context_push(&scanner, barriers[index]));
    assert(source_context_push(&scanner, BRACE_WORD_START));
    assert(source_context_push(&scanner, PARAMETER_OPEN));
    char state[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
    unsigned length = snapshot(&scanner, state);
    struct MockLexer lexer;
    init_mock_lexer(&lexer, NULL, 0);
    assert(!bash_scanner_scan(&scanner, &lexer.lexer, valid));
    assert_scanner_matches_snapshot(&scanner, state, length);
    clear_scanner(&scanner);
  }
}

static void test_pattern_range_state_round_trip(void) {
  struct Scanner *scanner = bash_scanner_create();
  assert(scanner != NULL && scanner_source_ready(scanner));
  assert(source_context_push(scanner, WORD_FALLBACK_LITERAL_BEGIN));
  const uint32_t chains = (1u << BRACKET_PHASE_RANGE) |
    (1u << (BRACKET_PHASE_RANGE_CLASS + BRACKET_CLASS_MARKED));
  scanner->contexts[0].bracket_chains = chains;
  char state[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
  unsigned length = snapshot(scanner, state);
  bash_scanner_deserialize(scanner, state, length);
  assert(scanner->contexts[0].bracket_chains == chains);
  bash_scanner_deserialize(scanner, NULL, 0);
  assert(scanner->context_count == 0);
  bash_scanner_destroy(scanner);
}

static void test_parameter_quote_changes_preserve_compressed_parents(void) {
  struct Scanner scanner = {0};
  assert(scanner_source_ready(&scanner));
  assert(source_context_push(&scanner, DQ_OPEN));
  assert(source_context_push(&scanner, PARAMETER_OPEN));
  assert(source_context_push(&scanner, PARAMETER_OPEN));
  assert(scanner.context_count == 2);
  assert(top_context(&scanner)->count == 2);
  assert(clear_parameter_quote(&scanner));
  assert(scanner.context_count == 3);
  assert(source_context_push(&scanner, DQ_OPEN));

  char original[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
  char restored[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
  unsigned length = snapshot(&scanner, original);
  bash_scanner_deserialize(&scanner, original, length);
  assert(snapshot(&scanner, restored) == length);
  assert(memcmp(original, restored, length) == 0);
  assert(source_quote(&scanner) == QUOTE_DOUBLE);
  assert(source_context_pop(&scanner));
  assert(source_quote(&scanner) == QUOTE_PLAIN);
  assert(source_context_pop(&scanner));
  assert(source_quote(&scanner) == QUOTE_PARAMETER);
  assert(top_context(&scanner)->count == 1);
  assert(source_context_push(&scanner, DQ_OPEN));
  assert(source_quote(&scanner) == QUOTE_PARAMETER);
  assert(source_context_push(&scanner, COMMAND_OPEN));
  assert(source_quote(&scanner) == QUOTE_PLAIN);
  assert(source_context_pop(&scanner));
  assert(source_quote(&scanner) == QUOTE_PARAMETER);
  clear_scanner(&scanner);
}

static void test_bracket_cache_round_trips_and_stays_in_context(void) {
  struct Scanner *scanner = bash_scanner_create();
  assert(scanner != NULL && scanner_source_ready(scanner));
  assert(bracket_cache(scanner) == &scanner->bracket);
  scanner->bracket.element_remaining = 5;
  scanner->bracket.collating_closer_from = 3;
  scanner->bracket.collating_closer_end = 9;
  assert(source_context_push(scanner, BRACE_WORD_START));
  struct SourceContext *word = top_context(scanner);
  word->bracket.collating_absent_start = 10;
  word->bracket.collating_absent_end = 130;
  word->bracket.collating_closer_from = 130;
  word->bracket.collating_closer_end = 140;
  word->bracket.element_remaining = 131;
  char state[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
  unsigned length = snapshot(scanner, state);
  bash_scanner_deserialize(scanner, state, length);
  assert(scanner->bracket.element_remaining == 5);
  assert(scanner->bracket.collating_absent_end == 0);
  assert(collating_closes_in(&scanner->bracket, 3));
  assert(collating_closes_in(&scanner->bracket, 6));
  assert(collating_closes_in(&scanner->bracket, 7));
  assert(!collating_closes_in(&scanner->bracket, 8));
  const struct BracketCache *cache = bracket_cache(scanner);
  assert(cache == &scanner->contexts[0].bracket);
  assert(cache->element_remaining == 131);
  assert(!collating_absent_in(cache, 9));
  assert(collating_absent_in(cache, 10));
  assert(collating_absent_in(cache, 129));
  assert(!collating_absent_in(cache, 130));
  assert(!collating_closes_in(cache, 129));
  assert(collating_closes_in(cache, 130));
  assert(collating_closes_in(cache, 137));
  assert(collating_closes_in(cache, 138));
  assert(!collating_closes_in(cache, 139));
  assert(source_context_push(scanner, WORD_FALLBACK_LITERAL_BEGIN));
  assert(bracket_cache(scanner) == &scanner->contexts[0].bracket);
  assert(source_context_push(scanner, COMMAND_OPEN));
  assert(bracket_cache(scanner) == &scanner->contexts[2].bracket);
  cache = &scanner->contexts[0].bracket;
  assert(!collating_cached(bracket_cache(scanner)));
  assert(bracket_cache(scanner)->element_remaining == 0);
  consume_context_remaining(scanner, 20);
  assert(scanner->bracket.element_remaining == 0);
  assert(!collating_cached(&scanner->bracket));
  assert(cache->collating_absent_start == 0);
  assert(cache->collating_absent_end == 110);
  assert(cache->collating_closer_from == 110);
  assert(cache->collating_closer_end == 120);
  assert(cache->element_remaining == 111);
  assert(source_context_pop(scanner));
  assert(source_context_pop(scanner));
  assert(bracket_cache(scanner) == cache);
  assert(cache == &scanner->contexts[0].bracket);
  consume_context_remaining(scanner, 110);
  assert(cache->collating_absent_end == 0);
  assert(cache->collating_closer_from == 0);
  assert(cache->collating_closer_end == 10);
  assert(cache->element_remaining == 1);
  consume_context_remaining(scanner, 8);
  assert(collating_cached(cache));
  consume_context_remaining(scanner, 1);
  assert(!collating_cached(cache));
  assert(cache->element_remaining == 0);
  assert(source_context_pop(scanner));
  assert(source_context_push(scanner, EXTGLOB_OPEN));
  assert(source_context_push(scanner, EXTGLOB_OPEN));
  assert(top_context(scanner)->count == 2);
  top_context(scanner)->bracket.collating_absent_end = 100;
  assert(source_context_push(scanner, EXTGLOB_OPEN));
  assert(scanner->context_count == 2);
  assert(!collating_absent_in(bracket_cache(scanner), 50));
  assert(source_context_pop(scanner));
  assert(collating_absent_in(bracket_cache(scanner), 50));
  assert(source_context_pop(scanner));
  assert(top_context(scanner)->count == 1);
  assert(!collating_absent_in(bracket_cache(scanner), 50));
  bash_scanner_destroy(scanner);
}

static void test_repeated_contexts_fit_serialization_budget(void) {
  const size_t repeated_contexts = 4096;
  struct Scanner *scanner = bash_scanner_create();
  assert(scanner != NULL && scanner_source_ready(scanner));
  for (size_t count = 0; count < repeated_contexts; count += 1) {
    assert(source_context_push(scanner, COMMAND_OPEN));
  }
  char state[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
  unsigned length = snapshot(scanner, state);
  bash_scanner_deserialize(scanner, state, length);
  assert(scanner->context_count == 1);
  assert(scanner->contexts[0].count == repeated_contexts);
  for (size_t count = 0; count < repeated_contexts; count += 1) {
    assert(source_context_pop(scanner));
  }
  assert(scanner->context_count == 0);
  bash_scanner_destroy(scanner);
}

static void test_truncated_and_malformed_states_stay_bounded(void) {
  struct Scanner *scanner = bash_scanner_create();
  assert(scanner != NULL && scanner_source_ready(scanner));
  assert(source_context_push(scanner, DQ_OPEN));
  char valid[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
  unsigned length = snapshot(scanner, valid);
  char state[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
  for (unsigned end = 0; end < length; end += 1) {
    bash_scanner_deserialize(scanner, valid, end);
    assert(scanner->context_count == 0 && scanner->source.stage_count == 0);
    snapshot(scanner, state);
  }
  const uint32_t random_seed = 1;
  const uint32_t random_multiplier = UINT32_C(1664525);
  const uint32_t random_increment = UINT32_C(1013904223);
  uint32_t random = random_seed;
  for (unsigned end = 1; end <= sizeof(state); end += 1) {
    for (unsigned index = 0; index < end; index += 1) {
      random = random * random_multiplier + random_increment;
      state[index] = (char)(random >> (sizeof(random) * CHAR_BIT - CHAR_BIT));
    }
    state[0] = SCANNER_SERIALIZATION_VERSION;
    bash_scanner_deserialize(scanner, state, end);
    snapshot(scanner, valid);
  }
  bash_scanner_destroy(scanner);
}

static void test_regex_boundaries_round_trip_across_nested_substitutions(void) {
  const size_t regex_group_depth = 8192;
  struct Scanner *scanner = bash_scanner_create();
  assert(scanner != NULL && scanner_source_ready(scanner));
  assert(source_context_push(scanner, REGEX_START));
  for (size_t count = 0; count < regex_group_depth; count++) {
    assert(source_context_commit(scanner, REGEX_OPEN));
  }
  assert(source_context_push(scanner, COMMAND_OPEN));
  assert(source_context_push(scanner, REGEX_START));
  assert(source_context_commit(scanner, ERE_MEMBER_OPEN_BEGIN));
  char state[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
  unsigned length = snapshot(scanner, state);
  bash_scanner_deserialize(scanner, state, length);
  assert(scanner->context_count == 3);
  assert(scanner->contexts[0].regex_depth == regex_group_depth);
  assert(scanner->contexts[0].regex_started);
  assert(scanner->contexts[2].regex_depth == 1);
  assert(scanner->contexts[2].regex_started);
  assert(source_context_commit(scanner, ERE_MEMBER_CLOSE_BEGIN));
  assert(scanner->contexts[2].regex_depth == 0);
  assert(source_context_pop(scanner));
  assert(source_context_pop(scanner));
  assert(scanner->contexts[0].regex_depth == regex_group_depth);
  bash_scanner_destroy(scanner);
}

static void test_brace_word_extent_survives_nested_substitutions(void) {
  const size_t outer_characters = 257;
  const size_t inner_characters = 43;
  struct Scanner *scanner = bash_scanner_create();
  assert(scanner != NULL && scanner_source_ready(scanner));
  assert(source_context_push(scanner, BRACE_WORD_START));
  scanner->contexts[0].word_remaining = outer_characters;
  scanner->contexts[0].brace_suppressed_remaining = 31;
  assert(source_context_push(scanner, BRACE_OPEN));
  assert(source_context_push(scanner, EXTGLOB_OPEN));
  assert(source_context_push(scanner, COMMAND_OPEN));
  assert(word_source_context(scanner, true) == NULL);
  assert(source_context_push(scanner, BRACE_WORD_START));
  scanner->contexts[4].word_remaining = inner_characters;
  scanner->contexts[4].brace_suppressed_remaining = 9;
  scanner->contexts[4].brace_free = true;
  char state[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
  unsigned length = snapshot(scanner, state);
  bash_scanner_deserialize(scanner, state, length);
  assert(scanner->context_count == 5);
  assert(
    word_source_context(scanner, true)->word_remaining == inner_characters
  );
  assert(word_source_context(scanner, true)->brace_free);
  assert(word_source_context(scanner, true)->brace_suppressed_remaining == 9);
  TSLexer brace_probe = {.lookahead = ','};
  assert(brace_suppressed(scanner, &brace_probe));
  consume_context_remaining(scanner, 9);
  assert(!brace_suppressed(scanner, &brace_probe));
  assert(source_context_pop(scanner));
  assert(word_source_context(scanner, true) == NULL);
  assert(!brace_suppressed(scanner, &brace_probe));
  assert(source_context_pop(scanner));
  assert(
    word_source_context(scanner, true)->word_remaining == outer_characters - 9
  );
  assert(!word_source_context(scanner, true)->brace_free);
  assert(word_source_context(scanner, true)->brace_suppressed_remaining == 22);
  assert(!brace_boundary(scanner, &brace_probe));
  consume_context_remaining(scanner, 22);
  assert(brace_boundary(scanner, &brace_probe));
  assert(source_context_pop(scanner));
  assert(source_context_pop(scanner));
  assert(!brace_boundary(scanner, &brace_probe));
  assert(source_context_pop(scanner));
  assert(word_source_context(scanner, true) == NULL);
  bash_scanner_destroy(scanner);
}

static void test_assignment_head_extent_survives_nested_words(void) {
  const enum TokenType openers[] =
    {BRACE_WORD_START, DECLARATION_ASSIGNMENT_START, ASSIGNMENT_ARGUMENT_START};
  for (size_t index = 0; index < ARRAY_COUNT(openers); index++) {
    struct Scanner *scanner = bash_scanner_create();
    assert(scanner != NULL && scanner_source_ready(scanner));
    assert(source_context_push(scanner, openers[index]));
    scanner->contexts[0].assignment_head_remaining = 33;
    assert(source_context_push(scanner, COMMAND_OPEN));
    assert(assignment_argument_context(scanner) == NULL);
    assert(source_context_push(scanner, ASSIGNMENT_ARGUMENT_START));
    scanner->contexts[2].assignment_head_remaining = 17;
    assert(source_context_push(scanner, ASSIGNMENT_FALLBACK_LITERAL_BEGIN));
    char state[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
    unsigned length = snapshot(scanner, state);
    bash_scanner_deserialize(scanner, state, length);
    assert(scanner->context_count == 4);
    assert(
      assignment_argument_context(scanner)->assignment_head_remaining == 17
    );
    consume_context_remaining(scanner, 7);
    assert(
      assignment_argument_context(scanner)->assignment_head_remaining == 10
    );
    assert(source_context_push(scanner, DQ_OPEN));
    assert(assignment_argument_context(scanner) == NULL);
    consume_context_remaining(scanner, 12);
    assert(source_context_pop(scanner));
    assert(
      assignment_argument_context(scanner)->assignment_head_remaining == 0
    );
    assert(source_context_pop(scanner));
    assert(source_context_pop(scanner));
    assert(assignment_argument_context(scanner) == NULL);
    assert(source_context_pop(scanner));
    assert(
      assignment_argument_context(scanner)->assignment_head_remaining == 14
    );
    consume_context_remaining(scanner, 14);
    assert(
      assignment_argument_context(scanner)->assignment_head_remaining == 0
    );
    bash_scanner_destroy(scanner);
  }
}

static void test_arithmetic_field_extent_survives_nested_expansions(void) {
  const size_t outer_characters = 257;
  const size_t inner_characters = 43;
  const enum TokenType openers[] = {
    PARAMETER_SUBSTRING_BEGIN,
    BRACKET_ARITHMETIC_OPEN
  };
  for (size_t index = 0; index < ARRAY_COUNT(openers); index++) {
    struct Scanner *scanner = bash_scanner_create();
    assert(scanner != NULL && scanner_source_ready(scanner));
    assert(source_context_push(scanner, PARAMETER_OPEN));
    if (openers[index] == PARAMETER_SUBSTRING_BEGIN) {
      assert(source_context_push(scanner, PARAMETER_OPEN));
      assert(source_context_commit(scanner, PARAMETER_SUBSTRING_BEGIN));
    } else {
      assert(source_context_commit(scanner, BRACKET_ARITHMETIC_OPEN));
    }
    assert(scanner->contexts[0].opener == PARAMETER_OPEN);
    scanner->contexts[1].arithmetic_field_remaining = outer_characters;
    assert(source_context_push(scanner, DQ_OPEN));
    assert(source_context_push(scanner, PARAMETER_OPEN));
    assert(source_context_commit(scanner, SUBSTRING_SEPARATOR_BEGIN));
    scanner->contexts[3].arithmetic_field_remaining = inner_characters;
    char state[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
    unsigned length = snapshot(scanner, state);
    bash_scanner_deserialize(scanner, state, length);
    assert(scanner->context_count == 4);
    assert(arithmetic_field_remaining(scanner) == inner_characters);
    consume_context_remaining(scanner, 3);
    assert(arithmetic_field_remaining(scanner) == inner_characters - 3);
    assert(source_context_pop(scanner));
    assert(arithmetic_field_remaining(scanner) == 0);
    assert(source_context_pop(scanner));
    assert(arithmetic_field_remaining(scanner) == outer_characters - 3);
    if (openers[index] == BRACKET_ARITHMETIC_OPEN) {
      assert(source_context_commit(scanner, BRACKET_ARITHMETIC_CLOSE));
      assert(top_context_opener(scanner) == PARAMETER_OPEN);
    }
    bash_scanner_destroy(scanner);
  }
}

struct SourceTestInput {
  const int32_t *characters;
  size_t length;
  size_t position;
  size_t calls;
  bool fail;
};

static enum SourceResult source_test_read(void *payload, int32_t *value) {
  struct SourceTestInput *input = payload;
  input->calls += 1;
  if (input->fail) {
    return SOURCE_FAILURE;
  }
  if (input->position == input->length) {
    return SOURCE_END;
  }
  *value = input->characters[input->position++];
  return SOURCE_CHARACTER;
}

static void source_expect(
  struct SourceCursor *cursor,
  const int32_t *expected,
  size_t length
) {
  for (size_t index = 0; index < length; index += 1) {
    struct SourceCharacter character;
    assert(source_next(cursor, &character) == SOURCE_CHARACTER);
    assert(character.value == expected[index]);
  }
  struct SourceCharacter character;
  assert(source_next(cursor, &character) == SOURCE_END);
}

static void
test_source_reading_removes_nul_and_preserves_scalar_positions(void) {
  const int32_t input[] = {'a', 0, 0x1f642, '\\', '\n', 'b'};
  struct SourceTestInput reader = {input, ARRAY_LENGTH(input), 0, 0, false};
  struct SourceStage stage = source_stage(SOURCE_REMOVE_CONTINUATIONS);
  struct SourceCursor cursor;
  assert(source_cursor_init(&cursor, &stage, 1, source_test_read, &reader));
  const int32_t expected[] = {'a', 0x1f642, 'b'};
  source_expect(&cursor, expected, ARRAY_LENGTH(expected));
  assert(cursor.logical[1].origin.start == 2);
  assert(cursor.logical[1].origin.end == 3);
  assert(cursor.logical[2].origin.start == 5);
  assert(cursor.removal_count == 1);
  assert(cursor.removals[0].slash == 3);
  assert(cursor.removals[0].origin.start == 4);
  assert(cursor.removals[0].origin.end == 5);
  source_cursor_clear(&cursor);

  reader = (struct SourceTestInput){input, ARRAY_LENGTH(input), 0, 0, false};
  stage.disabled = true;
  assert(source_cursor_init(&cursor, &stage, 1, source_test_read, &reader));
  const int32_t quoted[] = {'a', 0x1f642, '\\', '\n', 'b'};
  source_expect(&cursor, quoted, ARRAY_LENGTH(quoted));
  assert(cursor.removal_count == 0);
  source_cursor_clear(&cursor);
}

static void
test_nul_removal_precedes_continuations_and_snapshot_resumption(void) {
  const int32_t input[] = {'a', '\\', 0, 0, '\n', 'b', 0};
  struct SourceStage stage = source_stage(SOURCE_REMOVE_CONTINUATIONS);
  for (size_t cut = 0; cut <= ARRAY_LENGTH(input); cut += 1) {
    struct SourceCursor cursor;
    assert(source_cursor_init(&cursor, &stage, 1, NULL, NULL));
    for (size_t index = 0; index < cut; index += 1) {
      assert(source_feed(&cursor, input[index]));
    }
    struct SourceSnapshot snapshot = {0};
    assert(source_checkpoint(&cursor, &snapshot));
    uint8_t bytes[SOURCE_STATE_CAPACITY];
    size_t length;
    assert(source_snapshot_serialize(&snapshot, bytes, sizeof(bytes), &length));
    source_snapshot_clear(&snapshot);
    assert(source_snapshot_deserialize(&snapshot, bytes, length));
    size_t before = cursor.logical_count;
    if (before > 0) assert(cursor.logical[0].value == 'a');
    if (before > 1) assert(cursor.logical[1].value == 'b');
    assert(before <= 2);
    source_cursor_clear(&cursor);
    struct SourceTestInput reader =
      {input + cut, ARRAY_LENGTH(input) - cut, 0, 0, false};
    assert(source_cursor_resume(&cursor, &snapshot, source_test_read, &reader));
    const int32_t expected[] = {'a', 'b'};
    source_expect(&cursor, expected + before, ARRAY_LENGTH(expected) - before);
    if (cut < 5) {
      assert(cursor.removal_count == 1);
      assert(cursor.removals[0].slash == 1 - (int64_t)cut);
    }
    source_snapshot_clear(&snapshot);
    source_cursor_clear(&cursor);
  }
}

static void test_ancestor_removal_survives_local_quoting(void) {
  struct SourceStage stages[] = {
    source_stage(SOURCE_REMOVE_CONTINUATIONS),
    source_stage(SOURCE_REMOVE_CONTINUATIONS),
  };
  stages[1].disabled = true;
  const int32_t input[] = {'x', '\\', '\n', 'y'};
  struct SourceTestInput reader = {input, ARRAY_LENGTH(input), 0, 0, false};
  struct SourceCursor cursor;
  assert(source_cursor_init(
    &cursor,
    stages,
    ARRAY_LENGTH(stages),
    source_test_read,
    &reader
  ));
  const int32_t expected[] = {'x', 'y'};
  source_expect(&cursor, expected, ARRAY_LENGTH(expected));
  assert(cursor.removal_count == 1);
  assert(cursor.removals[0].stage == 0);
  assert(cursor.removals[0].slash == 1);
  source_cursor_clear(&cursor);
}

static void test_backquote_source_records_units_and_boundaries(void) {
  const int32_t input[] = {'\\', '\\', '\\', '$', '\\', '`', '`'};
  struct SourceTestInput reader = {input, ARRAY_LENGTH(input), 0, 0, false};
  struct SourceStage stage = source_stage(SOURCE_BACKQUOTE_DECODE);
  struct SourceCursor cursor;
  assert(source_cursor_init(&cursor, &stage, 1, source_test_read, &reader));
  const int32_t expected[] = {'\\', '$', '`', '`'};
  source_expect(&cursor, expected, ARRAY_LENGTH(expected));
  assert(cursor.logical[0].origin.start == 0);
  assert(cursor.logical[0].origin.end == 2);
  assert(cursor.logical[0].origin.character == 1);
  assert(cursor.logical[1].origin.start == 2);
  assert(cursor.logical[1].origin.character == 3);
  assert(cursor.logical[2].boundary_stage == SIZE_MAX);
  assert(cursor.logical[3].boundary_stage == 0);
  source_cursor_clear(&cursor);

  struct SourceStage stages[] = {stage, stage};
  const int32_t nested[] = {'\\', '`'};
  reader = (struct SourceTestInput){nested, ARRAY_LENGTH(nested), 0, 0, false};
  assert(source_cursor_init(
    &cursor,
    stages,
    ARRAY_LENGTH(stages),
    source_test_read,
    &reader
  ));
  const int32_t tick[] = {'`'};
  source_expect(&cursor, tick, ARRAY_LENGTH(tick));
  assert(cursor.logical[0].boundary_stage == 1);
  assert(cursor.logical[0].origin.start == 0);
  assert(cursor.logical[0].origin.character == 1);
  source_cursor_clear(&cursor);

  const int32_t nested_opener[] = {'\\', '\\', '\\', '`'};
  reader = (struct SourceTestInput){
    nested_opener,
    ARRAY_LENGTH(nested_opener),
    0,
    0,
    false
  };
  assert(source_cursor_init(
    &cursor,
    stages,
    ARRAY_LENGTH(stages),
    source_test_read,
    &reader
  ));
  source_expect(&cursor, tick, ARRAY_LENGTH(tick));
  assert(cursor.logical[0].boundary_stage == SIZE_MAX);
  assert(cursor.logical[0].origin.start == 0);
  assert(cursor.logical[0].origin.end == 4);
  assert(cursor.logical[0].origin.character == 3);
  source_cursor_clear(&cursor);
}

static void test_source_pass_order_controls_removal(void) {
  const int32_t input[] = {'\\', '\\', '\n'};
  const int32_t literal[] = {'\\', '\n'};
  struct SourceStage stages[] = {
    source_stage(SOURCE_REMOVE_CONTINUATIONS),
    source_stage(SOURCE_BACKQUOTE_DECODE),
  };
  struct SourceCursor cursor;
  struct SourceTestInput reader = {input, ARRAY_LENGTH(input), 0, 0, false};
  assert(source_cursor_init(
    &cursor,
    stages,
    ARRAY_LENGTH(stages),
    source_test_read,
    &reader
  ));
  source_expect(&cursor, literal, ARRAY_LENGTH(literal));
  assert(cursor.removal_count == 0);
  source_cursor_clear(&cursor);

  stages[0] = source_stage(SOURCE_BACKQUOTE_DECODE);
  stages[1] = source_stage(SOURCE_REMOVE_CONTINUATIONS);
  reader = (struct SourceTestInput){input, ARRAY_LENGTH(input), 0, 0, false};
  assert(source_cursor_init(
    &cursor,
    stages,
    ARRAY_LENGTH(stages),
    source_test_read,
    &reader
  ));
  source_expect(&cursor, NULL, 0);
  assert(cursor.removal_count == 1);
  assert(cursor.removals[0].slash == 1);
  source_cursor_clear(&cursor);
}

static void test_adjacent_runs_and_bare_newlines_follow_each_pass(void) {
  struct SourceStage stages[] = {
    source_stage(SOURCE_REMOVE_CONTINUATIONS),
    source_stage(SOURCE_BACKQUOTE_DECODE),
    source_stage(SOURCE_REMOVE_CONTINUATIONS),
    source_stage(SOURCE_BACKQUOTE_DECODE),
  };
  stages[1].quoted = true;
  stages[3].quoted = true;
  const int32_t retained[] = {'\\', '\\', '\\', '\n', '\\', '\\', '\n', 'w'};
  const int32_t continued[] = {
    '\\',
    '\\',
    '\\',
    '\n',
    '\\',
    '\\',
    '\\',
    '\\',
    '\n',
    'w',
  };
  const int32_t bare[] = {'\\', '\\', '\\', '\n', '\n', 'w'};
  const struct {
    const int32_t *input;
    size_t length;
    int32_t output[3];
    size_t output_length;
    size_t removal_count;
    int64_t second_slash;
  } cases[] = {
    {retained, ARRAY_LENGTH(retained), {'\\', '\n', 'w'}, 3, 1, 0},
    {continued, ARRAY_LENGTH(continued), {'\\', 'w'}, 2, 2, 7},
    {bare, ARRAY_LENGTH(bare), {'w'}, 1, 2, INT64_MIN},
  };
  for (size_t index = 0; index < ARRAY_LENGTH(cases); index += 1) {
    struct SourceTestInput reader =
      {cases[index].input, cases[index].length, 0, 0, false};
    struct SourceCursor cursor;
    assert(source_cursor_init(
      &cursor,
      stages,
      ARRAY_LENGTH(stages),
      source_test_read,
      &reader
    ));
    source_expect(&cursor, cases[index].output, cases[index].output_length);
    assert(cursor.removal_count == cases[index].removal_count);
    assert(cursor.removals[0].slash == 2);
    if (cursor.removal_count == 2) {
      assert(cursor.removals[1].slash == cases[index].second_slash);
      assert(cursor.removals[1].stage == 2);
    }
    source_cursor_clear(&cursor);
  }
}

static void test_tab_stripping_follows_joined_line_starts(void) {
  struct SourceStage stages[] = {
    source_stage(SOURCE_REMOVE_CONTINUATIONS),
    source_stage(SOURCE_STRIP_LEADING_TABS),
  };
  const int32_t input[] = {'\t', '\\', '\n', '\t', 'I', 'N', '\n'};
  const int32_t expected[] = {'I', 'N', '\n'};
  struct SourceTestInput reader = {input, ARRAY_LENGTH(input), 0, 0, false};
  struct SourceCursor cursor;
  assert(source_cursor_init(
    &cursor,
    stages,
    ARRAY_LENGTH(stages),
    source_test_read,
    &reader
  ));
  source_expect(&cursor, expected, ARRAY_LENGTH(expected));
  assert(cursor.removal_count == 3);
  assert(cursor.removals[0].kind == SOURCE_REMOVED_TAB);
  assert(cursor.removals[1].kind == SOURCE_REMOVED_CONTINUATION);
  assert(cursor.removals[2].kind == SOURCE_REMOVED_TAB);
  source_cursor_clear(&cursor);

  const int32_t spaced[] = {' ', '\\', '\n', '\t', 'I', 'N', '\n'};
  const int32_t spaced_expected[] = {' ', '\t', 'I', 'N', '\n'};
  reader = (struct SourceTestInput){spaced, ARRAY_LENGTH(spaced), 0, 0, false};
  assert(source_cursor_init(
    &cursor,
    stages,
    ARRAY_LENGTH(stages),
    source_test_read,
    &reader
  ));
  source_expect(&cursor, spaced_expected, ARRAY_LENGTH(spaced_expected));
  assert(cursor.removal_count == 1);
  source_cursor_clear(&cursor);
}

static void test_every_raw_cut_restores_pending_source_without_rereading(void) {
  const int32_t input[] = {
    'a',
    '\\',
    '\\',
    '\\',
    '\n',
    '\\',
    '\\',
    '\n',
    'b',
    '\\',
    '\\',
    '\\',
    '\n',
    0,
    0,
    '\n',
    0x1f642,
    '\\'
  };
  const size_t count = ARRAY_LENGTH(input);
  struct SourceStage stages[] = {
    source_stage(SOURCE_REMOVE_CONTINUATIONS),
    source_stage(SOURCE_BACKQUOTE_DECODE),
    source_stage(SOURCE_REMOVE_CONTINUATIONS),
    source_stage(SOURCE_BACKQUOTE_DECODE),
  };
  struct SourceTestInput reader = {input, count, 0, 0, false};
  struct SourceCursor cursor;
  assert(source_cursor_init(
    &cursor,
    stages,
    ARRAY_LENGTH(stages),
    source_test_read,
    &reader
  ));
  struct SourceCharacter character;
  while (source_next(&cursor, &character) == SOURCE_CHARACTER) {
  }
  assert(!cursor.failed);
  size_t reads = reader.calls;
  for (size_t cut = 0; cut <= count; cut += 1) {
    struct SourceSnapshot snapshot = {0};
    assert(source_snapshot_at(&cursor, cut, &snapshot));
    assert(reader.calls == reads);
    assert(snapshot.raw_position == (int64_t)cut);
    uint8_t encoded[SOURCE_STATE_CAPACITY];
    size_t length;
    assert(
      source_snapshot_serialize(&snapshot, encoded, sizeof(encoded), &length)
    );
    struct SourceSnapshot restored = {0};
    assert(source_snapshot_deserialize(&restored, encoded, length));
    struct SourceTestInput suffix = {input + cut, count - cut, 0, 0, false};
    struct SourceCursor resumed;
    assert(
      source_cursor_resume(&resumed, &restored, source_test_read, &suffix)
    );
    size_t index = snapshot.logical_count;
    while (source_next(&resumed, &character) == SOURCE_CHARACTER) {
      assert(index < cursor.logical_count);
      const struct SourceCharacter *expected = &cursor.logical[index++];
      assert(character.value == expected->value);
      assert(character.origin.start + (int64_t)cut == expected->origin.start);
      assert(character.origin.end + (int64_t)cut == expected->origin.end);
      assert(
        character.origin.character + (int64_t)cut == expected->origin.character
      );
      assert(character.boundary_stage == expected->boundary_stage);
    }
    assert(!resumed.failed);
    assert(index == cursor.logical_count);
    assert(
      snapshot.removal_count + resumed.removal_count == cursor.removal_count
    );
    for (size_t event = 0; event < resumed.removal_count; event += 1) {
      const struct SourceRemoval *actual = &resumed.removals[event];
      const struct SourceRemoval *expected =
        &cursor.removals[snapshot.removal_count + event];
      assert(actual->kind == expected->kind);
      assert(actual->origin.start + (int64_t)cut == expected->origin.start);
      assert(
        actual->slash == INT64_MIN
          ? expected->slash == INT64_MIN
          : actual->slash + (int64_t)cut == expected->slash
      );
    }
    source_cursor_clear(&resumed);
    source_snapshot_clear(&restored);
    source_snapshot_clear(&snapshot);
  }
  source_cursor_clear(&cursor);
}

static void test_snapshot_capacity_and_invalid_data_are_transactional(void) {
  struct SourceStage stage = source_stage(SOURCE_REMOVE_CONTINUATIONS);
  struct SourceCursor cursor;
  assert(source_cursor_init(&cursor, &stage, 1, NULL, NULL));
  assert(source_feed(&cursor, '\\'));
  struct SourceSnapshot snapshot = {0};
  assert(source_checkpoint(&cursor, &snapshot));
  uint8_t encoded[SOURCE_STATE_CAPACITY];
  size_t length;
  assert(
    source_snapshot_serialize(&snapshot, encoded, sizeof(encoded), &length)
  );
  size_t unchanged = length;
  uint8_t shortened[SOURCE_STATE_CAPACITY];
  assert(!source_snapshot_serialize(&snapshot, shortened, length - 1, &length));
  assert(length == 0);
  assert(snapshot.stages[0].has_pending);
  for (size_t prefix = 0; prefix < unchanged; prefix += 1) {
    assert(!source_snapshot_deserialize(&snapshot, encoded, prefix));
    assert(snapshot.stages[0].has_pending);
  }
  const uint8_t invalid_stage_kind = 9;
  const uint8_t invalid[] = {1, 0, invalid_stage_kind, 0};
  assert(!source_snapshot_deserialize(&snapshot, invalid, sizeof(invalid)));
  assert(snapshot.stages[0].has_pending);
  source_snapshot_clear(&snapshot);
  source_cursor_clear(&cursor);
}

static void
test_checkpoint_reuses_storage_and_preserves_snapshot_on_failure(void) {
  struct SourceStage stages[] = {
    source_stage(SOURCE_REMOVE_CONTINUATIONS),
    source_stage(SOURCE_BACKQUOTE_DECODE),
  };
  struct SourceCursor cursor;
  assert(source_cursor_init(&cursor, stages, 1, NULL, NULL));
  assert(source_feed(&cursor, '\\'));
  struct SourceSnapshot snapshot = {0};
  assert(source_checkpoint(&cursor, &snapshot));
  assert(snapshot.raw_position == 1);
  assert(snapshot.stages[0].has_pending);
  struct SourceStage *storage = snapshot.stages;
  assert(source_feed(&cursor, '\n'));
#ifdef TREE_SITTER_REUSE_ALLOCATOR
  size_t allocations = reuse_allocation_calls;
#endif
  assert(source_checkpoint(&cursor, &snapshot));
  assert(snapshot.stages == storage);
#ifdef TREE_SITTER_REUSE_ALLOCATOR
  assert(reuse_allocation_calls == allocations);
#endif
  assert(snapshot.raw_position == 2);
  assert(snapshot.removal_count == 1);
  assert(!snapshot.stages[0].has_pending);
  source_cursor_clear(&cursor);

  assert(source_cursor_init(&cursor, stages, ARRAY_LENGTH(stages), NULL, NULL));
#ifdef TREE_SITTER_REUSE_ALLOCATOR
  reuse_fail_allocation_call = reuse_allocation_calls + 1;
  assert(!source_checkpoint(&cursor, &snapshot));
  reuse_fail_allocation_call = 0;
  assert(snapshot.stages == storage);
  assert(snapshot.stage_count == 1);
  assert(snapshot.raw_position == 2);
  assert(snapshot.removal_count == 1);
#endif
  assert(source_checkpoint(&cursor, &snapshot));
  assert(snapshot.stage_count == 2);
  assert(snapshot.raw_position == 0);
  assert(snapshot.removal_count == 0);
  source_cursor_clear(&cursor);
  assert(source_checkpoint(&cursor, &snapshot));
  assert(snapshot.stage_count == 0 && snapshot.stages == NULL);
  source_snapshot_clear(&snapshot);
#ifdef TREE_SITTER_REUSE_ALLOCATOR
  assert(reuse_live_allocations == 0);
#endif
}

static void test_source_reader_failure_releases_owned_memory(void) {
  const int32_t input[] = {'a', '\\', '\n', 'b'};
  struct SourceStage stages[] = {
    source_stage(SOURCE_REMOVE_CONTINUATIONS),
    source_stage(SOURCE_BACKQUOTE_DECODE),
  };
  struct SourceTestInput reader = {
    .characters = input,
    .length = ARRAY_LENGTH(input),
    .fail = true,
  };
  struct SourceCursor cursor;
  assert(source_cursor_init(
    &cursor,
    stages,
    ARRAY_LENGTH(stages),
    source_test_read,
    &reader
  ));
  struct SourceCharacter character;
  assert(source_next(&cursor, &character) == SOURCE_FAILURE);
  source_cursor_clear(&cursor);
}

#ifdef TREE_SITTER_REUSE_ALLOCATOR
static void test_source_failures_release_owned_memory(void) {
  struct SourceStage stages[] = {
    source_stage(SOURCE_REMOVE_CONTINUATIONS),
    source_stage(SOURCE_BACKQUOTE_DECODE),
  };
  const int32_t input[] = {'a', '\\', '\n', 'b'};
  size_t allocation_count = 0;
  for (size_t failure = 0; failure <= allocation_count; failure += 1) {
    assert(reuse_live_allocations == 0);
    size_t calls = reuse_allocation_calls;
    if (failure > 0) reuse_fail_allocation_call = calls + failure;
    struct SourceTestInput reader = {
      .characters = input,
      .length = ARRAY_LENGTH(input)
    };
    struct SourceCursor cursor;
    bool initialized = source_cursor_init(
      &cursor,
      stages,
      ARRAY_LENGTH(stages),
      source_test_read,
      &reader
    );
    bool completed = false;
    bool saved = false;
    if (initialized) {
      struct SourceCharacter character;
      enum SourceResult result;
      do {
        result = source_next(&cursor, &character);
      } while (result == SOURCE_CHARACTER);
      completed = result == SOURCE_END;
      struct SourceSnapshot snapshot = {0};
      saved = source_checkpoint(&cursor, &snapshot);
      source_snapshot_clear(&snapshot);
    }
    if (failure == 0) {
      allocation_count = reuse_allocation_calls - calls;
      assert(allocation_count > 0);
      assert(initialized && completed && saved);
    } else {
      assert(reuse_allocation_calls >= reuse_fail_allocation_call);
      assert(!initialized || !completed || !saved);
      reuse_fail_allocation_call = 0;
    }
    source_cursor_clear(&cursor);
    assert(reuse_live_allocations == 0);
  }
}
#endif

struct SourceNativeMock {
  TSLexer lexer;
  const int32_t *input;
  size_t length;
  size_t position;
  size_t advances;
  size_t marks;
};

static void source_native_advance(TSLexer *lexer, bool skip) {
  struct SourceNativeMock *mock = (struct SourceNativeMock *)lexer;
  assert(!skip);
  assert(mock->position < mock->length);
  mock->position += 1;
  mock->advances += 1;
  lexer->lookahead =
    mock->position < mock->length ? mock->input[mock->position] : 0;
}

static void source_native_mark(TSLexer *lexer) {
  struct SourceNativeMock *mock = (struct SourceNativeMock *)lexer;
  mock->marks += 1;
}

static bool source_native_eof(const TSLexer *lexer) {
  const struct SourceNativeMock *mock = (const struct SourceNativeMock *)lexer;
  return mock->position == mock->length;
}

static void source_native_init(
  struct SourceNativeMock *mock,
  const int32_t *input,
  size_t length
) {
  *mock = (struct SourceNativeMock){
    .lexer =
      {
        .lookahead = length > 0 ? input[0] : 0,
        .advance = source_native_advance,
        .mark_end = source_native_mark,
        .eof = source_native_eof,
      },
    .input = input,
    .length = length,
  };
}

static void test_logical_context_changes_reclassify_cached_lookahead(void) {
  const int32_t input[] = {'\'', '\\', '\n', 'x', '\'', '\\', '\n', 'y'};
  struct SourceNativeMock mock;
  source_native_init(&mock, input, ARRAY_LENGTH(input));
  struct NativeInput native = {.lexer = &mock.lexer};
  struct SourceStage local = source_stage(SOURCE_REMOVE_CONTINUATIONS);
  struct SourceSnapshot initial = {.stages = &local, .stage_count = 1};
  struct LogicalLexer logical;
  assert(logical_init(&logical, &native, &initial));
  assert(logical.lexer.lookahead == '\'');
  logical.lexer.mark_end(&logical.lexer);
  logical.lexer.advance(&logical.lexer, false);
  assert(logical.lexer.lookahead == 'x');
  assert(logical.consumed == 1);
  assert(mock.position == 4);

  struct SourceStage quoted = local;
  quoted.disabled = true;
  assert(logical_replace_view(&logical, 0, &quoted, 1));
  assert(logical.lexer.lookahead == '\\');
  assert(logical.base == 1);
  assert(logical.mark == 0);
  assert(mock.position == 4);
  logical.lexer.advance(&logical.lexer, false);
  assert(logical.lexer.lookahead == '\n');
  logical.lexer.advance(&logical.lexer, false);
  assert(logical.lexer.lookahead == 'x');
  logical.lexer.advance(&logical.lexer, false);
  assert(logical.lexer.lookahead == '\'');
  logical.lexer.advance(&logical.lexer, false);
  assert(logical.lexer.lookahead == '\\');
  assert(logical.consumed == 5);

  assert(logical_replace_view(&logical, 0, &local, 1));
  assert(logical.lexer.lookahead == 'y');
  assert(logical.base == 5);
  assert(logical.cursor.removal_count == 1);
  assert(logical.cursor.removals[0].slash == 0);
  logical.lexer.advance(&logical.lexer, false);
  assert(logical.lexer.eof(&logical.lexer));
  assert(mock.advances == ARRAY_LENGTH(input));
  assert(mock.marks == 0);
  logical_clear(&logical);
  native_input_clear(&native);
}

static void
test_logical_backquote_closers_belong_to_the_innermost_active_view(void) {
  const struct {
    int32_t input[4];
    size_t length;
    size_t decoders;
    bool disable_inner;
    size_t boundary;
    bool closes;
  } fixtures[] = {
    {{'`'}, 1, 1, false, 0, true},
    {{'`'}, 1, 2, false, 0, false},
    {{'\\', '`'}, 2, 2, false, 2, true},
    {{'\\', '\\', '\\', '`'}, 4, 2, false, SIZE_MAX, false},
    {{'\\', '`'}, 2, 3, false, 2, false},
    {{'\\', '\\', '\\', '`'}, 4, 3, false, 4, true},
    {{'`'}, 1, 2, true, 0, true},
    {{'\\', '`'}, 2, 2, true, SIZE_MAX, false},
  };
  assert(!logical_backquote_end(NULL));
  for (size_t fixture = 0; fixture < ARRAY_LENGTH(fixtures); fixture += 1) {
    enum { MAX_BACKQUOTE_DECODERS = 3, STAGES_PER_DECODER = 2 };
    struct SourceStage stages[MAX_BACKQUOTE_DECODERS * STAGES_PER_DECODER];
    size_t count = STAGES_PER_DECODER * fixtures[fixture].decoders;
    assert(count <= ARRAY_LENGTH(stages));
    for (size_t index = 0; index < count; index += STAGES_PER_DECODER) {
      stages[index] = source_stage(SOURCE_BACKQUOTE_DECODE);
      stages[index + 1] = source_stage(SOURCE_REMOVE_CONTINUATIONS);
    }
    stages[count - STAGES_PER_DECODER].disabled =
      fixtures[fixture].disable_inner;
    struct SourceSnapshot initial = {.stages = stages, .stage_count = count};
    struct SourceNativeMock mock;
    source_native_init(
      &mock,
      fixtures[fixture].input,
      fixtures[fixture].length
    );
    struct NativeInput native = {.lexer = &mock.lexer};
    struct LogicalLexer logical;
    assert(logical_init(&logical, &native, &initial));
    assert(logical.character.value == '`');
    assert(logical.character.boundary_stage == fixtures[fixture].boundary);
    assert(logical_backquote_end(&logical) == fixtures[fixture].closes);
    assert(logical.character.origin.start == 0);
    assert(logical.character.origin.end == (int64_t)fixtures[fixture].length);
    for (size_t cut = 0; cut < fixtures[fixture].length; cut += 1) {
      struct SourceSnapshot snapshot = {0};
      assert(source_snapshot_at(&logical.cursor, cut, &snapshot));
      uint8_t bytes[SOURCE_STATE_CAPACITY];
      size_t length;
      assert(
        source_snapshot_serialize(&snapshot, bytes, sizeof(bytes), &length)
      );
      struct SourceSnapshot restored = {0};
      assert(source_snapshot_deserialize(&restored, bytes, length));
      struct SourceNativeMock resumed_mock;
      source_native_init(
        &resumed_mock,
        fixtures[fixture].input + cut,
        fixtures[fixture].length - cut
      );
      struct NativeInput resumed_native = {.lexer = &resumed_mock.lexer};
      struct LogicalLexer resumed;
      assert(logical_init(&resumed, &resumed_native, &restored));
      assert(resumed.character.boundary_stage == fixtures[fixture].boundary);
      assert(logical_backquote_end(&resumed) == fixtures[fixture].closes);
      assert(resumed.character.origin.start == -(int64_t)cut);
      assert(
        resumed.character.origin.end ==
        (int64_t)(fixtures[fixture].length - cut)
      );
      resumed.lexer.advance(&resumed.lexer, false);
      assert(resumed.lexer.eof(&resumed.lexer));
      assert(!logical_backquote_end(&resumed));
      assert(resumed_mock.advances == fixtures[fixture].length - cut);
      assert(resumed_mock.marks == 0);
      logical_clear(&resumed);
      native_input_clear(&resumed_native);
      source_snapshot_clear(&restored);
      source_snapshot_clear(&snapshot);
    }
    if (
      fixtures[fixture].decoders == 2 &&
      fixtures[fixture].length == 1 &&
      !fixtures[fixture].disable_inner
    ) {
      struct LogicalLexer outer;
      assert(logical_fork(&outer, &logical, 0, 2, NULL, 0));
      assert(logical_backquote_end(&outer));
      assert(!logical_backquote_end(&logical));
      logical_clear(&outer);
    }
    logical_clear(&logical);
    native_input_clear(&native);
  }
}

static void test_logical_forks_preserve_ancestor_pending_units(void) {
  const int32_t input[] = {'\\', '\n', 'x'};
  struct SourceNativeMock mock;
  source_native_init(&mock, input, ARRAY_LENGTH(input));
  struct NativeInput native = {.lexer = &mock.lexer};
  struct SourceStage stages[] = {
    source_stage(SOURCE_REMOVE_CONTINUATIONS),
    source_stage(SOURCE_REMOVE_CONTINUATIONS),
  };
  struct SourceSnapshot initial = {.stages = stages, .stage_count = 2};
  struct LogicalLexer parent;
  assert(logical_init(&parent, &native, &initial));
  assert(parent.lexer.lookahead == 'x');
  struct SourceStage quoted = stages[1];
  quoted.disabled = true;
  struct LogicalLexer child;
  assert(logical_fork(&child, &parent, 0, 1, &quoted, 1));
  assert(child.lexer.lookahead == 'x');
  assert(child.cursor.removal_count == 1);
  assert(child.cursor.removals[0].stage == 0);
  assert(parent.base == 0);
  assert(parent.lexer.lookahead == 'x');
  logical_clear(&child);

  assert(logical_fork(&child, &parent, 1, 2, NULL, 0));
  assert(child.lexer.lookahead == 'x');
  assert(child.base == 1);
  assert(child.cursor.removals[0].slash == -1);
  assert(child.cursor.removals[0].origin.start == 0);
  logical_clear(&child);
  assert(!logical_fork(&child, &parent, 1, 0, &quoted, 1));
  logical_clear(&child);
  logical_rewind(&parent);
  assert(parent.lexer.lookahead == 'x');
  assert(mock.advances == ARRAY_LENGTH(input));
  assert(mock.marks == 0);
  logical_clear(&parent);
  native_input_clear(&native);

  source_native_init(&mock, input, ARRAY_LENGTH(input));
  native = (struct NativeInput){.lexer = &mock.lexer};
  struct SourceStage literal[] = {quoted, quoted};
  struct SourceSnapshot comment = {.stages = literal, .stage_count = 2};
  assert(logical_init(&parent, &native, &comment));
  assert(parent.lexer.lookahead == '\\');
  parent.lexer.advance(&parent.lexer, false);
  assert(parent.lexer.lookahead == '\n');
  assert(parent.consumed == 1);
  assert(logical_fork(&child, &parent, parent.consumed, 1, &stages[1], 1));
  assert(child.lexer.lookahead == '\n');
  child.lexer.advance(&child.lexer, false);
  assert(child.lexer.lookahead == 'x');
  assert(child.cursor.removal_count == 0);
  logical_clear(&child);
  logical_clear(&parent);
  native_input_clear(&native);
}

#ifdef TREE_SITTER_REUSE_ALLOCATOR
static void test_logical_fork_allocation_failures_preserve_parent(void) {
  const int32_t input[] = {'a', '\\', '\n', 'b'};
  size_t allocation_count = 0;
  for (size_t failure = 0; failure <= allocation_count; failure += 1) {
    struct SourceNativeMock mock;
    source_native_init(&mock, input, ARRAY_LENGTH(input));
    struct NativeInput native = {.lexer = &mock.lexer};
    struct SourceStage stage = source_stage(SOURCE_REMOVE_CONTINUATIONS);
    struct SourceSnapshot initial = {.stages = &stage, .stage_count = 1};
    struct LogicalLexer parent;
    assert(logical_init(&parent, &native, &initial));
    assert(parent.lexer.lookahead == 'a');
    size_t calls = reuse_allocation_calls;
    if (failure > 0) reuse_fail_allocation_call = calls + failure;
    struct LogicalLexer child;
    bool accepted = logical_fork(&child, &parent, 0, 0, &stage, 1);
    if (failure == 0) {
      allocation_count = reuse_allocation_calls - calls;
      assert(allocation_count > 0);
      assert(accepted);
    } else {
      assert(reuse_allocation_calls >= reuse_fail_allocation_call);
      assert(!accepted);
      reuse_fail_allocation_call = 0;
    }
    assert(parent.lexer.lookahead == 'a');
    assert(parent.base == 0);
    logical_clear(&child);
    logical_clear(&parent);
    native_input_clear(&native);
    assert(reuse_live_allocations == 0);
  }
}
#endif

static void test_logical_resume_does_not_repeat_already_emitted_source(void) {
  const int32_t prefix[] = {'\\', '\\', '\\'};
  struct SourceStage stages[] = {
    source_stage(SOURCE_BACKQUOTE_DECODE),
    source_stage(SOURCE_REMOVE_CONTINUATIONS),
  };
  struct SourceCursor cursor;
  assert(source_cursor_init(&cursor, stages, ARRAY_LENGTH(stages), NULL, NULL));
  for (size_t index = 0; index < ARRAY_LENGTH(prefix); index += 1) {
    assert(source_feed(&cursor, prefix[index]));
  }
  struct SourceSnapshot snapshot = {0};
  assert(source_checkpoint(&cursor, &snapshot));
  const int32_t suffix[] = {']'};
  struct SourceNativeMock mock;
  source_native_init(&mock, suffix, ARRAY_LENGTH(suffix));
  struct NativeInput native = {.lexer = &mock.lexer};
  struct LogicalLexer input;
  assert(logical_init(&input, &native, &snapshot));
  assert(input.lexer.lookahead == ']');
  assert(input.character.origin.start == 0);
  assert(input.character.origin.end == 1);
  input.lexer.advance(&input.lexer, false);
  assert(input.lexer.eof(&input.lexer));
  assert(mock.advances == 1);
  logical_clear(&input);
  native_input_clear(&native);
  source_snapshot_clear(&snapshot);
  source_cursor_clear(&cursor);
}

static void test_recovery_reads_nested_documents_and_resumes_the_host(void) {
  struct Scanner scanner = {0};
  assert(scanner_source_ready(&scanner));
  assert(append_document(&scanner.pending, make_document("OUT", false, false)));
  assert(activate_startable_pending_documents(&scanner));
  assert(source_context_push(&scanner, HERE_DOCUMENT_BODY_START));
  assert(source_context_push(&scanner, COMMAND_OPEN));
  scanner.substitution_depth = 1;
  for (size_t index = 0; index < 2; index++) {
    struct HereDocument doc =
      make_document(index == 0 ? "A" : "B", index == 1, false);
    assert(append_pending_document(&scanner, doc));
  }
  const char *source = "fi\nA\n$HOME\nB\n";
  assert(activate_startable_pending_documents(&scanner));
  const struct {
    enum TokenType symbol;
    size_t consumed;
  } expected[] = {
    {HERE_DOCUMENT_BODY_START, 0},
    {HERE_DOCUMENT_CONTENT_LINE_START, 0},
    {HERE_DOCUMENT_TEXT_BEGIN, 0},
    {HERE_DOCUMENT_TEXT_BEGIN_PIECE, 2},
    {NEWLINE, 0},
    {NEWLINE_BEGIN_PIECE, 1},
    {HERE_DOCUMENT_END_BEGIN, 0},
    {HERE_DOCUMENT_END_TEXT_BEGIN, 0},
    {HERE_DOCUMENT_END_TEXT_BEGIN_PIECE, 1},
    {HERE_DOCUMENT_END_LINE_END, 0},
    {HERE_DOCUMENT_END_LINE_END_BEGIN_PIECE, 1},
    {HERE_DOCUMENT_END_COMMIT, 0},
    {QUOTED_HERE_DOCUMENT_BODY_START, 0},
    {HERE_DOCUMENT_CONTENT_LINE_START, 0},
    {QUOTED_HERE_DOCUMENT_TEXT, 0},
    {QUOTED_HERE_DOCUMENT_TEXT_BEGIN_PIECE, 5},
    {NEWLINE, 0},
    {NEWLINE_BEGIN_PIECE, 1},
    {QUOTED_HERE_DOCUMENT_END_BEGIN, 0},
    {QUOTED_HERE_DOCUMENT_END_TEXT, 0},
    {QUOTED_HERE_DOCUMENT_END_TEXT_BEGIN_PIECE, 1},
    {HERE_DOCUMENT_END_LINE_END, 0},
    {HERE_DOCUMENT_END_LINE_END_BEGIN_PIECE, 1},
    {HERE_DOCUMENT_END_COMMIT, 0},
    {HERE_DOCUMENT_SEQUENCE_END, 0},
  };
  int32_t input[MOCK_INPUT_CAPACITY];
  size_t length = strlen(source);
  assert(length < ARRAY_LENGTH(input));
  for (size_t index = 0; index < length; index++) input[index] = source[index];
  bool valid[TOKEN_COUNT];
  for (size_t index = 0; index < TOKEN_COUNT; index++) valid[index] = true;
  size_t offset = 0;
  for (size_t index = 0; index < ARRAY_LENGTH(expected); index++) {
    char state[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
    unsigned state_length = snapshot(&scanner, state);
    bash_scanner_deserialize(&scanner, state, state_length);
    struct MockLexer lexer;
    init_mock_lexer(&lexer, input + offset, length - offset);
#ifdef TREE_SITTER_REUSE_ALLOCATOR
    size_t first_allocation = reuse_allocation_calls;
#endif
    assert(bash_scanner_scan(&scanner, &lexer.lexer, valid));
    assert(lexer.lexer.result_symbol == expected[index].symbol);
    assert(lexer.mark == expected[index].consumed);
#ifdef TREE_SITTER_REUSE_ALLOCATOR
    size_t allocation_count = reuse_allocation_calls - first_allocation;
    size_t live_allocations = reuse_live_allocations;
    for (size_t failure = 1; failure <= allocation_count; failure++) {
      struct Scanner failed = {0};
      bash_scanner_deserialize(&failed, state, state_length);
      struct MockLexer attempt;
      init_mock_lexer(&attempt, input + offset, length - offset);
      reuse_fail_allocation_call = reuse_allocation_calls + failure;
      bool accepted = bash_scanner_scan(&failed, &attempt.lexer, valid);
      reuse_fail_allocation_call = 0;
      assert(!accepted);
      assert_scanner_matches_snapshot(&failed, state, state_length);
      clear_scanner(&failed);
      assert(reuse_live_allocations == live_allocations);
    }
#endif
    offset += lexer.mark;
  }
  assert(offset == length);
  assert(scanner.suspended_frame_count == 0);
  assert(scanner.active.documents.count == 1);
  assert(scanner.active.documents.data[0].delimiter_length == 3);
  assert(memcmp(scanner.active.documents.data[0].delimiter, "OUT", 3) == 0);
  assert(scanner.context_count == 2);
  assert(top_context_opener(&scanner) == COMMAND_OPEN);
  assert(!scanner.emission.active);
  assert(!scanner.sequence_end_pending);
  clear_scanner(&scanner);
}

static void
test_recovery_finishes_unterminated_documents_without_end_text(void) {
  struct Scanner scanner = {0};
  assert(scanner_source_ready(&scanner));
  for (size_t index = 0; index < 2; index++) {
    struct HereDocument doc = make_document("E", index == 1, false);
    assert(append_document(&scanner.pending, doc));
  }
  assert(activate_startable_pending_documents(&scanner));
  const enum TokenType expected[] = {
    HERE_DOCUMENT_BODY_START,
    HERE_DOCUMENT_END_COMMIT,
    QUOTED_HERE_DOCUMENT_BODY_START,
    HERE_DOCUMENT_END_COMMIT,
    HERE_DOCUMENT_SEQUENCE_END,
  };
  bool valid[TOKEN_COUNT];
  for (size_t index = 0; index < TOKEN_COUNT; index++) valid[index] = true;
  for (size_t index = 0; index < ARRAY_LENGTH(expected); index++) {
    struct MockLexer lexer;
    init_mock_lexer(&lexer, NULL, 0);
    assert(bash_scanner_scan(&scanner, &lexer.lexer, valid));
    assert(lexer.lexer.result_symbol == expected[index]);
    assert(lexer.mark == 0);
    char state[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
    unsigned length = snapshot(&scanner, state);
    bash_scanner_deserialize(&scanner, state, length);
  }
  assert(scanner.pending.count == 0);
  assert(scanner.active.documents.count == 0);
  assert(scanner.context_count == 0);
  assert(!scanner.sequence_end_pending);
  clear_scanner(&scanner);
}

#ifdef TREE_SITTER_REUSE_ALLOCATOR
static void test_local_lookahead_failures_leave_no_state_or_allocations(void) {
  const struct {
    const char *source;
    enum TokenType token;
    bool accepted;
  } fixtures[] = {
    {"foo\\\nbar", VARIABLE_NAME_BEGIN, true},
    {"<(cat <<E\nbody\nE\n)name()", FNAME_TOKEN, true},
    {"x[$(printf 0)]=~", ASSIGNMENT_ARGUMENT_START, true},
    {":() { :; }", FNAME_TOKEN, true},
    {" E\n", HERE_END_BEGIN, false},
  };
  for (size_t fixture = 0; fixture < ARRAY_LENGTH(fixtures); fixture++) {
    size_t allocation_count = 0;
    for (size_t failure = 0; failure <= allocation_count; failure++) {
      struct Scanner scanner = {0};
      assert(scanner_source_ready(&scanner));
      if (fixture == 0) {
        struct HereDocument document = make_document("E", false, false);
        assert(append_document(&scanner.pending, document));
      }
      char before[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
      unsigned before_length = snapshot(&scanner, before);
      int32_t input[MOCK_INPUT_CAPACITY];
      size_t length = strlen(fixtures[fixture].source);
      assert(length < ARRAY_LENGTH(input));
      for (size_t index = 0; index < length; index++)
        input[index] = (unsigned char)fixtures[fixture].source[index];
      struct MockLexer mock;
      init_mock_lexer(&mock, input, length);
      bool valid[TOKEN_COUNT] = {0};
      valid[fixtures[fixture].token] = true;
      size_t calls = reuse_allocation_calls;
      if (failure > 0) reuse_fail_allocation_call = calls + failure;
      bool accepted = bash_scanner_scan(&scanner, &mock.lexer, valid);
      reuse_fail_allocation_call = 0;
      if (failure == 0) {
        allocation_count = reuse_allocation_calls - calls;
        assert(accepted == fixtures[fixture].accepted && allocation_count > 0);
      } else {
        assert(!accepted);
      }
      if (!accepted)
        assert_scanner_matches_snapshot(&scanner, before, before_length);
      clear_scanner(&scanner);
      assert(reuse_live_allocations == 0);
    }
  }
}
#endif

int main(void) {
  test_recovery_finishes_unterminated_documents_without_end_text();
  test_recovery_reads_nested_documents_and_resumes_the_host();
  test_source_reading_removes_nul_and_preserves_scalar_positions();
  test_nul_removal_precedes_continuations_and_snapshot_resumption();
  test_ancestor_removal_survives_local_quoting();
  test_backquote_source_records_units_and_boundaries();
  test_source_pass_order_controls_removal();
  test_adjacent_runs_and_bare_newlines_follow_each_pass();
  test_tab_stripping_follows_joined_line_starts();
  test_every_raw_cut_restores_pending_source_without_rereading();
  test_snapshot_capacity_and_invalid_data_are_transactional();
  test_checkpoint_reuses_storage_and_preserves_snapshot_on_failure();
  test_source_reader_failure_releases_owned_memory();
  test_logical_context_changes_reclassify_cached_lookahead();
  test_logical_backquote_closers_belong_to_the_innermost_active_view();
  test_logical_forks_preserve_ancestor_pending_units();
  test_logical_resume_does_not_repeat_already_emitted_source();

  test_recovery_preserves_reserved_tokens_and_separator_layout();
  test_here_document_activation_preserves_queues_and_suspended_frames();
  test_pending_documents_preserve_state_up_to_serialization_capacity();
  test_pending_here_document_sequence_preserves_state();
  test_delimiter_quote_removal_retains_quoted_newlines();
  test_delimiter_read_preserves_bytes_and_distinguishes_failures();
  test_here_document_input_stops_before_nested_source_can_cross_its_end();
  test_here_document_end_restores_its_source_and_serialized_depth();
  test_scanner_copy_owns_nested_state_and_preserves_source_on_failure();
  test_nested_context_round_trip_and_reset();
  test_substitution_end_closes_its_owner_and_retains_outer_documents();
  test_substitution_end_does_not_cross_input_boundaries();
  test_parameter_quote_changes_preserve_compressed_parents();
  test_pattern_range_state_round_trip();
  test_bracket_cache_round_trips_and_stays_in_context();
  test_repeated_contexts_fit_serialization_budget();
  test_truncated_and_malformed_states_stay_bounded();
  test_regex_boundaries_round_trip_across_nested_substitutions();
  test_brace_word_extent_survives_nested_substitutions();
  test_assignment_head_extent_survives_nested_words();
  test_arithmetic_field_extent_survives_nested_expansions();
#ifdef TREE_SITTER_REUSE_ALLOCATOR
  test_local_lookahead_failures_leave_no_state_or_allocations();
  test_delimiter_allocation_failures_preserve_the_failure_reason();
  test_source_failures_release_owned_memory();
  test_logical_fork_allocation_failures_preserve_parent();
  assert(reuse_live_allocations == 0);
#endif
  return 0;
}
