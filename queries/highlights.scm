[
  (literal
    !fragment)
  (pattern_star_source
    !fragment)
  (pattern_question_source
    !fragment)
  (pattern_bracket_character_source
    !fragment)
  (pattern_bracket_hyphen_source
    !fragment)
  (pattern_bracket_range_operator_source
    !fragment)
  (pattern_bracket_negation_source
    !fragment)
  (pattern_character_class_content_source
    !fragment)
  (pattern_collating_symbol_character_source
    !fragment)
  (pattern_equivalence_class_character_source
    !fragment)
  (single_quote_content
    !fragment)
  (double_quote_text
    !fragment)
  (dollar_single_quote_text
    !fragment)
  (here_document_text
    !fragment)
  (quoted_here_document_text
    !fragment)
] @string

(literal
  fragment: (lexeme_fragment) @string)

(pattern_star_source
  fragment: (lexeme_fragment) @string)

(pattern_question_source
  fragment: (lexeme_fragment) @string)

(pattern_bracket_character_source
  fragment: (lexeme_fragment) @string)

(pattern_bracket_hyphen_source
  fragment: (lexeme_fragment) @string)

(pattern_bracket_range_operator_source
  fragment: (lexeme_fragment) @string)

(pattern_bracket_negation_source
  fragment: (lexeme_fragment) @string)

(pattern_character_class_content_source
  fragment: (lexeme_fragment) @string)

(pattern_collating_symbol_character_source
  fragment: (lexeme_fragment) @string)

(pattern_equivalence_class_character_source
  fragment: (lexeme_fragment) @string)

(single_quote_content
  fragment: (lexeme_fragment) @string)

(double_quote_text
  fragment: (lexeme_fragment) @string)

(dollar_single_quote_text
  fragment: (lexeme_fragment) @string)

(here_document_text
  fragment: (lexeme_fragment) @string)

(quoted_here_document_text
  fragment: (lexeme_fragment) @string)

(pattern_bracket_source
  [
    "["
    "]"
  ] @string)

(pattern_character_class_source
  [
    "["
    ":"
    "]"
  ] @string)

(pattern_collating_symbol_source
  [
    "["
    "."
    "]"
  ] @string)

(pattern_equivalence_class_source
  [
    "["
    "="
    "]"
  ] @string)

[
  (escaped_character
    !fragment)
  (double_quote_escape
    !fragment)
  (dollar_single_quote_escape
    !fragment)
  (here_document_escape
    !fragment)
] @string.escape

(escaped_character
  fragment: (lexeme_fragment) @string.escape)

(double_quote_escape
  fragment: (lexeme_fragment) @string.escape)

(dollar_single_quote_escape
  fragment: (lexeme_fragment) @string.escape)

(here_document_escape
  fragment: (lexeme_fragment) @string.escape)

(comment_text
  !fragment) @comment

(comment_text
  fragment: (lexeme_fragment) @comment)

[
  (arithmetic_number
    !fragment)
  (io_number
    !fragment)
] @number

(arithmetic_number
  fragment: (lexeme_fragment) @number)

(io_number
  fragment: (lexeme_fragment) @number)

[
  (arithmetic_variable
    !fragment)
  (variable_name
    !fragment)
  (name
    !fragment)
] @variable

(arithmetic_variable
  fragment: (lexeme_fragment) @variable)

(variable_name
  fragment: (lexeme_fragment) @variable)

(name
  fragment: (lexeme_fragment) @variable)

(positional_parameter
  !fragment) @variable.parameter

(positional_parameter
  fragment: (lexeme_fragment) @variable.parameter)

(special_parameter
  !fragment) @variable.builtin

(special_parameter
  fragment: (lexeme_fragment) @variable.builtin)

(function_name
  !fragment) @function

(function_name
  fragment: (lexeme_fragment) @function)

[
  (if_keyword
    !fragment)
  (then_keyword
    !fragment)
  (elif_keyword
    !fragment)
  (else_keyword
    !fragment)
  (fi_keyword
    !fragment)
  (for_keyword
    !fragment)
  (in_keyword
    !fragment)
  (do_keyword
    !fragment)
  (done_keyword
    !fragment)
  (case_keyword
    !fragment)
  (esac_keyword
    !fragment)
  (while_keyword
    !fragment)
  (until_keyword
    !fragment)
] @keyword

(if_keyword
  fragment: (lexeme_fragment) @keyword)

(then_keyword
  fragment: (lexeme_fragment) @keyword)

(elif_keyword
  fragment: (lexeme_fragment) @keyword)

(else_keyword
  fragment: (lexeme_fragment) @keyword)

(fi_keyword
  fragment: (lexeme_fragment) @keyword)

(for_keyword
  fragment: (lexeme_fragment) @keyword)

(in_keyword
  fragment: (lexeme_fragment) @keyword)

(do_keyword
  fragment: (lexeme_fragment) @keyword)

(done_keyword
  fragment: (lexeme_fragment) @keyword)

(case_keyword
  fragment: (lexeme_fragment) @keyword)

(esac_keyword
  fragment: (lexeme_fragment) @keyword)

(while_keyword
  fragment: (lexeme_fragment) @keyword)

(until_keyword
  fragment: (lexeme_fragment) @keyword)

[
  (arithmetic_operator
    !fragment)
  (parameter_length_operator
    !fragment)
  (parameter_value_operator
    !fragment)
  (parameter_pattern_operator
    !fragment)
  (and_if
    !fragment)
  (or_if
    !fragment)
  (bang
    !fragment)
  (dsemi
    !fragment)
  (semi_and
    !fragment)
] @operator

(arithmetic_operator
  fragment: (lexeme_fragment) @operator)

(parameter_length_operator
  fragment: (lexeme_fragment) @operator)

(parameter_value_operator
  fragment: (lexeme_fragment) @operator)

(parameter_pattern_operator
  fragment: (lexeme_fragment) @operator)

(and_if
  fragment: (lexeme_fragment) @operator)

(or_if
  fragment: (lexeme_fragment) @operator)

(bang
  fragment: (lexeme_fragment) @operator)

(dsemi
  fragment: (lexeme_fragment) @operator)

(semi_and
  fragment: (lexeme_fragment) @operator)

[
  (lessand
    !fragment)
  (greatand
    !fragment)
  (dgreat
    !fragment)
  (lessgreat
    !fragment)
  (clobber
    !fragment)
  (dless
    !fragment)
  (dlessdash
    !fragment)
] @operator

(lessand
  fragment: (lexeme_fragment) @operator)

(greatand
  fragment: (lexeme_fragment) @operator)

(dgreat
  fragment: (lexeme_fragment) @operator)

(lessgreat
  fragment: (lexeme_fragment) @operator)

(clobber
  fragment: (lexeme_fragment) @operator)

(dless
  fragment: (lexeme_fragment) @operator)

(dlessdash
  fragment: (lexeme_fragment) @operator)

(io_file
  operator: [
    "<"
    ">"
  ] @operator)

(assignment_word
  "=" @operator)

[
  "&"
  "|"
] @operator

";" @punctuation.delimiter

[
  "{"
  "}"
] @punctuation.bracket

