@echo off
REM app_source.hta (UTF-8) を app.hta (Shift-JIS) に変換して起動

cd /d "%~dp0"

REM 変換実行
python scripts\convert_hta.py

REM 64bit版のmshtaでHTAを起動
C:\Windows\System32\mshta.exe "%~dp0app.hta"
