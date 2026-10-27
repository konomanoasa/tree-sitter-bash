use konomanoasa_tree_sitter_bash as grammar;
use tree_sitter::{
  InputEdit, Parser, Point, Query, QueryCursor, StreamingIterator, Tree,
};
use tree_sitter_language::LanguageFn;

fn parser(language: LanguageFn) -> Parser {
  let mut parser = Parser::new();
  parser.set_language(&language.into()).unwrap();
  parser
}

fn snapshot(tree: &Tree) -> Vec<String> {
  let mut cursor = tree.walk();
  let mut depth = 0;
  let mut result = Vec::new();
  loop {
    let node = cursor.node();
    result.push(format!(
      "{depth} {:?} {} {:?} {:?} {:?} {} {} {} {}",
      cursor.field_name(),
      node.kind(),
      node.byte_range(),
      node.start_position(),
      node.end_position(),
      node.is_named(),
      node.is_extra(),
      node.is_error(),
      node.is_missing()
    ));
    if cursor.goto_first_child() {
      depth += 1;
      continue;
    }
    while !cursor.goto_next_sibling() {
      if !cursor.goto_parent() {
        return result;
      }
      depth -= 1;
    }
  }
}

fn point(source: &[u8], end: usize) -> Point {
  let prefix = &source[..end];
  Point::new(
    prefix.iter().filter(|byte| **byte == b'\n').count(),
    end
      - prefix
        .iter()
        .rposition(|byte| *byte == b'\n')
        .map_or(0, |at| at + 1),
  )
}

fn replace(
  parser: &mut Parser,
  source: &mut Vec<u8>,
  tree: &mut Tree,
  at: usize,
  count: usize,
  insertion: &[u8],
) {
  let start = point(source, at);
  let old_end = point(source, at + count);
  source.splice(at..at + count, insertion.iter().copied());
  tree.edit(&InputEdit {
    start_byte: at,
    old_end_byte: at + count,
    new_end_byte: at + insertion.len(),
    start_position: start,
    old_end_position: old_end,
    new_end_position: point(source, at + insertion.len()),
  });
  *tree = parser.parse(&*source, Some(tree)).unwrap();
}

fn captures(
  language: LanguageFn,
  source: &str,
  query: &Query,
) -> Vec<(usize, usize, String)> {
  let tree = parser(language).parse(source, None).unwrap();
  let mut cursor = QueryCursor::new();
  let mut matches = cursor.matches(query, tree.root_node(), source.as_bytes());
  let mut result = Vec::new();
  while let Some(matched) = matches.next() {
    for capture in matched.captures() {
      let mut children = capture.node.walk();
      assert!(
        capture.node.children(&mut children).all(|child| {
          child.kind() == "line_continuation" && child.child_count() == 0
        }),
        "non-lexical capture {} in {source:?}",
        capture.node.kind()
      );
      assert!(!capture.node.is_error());
      if !capture.node.is_missing() {
        result.push((
          matched.pattern_index,
          capture.node.start_byte(),
          capture.node.end_byte(),
          query.capture_names()[capture.index as usize].to_owned(),
        ));
      }
    }
  }
  result.sort_by_key(|capture| capture.0);
  let mut final_captures = vec![None; source.len()];
  for (_, start, end, name) in result {
    final_captures[start..end].fill(Some(name));
  }
  let mut ranges = Vec::new();
  let mut start = 0;
  while start < final_captures.len() {
    let mut end = start + 1;
    while end < final_captures.len()
      && final_captures[end] == final_captures[start]
    {
      end += 1;
    }
    if let Some(name) = &final_captures[start] {
      ranges.push((start, end, name.clone()));
    }
    start = end;
  }
  ranges
}

