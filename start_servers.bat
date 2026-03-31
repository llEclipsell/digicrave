@echo off
echo ==============================================
echo      Starting DigiCrave Local Servers
echo ==============================================

:: 1. Start the Redis Docker Container exactly as per SETUP.md
echo [1/3] Starting Redis (name: redis)...
docker start redis >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Docker might not be running or the 'redis' container does not exist.
) else (
    echo        Redis is running.
)

:: Note: PostgreSQL is installed natively per SETUP.md, so it runs as a Windows Service automatically.

:: 2. Start the Backend in a new terminal window
echo [2/3] Starting FastAPI Backend (Port 8000)...
start "DigiCrave Backend" cmd /k "cd /d c:\Antigravity\digicrave\backend && venv\Scripts\activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

:: 3. Start the Frontend in a new terminal window
echo [3/3] Starting Next.js Frontend (Port 3000)...
start "DigiCrave Frontend" cmd /k "cd /d c:\Antigravity\digicrave\frontend && npm run dev"

echo.
echo All servers are booting up in separate windows!
echo - Backend API: http://localhost:8000/docs
echo - Frontend UI: http://localhost:3000
echo.
pause
