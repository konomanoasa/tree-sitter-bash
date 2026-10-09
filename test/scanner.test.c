#include <assert.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#include SCANNER_TEST_ENTRY

#ifdef TREE_SITTER_REUSE_ALLOCATOR
void *(*ts_current_malloc)(size_t) = malloc;
void *(*ts_current_calloc)(size_t, size_t) = calloc;
void *(*ts_current_realloc)(void *, size_t) = realloc;
void (*ts_current_free)(void *) = free;
#endif

static unsigned snapshot(struct Scanner *scanner, char *state) {
  char guarded[TREE_SITTER_SERIALIZATION_BUFFER_SIZE + 2];
  memset(guarded, 0x55, sizeof(guarded));
  unsigned length = bash_scanner_serialize(scanner, guarded + 1);
  assert(length > 0 && length <= TREE_SITTER_SERIALIZATION_BUFFER_SIZE);
  assert(guarded[0] == 0x55);
  assert(guarded[sizeof(guarded) - 1] == 0x55);
  memcpy(state, guarded + 1, length);
  return length;
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

static void test_repeated_contexts_fit_serialization_budget(void) {
  struct Scanner *scanner = bash_scanner_create();
  assert(scanner != NULL && scanner_source_ready(scanner));
  for (size_t count = 0; count < 4096; count += 1) {
    assert(source_context_push(scanner, COMMAND_OPEN));
  }
  char state[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
  unsigned length = snapshot(scanner, state);
  bash_scanner_deserialize(scanner, state, length);
  assert(scanner->context_count == 1);
  assert(scanner->contexts[0].count == 4096);
  for (size_t count = 0; count < 4096; count += 1) {
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
  uint32_t random = 1;
  for (unsigned end = 1; end <= sizeof(state); end += 1) {
    for (unsigned index = 0; index < end; index += 1) {
      random = random * UINT32_C(1664525) + UINT32_C(1013904223);
      state[index] = (char)(random >> 24);
    }
    state[0] = SCANNER_SERIALIZATION_VERSION;
    bash_scanner_deserialize(scanner, state, end);
    snapshot(scanner, valid);
  }
  bash_scanner_destroy(scanner);
}

static void test_regex_boundaries_round_trip_across_nested_substitutions(void) {
  struct Scanner *scanner = bash_scanner_create();
  assert(scanner != NULL && scanner_source_ready(scanner));
  assert(source_context_push(scanner, REGEX_START));
  for (size_t count = 0; count < 8192; count++) {
    assert(source_context_commit(scanner, REGEX_OPEN));
  }
  assert(source_context_push(scanner, COMMAND_OPEN));
  assert(source_context_push(scanner, REGEX_START));
  assert(source_context_commit(scanner, ERE_MEMBER_OPEN_BEGIN));
  char state[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
  unsigned length = snapshot(scanner, state);
  bash_scanner_deserialize(scanner, state, length);
  assert(scanner->context_count == 3);
  assert(scanner->contexts[0].regex_depth == 8192);
  assert(scanner->contexts[0].regex_started);
  assert(scanner->contexts[2].regex_depth == 1);
  assert(scanner->contexts[2].regex_started);
  assert(source_context_commit(scanner, ERE_MEMBER_CLOSE_BEGIN));
  assert(scanner->contexts[2].regex_depth == 0);
  assert(source_context_pop(scanner));
  assert(source_context_pop(scanner));
  assert(scanner->contexts[0].regex_depth == 8192);
  bash_scanner_destroy(scanner);
}

static void test_brace_word_extent_survives_nested_substitutions(void) {
  struct Scanner *scanner = bash_scanner_create();
  assert(scanner != NULL && scanner_source_ready(scanner));
  assert(source_context_push(scanner, BRACE_WORD_START));
  scanner->contexts[0].word_remaining = 257;
  assert(source_context_push(scanner, BRACE_OPEN));
  assert(source_context_push(scanner, EXTGLOB_OPEN));
  assert(source_context_push(scanner, COMMAND_OPEN));
  assert(word_source_context(scanner, true) == NULL);
  assert(source_context_push(scanner, BRACE_WORD_START));
  scanner->contexts[4].word_remaining = 43;
  scanner->contexts[4].brace_free = true;
  char state[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
  unsigned length = snapshot(scanner, state);
  bash_scanner_deserialize(scanner, state, length);
  assert(scanner->context_count == 5);
  assert(word_source_context(scanner, true)->word_remaining == 43);
  assert(word_source_context(scanner, true)->brace_free);
  assert(source_context_pop(scanner));
  assert(word_source_context(scanner, true) == NULL);
  assert(source_context_pop(scanner));
  assert(word_source_context(scanner, true)->word_remaining == 257);
  assert(!word_source_context(scanner, true)->brace_free);
  assert(brace_boundary(scanner, ','));
  assert(source_context_pop(scanner));
  assert(source_context_pop(scanner));
  assert(!brace_boundary(scanner, ','));
  assert(source_context_pop(scanner));
  assert(word_source_context(scanner, true) == NULL);
  bash_scanner_destroy(scanner);
}

static void test_substring_operand_extent_survives_nested_expansions(void) {
  struct Scanner *scanner = bash_scanner_create();
  assert(scanner != NULL && scanner_source_ready(scanner));
  assert(source_context_push(scanner, PARAMETER_OPEN));
  assert(source_context_push(scanner, PARAMETER_OPEN));
  assert(source_context_commit(scanner, PARAMETER_SUBSTRING_BEGIN));
  assert(scanner->contexts[0].opener == PARAMETER_OPEN);
  scanner->contexts[1].substring_remaining = 257;
  assert(source_context_push(scanner, DQ_OPEN));
  assert(source_context_push(scanner, PARAMETER_OPEN));
  assert(source_context_commit(scanner, SUBSTRING_SEPARATOR_BEGIN));
  scanner->contexts[3].substring_remaining = 43;
  char state[TREE_SITTER_SERIALIZATION_BUFFER_SIZE];
  unsigned length = snapshot(scanner, state);
  bash_scanner_deserialize(scanner, state, length);
  assert(scanner->context_count == 4);
  assert(substring_remaining(scanner) == 43);
  assert(source_context_pop(scanner));
  assert(substring_remaining(scanner) == 0);
  assert(source_context_pop(scanner));
  assert(substring_remaining(scanner) == 257);
  bash_scanner_destroy(scanner);
}

int main(void) {
  test_nested_context_round_trip_and_reset();
  test_repeated_contexts_fit_serialization_budget();
  test_truncated_and_malformed_states_stay_bounded();
  test_regex_boundaries_round_trip_across_nested_substitutions();
  test_brace_word_extent_survives_nested_substitutions();
  test_substring_operand_extent_survives_nested_expansions();
  return 0;
}