#[test]
fn parses_valid_source() {
  let tree = parser(grammar::LANGUAGE)
    .parse("echo hello\n", None)
    .unwrap();
  assert_eq!(tree.root_node().kind(), "program");
  assert_eq!(tree.root_node().byte_range(), 0..11);
  assert!(!tree.root_node().has_error());
  assert!(grammar::NODE_TYPES.contains("\"program\""));
  Query::new(&grammar::LANGUAGE.into(), grammar::HIGHLIGHTS_QUERY).unwrap();
}

#[test]
fn parses_fixed_conditions_for_every_language() {
  for (name, language, node_types, extglob) in [
    ("bash", grammar::LANGUAGE, grammar::NODE_TYPES, false),
    (
      "bash_extglob",
      grammar::LANGUAGE_EXTGLOB,
      grammar::NODE_TYPES_EXTGLOB,
      true,
    ),
  ] {
    let language = language.into();
    let mut parser = Parser::new();
    parser.set_language(&language).unwrap();
    assert_eq!(language.name(), Some(name));
    Query::new(&language, grammar::HIGHLIGHTS_QUERY).unwrap();
    assert_eq!(node_types, grammar::NODE_TYPES, "{name}: shared CST schema");
    for (source, valid) in [
      ("echo hello\n", true),
      (": @(a|b)\n", extglob),
      ("@() { :; }\n", !extglob),
      ("[[ a == $(: @(a|b)) ]]\n", true),
      (": \"${s:-$'${p}'}\" \"${a[key]}\"\n", true),
    ] {
      let tree = parser.parse(source, None).unwrap();
      assert_eq!(!tree.root_node().has_error(), valid, "{name}: {source:?}");
    }

    let delimiter = "${x:-ab}";
    let original =
      format!("shopt -s extquote\n: <<\"${{x:-$'ab'}}\"\nbody\n{delimiter}\n")
        .into_bytes();
    let mut source = original.clone();
    let mut tree = parser.parse(&source, None).unwrap();
    assert!(!tree.root_node().has_error(), "{name}");
    assert_eq!(tree.root_node().byte_range(), 0..source.len());
    let initial = snapshot(&tree);
    let query = Query::new(&language, "(here_document_end_text) @end").unwrap();
    let mut cursor = QueryCursor::new();
    let mut matches = cursor.matches(&query, tree.root_node(), &*source);
    let mut ends = Vec::new();
    while let Some(matched) = matches.next() {
      for capture in matched.captures() {
        ends.push(capture.node.utf8_text(&source).unwrap().to_owned());
      }
    }
    assert_eq!(ends, [delimiter], "{name}: delimiter source range");

    let setting = original.windows(2).position(|b| b == b"-s").unwrap() + 1;
    replace(&mut parser, &mut source, &mut tree, setting, 1, b"u");
    let fresh = parser.parse(&source, None).unwrap();
    assert!(!fresh.root_node().has_error(), "{name}: edited setting");
    assert_eq!(snapshot(&tree), snapshot(&fresh), "{name}: edit");
    replace(&mut parser, &mut source, &mut tree, setting, 1, b"s");
    assert_eq!(source, original);
    assert_eq!(snapshot(&tree), initial, "{name}: undo");
  }
}