[
  (function_definition
    [
      "("
      ")"
    ] @punctuation.bracket)
  (subshell
    [
      "("
      ")"
    ] @punctuation.bracket)
  (case_item
    ")" @punctuation.bracket)
  (pattern_list
    "(" @punctuation.bracket)
  (array_assignment
    [
      "("
      ")"
    ] @punctuation.bracket)
  (process_substitution
    [
      "("
      ")"
    ] @punctuation.bracket)
  (extglob_pattern
    [
      "("
      ")"
    ] @punctuation.bracket)
  (extglob_group
    [
      "("
      ")"
    ] @punctuation.bracket)
  (command_substitution
    [
      "("
      ")"
    ] @punctuation.bracket)
  (conditional_group
    [
      "("
      ")"
    ] @punctuation.bracket)
  (ere_expression
    [
      "("
      ")"
    ] @punctuation.bracket)
  (regex_source_expression
    "(" @punctuation.bracket)
  (arithmetic_command
    [
      "("
      ")"
    ] @punctuation.bracket)
  (arithmetic_for_clause
    ")" @punctuation.bracket)
  (arithmetic_expansion
    [
      "("
      ")"
      "["
      "]"
    ] @punctuation.bracket)
  (parenthesized_arithmetic
    [
      "("
      ")"
    ] @punctuation.bracket)
  (parenthesized_arithmetic_source
    [
      "("
      ")"
    ] @punctuation.bracket)
]

(parameter_expansion
  "$" @variable
  parameter: (_))

(command_substitution
  "$" @punctuation.special)

(arithmetic_expansion
  "$" @punctuation.special)

(single_quoted
  "'" @punctuation.delimiter)

(double_quoted
  "\"" @punctuation.delimiter)

(dollar_single_quoted
  [
    "$"
    "'"
  ] @punctuation.delimiter)

(backquote_substitution
  "`" @punctuation.delimiter)

(tilde_expansion
  "~" @string.special.path)

(tilde_expansion
  user: (tilde_user
    [
      (literal
        !fragment)
      (pattern_star_source
        !fragment)
      (pattern_question_source
        !fragment)
    ] @string.special.path))

(tilde_expansion
  user: (tilde_user
    (literal
      fragment: (lexeme_fragment) @string.special.path)))

(tilde_expansion
  user: (tilde_user
    (pattern_star_source
      fragment: (lexeme_fragment) @string.special.path)))

(tilde_expansion
  user: (tilde_user
    (pattern_question_source
      fragment: (lexeme_fragment) @string.special.path)))

(tilde_user
  (pattern_bracket_source
    [
      "[" @string.special.path
      "]" @string.special.path
      (pattern_bracket_negation_source
        !fragment) @string.special.path
    ]))

(tilde_user
  (pattern_bracket_source
    (pattern_bracket_negation_source
      fragment: (lexeme_fragment) @string.special.path)))

(tilde_user
  (pattern_bracket_source
    (pattern_bracket_members_source
      [
        (pattern_bracket_character_source
          !fragment) @string.special.path
        (pattern_bracket_hyphen_source
          !fragment) @string.special.path
        (pattern_bracket_range_source
          [
            (pattern_bracket_character_source
              !fragment) @string.special.path
            (pattern_bracket_hyphen_source
              !fragment) @string.special.path
            (pattern_bracket_range_operator_source
              !fragment) @string.special.path
            (pattern_collating_symbol_source
              [
                "["
                "."
                "]"
                (pattern_collating_symbol_character_source
                  !fragment)
              ] @string.special.path)
          ])
        (pattern_character_class_source
          [
            "["
            ":"
            "]"
            (pattern_character_class_content_source
              !fragment)
          ] @string.special.path)
        (pattern_collating_symbol_source
          [
            "["
            "."
            "]"
            (pattern_collating_symbol_character_source
              !fragment)
          ] @string.special.path)
        (pattern_equivalence_class_source
          [
            "["
            "="
            "]"
            (pattern_equivalence_class_character_source
              !fragment)
          ] @string.special.path)
      ])))

(tilde_user
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_character_source
        fragment: (lexeme_fragment) @string.special.path))))

(tilde_user
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_hyphen_source
        fragment: (lexeme_fragment) @string.special.path))))

(tilde_user
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_range_source
        (pattern_bracket_character_source
          fragment: (lexeme_fragment) @string.special.path)))))

(tilde_user
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_range_source
        (pattern_bracket_hyphen_source
          fragment: (lexeme_fragment) @string.special.path)))))

(tilde_user
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_range_source
        (pattern_bracket_range_operator_source
          fragment: (lexeme_fragment) @string.special.path)))))

(tilde_user
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_range_source
        (pattern_collating_symbol_source
          (pattern_collating_symbol_character_source
            fragment: (lexeme_fragment) @string.special.path))))))

(tilde_user
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_character_class_source
        (pattern_character_class_content_source
          fragment: (lexeme_fragment) @string.special.path)))))

(tilde_user
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_collating_symbol_source
        (pattern_collating_symbol_character_source
          fragment: (lexeme_fragment) @string.special.path)))))

(tilde_user
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_equivalence_class_source
        (pattern_equivalence_class_character_source
          fragment: (lexeme_fragment) @string.special.path)))))

(here_end
  word: (word
    [
      (literal
        !fragment)
      (pattern_star_source
        !fragment)
      (pattern_question_source
        !fragment)
    ] @label))

(here_end
  word: (word
    (literal
      fragment: (lexeme_fragment) @label)))

(here_end
  word: (word
    (pattern_star_source
      fragment: (lexeme_fragment) @label)))

(here_end
  word: (word
    (pattern_question_source
      fragment: (lexeme_fragment) @label)))

(here_end
  word: (word
    (single_quoted
      (single_quote_content
        !fragment) @label)))

(here_end
  word: (word
    (single_quoted
      (single_quote_content
        fragment: (lexeme_fragment) @label))))

(here_end
  word: (word
    (double_quoted
      (double_quote_text
        !fragment) @label)))

(here_end
  word: (word
    (double_quoted
      (double_quote_text
        fragment: (lexeme_fragment) @label))))

(here_end
  word: (word
    (dollar_single_quoted
      (dollar_single_quote_text
        !fragment) @label)))

(here_end
  word: (word
    (dollar_single_quoted
      (dollar_single_quote_text
        fragment: (lexeme_fragment) @label))))

