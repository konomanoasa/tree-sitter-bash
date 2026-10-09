#define BASH_EXTGLOB 0
#define BASH_EXTQUOTE 1
#include "../common/scanner.h"

void *tree_sitter_bash_external_scanner_create(void) {
  return bash_scanner_create();
}

void tree_sitter_bash_external_scanner_destroy(void *payload) {
  bash_scanner_destroy(payload);
}

unsigned
tree_sitter_bash_external_scanner_serialize(void *payload, char *buffer) {
  return bash_scanner_serialize(payload, buffer);
}

void tree_sitter_bash_external_scanner_deserialize(
  void *payload,
  const char *buffer,
  unsigned length
) {
  bash_scanner_deserialize(payload, buffer, length);
}

bool tree_sitter_bash_external_scanner_scan(
  void *payload,
  TSLexer *lexer,
  const bool *valid_symbols
) {
  return bash_scanner_scan(payload, lexer, valid_symbols);
}
