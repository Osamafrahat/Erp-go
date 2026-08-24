@echo off
title Store Management
color 0A

echo Starting Store Management...

:: Start server in background
cd server
start /b node src/index.js >nul 2>&1
cd ..

:: Wait for server to start
echo Waiting for server...
timeout /t 3 /nobreak >nul

:: Open browser
start http://localhost:3001

echo.
echo Store Management is running at http://localhost:3001
echo Login: admin / admin123
echo.
echo Press any key to stop...
pause >nul

:: Kill node processes
taskkill /f /im node.exe >nul 2>&1
echo Server stopped.
