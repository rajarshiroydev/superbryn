FROM python:3.12-slim

# Install system dependencies required by livekit/onnxruntime/noise-cancellation
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc \
        g++ \
        libffi-dev \
        libssl-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv (fast Python package manager)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Copy dependency files first for layer caching
COPY pyproject.toml uv.lock ./

# Install dependencies (no dev deps, frozen lockfile)
RUN uv sync --frozen --no-dev

# Copy application source
COPY agent.py api.py db.py tools.py ./
COPY start.sh ./

RUN chmod +x start.sh

# Railway injects PORT env var (default 8080 for the FastAPI server)
EXPOSE 8080

# Run both the FastAPI server and LiveKit agent worker
CMD ["./start.sh"]
