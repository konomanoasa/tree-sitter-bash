# tree-sitter-bash

[![CI](https://github.com/konomanoasa/tree-sitter-bash/actions/workflows/ci.yaml/badge.svg)](https://github.com/konomanoasa/tree-sitter-bash/actions/workflows/ci.yaml)
[![crates.io](https://img.shields.io/crates/v/konomanoasa-tree-sitter-bash)](https://crates.io/crates/konomanoasa-tree-sitter-bash)
[![npm](https://img.shields.io/npm/v/@konomanoasa/tree-sitter-bash)](https://www.npmjs.com/package/@konomanoasa/tree-sitter-bash)

[Tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammars for
GNU Bourne Again SHell 5.3.

## Installation

```sh
npm install @konomanoasa/tree-sitter-bash
```

## Parsing Option

For Bash parsing with `extglob` enabled, use `bash_extglob`.

## Parsing Policy

[Parsing Policy](PARSING_POLICY.md)

## Development

```sh
npm install
npm run build
npm test
```

## Specification

[GNU Bash Reference Manual 5.3](https://www.gnu.org/software/bash/manual/bash.html)

## License

[MIT](LICENSE)

## Used By

[bash-ts-mode](https://github.com/konomanoasa/bash-ts-mode)
