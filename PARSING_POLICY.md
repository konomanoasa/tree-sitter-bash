# Parsing Policy

`bash_default` parses source using [Bash 5.3](https://www.gnu.org/software/bash/manual/bash.html) default settings. To parse with `extglob`
enabled, use `bash_extglob`. The selected grammar applies to the whole document.

The following commands can affect how subsequent source is parsed. The parser
recognizes these commands but does not apply their effects.

| Command            | Effects not applied                                 |
| ------------------ | --------------------------------------------------- |
| `alias`, `unalias` | Alias substitution or changes to alias definitions. |
| `set`, `shopt`     | Changes to shell option settings.                   |
