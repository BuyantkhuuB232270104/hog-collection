@echo off
rem Davhar darahad administrator erhtei PowerShell-eer setup-windows.ps1-iig ajilluulna
cd /d "%~dp0"
powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0setup-windows.ps1\"'"