(here_end
  word: (word
    (pattern_bracket_source
      [
        "[" @label
        "]" @label
        (pattern_bracket_negation_source
          !fragment) @label
        (pattern_bracket_members_source
          [
            (pattern_bracket_character_source
              !fragment) @label
            (pattern_bracket_hyphen_source
              !fragment) @label
            (single_quoted
              (single_quote_content
                !fragment) @label)
            (double_quoted
              (double_quote_text
                !fragment) @label)
            (locale_quoted
              (double_quote_text
                !fragment) @label)
            (dollar_single_quoted
              (dollar_single_quote_text
                !fragment) @label)
            (pattern_bracket_range_source
              [
                (pattern_bracket_character_source
                  !fragment) @label
                (pattern_bracket_hyphen_source
                  !fragment) @label
                (single_quoted
                  (single_quote_content
                    !fragment) @label)
                (double_quoted
                  (double_quote_text
                    !fragment) @label)
                (locale_quoted
                  (double_quote_text
                    !fragment) @label)
                (dollar_single_quoted
                  (dollar_single_quote_text
                    !fragment) @label)
                (pattern_bracket_range_operator_source
                  !fragment) @label
                (pattern_collating_symbol_source
                  [
                    "[" @label
                    "." @label
                    "]" @label
                    (pattern_collating_symbol_character_source
                      !fragment) @label
                    (single_quoted
                      (single_quote_content
                        !fragment) @label)
                    (double_quoted
                      (double_quote_text
                        !fragment) @label)
                    (locale_quoted
                      (double_quote_text
                        !fragment) @label)
                    (dollar_single_quoted
                      (dollar_single_quote_text
                        !fragment) @label)
                  ])
              ])
            (pattern_character_class_source
              [
                "[" @label
                ":" @label
                "]" @label
                (pattern_character_class_content_source
                  !fragment) @label
                (single_quoted
                  (single_quote_content
                    !fragment) @label)
                (double_quoted
                  (double_quote_text
                    !fragment) @label)
                (locale_quoted
                  (double_quote_text
                    !fragment) @label)
                (dollar_single_quoted
                  (dollar_single_quote_text
                    !fragment) @label)
              ])
            (pattern_collating_symbol_source
              [
                "[" @label
                "." @label
                "]" @label
                (pattern_collating_symbol_character_source
                  !fragment) @label
                (single_quoted
                  (single_quote_content
                    !fragment) @label)
                (double_quoted
                  (double_quote_text
                    !fragment) @label)
                (locale_quoted
                  (double_quote_text
                    !fragment) @label)
                (dollar_single_quoted
                  (dollar_single_quote_text
                    !fragment) @label)
              ])
            (pattern_equivalence_class_source
              [
                "[" @label
                "=" @label
                "]" @label
                (pattern_equivalence_class_character_source
                  !fragment) @label
                (single_quoted
                  (single_quote_content
                    !fragment) @label)
                (double_quoted
                  (double_quote_text
                    !fragment) @label)
                (locale_quoted
                  (double_quote_text
                    !fragment) @label)
                (dollar_single_quoted
                  (dollar_single_quote_text
                    !fragment) @label)
              ])
          ])
      ])))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_negation_source
        fragment: (lexeme_fragment) @label))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_character_source
          fragment: (lexeme_fragment) @label)))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_hyphen_source
          fragment: (lexeme_fragment) @label)))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (single_quoted
          (single_quote_content
            fragment: (lexeme_fragment) @label))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (double_quoted
          (double_quote_text
            fragment: (lexeme_fragment) @label))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (locale_quoted
          (double_quote_text
            fragment: (lexeme_fragment) @label))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (dollar_single_quoted
          (dollar_single_quote_text
            fragment: (lexeme_fragment) @label))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_bracket_character_source
            fragment: (lexeme_fragment) @label))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_bracket_hyphen_source
            fragment: (lexeme_fragment) @label))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (single_quoted
            (single_quote_content
              fragment: (lexeme_fragment) @label)))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (double_quoted
            (double_quote_text
              fragment: (lexeme_fragment) @label)))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (locale_quoted
            (double_quote_text
              fragment: (lexeme_fragment) @label)))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (dollar_single_quoted
            (dollar_single_quote_text
              fragment: (lexeme_fragment) @label)))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_bracket_range_operator_source
            fragment: (lexeme_fragment) @label))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_collating_symbol_source
            (pattern_collating_symbol_character_source
              fragment: (lexeme_fragment) @label)))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_collating_symbol_source
            (single_quoted
              (single_quote_content
                fragment: (lexeme_fragment) @label))))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_collating_symbol_source
            (double_quoted
              (double_quote_text
                fragment: (lexeme_fragment) @label))))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_collating_symbol_source
            (locale_quoted
              (double_quote_text
                fragment: (lexeme_fragment) @label))))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_collating_symbol_source
            (dollar_single_quoted
              (dollar_single_quote_text
                fragment: (lexeme_fragment) @label))))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_character_class_source
          (pattern_character_class_content_source
            fragment: (lexeme_fragment) @label))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_character_class_source
          (single_quoted
            (single_quote_content
              fragment: (lexeme_fragment) @label)))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_character_class_source
          (double_quoted
            (double_quote_text
              fragment: (lexeme_fragment) @label)))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_character_class_source
          (locale_quoted
            (double_quote_text
              fragment: (lexeme_fragment) @label)))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_character_class_source
          (dollar_single_quoted
            (dollar_single_quote_text
              fragment: (lexeme_fragment) @label)))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_collating_symbol_source
          (pattern_collating_symbol_character_source
            fragment: (lexeme_fragment) @label))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_collating_symbol_source
          (single_quoted
            (single_quote_content
              fragment: (lexeme_fragment) @label)))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_collating_symbol_source
          (double_quoted
            (double_quote_text
              fragment: (lexeme_fragment) @label)))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_collating_symbol_source
          (locale_quoted
            (double_quote_text
              fragment: (lexeme_fragment) @label)))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_collating_symbol_source
          (dollar_single_quoted
            (dollar_single_quote_text
              fragment: (lexeme_fragment) @label)))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_equivalence_class_source
          (pattern_equivalence_class_character_source
            fragment: (lexeme_fragment) @label))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_equivalence_class_source
          (single_quoted
            (single_quote_content
              fragment: (lexeme_fragment) @label)))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_equivalence_class_source
          (double_quoted
            (double_quote_text
              fragment: (lexeme_fragment) @label)))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_equivalence_class_source
          (locale_quoted
            (double_quote_text
              fragment: (lexeme_fragment) @label)))))))

(here_end
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_equivalence_class_source
          (dollar_single_quoted
            (dollar_single_quote_text
              fragment: (lexeme_fragment) @label)))))))

(here_document_end_text
  !fragment) @label

(here_document_end_text
  fragment: (lexeme_fragment) @label)

(simple_command
  name: (word
    (literal
      !fragment) @function.call))

(simple_command
  name: (word
    (literal
      fragment: (lexeme_fragment) @function.call)))

(parameter_pattern
  [
    (literal
      !fragment) @string.regexp
    (pattern_star_source
      !fragment) @character.special
    (pattern_question_source
      !fragment) @character.special
  ])

(parameter_pattern
  (literal
    fragment: (lexeme_fragment) @string.regexp))

(parameter_pattern
  (pattern_star_source
    fragment: (lexeme_fragment) @character.special))

(parameter_pattern
  (pattern_question_source
    fragment: (lexeme_fragment) @character.special))

(conditional_pattern
  [
    (literal
      !fragment) @string.regexp
    (pattern_star_source
      !fragment) @character.special
    (pattern_question_source
      !fragment) @character.special
  ])

(conditional_pattern
  (literal
    fragment: (lexeme_fragment) @string.regexp))

(conditional_pattern
  (pattern_star_source
    fragment: (lexeme_fragment) @character.special))

(conditional_pattern
  (pattern_question_source
    fragment: (lexeme_fragment) @character.special))

(extglob_alternative
  [
    (literal
      !fragment) @string.regexp
    (pattern_star_source
      !fragment) @character.special
    (pattern_question_source
      !fragment) @character.special
  ])

(extglob_alternative
  (literal
    fragment: (lexeme_fragment) @string.regexp))

(extglob_alternative
  (pattern_star_source
    fragment: (lexeme_fragment) @character.special))

(extglob_alternative
  (pattern_question_source
    fragment: (lexeme_fragment) @character.special))

(pattern_list
  (word
    [
      (literal
        !fragment) @string.regexp
      (pattern_star_source
        !fragment) @character.special
      (pattern_question_source
        !fragment) @character.special
    ]))

(pattern_list
  (word
    (literal
      fragment: (lexeme_fragment) @string.regexp)))

(pattern_list
  (word
    (pattern_star_source
      fragment: (lexeme_fragment) @character.special)))

(pattern_list
  (word
    (pattern_question_source
      fragment: (lexeme_fragment) @character.special)))

(simple_command
  name: (word
    [
      (pattern_star_source
        !fragment) @character.special
      (pattern_question_source
        !fragment) @character.special
    ]))

(simple_command
  name: (word
    (pattern_star_source
      fragment: (lexeme_fragment) @character.special)))

(simple_command
  name: (word
    (pattern_question_source
      fragment: (lexeme_fragment) @character.special)))

(simple_command
  argument: (word
    [
      (pattern_star_source
        !fragment) @character.special
      (pattern_question_source
        !fragment) @character.special
    ]))

(simple_command
  argument: (word
    (pattern_star_source
      fragment: (lexeme_fragment) @character.special)))

(simple_command
  argument: (word
    (pattern_question_source
      fragment: (lexeme_fragment) @character.special)))

(for_clause
  word: (word
    [
      (pattern_star_source
        !fragment) @character.special
      (pattern_question_source
        !fragment) @character.special
    ]))

