[
  (literal)
  (pattern_star_source)
  (pattern_question_source)
  (pattern_bracket_character_source)
  (pattern_bracket_hyphen_source)
  (pattern_bracket_range_operator_source)
  (pattern_bracket_negation_source)
  (pattern_character_class_content_source)
  (pattern_collating_symbol_character_source)
  (pattern_equivalence_class_character_source)
  (single_quote_content)
  (double_quote_text)
  (dollar_single_quote_text)
  (here_document_text)
  (quoted_here_document_text)
] @string

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
  (escaped_character)
  (double_quote_escape)
  (dollar_single_quote_escape)
  (here_document_escape)
] @string.escape

(comment_text) @comment

[
  (arithmetic_number)
  (io_number)
] @number

[
  (arithmetic_variable)
  (variable_name)
  (name)
] @variable

(positional_parameter) @variable.parameter

(special_parameter) @variable.builtin

(function_name) @function

[
  (if_keyword)
  (then_keyword)
  (elif_keyword)
  (else_keyword)
  (fi_keyword)
  (for_keyword)
  (in_keyword)
  (do_keyword)
  (done_keyword)
  (case_keyword)
  (esac_keyword)
  (while_keyword)
  (until_keyword)
] @keyword

[
  (arithmetic_operator)
  (parameter_length_operator)
  (parameter_value_operator)
  (parameter_pattern_operator)
  (and_if)
  (or_if)
  (bang)
  (dsemi)
  (semi_and)
] @operator

[
  (lessand)
  (greatand)
  (dgreat)
  (lessgreat)
  (clobber)
  (dless)
  (dlessdash)
] @operator

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
      (literal)
      (pattern_star_source)
      (pattern_question_source)
    ] @string.special.path))

(tilde_user
  (pattern_bracket_source
    [
      "[" @string.special.path
      "]" @string.special.path
      (pattern_bracket_negation_source) @string.special.path
    ]))

(tilde_user
  (pattern_bracket_source
    (pattern_bracket_members_source
      [
        (pattern_bracket_character_source) @string.special.path
        (pattern_bracket_hyphen_source) @string.special.path
        (pattern_bracket_range_source
          [
            (pattern_bracket_character_source) @string.special.path
            (pattern_bracket_hyphen_source) @string.special.path
            (pattern_bracket_range_operator_source) @string.special.path
            (pattern_collating_symbol_source
              [
                "["
                "."
                "]"
                (pattern_collating_symbol_character_source)
              ] @string.special.path)
          ])
        (pattern_character_class_source
          [
            "["
            ":"
            "]"
            (pattern_character_class_content_source)
          ] @string.special.path)
        (pattern_collating_symbol_source
          [
            "["
            "."
            "]"
            (pattern_collating_symbol_character_source)
          ] @string.special.path)
        (pattern_equivalence_class_source
          [
            "["
            "="
            "]"
            (pattern_equivalence_class_character_source)
          ] @string.special.path)
      ])))

(here_end
  word: (word
    [
      (literal)
      (pattern_star_source)
      (pattern_question_source)
    ] @label))

(here_end
  word: (word
    (single_quoted
      (single_quote_content) @label)))

(here_end
  word: (word
    (double_quoted
      (double_quote_text) @label)))

(here_end
  word: (word
    (dollar_single_quoted
      (dollar_single_quote_text) @label)))

