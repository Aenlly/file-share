#!/bin/bash

echo "Starting File Share System..."

echo "Installing backend dependencies..."
cd backend
npm install
if [ $? -ne 0 ]; then
    echo "Failed to install backend dependencies"
    exit 1
fi

echo "Starting backend server..."
npm start &
BACKEND_PID=$!

echo "Installing frontend dependencies..."
cd ../frontend
npm install
if [ $? -ne 0 ]; then
    echo "Failed to install frontend dependencies"
    exit 1
fi

echo "Starting frontend application..."
npm run dev &
FRONTEND_PID=$!

echo "Both services are starting..."
echo "Backend: http://localhost:3000"
echo "Frontend: http://localhost:3001"
echo "Default admin account: admin / admin123"

# Wait for user input to stop services
read -p "Press Enter to stop all services..."

# Kill the background processes
kill $BACKEND_PID $FRONTEND_PID
echo "All services stopped."