(for_clause
  word: (word
    (pattern_star_source
      fragment: (lexeme_fragment) @character.special)))

(for_clause
  word: (word
    (pattern_question_source
      fragment: (lexeme_fragment) @character.special)))

(select_clause
  word: (word
    [
      (pattern_star_source
        !fragment) @character.special
      (pattern_question_source
        !fragment) @character.special
    ]))

(select_clause
  word: (word
    (pattern_star_source
      fragment: (lexeme_fragment) @character.special)))

(select_clause
  word: (word
    (pattern_question_source
      fragment: (lexeme_fragment) @character.special)))

(array_assignment
  element: (word
    [
      (pattern_star_source
        !fragment) @character.special
      (pattern_question_source
        !fragment) @character.special
    ]))

(array_assignment
  element: (word
    (pattern_star_source
      fragment: (lexeme_fragment) @character.special)))

(array_assignment
  element: (word
    (pattern_question_source
      fragment: (lexeme_fragment) @character.special)))

(brace_alternative
  [
    (pattern_star_source
      !fragment) @character.special
    (pattern_question_source
      !fragment) @character.special
  ])

(brace_alternative
  (pattern_star_source
    fragment: (lexeme_fragment) @character.special))

(brace_alternative
  (pattern_question_source
    fragment: (lexeme_fragment) @character.special))

(io_file
  filename: (word
    [
      (pattern_star_source
        !fragment) @character.special
      (pattern_question_source
        !fragment) @character.special
    ]))

(io_file
  filename: (word
    (pattern_star_source
      fragment: (lexeme_fragment) @character.special)))

(io_file
  filename: (word
    (pattern_question_source
      fragment: (lexeme_fragment) @character.special)))

(pattern_list
  (word
    (pattern_bracket_source
      [
        "[" @punctuation.bracket
        "]" @punctuation.bracket
        (pattern_bracket_negation_source
          !fragment) @operator
        (pattern_bracket_members_source
          [
            (pattern_bracket_character_source
              !fragment) @character
            (pattern_bracket_hyphen_source
              !fragment) @character
            (pattern_bracket_range_source
              [
                (pattern_bracket_character_source
                  !fragment) @character
                (pattern_bracket_hyphen_source
                  !fragment) @character
                (pattern_bracket_range_operator_source
                  !fragment) @operator
                (pattern_collating_symbol_source
                  [
                    "[" @punctuation.bracket
                    "." @punctuation.delimiter
                    "]" @punctuation.bracket
                    (pattern_collating_symbol_character_source
                      !fragment) @character.special
                  ])
              ])
            (pattern_character_class_source
              [
                "[" @punctuation.bracket
                ":" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_character_class_content_source
                  !fragment) @character.special
              ])
            (pattern_collating_symbol_source
              [
                "[" @punctuation.bracket
                "." @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_collating_symbol_character_source
                  !fragment) @character.special
              ])
            (pattern_equivalence_class_source
              [
                "[" @punctuation.bracket
                "=" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_equivalence_class_character_source
                  !fragment) @character.special
              ])
          ])
      ])))

(pattern_list
  (word
    (pattern_bracket_source
      (pattern_bracket_negation_source
        fragment: (lexeme_fragment) @operator))))

(pattern_list
  (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_character_source
          fragment: (lexeme_fragment) @character)))))

(pattern_list
  (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_hyphen_source
          fragment: (lexeme_fragment) @character)))))

(pattern_list
  (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_bracket_character_source
            fragment: (lexeme_fragment) @character))))))

(pattern_list
  (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_bracket_hyphen_source
            fragment: (lexeme_fragment) @character))))))

(pattern_list
  (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_bracket_range_operator_source
            fragment: (lexeme_fragment) @operator))))))

(pattern_list
  (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_collating_symbol_source
            (pattern_collating_symbol_character_source
              fragment: (lexeme_fragment) @character.special)))))))

(pattern_list
  (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_character_class_source
          (pattern_character_class_content_source
            fragment: (lexeme_fragment) @character.special))))))

(pattern_list
  (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_collating_symbol_source
          (pattern_collating_symbol_character_source
            fragment: (lexeme_fragment) @character.special))))))

(pattern_list
  (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_equivalence_class_source
          (pattern_equivalence_class_character_source
            fragment: (lexeme_fragment) @character.special))))))

(parameter_pattern
  (pattern_bracket_source
    [
      "[" @punctuation.bracket
      "]" @punctuation.bracket
      (pattern_bracket_negation_source
        !fragment) @operator
      (pattern_bracket_members_source
        [
          (pattern_bracket_character_source
            !fragment) @character
          (pattern_bracket_hyphen_source
            !fragment) @character
          (pattern_bracket_range_source
            [
              (pattern_bracket_character_source
                !fragment) @character
              (pattern_bracket_hyphen_source
                !fragment) @character
              (pattern_bracket_range_operator_source
                !fragment) @operator
              (pattern_collating_symbol_source
                [
                  "[" @punctuation.bracket
                  "." @punctuation.delimiter
                  "]" @punctuation.bracket
                  (pattern_collating_symbol_character_source
                    !fragment) @character.special
                ])
            ])
          (pattern_character_class_source
            [
              "[" @punctuation.bracket
              ":" @punctuation.delimiter
              "]" @punctuation.bracket
              (pattern_character_class_content_source
                !fragment) @character.special
            ])
          (pattern_collating_symbol_source
            [
              "[" @punctuation.bracket
              "." @punctuation.delimiter
              "]" @punctuation.bracket
              (pattern_collating_symbol_character_source
                !fragment) @character.special
            ])
          (pattern_equivalence_class_source
            [
              "[" @punctuation.bracket
              "=" @punctuation.delimiter
              "]" @punctuation.bracket
              (pattern_equivalence_class_character_source
                !fragment) @character.special
            ])
        ])
    ]))

(parameter_pattern
  (pattern_bracket_source
    (pattern_bracket_negation_source
      fragment: (lexeme_fragment) @operator)))

(parameter_pattern
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_character_source
        fragment: (lexeme_fragment) @character))))

(parameter_pattern
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_hyphen_source
        fragment: (lexeme_fragment) @character))))

(parameter_pattern
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_range_source
        (pattern_bracket_character_source
          fragment: (lexeme_fragment) @character)))))

(parameter_pattern
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_range_source
        (pattern_bracket_hyphen_source
          fragment: (lexeme_fragment) @character)))))

(parameter_pattern
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_range_source
        (pattern_bracket_range_operator_source
          fragment: (lexeme_fragment) @operator)))))

(parameter_pattern
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_range_source
        (pattern_collating_symbol_source
          (pattern_collating_symbol_character_source
            fragment: (lexeme_fragment) @character.special))))))

(parameter_pattern
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_character_class_source
        (pattern_character_class_content_source
          fragment: (lexeme_fragment) @character.special)))))

(parameter_pattern
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_collating_symbol_source
        (pattern_collating_symbol_character_source
          fragment: (lexeme_fragment) @character.special)))))

(parameter_pattern
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_equivalence_class_source
        (pattern_equivalence_class_character_source
          fragment: (lexeme_fragment) @character.special)))))

