#ifndef TREE_SITTER_BASH_ARITHMETIC_H_
#define TREE_SITTER_BASH_ARITHMETIC_H_

#include <stdbool.h>
#include <stdint.h>

enum ArithmeticValidation {
  ARITHMETIC_VALIDATION_INVALID,
  ARITHMETIC_VALIDATION_INCOMPLETE,
  ARITHMETIC_VALIDATION_VALID,
  ARITHMETIC_VALIDATION_RESOURCE_FAILURE,
};

static bool arithmetic_whitespace(int32_t character) {
  return character ==
    ' ' ||
    character ==
    '\t' ||
    character ==
    '\n' ||
    character ==
    '\v' ||
    character == '\f';
}

static bool is_decimal_digit(int32_t character) {
  return character >= '0' && character <= '9';
}

static bool is_hexadecimal_digit(int32_t character) {
  return is_decimal_digit(character) ||
    (character >= 'A' && character <= 'F') ||
    (character >= 'a' && character <= 'f');
}

static bool is_name_start_character(int32_t character) {
  return (character >= 'A' && character <= 'Z') ||
    (character >= 'a' && character <= 'z') ||
    character == '_';
}

static bool is_name_character(int32_t character) {
  return is_name_start_character(character) || is_decimal_digit(character);
}

enum ArithmeticWord {
  ARITHMETIC_WORD_START,
  ARITHMETIC_WORD_NAME,
  ARITHMETIC_WORD_ZERO,
  ARITHMETIC_WORD_OCTAL,
  ARITHMETIC_WORD_DECIMAL,
  ARITHMETIC_WORD_HEX_PREFIX,
  ARITHMETIC_WORD_HEX,
  ARITHMETIC_WORD_FRAGMENT,
};

static enum ArithmeticWord
arithmetic_word_after(enum ArithmeticWord state, int32_t character) {
  switch (state) {
  case ARITHMETIC_WORD_START:
    return is_name_start_character(character) ? ARITHMETIC_WORD_NAME
      : character == '0'                      ? ARITHMETIC_WORD_ZERO
                                              : ARITHMETIC_WORD_DECIMAL;
  case ARITHMETIC_WORD_NAME:
    return ARITHMETIC_WORD_NAME;
  case ARITHMETIC_WORD_ZERO:
    if (character == 'x' || character == 'X')
      return ARITHMETIC_WORD_HEX_PREFIX;
    return character >= '0' && character <= '7' ? ARITHMETIC_WORD_OCTAL
                                                : ARITHMETIC_WORD_FRAGMENT;
  case ARITHMETIC_WORD_OCTAL:
    return character >= '0' && character <= '7' ? state
                                                : ARITHMETIC_WORD_FRAGMENT;
  case ARITHMETIC_WORD_DECIMAL:
    return is_decimal_digit(character) ? state : ARITHMETIC_WORD_FRAGMENT;
  case ARITHMETIC_WORD_HEX_PREFIX:
  case ARITHMETIC_WORD_HEX:
    return is_hexadecimal_digit(character) ? ARITHMETIC_WORD_HEX
                                           : ARITHMETIC_WORD_FRAGMENT;
  case ARITHMETIC_WORD_FRAGMENT:
    return state;
  }
  return ARITHMETIC_WORD_FRAGMENT;
}

static bool arithmetic_word_is_number(enum ArithmeticWord state) {
  return state ==
    ARITHMETIC_WORD_ZERO ||
    state ==
    ARITHMETIC_WORD_OCTAL ||
    state ==
    ARITHMETIC_WORD_DECIMAL ||
    state == ARITHMETIC_WORD_HEX;
}

#endif
