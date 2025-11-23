@echo off
echo Starting File Share System...

echo Installing backend dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo Failed to install backend dependencies
    pause
    exit /b 1
)

echo Starting backend server...
start "Backend Server" cmd /k "npm start"

echo Installing frontend dependencies...
cd ../frontend
call npm install
if %errorlevel% neq 0 (
    echo Failed to install frontend dependencies
    pause
    exit /b 1
)

echo Starting frontend application...
start "Frontend App" cmd /k "npm run dev"

echo Both services are starting...
echo Backend: http://localhost:3000
echo Frontend: http://localhost:3001
echo Default admin account: admin / admin123
pause