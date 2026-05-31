# -*- coding: utf-8 -*-
"""
Extract the HTA inline script and run it with cscript for a basic syntax check.
This only checks parse-time errors; runtime ADODB/HTA behavior still needs Windows.
"""
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
HTA_PATH = ROOT / "app_source.hta"
TEMP_JS = ROOT / "scripts" / "_temp_check.js"

content = HTA_PATH.read_text(encoding="utf-8")
match = re.search(r"<script[^>]*>(.*?)</script>", content, re.DOTALL | re.IGNORECASE)
if not match:
    raise SystemExit("scriptタグが見つかりません")

script = match.group(1)
TEMP_JS.write_text(script, encoding="cp932", errors="replace")

print(f"スクリプト抽出: {len(script)} bytes")
print("cscriptで構文チェック中...")
print("=" * 50)

try:
    result = subprocess.run(
        ["cscript", "//Nologo", str(TEMP_JS)],
        capture_output=True,
        text=True,
        encoding="cp932",
        timeout=10,
    )
    if result.returncode != 0 or result.stderr:
        print("エラー:")
        print(result.stderr or result.stdout)
        raise SystemExit(result.returncode or 1)
    print("構文エラーなし（実行時エラーは検出できません）")
finally:
    try:
        TEMP_JS.unlink()
    except OSError:
        pass