(here_end
  word: (word
    (pattern_bracket_source
      [
        "[" @label
        "]" @label
        (pattern_bracket_negation_source) @label
        (pattern_bracket_members_source
          [
            (pattern_bracket_character_source) @label
            (pattern_bracket_hyphen_source) @label
            (single_quoted
              (single_quote_content) @label)
            (double_quoted
              (double_quote_text) @label)
            (locale_quoted
              (double_quote_text) @label)
            (dollar_single_quoted
              (dollar_single_quote_text) @label)
            (pattern_bracket_range_source
              [
                (pattern_bracket_character_source) @label
                (pattern_bracket_hyphen_source) @label
                (single_quoted
                  (single_quote_content) @label)
                (double_quoted
                  (double_quote_text) @label)
                (locale_quoted
                  (double_quote_text) @label)
                (dollar_single_quoted
                  (dollar_single_quote_text) @label)
                (pattern_bracket_range_operator_source) @label
                (pattern_collating_symbol_source
                  [
                    "[" @label
                    "." @label
                    "]" @label
                    (pattern_collating_symbol_character_source) @label
                    (single_quoted
                      (single_quote_content) @label)
                    (double_quoted
                      (double_quote_text) @label)
                    (locale_quoted
                      (double_quote_text) @label)
                    (dollar_single_quoted
                      (dollar_single_quote_text) @label)
                  ])
              ])
            (pattern_character_class_source
              [
                "[" @label
                ":" @label
                "]" @label
                (pattern_character_class_content_source) @label
                (single_quoted
                  (single_quote_content) @label)
                (double_quoted
                  (double_quote_text) @label)
                (locale_quoted
                  (double_quote_text) @label)
                (dollar_single_quoted
                  (dollar_single_quote_text) @label)
              ])
            (pattern_collating_symbol_source
              [
                "[" @label
                "." @label
                "]" @label
                (pattern_collating_symbol_character_source) @label
                (single_quoted
                  (single_quote_content) @label)
                (double_quoted
                  (double_quote_text) @label)
                (locale_quoted
                  (double_quote_text) @label)
                (dollar_single_quoted
                  (dollar_single_quote_text) @label)
              ])
            (pattern_equivalence_class_source
              [
                "[" @label
                "=" @label
                "]" @label
                (pattern_equivalence_class_character_source) @label
                (single_quoted
                  (single_quote_content) @label)
                (double_quoted
                  (double_quote_text) @label)
                (locale_quoted
                  (double_quote_text) @label)
                (dollar_single_quoted
                  (dollar_single_quote_text) @label)
              ])
          ])
      ])))

(here_document_end_text) @label

(simple_command
  name: (word
    (literal) @function.call))

(parameter_pattern
  [
    (literal) @string.regexp
    (pattern_star_source) @character.special
    (pattern_question_source) @character.special
  ])

(conditional_pattern
  [
    (literal) @string.regexp
    (pattern_star_source) @character.special
    (pattern_question_source) @character.special
  ])

(extglob_alternative
  [
    (literal) @string.regexp
    (pattern_star_source) @character.special
    (pattern_question_source) @character.special
  ])

(pattern_list
  (word
    [
      (literal) @string.regexp
      (pattern_star_source) @character.special
      (pattern_question_source) @character.special
    ]))

(simple_command
  name: (word
    [
      (pattern_star_source) @character.special
      (pattern_question_source) @character.special
    ]))

(simple_command
  argument: (word
    [
      (pattern_star_source) @character.special
      (pattern_question_source) @character.special
    ]))

(word_list
  word: (word
    [
      (pattern_star_source) @character.special
      (pattern_question_source) @character.special
    ]))

(array_assignment
  element: (word
    [
      (pattern_star_source) @character.special
      (pattern_question_source) @character.special
    ]))

(brace_alternative
  [
    (pattern_star_source) @character.special
    (pattern_question_source) @character.special
  ])

(io_file
  filename: (word
    [
      (pattern_star_source) @character.special
      (pattern_question_source) @character.special
    ]))

(pattern_list
  (word
    (pattern_bracket_source
      [
        "[" @punctuation.bracket
        "]" @punctuation.bracket
        (pattern_bracket_negation_source) @operator
        (pattern_bracket_members_source
          [
            (pattern_bracket_character_source) @character
            (pattern_bracket_hyphen_source) @character
            (pattern_bracket_range_source
              [
                (pattern_bracket_character_source) @character
                (pattern_bracket_hyphen_source) @character
                (pattern_bracket_range_operator_source) @operator
                (pattern_collating_symbol_source
                  [
                    "[" @punctuation.bracket
                    "." @punctuation.delimiter
                    "]" @punctuation.bracket
                    (pattern_collating_symbol_character_source) @character.special
                  ])
              ])
            (pattern_character_class_source
              [
                "[" @punctuation.bracket
                ":" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_character_class_content_source) @character.special
              ])
            (pattern_collating_symbol_source
              [
                "[" @punctuation.bracket
                "." @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_collating_symbol_character_source) @character.special
              ])
            (pattern_equivalence_class_source
              [
                "[" @punctuation.bracket
                "=" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_equivalence_class_character_source) @character.special
              ])
          ])
      ])))

