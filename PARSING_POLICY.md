# Parsing Policy

This document describes the parsing conditions and how the parser preserves
syntax whose interpretation remains unresolved.

The settings and constructs covered are:

- [`extglob`](#extglob) (`shopt`): enables extended pattern syntax.
- [`extquote`](#extquote) (`shopt`): changes dollar-prefixed quoting within double-quoted parameter expansions.
- [`patsub_replacement`](#patsub_replacement) (`shopt`): makes replacement `&` refer to matched text.
- [`braceexpand`](#braceexpand-and-noglob) (`set`): enables brace expansion.
- [`noglob`](#braceexpand-and-noglob) (`set`): disables filename expansion.
- [Array Subscripts](#array-subscripts)
- [Arithmetic Regions](#arithmetic-regions)
- [Regular Expression Operands](#regular-expression-operands)

## [extglob](https://www.gnu.org/software/bash/manual/html_node/Pattern-Matching.html)

Select one grammar for the whole document: `bash` to parse with `extglob`
enabled, or `bash_default` to parse with it disabled.
However, extended patterns are always enabled in conditional pattern operands.

```bash
[[ $value == @(a|b) ]]
```

## [extquote](https://www.gnu.org/software/bash/manual/html_node/The-Shopt-Builtin.html)

Both grammars fix `extquote` to enabled.
Dollar-prefixed quoting is also recognized within double-quoted parameter expansions.

```bash
printf '%s\n' "${value:-$'a\nb'}"
```

## [patsub_replacement](https://www.gnu.org/software/bash/manual/html_node/Shell-Parameter-Expansion.html)

The parser preserves replacement `&` as an ordinary character with its
interpretation as a reference to matched text unresolved.

```bash
printf '%s\n' "${value/x/&}"
```

## [braceexpand and noglob](https://www.gnu.org/software/bash/manual/html_node/The-Set-Builtin.html)

The parser preserves brace and pattern source structures regardless of these
settings, with their interpretation during expansion unresolved.

```bash
printf '%s\n' {a,b} *.txt
```

## [Array Subscripts](https://www.gnu.org/software/bash/manual/html_node/Arrays.html)

The parser preserves parts of a subscript that can be read as arithmetic as
candidates, with interpretation dependent on the array type unresolved.
Quotes and expansions remain structured. A whole unquoted `@` or `*` is an
all-elements candidate.

```bash
printf '%s\n' "${a[i + 1]}"
```

## [Arithmetic Regions](https://www.gnu.org/software/bash/manual/html_node/Shell-Arithmetic.html)

The parser preserves arithmetic structure and nested expansions that can be
determined from source. Parts dependent on expansion results remain unresolved.
The same policy applies to arithmetic commands, arithmetic `for`, and substring
expressions.

```bash
printf '%s\n' "$((++$x))"
```

## [Regular Expression Operands](https://www.gnu.org/software/bash/manual/html_node/Conditional-Constructs.html)

The parser preserves regular expression structure that can be determined from
source. Parts dependent on expansion results remain unresolved.

```bash
[[ $value =~ "$prefix"+ ]]
```
