@echo off
setlocal
chcp 65001 >nul
node "%~dp0_internal\handoff.mjs"
set "HANDOFF_EXIT=%ERRORLEVEL%"
pause >nul
exit /b %HANDOFF_EXIT%
