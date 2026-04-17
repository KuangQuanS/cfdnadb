@echo off
setlocal

set "REPO_ROOT=%~dp0"
if "%REPO_ROOT:~-1%"=="\" set "REPO_ROOT=%REPO_ROOT:~0,-1%"
set "BACKEND_DIR=%REPO_ROOT%\backend"

if not exist "%BACKEND_DIR%\mvnw.cmd" (
	echo [ERROR] Cannot find backend\mvnw.cmd under %REPO_ROOT%
	exit /b 1
)

if not defined APP_DATA_DIR set "APP_DATA_DIR=%REPO_ROOT%"
if not defined APP_QUERY_DB_FILE set "APP_QUERY_DB_FILE=cfdnadb.duckdb"
if not defined APP_TCGA_IGV_FILE set "APP_TCGA_IGV_FILE=%REPO_ROOT%\tcga_maf.txt"

echo [INFO] APP_DATA_DIR=%APP_DATA_DIR%
echo [INFO] APP_QUERY_DB_FILE=%APP_QUERY_DB_FILE%
echo [INFO] APP_TCGA_IGV_FILE=%APP_TCGA_IGV_FILE%

cd /d "%BACKEND_DIR%"
call mvnw.cmd spring-boot:run