(parameter_pattern
  (pattern_bracket_source
    [
      "[" @punctuation.bracket
      "]" @punctuation.bracket
      (pattern_bracket_negation_source) @operator
      (pattern_bracket_members_source
        [
          (pattern_bracket_character_source) @character
          (pattern_bracket_hyphen_source) @character
          (pattern_bracket_range_source
            [
              (pattern_bracket_character_source) @character
              (pattern_bracket_hyphen_source) @character
              (pattern_bracket_range_operator_source) @operator
              (pattern_collating_symbol_source
                [
                  "[" @punctuation.bracket
                  "." @punctuation.delimiter
                  "]" @punctuation.bracket
                  (pattern_collating_symbol_character_source) @character.special
                ])
            ])
          (pattern_character_class_source
            [
              "[" @punctuation.bracket
              ":" @punctuation.delimiter
              "]" @punctuation.bracket
              (pattern_character_class_content_source) @character.special
            ])
          (pattern_collating_symbol_source
            [
              "[" @punctuation.bracket
              "." @punctuation.delimiter
              "]" @punctuation.bracket
              (pattern_collating_symbol_character_source) @character.special
            ])
          (pattern_equivalence_class_source
            [
              "[" @punctuation.bracket
              "=" @punctuation.delimiter
              "]" @punctuation.bracket
              (pattern_equivalence_class_character_source) @character.special
            ])
        ])
    ]))

(conditional_pattern
  (pattern_bracket_source
    [
      "[" @punctuation.bracket
      "]" @punctuation.bracket
      (pattern_bracket_negation_source) @operator
      (pattern_bracket_members_source
        [
          (pattern_bracket_character_source) @character
          (pattern_bracket_hyphen_source) @character
          (pattern_bracket_range_source
            [
              (pattern_bracket_character_source) @character
              (pattern_bracket_hyphen_source) @character
              (pattern_bracket_range_operator_source) @operator
              (pattern_collating_symbol_source
                [
                  "[" @punctuation.bracket
                  "." @punctuation.delimiter
                  "]" @punctuation.bracket
                  (pattern_collating_symbol_character_source) @character.special
                ])
            ])
          (pattern_character_class_source
            [
              "[" @punctuation.bracket
              ":" @punctuation.delimiter
              "]" @punctuation.bracket
              (pattern_character_class_content_source) @character.special
            ])
          (pattern_collating_symbol_source
            [
              "[" @punctuation.bracket
              "." @punctuation.delimiter
              "]" @punctuation.bracket
              (pattern_collating_symbol_character_source) @character.special
            ])
          (pattern_equivalence_class_source
            [
              "[" @punctuation.bracket
              "=" @punctuation.delimiter
              "]" @punctuation.bracket
              (pattern_equivalence_class_character_source) @character.special
            ])
        ])
    ]))

(extglob_alternative
  (pattern_bracket_source
    [
      "[" @punctuation.bracket
      "]" @punctuation.bracket
      (pattern_bracket_negation_source) @operator
      (pattern_bracket_members_source
        [
          (pattern_bracket_character_source) @character
          (pattern_bracket_hyphen_source) @character
          (pattern_bracket_range_source
            [
              (pattern_bracket_character_source) @character
              (pattern_bracket_hyphen_source) @character
              (pattern_bracket_range_operator_source) @operator
              (pattern_collating_symbol_source
                [
                  "[" @punctuation.bracket
                  "." @punctuation.delimiter
                  "]" @punctuation.bracket
                  (pattern_collating_symbol_character_source) @character.special
                ])
            ])
          (pattern_character_class_source
            [
              "[" @punctuation.bracket
              ":" @punctuation.delimiter
              "]" @punctuation.bracket
              (pattern_character_class_content_source) @character.special
            ])
          (pattern_collating_symbol_source
            [
              "[" @punctuation.bracket
              "." @punctuation.delimiter
              "]" @punctuation.bracket
              (pattern_collating_symbol_character_source) @character.special
            ])
          (pattern_equivalence_class_source
            [
              "[" @punctuation.bracket
              "=" @punctuation.delimiter
              "]" @punctuation.bracket
              (pattern_equivalence_class_character_source) @character.special
            ])
        ])
    ]))