(conditional_pattern
  (pattern_bracket_source
    [
      "[" @punctuation.bracket
      "]" @punctuation.bracket
      (pattern_bracket_negation_source
        !fragment) @operator
      (pattern_bracket_members_source
        [
          (pattern_bracket_character_source
            !fragment) @character
          (pattern_bracket_hyphen_source
            !fragment) @character
          (pattern_bracket_range_source
            [
              (pattern_bracket_character_source
                !fragment) @character
              (pattern_bracket_hyphen_source
                !fragment) @character
              (pattern_bracket_range_operator_source
                !fragment) @operator
              (pattern_collating_symbol_source
                [
                  "[" @punctuation.bracket
                  "." @punctuation.delimiter
                  "]" @punctuation.bracket
                  (pattern_collating_symbol_character_source
                    !fragment) @character.special
                ])
            ])
          (pattern_character_class_source
            [
              "[" @punctuation.bracket
              ":" @punctuation.delimiter
              "]" @punctuation.bracket
              (pattern_character_class_content_source
                !fragment) @character.special
            ])
          (pattern_collating_symbol_source
            [
              "[" @punctuation.bracket
              "." @punctuation.delimiter
              "]" @punctuation.bracket
              (pattern_collating_symbol_character_source
                !fragment) @character.special
            ])
          (pattern_equivalence_class_source
            [
              "[" @punctuation.bracket
              "=" @punctuation.delimiter
              "]" @punctuation.bracket
              (pattern_equivalence_class_character_source
                !fragment) @character.special
            ])
        ])
    ]))

(conditional_pattern
  (pattern_bracket_source
    (pattern_bracket_negation_source
      fragment: (lexeme_fragment) @operator)))

(conditional_pattern
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_character_source
        fragment: (lexeme_fragment) @character))))

(conditional_pattern
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_hyphen_source
        fragment: (lexeme_fragment) @character))))

(conditional_pattern
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_range_source
        (pattern_bracket_character_source
          fragment: (lexeme_fragment) @character)))))

(conditional_pattern
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_range_source
        (pattern_bracket_hyphen_source
          fragment: (lexeme_fragment) @character)))))

(conditional_pattern
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_range_source
        (pattern_bracket_range_operator_source
          fragment: (lexeme_fragment) @operator)))))

(conditional_pattern
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_range_source
        (pattern_collating_symbol_source
          (pattern_collating_symbol_character_source
            fragment: (lexeme_fragment) @character.special))))))

(conditional_pattern
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_character_class_source
        (pattern_character_class_content_source
          fragment: (lexeme_fragment) @character.special)))))

(conditional_pattern
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_collating_symbol_source
        (pattern_collating_symbol_character_source
          fragment: (lexeme_fragment) @character.special)))))

(conditional_pattern
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_equivalence_class_source
        (pattern_equivalence_class_character_source
          fragment: (lexeme_fragment) @character.special)))))

(extglob_alternative
  (pattern_bracket_source
    [
      "[" @punctuation.bracket
      "]" @punctuation.bracket
      (pattern_bracket_negation_source
        !fragment) @operator
      (pattern_bracket_members_source
        [
          (pattern_bracket_character_source
            !fragment) @character
          (pattern_bracket_hyphen_source
            !fragment) @character
          (pattern_bracket_range_source
            [
              (pattern_bracket_character_source
                !fragment) @character
              (pattern_bracket_hyphen_source
                !fragment) @character
              (pattern_bracket_range_operator_source
                !fragment) @operator
              (pattern_collating_symbol_source
                [
                  "[" @punctuation.bracket
                  "." @punctuation.delimiter
                  "]" @punctuation.bracket
                  (pattern_collating_symbol_character_source
                    !fragment) @character.special
                ])
            ])
          (pattern_character_class_source
            [
              "[" @punctuation.bracket
              ":" @punctuation.delimiter
              "]" @punctuation.bracket
              (pattern_character_class_content_source
                !fragment) @character.special
            ])
          (pattern_collating_symbol_source
            [
              "[" @punctuation.bracket
              "." @punctuation.delimiter
              "]" @punctuation.bracket
              (pattern_collating_symbol_character_source
                !fragment) @character.special
            ])
          (pattern_equivalence_class_source
            [
              "[" @punctuation.bracket
              "=" @punctuation.delimiter
              "]" @punctuation.bracket
              (pattern_equivalence_class_character_source
                !fragment) @character.special
            ])
        ])
    ]))

(extglob_alternative
  (pattern_bracket_source
    (pattern_bracket_negation_source
      fragment: (lexeme_fragment) @operator)))

(extglob_alternative
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_character_source
        fragment: (lexeme_fragment) @character))))

(extglob_alternative
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_hyphen_source
        fragment: (lexeme_fragment) @character))))

(extglob_alternative
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_range_source
        (pattern_bracket_character_source
          fragment: (lexeme_fragment) @character)))))

(extglob_alternative
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_range_source
        (pattern_bracket_hyphen_source
          fragment: (lexeme_fragment) @character)))))

(extglob_alternative
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_range_source
        (pattern_bracket_range_operator_source
          fragment: (lexeme_fragment) @operator)))))

(extglob_alternative
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_range_source
        (pattern_collating_symbol_source
          (pattern_collating_symbol_character_source
            fragment: (lexeme_fragment) @character.special))))))

(extglob_alternative
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_character_class_source
        (pattern_character_class_content_source
          fragment: (lexeme_fragment) @character.special)))))

(extglob_alternative
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_collating_symbol_source
        (pattern_collating_symbol_character_source
          fragment: (lexeme_fragment) @character.special)))))

(extglob_alternative
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_equivalence_class_source
        (pattern_equivalence_class_character_source
          fragment: (lexeme_fragment) @character.special)))))

(simple_command
  name: (word
    (pattern_bracket_source
      [
        "[" @punctuation.bracket
        "]" @punctuation.bracket
        (pattern_bracket_negation_source
          !fragment) @operator
        (pattern_bracket_members_source
          [
            (pattern_bracket_character_source
              !fragment) @character
            (pattern_bracket_hyphen_source
              !fragment) @character
            (pattern_bracket_range_source
              [
                (pattern_bracket_character_source
                  !fragment) @character
                (pattern_bracket_hyphen_source
                  !fragment) @character
                (pattern_bracket_range_operator_source
                  !fragment) @operator
                (pattern_collating_symbol_source
                  [
                    "[" @punctuation.bracket
                    "." @punctuation.delimiter
                    "]" @punctuation.bracket
                    (pattern_collating_symbol_character_source
                      !fragment) @character.special
                  ])
              ])
            (pattern_character_class_source
              [
                "[" @punctuation.bracket
                ":" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_character_class_content_source
                  !fragment) @character.special
              ])
            (pattern_collating_symbol_source
              [
                "[" @punctuation.bracket
                "." @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_collating_symbol_character_source
                  !fragment) @character.special
              ])
            (pattern_equivalence_class_source
              [
                "[" @punctuation.bracket
                "=" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_equivalence_class_character_source
                  !fragment) @character.special
              ])
          ])
      ])))

(simple_command
  name: (word
    (pattern_bracket_source
      (pattern_bracket_negation_source
        fragment: (lexeme_fragment) @operator))))

(simple_command
  name: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_character_source
          fragment: (lexeme_fragment) @character)))))

(simple_command
  name: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_hyphen_source
          fragment: (lexeme_fragment) @character)))))

(simple_command
  name: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_bracket_character_source
            fragment: (lexeme_fragment) @character))))))

(simple_command
  name: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_bracket_hyphen_source
            fragment: (lexeme_fragment) @character))))))

(simple_command
  name: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_bracket_range_operator_source
            fragment: (lexeme_fragment) @operator))))))

(simple_command
  name: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_collating_symbol_source
            (pattern_collating_symbol_character_source
              fragment: (lexeme_fragment) @character.special)))))))

(simple_command
  name: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_character_class_source
          (pattern_character_class_content_source
            fragment: (lexeme_fragment) @character.special))))))

(simple_command
  name: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_collating_symbol_source
          (pattern_collating_symbol_character_source
            fragment: (lexeme_fragment) @character.special))))))

(simple_command
  name: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_equivalence_class_source
          (pattern_equivalence_class_character_source
            fragment: (lexeme_fragment) @character.special))))))