#[test]
fn highlights_lexical_nodes_with_context_precedence() {
  let query =
    Query::new(&grammar::LANGUAGE_EXTGLOB.into(), grammar::HIGHLIGHTS_QUERY)
      .unwrap();
  let source = "x=\"$1\"; echo ~ @(a|b) [[:alpha:]][[=a=]]\n";
  let actual = captures(grammar::LANGUAGE_EXTGLOB, source, &query);
  let expected = [
    (0, 1, "variable"),
    (1, 2, "operator"),
    (2, 3, "punctuation.delimiter"),
    (3, 4, "variable"),
    (4, 5, "variable.parameter"),
    (5, 7, "punctuation.delimiter"),
    (8, 12, "function.call"),
    (13, 14, "string.special.path"),
    (15, 16, "operator"),
    (16, 17, "punctuation.bracket"),
    (17, 18, "string.regexp"),
    (18, 19, "operator"),
    (19, 20, "string.regexp"),
    (20, 21, "punctuation.bracket"),
    (22, 24, "punctuation.bracket"),
    (24, 25, "punctuation.delimiter"),
    (25, 30, "character.special"),
    (30, 31, "punctuation.delimiter"),
    (31, 35, "punctuation.bracket"),
    (35, 36, "punctuation.delimiter"),
    (36, 37, "character.special"),
    (37, 38, "punctuation.delimiter"),
    (38, 40, "punctuation.bracket"),
  ];
  assert_eq!(
    actual,
    expected
      .into_iter()
      .map(|(a, b, c)| (a, b, c.to_owned()))
      .collect::<Vec<_>>()
  );
  assert_eq!(
    captures(grammar::LANGUAGE_EXTGLOB, "echo plain # comment\n", &query),
    vec![
      (0, 4, "function.call".into()),
      (5, 10, "string".into()),
      (11, 20, "comment".into()),
    ]
  );
  assert_eq!(
    captures(grammar::LANGUAGE_EXTGLOB, "ec\\\nho ab\\\ncd\n", &query),
    vec![
      (0, 2, "function.call".into()),
      (2, 3, "punctuation.special".into()),
      (3, 6, "function.call".into()),
      (7, 9, "string".into()),
      (9, 10, "punctuation.special".into()),
      (10, 13, "string".into()),
    ]
  );
}

#[test]
fn ere_group_fields_survive_adjacent_quotes_and_expansions() {
  let query = Query::new(
    &grammar::LANGUAGE_EXTGLOB.into(),
    r#"(ere_expression opening: "(" @opening closing: ")" @closing)"#,
  )
  .unwrap();
  let source = "[[ x =~ \"${p}\"(a|b)+${q}(c) ]]\n";
  assert_eq!(
    captures(grammar::LANGUAGE_EXTGLOB, source, &query),
    vec![
      (14, 15, "opening".into()),
      (18, 19, "closing".into()),
      (24, 25, "opening".into()),
      (26, 27, "closing".into()),
    ]
  );
  assert_eq!(
    captures(grammar::LANGUAGE_EXTGLOB, "[[ x =~ () ]]\n", &query),
    vec![(8, 9, "opening".into()), (9, 10, "closing".into()),]
  );
}

