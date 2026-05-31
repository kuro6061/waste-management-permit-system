# -*- coding: utf-8 -*-
"""
Convert app_source.hta (UTF-8) to app.hta (CP932) for mshta.exe.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "app_source.hta"
OUTPUT = ROOT / "app.hta"

content = SOURCE.read_text(encoding="utf-8")
OUTPUT.write_text(content, encoding="cp932", errors="replace")

print(f"converted: {OUTPUT}")
