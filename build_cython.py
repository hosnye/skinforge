#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cython build step for Rose
Compiles sensitive Python modules to native .pyd (C extensions) before PyInstaller.
These are much harder to reverse-engineer than Python bytecode.
"""

import sys
import shutil
import subprocess
from pathlib import Path


# Modules to compile to native code (most sensitive files)
CYTHON_MODULES = [
    "utils/crypto/skin_crypto.py",
    "utils/crypto/key_provider.py",
    "utils/crypto/client_secrets.py",
    "utils/crypto/integrity.py",
]


def check_cython():
    """Check if Cython and a C compiler are available"""
    try:
        import Cython
        print(f"[OK] Cython {Cython.__version__} found")
        return True
    except ImportError:
        print("[ERROR] Cython not installed. Install with: pip install cython")
        return False


def build_cython_modules():
    """Compile Python modules to .pyd using Cython"""
    print("\n[Cython] Compiling sensitive modules to native code...")

    # Create a temporary setup script for Cython
    setup_content = '''
import sys
from setuptools import setup, Extension
from Cython.Build import cythonize

extensions = [
'''
    for mod_path in CYTHON_MODULES:
        p = Path(mod_path)
        if not p.exists():
            print(f"[WARNING] Module not found, skipping: {mod_path}")
            continue
        # Convert path to dotted module name
        mod_name = mod_path.replace("/", ".").replace("\\", ".").removesuffix(".py")
        setup_content += f'    Extension("{mod_name}", ["{mod_path}"]),\n'

    setup_content += '''
]

setup(
    ext_modules=cythonize(
        extensions,
        compiler_directives={"language_level": "3"},
    ),
)
'''

    setup_file = Path("_cython_setup.py")
    setup_file.write_text(setup_content)

    try:
        result = subprocess.run(
            [sys.executable, str(setup_file), "build_ext", "--inplace"],
            capture_output=True,
            text=True,
        )

        if result.returncode != 0:
            print(f"[ERROR] Cython compilation failed:\n{result.stderr}")
            return False

        # Verify .pyd files were created
        compiled = 0
        for mod_path in CYTHON_MODULES:
            p = Path(mod_path)
            # Look for the compiled .pyd file next to the source
            pyd_files = list(p.parent.glob(f"{p.stem}*.pyd"))
            if pyd_files:
                print(f"[OK] Compiled: {mod_path} -> {pyd_files[0].name}")
                compiled += 1
            else:
                print(f"[WARNING] No .pyd found for: {mod_path}")

        if compiled == 0:
            print("[ERROR] No modules were compiled")
            return False

        print(f"\n[OK] {compiled}/{len(CYTHON_MODULES)} modules compiled to native code")

        # Rename original .py files so PyInstaller picks up the .pyd instead
        for mod_path in CYTHON_MODULES:
            p = Path(mod_path)
            pyd_files = list(p.parent.glob(f"{p.stem}*.pyd"))
            if pyd_files and p.exists():
                backup = p.with_suffix(".py.bak")
                p.rename(backup)
                print(f"[OK] Backed up: {p} -> {backup}")

        return True

    finally:
        # Clean up temp setup file and build artifacts
        setup_file.unlink(missing_ok=True)
        build_dir = Path("build")
        # Don't remove entire build dir as PyInstaller uses it too


def restore_sources():
    """Restore original .py files from backups (for development).

    Only deletes .pyd / .c artifacts WE produced this build (i.e. modules where
    a .py.bak backup exists, proving we did the compile-and-rename dance).
    User-supplied .pyd files (no matching .py source — e.g. secret modules
    shipped pre-compiled) are left untouched; otherwise the next build would
    fail at Rose.spec's missing-crypto check.
    """
    print("\n[Cython] Restoring original source files...")
    restored = 0
    for mod_path in CYTHON_MODULES:
        backup = Path(mod_path).with_suffix(".py.bak")
        original = Path(mod_path)
        we_compiled_this = backup.exists()

        if we_compiled_this:
            if original.exists():
                original.unlink()
            backup.rename(original)
            print(f"[OK] Restored: {original}")
            restored += 1

            # Only clean up artifacts when we compiled — preserves pre-built .pyd
            p = Path(mod_path)
            for pyd in p.parent.glob(f"{p.stem}*.pyd"):
                pyd.unlink()
            c_file = p.with_suffix(".c")
            if c_file.exists():
                c_file.unlink()

    print(f"[OK] Restored {restored} source files")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "restore":
        restore_sources()
    else:
        if not check_cython():
            sys.exit(1)
        if not build_cython_modules():
            sys.exit(1)