(simple_command
  argument: (word
    (pattern_bracket_source
      [
        "[" @punctuation.bracket
        "]" @punctuation.bracket
        (pattern_bracket_negation_source
          !fragment) @operator
        (pattern_bracket_members_source
          [
            (pattern_bracket_character_source
              !fragment) @character
            (pattern_bracket_hyphen_source
              !fragment) @character
            (pattern_bracket_range_source
              [
                (pattern_bracket_character_source
                  !fragment) @character
                (pattern_bracket_hyphen_source
                  !fragment) @character
                (pattern_bracket_range_operator_source
                  !fragment) @operator
                (pattern_collating_symbol_source
                  [
                    "[" @punctuation.bracket
                    "." @punctuation.delimiter
                    "]" @punctuation.bracket
                    (pattern_collating_symbol_character_source
                      !fragment) @character.special
                  ])
              ])
            (pattern_character_class_source
              [
                "[" @punctuation.bracket
                ":" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_character_class_content_source
                  !fragment) @character.special
              ])
            (pattern_collating_symbol_source
              [
                "[" @punctuation.bracket
                "." @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_collating_symbol_character_source
                  !fragment) @character.special
              ])
            (pattern_equivalence_class_source
              [
                "[" @punctuation.bracket
                "=" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_equivalence_class_character_source
                  !fragment) @character.special
              ])
          ])
      ])))

(simple_command
  argument: (word
    (pattern_bracket_source
      (pattern_bracket_negation_source
        fragment: (lexeme_fragment) @operator))))

(simple_command
  argument: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_character_source
          fragment: (lexeme_fragment) @character)))))

(simple_command
  argument: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_hyphen_source
          fragment: (lexeme_fragment) @character)))))

(simple_command
  argument: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_bracket_character_source
            fragment: (lexeme_fragment) @character))))))

(simple_command
  argument: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_bracket_hyphen_source
            fragment: (lexeme_fragment) @character))))))

(simple_command
  argument: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_bracket_range_operator_source
            fragment: (lexeme_fragment) @operator))))))

(simple_command
  argument: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_collating_symbol_source
            (pattern_collating_symbol_character_source
              fragment: (lexeme_fragment) @character.special)))))))

(simple_command
  argument: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_character_class_source
          (pattern_character_class_content_source
            fragment: (lexeme_fragment) @character.special))))))

(simple_command
  argument: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_collating_symbol_source
          (pattern_collating_symbol_character_source
            fragment: (lexeme_fragment) @character.special))))))

(simple_command
  argument: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_equivalence_class_source
          (pattern_equivalence_class_character_source
            fragment: (lexeme_fragment) @character.special))))))

(for_clause
  word: (word
    (pattern_bracket_source
      [
        "[" @punctuation.bracket
        "]" @punctuation.bracket
        (pattern_bracket_negation_source
          !fragment) @operator
        (pattern_bracket_members_source
          [
            (pattern_bracket_character_source
              !fragment) @character
            (pattern_bracket_hyphen_source
              !fragment) @character
            (pattern_bracket_range_source
              [
                (pattern_bracket_character_source
                  !fragment) @character
                (pattern_bracket_hyphen_source
                  !fragment) @character
                (pattern_bracket_range_operator_source
                  !fragment) @operator
                (pattern_collating_symbol_source
                  [
                    "[" @punctuation.bracket
                    "." @punctuation.delimiter
                    "]" @punctuation.bracket
                    (pattern_collating_symbol_character_source
                      !fragment) @character.special
                  ])
              ])
            (pattern_character_class_source
              [
                "[" @punctuation.bracket
                ":" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_character_class_content_source
                  !fragment) @character.special
              ])
            (pattern_collating_symbol_source
              [
                "[" @punctuation.bracket
                "." @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_collating_symbol_character_source
                  !fragment) @character.special
              ])
            (pattern_equivalence_class_source
              [
                "[" @punctuation.bracket
                "=" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_equivalence_class_character_source
                  !fragment) @character.special
              ])
          ])
      ])))

(for_clause
  word: (word
    (pattern_bracket_source
      (pattern_bracket_negation_source
        fragment: (lexeme_fragment) @operator))))

(for_clause
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_character_source
          fragment: (lexeme_fragment) @character)))))

(for_clause
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_hyphen_source
          fragment: (lexeme_fragment) @character)))))

(for_clause
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_bracket_character_source
            fragment: (lexeme_fragment) @character))))))

(for_clause
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_bracket_hyphen_source
            fragment: (lexeme_fragment) @character))))))

(for_clause
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_bracket_range_operator_source
            fragment: (lexeme_fragment) @operator))))))

(for_clause
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_collating_symbol_source
            (pattern_collating_symbol_character_source
              fragment: (lexeme_fragment) @character.special)))))))

(for_clause
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_character_class_source
          (pattern_character_class_content_source
            fragment: (lexeme_fragment) @character.special))))))

(for_clause
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_collating_symbol_source
          (pattern_collating_symbol_character_source
            fragment: (lexeme_fragment) @character.special))))))

(for_clause
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_equivalence_class_source
          (pattern_equivalence_class_character_source
            fragment: (lexeme_fragment) @character.special))))))

(select_clause
  word: (word
    (pattern_bracket_source
      [
        "[" @punctuation.bracket
        "]" @punctuation.bracket
        (pattern_bracket_negation_source
          !fragment) @operator
        (pattern_bracket_members_source
          [
            (pattern_bracket_character_source
              !fragment) @character
            (pattern_bracket_hyphen_source
              !fragment) @character
            (pattern_bracket_range_source
              [
                (pattern_bracket_character_source
                  !fragment) @character
                (pattern_bracket_hyphen_source
                  !fragment) @character
                (pattern_bracket_range_operator_source
                  !fragment) @operator
                (pattern_collating_symbol_source
                  [
                    "[" @punctuation.bracket
                    "." @punctuation.delimiter
                    "]" @punctuation.bracket
                    (pattern_collating_symbol_character_source
                      !fragment) @character.special
                  ])
              ])
            (pattern_character_class_source
              [
                "[" @punctuation.bracket
                ":" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_character_class_content_source
                  !fragment) @character.special
              ])
            (pattern_collating_symbol_source
              [
                "[" @punctuation.bracket
                "." @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_collating_symbol_character_source
                  !fragment) @character.special
              ])
            (pattern_equivalence_class_source
              [
                "[" @punctuation.bracket
                "=" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_equivalence_class_character_source
                  !fragment) @character.special
              ])
          ])
      ])))

(select_clause
  word: (word
    (pattern_bracket_source
      (pattern_bracket_negation_source
        fragment: (lexeme_fragment) @operator))))

(select_clause
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_character_source
          fragment: (lexeme_fragment) @character)))))

(select_clause
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_hyphen_source
          fragment: (lexeme_fragment) @character)))))

(select_clause
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_bracket_character_source
            fragment: (lexeme_fragment) @character))))))

(select_clause
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_bracket_hyphen_source
            fragment: (lexeme_fragment) @character))))))

(select_clause
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_bracket_range_operator_source
            fragment: (lexeme_fragment) @operator))))))

(select_clause
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_collating_symbol_source
            (pattern_collating_symbol_character_source
              fragment: (lexeme_fragment) @character.special)))))))

(select_clause
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_character_class_source
          (pattern_character_class_content_source
            fragment: (lexeme_fragment) @character.special))))))

(select_clause
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_collating_symbol_source
          (pattern_collating_symbol_character_source
            fragment: (lexeme_fragment) @character.special))))))

(select_clause
  word: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_equivalence_class_source
          (pattern_equivalence_class_character_source
            fragment: (lexeme_fragment) @character.special))))))