#[test]
fn ere_fields_own_direct_children_of_flat_static_and_source_expressions() {
  let source =
    r#"[[ x =~ ^(a|bc){2,3}?d{4}e{5,}()[[:alpha:][.ch.][=é=][.ab${p}cd.]]$ ]]"#;
  let tree = parser(grammar::LANGUAGE_EXTGLOB)
    .parse(source, None)
    .unwrap();
  assert!(!tree.root_node().has_error());
  for (kind, text, expected) in [
    (
      "ere_expression",
      "(a|bc){2,3}?",
      vec![("opening", "("), ("expression", "a|bc"), ("closing", ")")],
    ),
    (
      "ere_expression",
      "()",
      vec![("opening", "("), ("closing", ")")],
    ),
    (
      "ere_dupl_symbol",
      "{2,3}?",
      vec![("minimum", "2"), ("maximum", "3"), ("modifier", "?")],
    ),
    ("ere_dupl_symbol", "{4}", vec![("minimum", "4")]),
    ("ere_dupl_symbol", "{5,}", vec![("minimum", "5")]),
    ("character_class", "[:alpha:]", vec![("name", "alpha")]),
    ("collating_symbol", "[.ch.]", vec![("element", "ch")]),
    ("equivalence_class", "[=é=]", vec![("element", "é")]),
    (
      "collating_symbol",
      "[.ab${p}cd.]",
      vec![("element", "ab${p}cd")],
    ),
  ] {
    let start = source.find(text).unwrap();
    let node = tree
      .root_node()
      .descendant_for_byte_range(start, start + text.len())
      .unwrap();
    assert_eq!(node.kind(), kind, "{text}");
    let actual: Vec<_> = node
      .children(&mut node.walk())
      .enumerate()
      .filter_map(|(index, child)| {
        node
          .field_name_for_child(index as u32)
          .map(|field| (field, child.utf8_text(source.as_bytes()).unwrap()))
      })
      .collect();
    assert_eq!(actual, expected, "{text}");
    for (field, value) in expected {
      let child = node.child_by_field_name(field).unwrap();
      assert_eq!(child.parent(), Some(node), "{text}: {field}");
      assert_eq!(
        child.utf8_text(source.as_bytes()).unwrap(),
        value,
        "{text}: {field}"
      );
    }
  }
  for source in ["[[ x =~ ()*?+? ]]", "[[ x =~ \"p\"()*?+?${q} ]]"] {
    let tree = parser(grammar::LANGUAGE_EXTGLOB)
      .parse(source, None)
      .unwrap();
    assert!(!tree.root_node().has_error(), "{source}");
    let start = source.find("()").unwrap();
    let expression = tree
      .root_node()
      .descendant_for_byte_range(start, start + 6)
      .unwrap();
    assert_eq!(expression.kind(), "ere_expression");
    assert!(expression.child_by_field_name("expression").is_none());
    let children: Vec<_> = expression
      .children(&mut expression.walk())
      .map(|node| node.kind())
      .collect();
    assert_eq!(children, ["(", ")", "ere_dupl_symbol", "ere_dupl_symbol"]);
    for symbol in expression.named_children(&mut expression.walk()) {
      let modifier = symbol.child_by_field_name("modifier").unwrap();
      assert_eq!(modifier.kind(), "repetition_modifier");
      assert_eq!(modifier.child_count(), 0);
      assert_eq!(modifier.parent(), Some(symbol));
    }
  }
}

#[test]
fn collating_payload_leaves_preserve_logical_lengths_and_source_ranges() {
  let source = "[[ x =~ [[.é.][.a\\\nb.][=日=][=ab=][.-.][.ab${p}cd.]] ]]";
  let tree = parser(grammar::LANGUAGE_EXTGLOB)
    .parse(source, None)
    .unwrap();
  assert!(!tree.root_node().has_error());
  let mut pending = vec![tree.root_node()];
  let mut payloads = Vec::new();
  let mut continuations = Vec::new();
  while let Some(node) = pending.pop() {
    if node.kind() == "line_continuation" {
      assert_eq!(node.child_count(), 0);
      continuations.push(node.byte_range());
    }
    if matches!(node.kind(), "collating_symbol" | "equivalence_class") {
      let payload = node.child_by_field_name("element").unwrap();
      assert_eq!(payload.parent(), Some(node));
      let children: Vec<_> = payload
        .children(&mut payload.walk())
        .filter(|child| child.kind() != "line_continuation")
        .map(|child| child.kind())
        .collect();
      payloads.push((
        payload.kind(),
        payload.utf8_text(source.as_bytes()).unwrap(),
        children,
      ));
    }
    for index in (0..node.child_count()).rev() {
      pending.push(node.child(index).unwrap());
    }
  }
  assert_eq!(
    payloads,
    vec![
      ("collating_element_single", "é", vec![]),
      ("collating_element_multi", "a\\\nb", vec![]),
      ("collating_element_single", "日", vec![]),
      ("collating_element_multi", "ab", vec![]),
      ("meta_character", "-", vec![]),
      (
        "regex_source_expression",
        "ab${p}cd",
        vec![
          "collating_element_multi",
          "parameter_expansion",
          "collating_element_multi"
        ]
      ),
    ]
  );
  let continuation = source.find("\\\n").unwrap();
  assert_eq!(continuations, vec![continuation..continuation + 1]);
  let query =
    Query::new(&grammar::LANGUAGE_EXTGLOB.into(), grammar::HIGHLIGHTS_QUERY)
      .unwrap();
  captures(grammar::LANGUAGE_EXTGLOB, source, &query);
}

