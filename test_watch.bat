@echo off
REM ファイル変更を監視し、自動でJestテストを実行する
REM app_logic.js またはテストファイルを保存すると自動でテストが走る
REM 終了するには Ctrl+C

cd /d "%~dp0"
echo === ファイル監視モード開始 ===
echo app_logic.js / tests/js/*.test.js を監視中...
echo 変更を検知するとテストが自動実行されます
echo 終了: Ctrl+C
echo.

npx chokidar-cli "app_logic.js" "tests/js/**/*.test.js" -c "npx jest --verbose --config tests/js/jest.config.json" --initial