(array_assignment
  element: (word
    (pattern_bracket_source
      [
        "[" @punctuation.bracket
        "]" @punctuation.bracket
        (pattern_bracket_negation_source
          !fragment) @operator
        (pattern_bracket_members_source
          [
            (pattern_bracket_character_source
              !fragment) @character
            (pattern_bracket_hyphen_source
              !fragment) @character
            (pattern_bracket_range_source
              [
                (pattern_bracket_character_source
                  !fragment) @character
                (pattern_bracket_hyphen_source
                  !fragment) @character
                (pattern_bracket_range_operator_source
                  !fragment) @operator
                (pattern_collating_symbol_source
                  [
                    "[" @punctuation.bracket
                    "." @punctuation.delimiter
                    "]" @punctuation.bracket
                    (pattern_collating_symbol_character_source
                      !fragment) @character.special
                  ])
              ])
            (pattern_character_class_source
              [
                "[" @punctuation.bracket
                ":" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_character_class_content_source
                  !fragment) @character.special
              ])
            (pattern_collating_symbol_source
              [
                "[" @punctuation.bracket
                "." @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_collating_symbol_character_source
                  !fragment) @character.special
              ])
            (pattern_equivalence_class_source
              [
                "[" @punctuation.bracket
                "=" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_equivalence_class_character_source
                  !fragment) @character.special
              ])
          ])
      ])))

(array_assignment
  element: (word
    (pattern_bracket_source
      (pattern_bracket_negation_source
        fragment: (lexeme_fragment) @operator))))

(array_assignment
  element: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_character_source
          fragment: (lexeme_fragment) @character)))))

(array_assignment
  element: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_hyphen_source
          fragment: (lexeme_fragment) @character)))))

(array_assignment
  element: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_bracket_character_source
            fragment: (lexeme_fragment) @character))))))

(array_assignment
  element: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_bracket_hyphen_source
            fragment: (lexeme_fragment) @character))))))

(array_assignment
  element: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_bracket_range_operator_source
            fragment: (lexeme_fragment) @operator))))))

(array_assignment
  element: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_collating_symbol_source
            (pattern_collating_symbol_character_source
              fragment: (lexeme_fragment) @character.special)))))))

(array_assignment
  element: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_character_class_source
          (pattern_character_class_content_source
            fragment: (lexeme_fragment) @character.special))))))

(array_assignment
  element: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_collating_symbol_source
          (pattern_collating_symbol_character_source
            fragment: (lexeme_fragment) @character.special))))))

(array_assignment
  element: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_equivalence_class_source
          (pattern_equivalence_class_character_source
            fragment: (lexeme_fragment) @character.special))))))

(brace_alternative
  (pattern_bracket_source
    [
      "[" @punctuation.bracket
      "]" @punctuation.bracket
      (pattern_bracket_negation_source
        !fragment) @operator
      (pattern_bracket_members_source
        [
          (pattern_bracket_character_source
            !fragment) @character
          (pattern_bracket_hyphen_source
            !fragment) @character
          (pattern_bracket_range_source
            [
              (pattern_bracket_character_source
                !fragment) @character
              (pattern_bracket_hyphen_source
                !fragment) @character
              (pattern_bracket_range_operator_source
                !fragment) @operator
              (pattern_collating_symbol_source
                [
                  "[" @punctuation.bracket
                  "." @punctuation.delimiter
                  "]" @punctuation.bracket
                  (pattern_collating_symbol_character_source
                    !fragment) @character.special
                ])
            ])
          (pattern_character_class_source
            [
              "[" @punctuation.bracket
              ":" @punctuation.delimiter
              "]" @punctuation.bracket
              (pattern_character_class_content_source
                !fragment) @character.special
            ])
          (pattern_collating_symbol_source
            [
              "[" @punctuation.bracket
              "." @punctuation.delimiter
              "]" @punctuation.bracket
              (pattern_collating_symbol_character_source
                !fragment) @character.special
            ])
          (pattern_equivalence_class_source
            [
              "[" @punctuation.bracket
              "=" @punctuation.delimiter
              "]" @punctuation.bracket
              (pattern_equivalence_class_character_source
                !fragment) @character.special
            ])
        ])
    ]))

(brace_alternative
  (pattern_bracket_source
    (pattern_bracket_negation_source
      fragment: (lexeme_fragment) @operator)))

(brace_alternative
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_character_source
        fragment: (lexeme_fragment) @character))))

(brace_alternative
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_hyphen_source
        fragment: (lexeme_fragment) @character))))

(brace_alternative
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_range_source
        (pattern_bracket_character_source
          fragment: (lexeme_fragment) @character)))))

(brace_alternative
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_range_source
        (pattern_bracket_hyphen_source
          fragment: (lexeme_fragment) @character)))))

(brace_alternative
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_range_source
        (pattern_bracket_range_operator_source
          fragment: (lexeme_fragment) @operator)))))

(brace_alternative
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_bracket_range_source
        (pattern_collating_symbol_source
          (pattern_collating_symbol_character_source
            fragment: (lexeme_fragment) @character.special))))))

(brace_alternative
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_character_class_source
        (pattern_character_class_content_source
          fragment: (lexeme_fragment) @character.special)))))

(brace_alternative
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_collating_symbol_source
        (pattern_collating_symbol_character_source
          fragment: (lexeme_fragment) @character.special)))))

(brace_alternative
  (pattern_bracket_source
    (pattern_bracket_members_source
      (pattern_equivalence_class_source
        (pattern_equivalence_class_character_source
          fragment: (lexeme_fragment) @character.special)))))

(io_file
  filename: (word
    (pattern_bracket_source
      [
        "[" @punctuation.bracket
        "]" @punctuation.bracket
        (pattern_bracket_negation_source
          !fragment) @operator
        (pattern_bracket_members_source
          [
            (pattern_bracket_character_source
              !fragment) @character
            (pattern_bracket_hyphen_source
              !fragment) @character
            (pattern_bracket_range_source
              [
                (pattern_bracket_character_source
                  !fragment) @character
                (pattern_bracket_hyphen_source
                  !fragment) @character
                (pattern_bracket_range_operator_source
                  !fragment) @operator
                (pattern_collating_symbol_source
                  [
                    "[" @punctuation.bracket
                    "." @punctuation.delimiter
                    "]" @punctuation.bracket
                    (pattern_collating_symbol_character_source
                      !fragment) @character.special
                  ])
              ])
            (pattern_character_class_source
              [
                "[" @punctuation.bracket
                ":" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_character_class_content_source
                  !fragment) @character.special
              ])
            (pattern_collating_symbol_source
              [
                "[" @punctuation.bracket
                "." @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_collating_symbol_character_source
                  !fragment) @character.special
              ])
            (pattern_equivalence_class_source
              [
                "[" @punctuation.bracket
                "=" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_equivalence_class_character_source
                  !fragment) @character.special
              ])
          ])
      ])))

(io_file
  filename: (word
    (pattern_bracket_source
      (pattern_bracket_negation_source
        fragment: (lexeme_fragment) @operator))))

(io_file
  filename: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_character_source
          fragment: (lexeme_fragment) @character)))))

(io_file
  filename: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_hyphen_source
          fragment: (lexeme_fragment) @character)))))

(io_file
  filename: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_bracket_character_source
            fragment: (lexeme_fragment) @character))))))

(io_file
  filename: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_bracket_hyphen_source
            fragment: (lexeme_fragment) @character))))))

(io_file
  filename: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_bracket_range_operator_source
            fragment: (lexeme_fragment) @operator))))))

(io_file
  filename: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_bracket_range_source
          (pattern_collating_symbol_source
            (pattern_collating_symbol_character_source
              fragment: (lexeme_fragment) @character.special)))))))

(io_file
  filename: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_character_class_source
          (pattern_character_class_content_source
            fragment: (lexeme_fragment) @character.special))))))

(io_file
  filename: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_collating_symbol_source
          (pattern_collating_symbol_character_source
            fragment: (lexeme_fragment) @character.special))))))