#[test]
fn highlights_remain_lexical_across_continuations_and_recovery() {
  let query =
    Query::new(&grammar::LANGUAGE_EXTGLOB.into(), grammar::HIGHLIGHTS_QUERY)
      .unwrap();
  for source in [
    "if [[ $x == @(a|b) ]]; then a=(1 \"x\"); echo ${a[0]} $((1+2)); fi\n",
    "cat <<EOF\nabc${x}def\nEOF\n",
    "function f { declare x=$'a\\n'; : {fd}>>out; } # note\n",
  ] {
    for at in 0..source.len() {
      let continued = format!("{}\\\n{}", &source[..at], &source[at..]);
      captures(grammar::LANGUAGE_EXTGLOB, &continued, &query);
      captures(grammar::LANGUAGE_EXTGLOB, &source[..at], &query);
    }
  }
  for source in [
    "echo `echo \\\"$x\\\"`\n",
    "cat <<EOF\n$x\nEOF\n",
    "[[ x =~ ^(a|${p})+[[:di\\\ngit:]]{${n},4}?$ ]]\n",
  ] {
    captures(grammar::LANGUAGE_EXTGLOB, source, &query);
  }
}

#[test]
fn repair_every_byte_restores_complete_cst_and_ranges() {
  for seed in [
    "time -p : | time : |& ti\\\nme() { :; }\n",
    "[[ a[日]=~ && $x]] == \"x\"=~ && -n \\]\\] ]]\n",
    "[[ $x]] =~ \"]]\" ]]; [[ \"$([[ x ]] && printf 日)\"-eq ]]\n",
    "[[ x =~ ]]\\\n(a)||x ]]\n",
    ": {[日,本]} [{a,b}-z] [a-{b,c}] [[:{upper,lower}:]]\n",
    ": @\\\n({日,本 c}) {@(a,b},c) @({a,b),c}\n",
    ": @(({a,b),c}) @({(a,b},c)) @(({a,b}))\n",
    ": {a,[b\\,c]} {a,@(\"b,c\"|d)} {a,@({x,y}|z)}\n",
    ": {a,@($(printf 'x,y}')|c)} tail\n",
    "a=([{a,b c}]); a[b[c d] e] tail\n",
    "x=[{a,b}]; case @({a,b}) in [{a,b}]) :;; esac; [[ x == @({a,b}) ]]\n",
    ": pre{日,<\\\n(printf 'x,}'),>(:)}post\n",
    ": <<OUT {a,<(cat <<'INNER'\n},(\nINNER\n)}\n$body\nOUT\n",
    "(( $'a\\'b' )); echo after\n",
    "echo $(( $\\\n'a\\'日' + $\\\n\"$x\" + $\n'1' + $ ))\n",
    "for (($'a;))';$\"b;))\";$'c\\'')); do :; done\n",
    ": <<OUT \"$(cat << ${|\\\n\t :; }\n日$x\n${|\t :; }\n)\"\n$y\nOUT\n",
    "cat << ${\\\n\tprintf \"x\"; } << \"\"${| \t:; }\n$x\n${\tprintf \"x\"; }\n$y\n${| \t:; }\n",
    "cat << \"${ printf $'a\\tb'; }\" << \"${|printf $'a\\tb'; }\"\n$x\n${ printf 'a\tb'; }\n$y\n${|printf 'a\tb'; }\n",
    ": \"$(cat << @($'a\\tb'|c)\n$x\n@('a\tb'|c)\n)\"\n",
    ": <<OUT \"$(cat << pre<(printf \"日\")post\n$x\npre<(printf \"日\")post\n)\"\n$y\nOUT\n",
    "cat << @(\"a b\"|c\\ d) << \"\"@(\"a b\"|c\\ d)\n$x\n@(\"a b\"|c\\ d)\n$y\n@(a b|c d)\n",
    "cat << @($'a\\tb'|c) << \"${v:-$'a\\\"b'}\"\n$x\n@('a\tb'|c)\n$y\n${v:-ab}\n",
    "cat << \"\"$(printf \"a b\")\n$x\n$(printf a b)\n",
    ": {f\\\nd[\"日\\\n本\"]}\\\n>out {fd[$(printf x)]}<<EOF\nbody\nEOF\n",
    ": 2<(printf x) {fd}>(:) {fd[0]}<(printf y); : >\"2\">out\n",
    "{ :; } &>out; f() { :; } &>>log\n",
    "a=([a b] [a;b] [a|b] [a<b] [(] [)] [a\nb] [key]=value)\n",
    "a=([x][a b] \"[a b]\" \\[a b] a[x y])\n",
    "a=([\"x y\"$p$(b=([x y]); printf z)日本\\\n ]suffix)\n",
    ">out x=y a=(one) declare b=(two); x=() >out c=z declare a=$v b+=~/p\n",
    ": ${x:1?2} ${x:(1} ${x:1)} ${x:0:1:2}\n",
    ": \"${s: (n > 0 ? 1 : 0):2}\" ${s:0x$y:2+3*4} ${s:(x y)+08: a[\"1:2\"] }\n",
    ": ${s:} ${s::} ${s: \t: \n} ${s:1+2 : 3*4 }\n",
    ": \"${x:1?${n:-2}:$(printf 3):a[\"1:2\"]}\" ${x:(${y:1?2:3:4}):`printf 2`}\n",
    ": ${x:-${y:1:2}:suffix} ${x:-${y/a/b}/suffix}\n",
    ": ${x/${y:-a\\/b}/\"${z:-c}d\"}\n",
    ": \"${x:(1?${n:-2}:3)\\\n:\\\n${y:-日\\\n本:5}}\"\n",
    ": <<OUT \"$(cat <<ONE <<'TWO'\n$first\nONE\n$second\nTWO\n)\" <<LAST\n$outer\nOUT\n$last\nLAST\n",
    "cat <<OUT\n$(cat <<IN\n日$x\nI\\\nN\n)\nOUT\n",
    ": <<OUT \"`cat <<-'IN'\n\t$x\n\tIN\n`\"\n$outer\nOUT\n",
    "cat <<OUT\n${| cat <<IN\n$x\nIN\nREPLY=reply\n}\nOUT\n",
    "cat <<'' <<EOF\n$v\n\n$w\nEOF\n",
    "for ((a[x;y;z])); do :; done\n",
    "for ((((x;y);z))); do :; done; for (((x;(y);z))); do :; done\n",
    "for ((((x y)(z w);0;))); do :; done\n",
    "for ((((日\\\n本 x);)(z w)(;))); do :; done\n",
    "echo $(for ((a[\"x;y\"];0;)); do :; done)\n",
    "echo `for (((x;y;z))); do :; done`\n",
    "a[(]=x; a[)]+=y; declare -A a=([)(]=z); echo \"${a[(key)]}\"\n",
    "a[$(coproc worker b[ ) ]=x c=(1))]=y; echo $(a[(]=x)\n",
    "echo $((a[(]+1))) $((a[)(]+1)); ((a[(]+1)); echo $((a[$((1+2))]+1))\n",
    "for x; { :; }; select x do :; done\n",
    "coproc a[ 日本 ] { :; }; coproc wo\"$name\"(:)\n",
    "coproc worker a[ ]=v a=(1) declare b=(2); coproc worker a[ ] tail\n",
    "a=([key]=\"${x:-$(echo y)}\")\n",
    "a[(i+1)]=x; declare a[x y]=z b[\"x y\"]=v; a[(x)] () { :; }\n",
    "a[$\"key\"]=x; echo \"${a[$\"key\"]}\" ${x:$'1':$\"2\"}\n",
    "echo ${x//[a/]/X} ${x//[a\\/]/X} ${x/@(a/b)/X}\n",
    "echo ${x/@(a[)]b)/X} ${x/@(a[)/X} ${x#@(a}\n",
    "a[ ] one; a[(x)] two; a[x][ ] three; a[] next\n",
    "a[\"x y\"$p$(printf x)日本\\\n ]suffix tail\n",
    "a[$(>out x=y a[)] ) ] next; a[ ]@(x|y) arg\n",
    "if [[ $x == @(a|b) ]]; then ((a+=1)); fi\n",
    "cat <<EOF\n${x//a/b}\nEOF\nprintf done\n",
    "for ((i=0;i<2;i++)); do echo <(printf 日本語); done\n",
    ": {fd}>out; cat {input}<<EOF\nbody\nEOF\n",
    "[[ x =~ ^(a|${p})+[[:digit:]a-z]{${n},4}?$ ]]\n",
    "[[ x =~ \"ab\"+([a)]b ]]; echo after\n",
    "[[ x =~ [[.a${p}c.]][[:al\"ph\"a:]] ]]\n",
    "[[ x =~ [[.é.][.a\\\nb.][.ab${p}cd.][=(a)=]] ]]; echo next\n",
    "[[ x =~ ([[.a).]]b ]]; echo next\n",
    "[[ x =~ [[.(a.]]b) ]]; echo next\n",
  ] {
    let mut parser = parser(grammar::LANGUAGE_EXTGLOB);
    let original = parser.parse(seed, None).unwrap();
    assert!(!original.root_node().has_error(), "{seed}");
    let expected = snapshot(&original);
    for at in 0..seed.len() {
      let mut source = seed.as_bytes().to_vec();
      let mut tree = original.clone();
      replace(&mut parser, &mut source, &mut tree, at, 1, b"");
      let fresh = parser.parse(&source, None).unwrap();
      let repeated = parser.parse(&source, None).unwrap();
      assert_eq!(
        snapshot(&fresh),
        snapshot(&repeated),
        "fresh {seed:?} at {at}"
      );
      if !fresh.root_node().has_error() {
        assert_eq!(
          snapshot(&tree),
          snapshot(&fresh),
          "incremental {seed:?} at {at}"
        );
      }
      replace(
        &mut parser,
        &mut source,
        &mut tree,
        at,
        0,
        &seed.as_bytes()[at..at + 1],
      );
      assert_eq!(snapshot(&tree), expected, "repair {seed:?} at {at}");
    }
  }
}