(simple_command
  name: (word
    (pattern_bracket_source
      [
        "[" @punctuation.bracket
        "]" @punctuation.bracket
        (pattern_bracket_negation_source) @operator
        (pattern_bracket_members_source
          [
            (pattern_bracket_character_source) @character
            (pattern_bracket_hyphen_source) @character
            (pattern_bracket_range_source
              [
                (pattern_bracket_character_source) @character
                (pattern_bracket_hyphen_source) @character
                (pattern_bracket_range_operator_source) @operator
                (pattern_collating_symbol_source
                  [
                    "[" @punctuation.bracket
                    "." @punctuation.delimiter
                    "]" @punctuation.bracket
                    (pattern_collating_symbol_character_source) @character.special
                  ])
              ])
            (pattern_character_class_source
              [
                "[" @punctuation.bracket
                ":" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_character_class_content_source) @character.special
              ])
            (pattern_collating_symbol_source
              [
                "[" @punctuation.bracket
                "." @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_collating_symbol_character_source) @character.special
              ])
            (pattern_equivalence_class_source
              [
                "[" @punctuation.bracket
                "=" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_equivalence_class_character_source) @character.special
              ])
          ])
      ])))

(simple_command
  argument: (word
    (pattern_bracket_source
      [
        "[" @punctuation.bracket
        "]" @punctuation.bracket
        (pattern_bracket_negation_source) @operator
        (pattern_bracket_members_source
          [
            (pattern_bracket_character_source) @character
            (pattern_bracket_hyphen_source) @character
            (pattern_bracket_range_source
              [
                (pattern_bracket_character_source) @character
                (pattern_bracket_hyphen_source) @character
                (pattern_bracket_range_operator_source) @operator
                (pattern_collating_symbol_source
                  [
                    "[" @punctuation.bracket
                    "." @punctuation.delimiter
                    "]" @punctuation.bracket
                    (pattern_collating_symbol_character_source) @character.special
                  ])
              ])
            (pattern_character_class_source
              [
                "[" @punctuation.bracket
                ":" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_character_class_content_source) @character.special
              ])
            (pattern_collating_symbol_source
              [
                "[" @punctuation.bracket
                "." @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_collating_symbol_character_source) @character.special
              ])
            (pattern_equivalence_class_source
              [
                "[" @punctuation.bracket
                "=" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_equivalence_class_character_source) @character.special
              ])
          ])
      ])))

(word_list
  word: (word
    (pattern_bracket_source
      [
        "[" @punctuation.bracket
        "]" @punctuation.bracket
        (pattern_bracket_negation_source) @operator
        (pattern_bracket_members_source
          [
            (pattern_bracket_character_source) @character
            (pattern_bracket_hyphen_source) @character
            (pattern_bracket_range_source
              [
                (pattern_bracket_character_source) @character
                (pattern_bracket_hyphen_source) @character
                (pattern_bracket_range_operator_source) @operator
                (pattern_collating_symbol_source
                  [
                    "[" @punctuation.bracket
                    "." @punctuation.delimiter
                    "]" @punctuation.bracket
                    (pattern_collating_symbol_character_source) @character.special
                  ])
              ])
            (pattern_character_class_source
              [
                "[" @punctuation.bracket
                ":" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_character_class_content_source) @character.special
              ])
            (pattern_collating_symbol_source
              [
                "[" @punctuation.bracket
                "." @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_collating_symbol_character_source) @character.special
              ])
            (pattern_equivalence_class_source
              [
                "[" @punctuation.bracket
                "=" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_equivalence_class_character_source) @character.special
              ])
          ])
      ])))

(array_assignment
  element: (word
    (pattern_bracket_source
      [
        "[" @punctuation.bracket
        "]" @punctuation.bracket
        (pattern_bracket_negation_source) @operator
        (pattern_bracket_members_source
          [
            (pattern_bracket_character_source) @character
            (pattern_bracket_hyphen_source) @character
            (pattern_bracket_range_source
              [
                (pattern_bracket_character_source) @character
                (pattern_bracket_hyphen_source) @character
                (pattern_bracket_range_operator_source) @operator
                (pattern_collating_symbol_source
                  [
                    "[" @punctuation.bracket
                    "." @punctuation.delimiter
                    "]" @punctuation.bracket
                    (pattern_collating_symbol_character_source) @character.special
                  ])
              ])
            (pattern_character_class_source
              [
                "[" @punctuation.bracket
                ":" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_character_class_content_source) @character.special
              ])
            (pattern_collating_symbol_source
              [
                "[" @punctuation.bracket
                "." @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_collating_symbol_character_source) @character.special
              ])
            (pattern_equivalence_class_source
              [
                "[" @punctuation.bracket
                "=" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_equivalence_class_character_source) @character.special
              ])
          ])
      ])))

