@echo off
rem ============================================================================
rem  XCPC daily - Windows launcher.
rem
rem  IMPORTANT: keep this file ASCII-only, and keep CRLF line endings.
rem  cmd.exe parses a .bat with the *console* code page; a file containing
rem  multi-byte UTF-8 text can be split mid-character, which makes cmd run
rem  fragments of comment lines as commands (and can even loop forever).
rem  All human-facing text therefore lives in scripts\tool.mjs (Node reads
rem  UTF-8 correctly), and this launcher only sets up the environment.
rem
rem  Usage:
rem    xcpc.bat              menu
rem    xcpc.bat dev          start the dev server
rem    xcpc.bat check        full check (data + build + randomness tests)
rem    xcpc.bat check live   full check plus live Codeforces API tests
rem    xcpc.bat help         help
rem
rem  Why a launcher at all: on hardened Windows setups the system TEMP carries
rem  a Deny-Delete ACE, so esbuild cannot remove its own temp files and
rem  dev/build fail with "spawn EPERM" or "Access is denied". Pointing
rem  TEMP/TMP at the repo-local .tmp\ avoids that (see .tmp\README.md).
rem ============================================================================

chcp 65001 >nul

setlocal
cd /d "%~dp0"

if not exist ".tmp" mkdir ".tmp" >nul 2>nul
set "TEMP=%~dp0.tmp"
set "TMP=%~dp0.tmp"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [x] Node.js not found. Please install it first: https://nodejs.org/
  echo.
  if "%~1"=="" pause
  exit /b 1
)

node "scripts\tool.mjs" %*
set "CODE=%ERRORLEVEL%"

rem No arguments means it was double-clicked: keep the window open so the
rem output is readable. With arguments we are called from a shell - just exit.
if "%~1"=="" pause

exit /b %CODE%
