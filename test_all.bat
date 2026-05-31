@echo off
REM 全テストを一括実行する

cd /d "%~dp0"

echo ============================================
echo  Jest テスト (JavaScript ロジック)
echo ============================================
call npx jest --verbose --config tests/js/jest.config.json
set JEST_EXIT=%ERRORLEVEL%
echo.

echo ============================================
echo  pytest テスト (DB接続・スキーマ・CRUD)
echo ============================================
python -m pytest tests/ -v
set PYTEST_EXIT=%ERRORLEVEL%
echo.

echo ============================================
echo  結果サマリー
echo ============================================
if %JEST_EXIT% EQU 0 (
    echo  [OK] Jest テスト: パス
) else (
    echo  [NG] Jest テスト: 失敗
)
if %PYTEST_EXIT% EQU 0 (
    echo  [OK] pytest テスト: パス
) else (
    echo  [NG] pytest テスト: 失敗
)
echo ============================================
