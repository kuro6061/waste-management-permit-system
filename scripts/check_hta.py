# -*- coding: utf-8 -*-
"""
HTA文法チェックスクリプト
- JavaScriptの基本的な構文エラーをチェック
- 括弧/引用符の対応をチェック
"""
import re
import os

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def check_brackets(content, filename):
    """括弧の対応をチェック"""
    errors = []
    lines = content.split('\n')

    # 各種括弧のカウント
    parens = 0      # ()
    braces = 0      # {}
    brackets = 0    # []

    in_string = False
    string_char = None

    for line_num, line in enumerate(lines, 1):
        i = 0
        while i < len(line):
            char = line[i]

            # 文字列内かどうか
            if not in_string:
                if char in '"\'':
                    in_string = True
                    string_char = char
                elif char == '(':
                    parens += 1
                elif char == ')':
                    parens -= 1
                    if parens < 0:
                        errors.append(f"行 {line_num}: 余分な ')' があります")
                elif char == '{':
                    braces += 1
                elif char == '}':
                    braces -= 1
                    if braces < 0:
                        errors.append(f"行 {line_num}: 余分な '}}' があります")
                elif char == '[':
                    brackets += 1
                elif char == ']':
                    brackets -= 1
                    if brackets < 0:
                        errors.append(f"行 {line_num}: 余分な ']' があります")
            else:
                # 文字列終了チェック（エスケープ考慮）
                if char == string_char and (i == 0 or line[i-1] != '\\'):
                    in_string = False
                    string_char = None
            i += 1

    if parens != 0:
        errors.append(f"'(' と ')' の数が合いません (差: {parens})")
    if braces != 0:
        errors.append(f"'{{' と '}}' の数が合いません (差: {braces})")
    if brackets != 0:
        errors.append(f"'[' と ']' の数が合いません (差: {brackets})")

    return errors

def check_common_errors(content):
    """よくあるエラーパターンをチェック"""
    errors = []
    lines = content.split('\n')

    for line_num, line in enumerate(lines, 1):
        # エスケープされた引用符のチェック（HTA内では不正）
        if '\\"' in line or "\\'" in line:
            # ただしJavaScript文字列内は除く
            if 'onclick=\\"' in line or "onclick=\\'" in line:
                errors.append(f"行 {line_num}: 不正なエスケープ '\\\"' または '\\''. HTAではシングルクォートを使用してください")

        # 行末のセミコロン忘れ（関数呼び出し後など）
        stripped = line.strip()
        if stripped.endswith(')') and not stripped.endswith('})') and not stripped.endswith('{'):
            # 次の行が { で始まらない場合のみ警告
            pass  # 複雑なので省略

    return errors

def extract_script(content):
    """scriptタグ内のJavaScriptを抽出"""
    match = re.search(r'<script[^>]*>(.*?)</script>', content, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1)
    return ""

def main():
    hta_path = os.path.join(ROOT_DIR, 'app_source.hta')

    print("HTA文法チェック")
    print("=" * 50)

    if not os.path.exists(hta_path):
        print(f"エラー: {hta_path} が見つかりません")
        return

    with open(hta_path, 'r', encoding='utf-8') as f:
        content = f.read()

    print(f"ファイル: {hta_path}")
    print(f"サイズ: {len(content)} bytes")
    print()

    # スクリプト部分を抽出
    script = extract_script(content)
    if script:
        print(f"スクリプト部分: {len(script)} bytes")
        print()

    all_errors = []

    # 括弧チェック
    print("括弧の対応をチェック中...")
    bracket_errors = check_brackets(script, hta_path)
    all_errors.extend(bracket_errors)

    # よくあるエラーチェック
    print("一般的なエラーパターンをチェック中...")
    common_errors = check_common_errors(content)
    all_errors.extend(common_errors)

    print()
    if all_errors:
        print(f"エラー/警告: {len(all_errors)}件")
        print("-" * 50)
        for err in all_errors:
            print(f"  {err}")
    else:
        print("エラーは見つかりませんでした")

    print()
    print("=" * 50)
    print("チェック完了")

if __name__ == '__main__':
    main()
