@echo off
setlocal

set "REPO_ROOT=%~dp0"
if "%REPO_ROOT:~-1%"=="\" set "REPO_ROOT=%REPO_ROOT:~0,-1%"
set "FRONTEND_DIR=%REPO_ROOT%\frontend"

if not exist "%FRONTEND_DIR%\package.json" (
	echo [ERROR] Cannot find frontend\package.json under %REPO_ROOT%
	exit /b 1
)

cd /d "%FRONTEND_DIR%"
call npm.cmd run dev -- --host 127.0.0.1 --port 7173
