import unittest
from types import CapsuleType

import tree_sitter_bash

from tree_sitter import Language, Parser, Query, QueryCursor


class BindingsTest(unittest.TestCase):
    def test_languages_parse_source_and_packaged_queries_capture_comments(self):
        source = b"# sample\ncat <<E\n$expanded\nE\n"
        for name, factory in [
            ("bash", tree_sitter_bash.language),
            ("bash_extglob", tree_sitter_bash.language_extglob),
        ]:
            with self.subTest(language=name):
                capsule = factory()
                self.assertIsInstance(capsule, CapsuleType)
                language = Language(capsule)
                self.assertEqual(language.name, name)
                tree = Parser(language).parse(source)
                self.assertEqual(tree.root_node.type, "program")
                self.assertEqual(tree.root_node.text, source)
                self.assertFalse(tree.root_node.has_error)
                query = Query(language, tree_sitter_bash.HIGHLIGHTS_QUERY)
                captures = QueryCursor(query).captures(tree.root_node)
                self.assertEqual(
                    [node.text for node in captures["comment"]], [b"# sample"]
                )


if __name__ == "__main__":
    unittest.main()
