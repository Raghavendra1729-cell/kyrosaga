FROM python:3.11-slim

# Install Node.js, npm, and system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    libpq-dev \
    python3-dev \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy the entire project
COPY . .

# Build frontend
WORKDIR /app/frontend
RUN npm install
RUN npm run build

# Move frontend build to backend directory so FastAPI can serve it
RUN mv dist ../backend/dist

# Setup Backend
WORKDIR /app/backend

# Install Python dependencies from the root requirements.txt
RUN pip install --no-cache-dir -r ../../requirements.txt

# Hugging Face Spaces exposes port 7860
EXPOSE 7860

# Command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