#[test]
fn large_bodies_and_compressed_nesting_preserve_incremental_structure() {
  let delimiter_padding = 256;
  let delimiter_quotes = 16_384;
  let word_bytes = 1_048_576;
  let body_bytes = 1_048_576;
  let command_rows = 16_384;
  let substring_depth = 1_024;
  let subscript_characters = 16_384;
  let word_depth = 32;
  let extglob_depth = 128;
  let substitution_depth = 64;
  let arithmetic_for_depth = 1_024;
  let ere_text_characters = 16_384;
  let ere_branches = 4_096;
  let ere_group_depth = 1_024;
  let ere_bracket_characters = 4_096;
  let ere_source_segments = 1_024;
  let sources = [
    format!(
      "cat << ${{|{0}:; }}\nx\n${{|{0}:; }}\n",
      " ".repeat(delimiter_padding)
    ),
    format!(
      "cat << \"$(printf '{}')\"\nx\n$(printf '')\n",
      "\"".repeat(delimiter_quotes)
    ),
    format!("echo x{}\n", "a".repeat(word_bytes)),
    format!("cat <<EOF\nx{}\nEOF\n", "a".repeat(body_bytes)),
    "echo x\n".repeat(command_rows),
    format!(
      ": ${{s:{}x${{n:-1}}{}:2}}\n",
      "(".repeat(substring_depth),
      ")".repeat(substring_depth)
    ),
    format!(
      ": ${{s:{}${{n:-x}}{}:2}}\n",
      "1?".repeat(substring_depth),
      ":1".repeat(substring_depth)
    ),
    format!("a[x{} ] tail\n", "a".repeat(subscript_characters)),
    format!("a=([x{} ] tail)\n", "a".repeat(subscript_characters)),
    format!(": {{fd[x{}]}}>out\n", "a".repeat(subscript_characters)),
    format!(
      "{}x{}\n",
      "a[$(".repeat(word_depth),
      ") ]".repeat(word_depth)
    ),
    format!(
      "echo {}x{}\n",
      "@(".repeat(extglob_depth),
      ")".repeat(extglob_depth)
    ),
    format!(
      "echo {}x{}\n",
      "$(echo ".repeat(substitution_depth),
      ")".repeat(substitution_depth)
    ),
    format!(
      "for (({}x y{};0;)); do :; done\n",
      "(".repeat(arithmetic_for_depth),
      ")".repeat(arithmetic_for_depth)
    ),
    format!(
      "for (({}x;y;z{})); do :; done\n",
      "(".repeat(arithmetic_for_depth),
      ")".repeat(arithmetic_for_depth)
    ),
    format!(
      "for (({};0;{})); do :; done\n",
      "((x y)".repeat(arithmetic_for_depth),
      ")".repeat(arithmetic_for_depth)
    ),
    format!("[[ s =~ x{} ]]\n", "a".repeat(ere_text_characters)),
    format!("[[ s =~ x{} ]]\n", "|a".repeat(ere_branches)),
    format!(
      "[[ s =~ {}x{} ]]\n",
      "(".repeat(ere_group_depth),
      ")".repeat(ere_group_depth)
    ),
    format!("[[ s =~ [x{}] ]]\n", "a".repeat(ere_bracket_characters)),
    format!("[[ s =~ [[.x{}.]] ]]\n", "a".repeat(ere_text_characters)),
    format!(
      "[[ s =~ \"p\"(x){} ]]\n",
      "\"q\"(a)".repeat(ere_source_segments)
    ),
  ];
  for seed in sources {
    let mut parser = parser(grammar::LANGUAGE_EXTGLOB);
    let mut tree = parser.parse(&seed, None).unwrap();
    assert!(!tree.root_node().has_error(), "{} bytes", seed.len());
    let at = seed.find('x').unwrap();
    let mut source = seed.into_bytes();
    replace(&mut parser, &mut source, &mut tree, at, 1, b"y");
    let fresh = parser.parse(&source, None).unwrap();
    assert!(!tree.root_node().has_error());
    assert_eq!(snapshot(&tree), snapshot(&fresh));
  }
}

#[test]
fn metadata_overflow_finishes_and_repaired_input_is_reusable() {
  let delimiter_bytes = 2048;
  let reply_padding_bytes = 16_384;
  for source in [
    format!("cat <<{}\n", "a".repeat(delimiter_bytes)),
    format!(
      "cat << ${{|{}:; }}\nx\n${{|:; }}\n",
      " ".repeat(reply_padding_bytes)
    ),
  ] {
    let mut parser = parser(grammar::LANGUAGE_EXTGLOB);
    let mut tree = parser.parse(&source, None).unwrap();
    assert!(tree.root_node().has_error());
    assert_eq!(tree.root_node().end_byte(), source.len());
    let mut bytes = source.into_bytes();
    let length = bytes.len();
    replace(
      &mut parser,
      &mut bytes,
      &mut tree,
      0,
      length,
      b"cat <<EOF\nx\nEOF\n",
    );
    let fresh = parser.parse(&bytes, None).unwrap();
    assert!(!tree.root_node().has_error());
    assert_eq!(snapshot(&tree), snapshot(&fresh));
  }
}
