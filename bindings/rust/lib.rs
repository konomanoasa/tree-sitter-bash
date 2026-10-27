use tree_sitter_language::LanguageFn;

unsafe extern "C" {
  fn tree_sitter_bash() -> *const ();
  fn tree_sitter_bash_extglob() -> *const ();
}

pub const LANGUAGE: LanguageFn =
  unsafe { LanguageFn::from_raw(tree_sitter_bash) };
pub const NODE_TYPES: &str = include_str!("../../src/node-types.json");
pub const HIGHLIGHTS_QUERY: &str = include_str!("../../queries/highlights.scm");

pub const LANGUAGE_EXTGLOB: LanguageFn =
  unsafe { LanguageFn::from_raw(tree_sitter_bash_extglob) };
pub const NODE_TYPES_EXTGLOB: &str =
  include_str!("../../bash_extglob/src/node-types.json");
