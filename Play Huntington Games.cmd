@echo off
rem Double-click to play Huntington Games on this computer (no account, no codes).
rem It starts a small local server (tools\play.mjs) and opens http://localhost:8090/ in your browser.
title Huntington Games
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is needed to run the games here. Install it from https://nodejs.org and double-click this again.
  echo.
  pause
  exit /b 1
)
node tools\play.mjs %*
if errorlevel 1 pause
