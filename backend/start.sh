#!/bin/sh

echo "Starting SuperBryn backend..."

# Start the FastAPI server in the background
echo "Starting FastAPI server on port ${PORT:-8080}..."
uv run uvicorn api:app --host 0.0.0.0 --port "${PORT:-8080}" &
API_PID=$!

# Give the API a moment to bind
sleep 2

# Start the LiveKit agent worker
echo "Starting LiveKit agent worker..."
uv run python agent.py start &
AGENT_PID=$!

# Trap signals to clean up both processes
trap 'echo "Shutting down..."; kill $API_PID $AGENT_PID 2>/dev/null; wait' INT TERM

# Wait for both — if either exits, shut down the other
while kill -0 $API_PID 2>/dev/null && kill -0 $AGENT_PID 2>/dev/null; do
    sleep 2
done

echo "A process exited, shutting down..."
kill $API_PID $AGENT_PID 2>/dev/null || true
wait
