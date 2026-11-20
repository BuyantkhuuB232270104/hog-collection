@echo off
rem Sistemiig asaana: http://localhost:3000  (zogsooh: Ctrl+C)
cd /d "%~dp0"
start "" cmd /c "timeout /t 4 >nul & start http://localhost:3000"
npm.cmd start