(brace_alternative
  (pattern_bracket_source
    [
      "[" @punctuation.bracket
      "]" @punctuation.bracket
      (pattern_bracket_negation_source) @operator
      (pattern_bracket_members_source
        [
          (pattern_bracket_character_source) @character
          (pattern_bracket_hyphen_source) @character
          (pattern_bracket_range_source
            [
              (pattern_bracket_character_source) @character
              (pattern_bracket_hyphen_source) @character
              (pattern_bracket_range_operator_source) @operator
              (pattern_collating_symbol_source
                [
                  "[" @punctuation.bracket
                  "." @punctuation.delimiter
                  "]" @punctuation.bracket
                  (pattern_collating_symbol_character_source) @character.special
                ])
            ])
          (pattern_character_class_source
            [
              "[" @punctuation.bracket
              ":" @punctuation.delimiter
              "]" @punctuation.bracket
              (pattern_character_class_content_source) @character.special
            ])
          (pattern_collating_symbol_source
            [
              "[" @punctuation.bracket
              "." @punctuation.delimiter
              "]" @punctuation.bracket
              (pattern_collating_symbol_character_source) @character.special
            ])
          (pattern_equivalence_class_source
            [
              "[" @punctuation.bracket
              "=" @punctuation.delimiter
              "]" @punctuation.bracket
              (pattern_equivalence_class_character_source) @character.special
            ])
        ])
    ]))

(io_file
  filename: (word
    (pattern_bracket_source
      [
        "[" @punctuation.bracket
        "]" @punctuation.bracket
        (pattern_bracket_negation_source) @operator
        (pattern_bracket_members_source
          [
            (pattern_bracket_character_source) @character
            (pattern_bracket_hyphen_source) @character
            (pattern_bracket_range_source
              [
                (pattern_bracket_character_source) @character
                (pattern_bracket_hyphen_source) @character
                (pattern_bracket_range_operator_source) @operator
                (pattern_collating_symbol_source
                  [
                    "[" @punctuation.bracket
                    "." @punctuation.delimiter
                    "]" @punctuation.bracket
                    (pattern_collating_symbol_character_source) @character.special
                  ])
              ])
            (pattern_character_class_source
              [
                "[" @punctuation.bracket
                ":" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_character_class_content_source) @character.special
              ])
            (pattern_collating_symbol_source
              [
                "[" @punctuation.bracket
                "." @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_collating_symbol_character_source) @character.special
              ])
            (pattern_equivalence_class_source
              [
                "[" @punctuation.bracket
                "=" @punctuation.delimiter
                "]" @punctuation.bracket
                (pattern_equivalence_class_character_source) @character.special
              ])
          ])
      ])))

[
  (function_keyword)
  (select_keyword)
  (coproc_keyword)
  (time_keyword)
] @keyword

(declaration_name) @function.call

(coproc
  name: (word
    (literal) @label))

(time_option) @keyword.modifier

[
  (assignment_append)
  (conditional_unary_operator)
  (conditional_binary_operator)
  (conditional_match_operator)
  (conditional_regex_operator)
  (conditional_not)
  (pipe_and)
  (dsemi_and)
  (andgreat)
  (anddgreat)
  (here_string_operator)
  (parameter_indirection_operator)
  (parameter_names_operator)
  (parameter_substring_operator)
  (parameter_replacement_operator)
  (parameter_case_operator)
  (extglob_operator)
] @operator

(parameter_transformation
  (parameter_transformation_operator) @operator)

(parameter_transformation_code) @character.special

(parameter_replacement_reference) @string.special.symbol

(locale_quoted
  [
    "$"
    "\""
  ] @punctuation.delimiter)

(brace_endpoint) @string

(brace_increment) @number

(ordinary_character) @string.regexp

[
  (collating_element_single)
  (collating_element_multi)
  (class_name)
  (meta_character)
] @character.special

(one_char_or_coll_elem_ere
  "." @character.special)

(ere_expression
  [
    "^"
    "$"
  ] @operator)

(repetition_modifier) @operator

(duplication_count) @number

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
  (conditional_open)
  (conditional_close)
  (arithmetic_for_open)
] @punctuation.bracket

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
  (brace_sequence_separator) @punctuation.delimiter)

(parameter_substring
  (parameter_substring_separator) @punctuation.delimiter)

(parameter_replacement
  (parameter_replacement_separator) @punctuation.delimiter)

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
      (double_quote_text) @label)))

(line_continuation) @punctuation.special
