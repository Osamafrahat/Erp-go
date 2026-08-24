@echo off
title Store Management - Setup
color 0A

echo.
echo ========================================
echo   Store Management - Quick Setup
echo ========================================
echo.

:: Check Node.js (npm comes bundled with it)
echo [1/4] Checking Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   X Node.js is not installed.
    echo   Download from: https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo   OK Node.js %NODE_VER% found
echo.

:: Create .env.docker if missing
echo [2/4] Checking configuration...
if not exist ".env.docker" (
    echo   Creating .env.docker from template...
    copy .env.docker.example .env.docker >nul 2>&1
    echo.
    echo   IMPORTANT: Edit .env.docker with your Supabase credentials.
    echo   File: %CD%\.env.docker
    echo.
    notepad .env.docker
    echo.
    echo   Press any key after saving...
    pause >nul
) else (
    echo   OK .env.docker exists
)
echo.

:: Install dependencies
echo [3/4] Installing dependencies...
cd server
call node ..\node_modules\npm\bin\npm-cli.js install --production >nul 2>&1
if %errorlevel% neq 0 (
    echo   X Server install failed
    pause
    exit /b 1
)
cd ..

cd client
call node ..\node_modules\npm\bin\npm-cli.js install >nul 2>&1
if %errorlevel% neq 0 (
    echo   X Client install failed
    pause
    exit /b 1
)
cd ..
echo   OK Dependencies installed
echo.

:: Build client
echo [4/4] Building client...
cd client
set VITE_API_URL=/api
call node ..\node_modules\npm\bin\npm-cli.js exec -- vite build --mode development >nul 2>&1
if %errorlevel% neq 0 (
    echo   X Client build failed
    pause
    exit /b 1
)
cd ..
echo   OK Client built

:: Copy env to server directory
copy .env.docker server\.env >nul 2>&1

:: Ensure ALLOWED_ORIGINS includes localhost:3001
findstr /C:"localhost:3001" server\.env >nul 2>&1
if %errorlevel% neq 0 (
    echo ALLOWED_ORIGINS=%%ALLOWED_ORIGINS%%,http://localhost:3001 >> server\.env
)

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo   Starting server on http://localhost:3001
echo   Login: admin / admin123
echo   (You will be forced to change password)
echo.
echo   Press Ctrl+C to stop the server
echo.

:: Start server
cd server
node src\index.js
