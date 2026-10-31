import sys
from pathlib import Path

from setuptools import Extension, setup

Path("dist/metadata").mkdir(parents=True, exist_ok=True)

setup(
    options={
        "build": {"build_base": "dist/build"},
        "egg_info": {"egg_base": "dist/metadata"},
    },
    ext_modules=[
        Extension(
            "tree_sitter_bash.binding",
            sources=[
                "bash_extglob/src/parser.c",
                "bash_extglob/src/scanner.c",
                "bindings/python/binding.c",
                "src/parser.c",
                "src/scanner.c",
            ],
            include_dirs=["src", "bash_extglob/src"],
            depends=[
                "bash_extglob/src/tokens.h",
                "bash_extglob/src/tree_sitter/alloc.h",
                "bash_extglob/src/tree_sitter/parser.h",
                "common/arithmetic.h",
                "common/input.h",
                "common/scanner.h",
                "common/source.h",
                "src/tokens.h",
                "src/tree_sitter/alloc.h",
                "src/tree_sitter/parser.h",
            ],
            extra_compile_args=["/std:c17", "/utf-8"]
            if sys.platform == "win32"
            else ["-std=c17"],
        )
    ],
)