(io_file
  filename: (word
    (pattern_bracket_source
      (pattern_bracket_members_source
        (pattern_equivalence_class_source
          (pattern_equivalence_class_character_source
            fragment: (lexeme_fragment) @character.special))))))

[
  (function_keyword
    !fragment)
  (select_keyword
    !fragment)
  (coproc_keyword
    !fragment)
  (time_keyword
    !fragment)
] @keyword

(function_keyword
  fragment: (lexeme_fragment) @keyword)

(select_keyword
  fragment: (lexeme_fragment) @keyword)

(coproc_keyword
  fragment: (lexeme_fragment) @keyword)

(time_keyword
  fragment: (lexeme_fragment) @keyword)

(declaration_name
  !fragment) @function.call

(declaration_name
  fragment: (lexeme_fragment) @function.call)

(coproc
  name: (word
    (literal
      !fragment) @label))

(coproc
  name: (word
    (literal
      fragment: (lexeme_fragment) @label)))

(time_option
  !fragment) @keyword.modifier

(time_option
  fragment: (lexeme_fragment) @keyword.modifier)

[
  (assignment_append
    !fragment)
  (conditional_unary_operator
    !fragment)
  (conditional_binary_operator
    !fragment)
  (conditional_match_operator
    !fragment)
  (conditional_regex_operator
    !fragment)
  (conditional_not
    !fragment)
  (pipe_and
    !fragment)
  (dsemi_and
    !fragment)
  (andgreat
    !fragment)
  (anddgreat
    !fragment)
  (here_string_operator
    !fragment)
  (parameter_indirection_operator
    !fragment)
  (parameter_names_operator
    !fragment)
  (parameter_substring_operator
    !fragment)
  (parameter_replacement_operator
    !fragment)
  (parameter_case_operator
    !fragment)
  (extglob_operator
    !fragment)
] @operator

(assignment_append
  fragment: (lexeme_fragment) @operator)

(conditional_unary_operator
  fragment: (lexeme_fragment) @operator)

(conditional_binary_operator
  fragment: (lexeme_fragment) @operator)

(conditional_match_operator
  fragment: (lexeme_fragment) @operator)

(conditional_regex_operator
  fragment: (lexeme_fragment) @operator)

(conditional_not
  fragment: (lexeme_fragment) @operator)

(pipe_and
  fragment: (lexeme_fragment) @operator)

(dsemi_and
  fragment: (lexeme_fragment) @operator)

(andgreat
  fragment: (lexeme_fragment) @operator)

(anddgreat
  fragment: (lexeme_fragment) @operator)

(here_string_operator
  fragment: (lexeme_fragment) @operator)

(parameter_indirection_operator
  fragment: (lexeme_fragment) @operator)

(parameter_names_operator
  fragment: (lexeme_fragment) @operator)

(parameter_substring_operator
  fragment: (lexeme_fragment) @operator)

(parameter_replacement_operator
  fragment: (lexeme_fragment) @operator)

(parameter_case_operator
  fragment: (lexeme_fragment) @operator)

(extglob_operator
  fragment: (lexeme_fragment) @operator)

(parameter_transformation
  (parameter_transformation_operator
    !fragment) @operator)

(parameter_transformation
  (parameter_transformation_operator
    fragment: (lexeme_fragment) @operator))

(parameter_transformation_code
  !fragment) @character.special

(parameter_transformation_code
  fragment: (lexeme_fragment) @character.special)

(locale_quoted
  [
    "$"
    "\""
  ] @punctuation.delimiter)

(brace_endpoint
  !fragment) @string

(brace_endpoint
  fragment: (lexeme_fragment) @string)

(brace_increment
  !fragment) @number

(brace_increment
  fragment: (lexeme_fragment) @number)

(ordinary_character
  !fragment) @string.regexp

(ordinary_character
  fragment: (lexeme_fragment) @string.regexp)

[
  (collating_element_single
    !fragment)
  (collating_element_multi
    !fragment)
  (class_name
    !fragment)
  (meta_character
    !fragment)
] @character.special

(collating_element_single
  fragment: (lexeme_fragment) @character.special)

(collating_element_multi
  fragment: (lexeme_fragment) @character.special)

(class_name
  fragment: (lexeme_fragment) @character.special)

(meta_character
  fragment: (lexeme_fragment) @character.special)

(one_char_or_coll_elem_ere
  "." @character.special)

(ere_expression
  [
    "^"
    "$"
  ] @operator)

(repetition_modifier
  !fragment) @operator

(repetition_modifier
  fragment: (lexeme_fragment) @operator)

(duplication_count
  !fragment) @number

(duplication_count
  fragment: (lexeme_fragment) @number)

(ere_dupl_symbol
  [
    "*"
    "+"
    "?"
  ] @operator)

(ere_dupl_symbol
  "," @punctuation.delimiter)

(nonmatching_list
  "^" @operator)

(start_range
  "-" @operator)

[
  (range_expression
    "-" @string.regexp)
  (bracket_list
    "-" @string.regexp)
]

[
  (bracket_expression
    [
      "["
      "]"
    ] @punctuation.bracket)
  (character_class
    [
      "["
      "]"
    ] @punctuation.bracket)
  (collating_symbol
    [
      "["
      "]"
    ] @punctuation.bracket)
  (equivalence_class
    [
      "["
      "]"
    ] @punctuation.bracket)
]

(character_class
  ":" @punctuation.delimiter)

(collating_symbol
  "." @punctuation.delimiter)

(equivalence_class
  "=" @punctuation.delimiter)

[
  (conditional_open
    !fragment)
  (conditional_close
    !fragment)
  (arithmetic_for_open
    !fragment)
] @punctuation.bracket

(conditional_open
  fragment: (lexeme_fragment) @punctuation.bracket)

(conditional_close
  fragment: (lexeme_fragment) @punctuation.bracket)

(arithmetic_for_open
  fragment: (lexeme_fragment) @punctuation.bracket)

[
  (arithmetic_array_reference
    subscript: (array_subscript
      [
        "["
        "]"
      ] @punctuation.bracket))
  (array_element_assignment
    subscript: (array_subscript
      [
        "["
        "]"
      ] @punctuation.bracket))
  (array_reference
    subscript: (array_subscript
      [
        "["
        "]"
      ] @punctuation.bracket))
  (assignment_word
    subscript: (array_subscript
      [
        "["
        "]"
      ] @punctuation.bracket))
  (io_variable
    subscript: (array_subscript
      [
        "["
        "]"
      ] @punctuation.bracket))
]

(brace_expansion
  "," @punctuation.delimiter)

(brace_sequence
  (brace_sequence_separator
    !fragment) @punctuation.delimiter)

(brace_sequence
  (brace_sequence_separator
    fragment: (lexeme_fragment) @punctuation.delimiter))

(parameter_substring
  (parameter_substring_separator
    !fragment) @punctuation.delimiter)

(parameter_substring
  (parameter_substring_separator
    fragment: (lexeme_fragment) @punctuation.delimiter))

(parameter_replacement
  (parameter_replacement_separator
    !fragment) @punctuation.delimiter)

(parameter_replacement
  (parameter_replacement_separator
    fragment: (lexeme_fragment) @punctuation.delimiter))

(array_element_assignment
  "=" @operator)

(process_substitution
  direction: [
    "<"
    ">"
  ] @operator)

(current_shell_substitution
  "$" @punctuation.special)

(reply_substitution
  "$" @punctuation.special)

(here_end
  word: (word
    (locale_quoted
      (double_quote_text
        !fragment) @label)))

(here_end
  word: (word
    (locale_quoted
      (double_quote_text
        fragment: (lexeme_fragment) @label))))

(line_continuation) @punctuation.special
