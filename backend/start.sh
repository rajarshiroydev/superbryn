#!/bin/sh
set -e

echo "Starting SuperBryn backend..."

# Start the FastAPI server in the background
echo "Starting FastAPI server on port ${PORT:-8080}..."
uv run uvicorn api:app --host 0.0.0.0 --port "${PORT:-8080}" &
API_PID=$!

# Start the LiveKit agent worker
echo "Starting LiveKit agent worker..."
uv run agent.py start &
AGENT_PID=$!

# Wait for either process to exit
wait -n $API_PID $AGENT_PID

# If one exits, kill the other and exit
echo "A process exited, shutting down..."
kill $API_PID $AGENT_PID 2>/dev/null || true
wait
