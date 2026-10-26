# Parsing Policy

The parser analyzes source as written. It parses the following commands but
does not apply their effects to parsing.

| Command            | Effects not applied                                               |
| ------------------ | ----------------------------------------------------------------- |
| `.`, `source`      | Loading another file or applying changes made by its execution.   |
| `alias`, `unalias` | Alias substitution or changes to alias definitions.               |
| `eval`             | Reparsing code constructed from its arguments.                    |
| `set`, `shopt`     | Changing parsing conditions in response to shell option settings. |

Only `extglob` can be selected through the grammar. Use `bash` for enabled
or `bash_default` for disabled, for the whole document. Commands in the source
do not change this selection.
