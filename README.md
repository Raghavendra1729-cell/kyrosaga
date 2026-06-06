# Kyrosaga

Multimodal Product Catalogue Intelligence System

## Directory Layout
- Frontend: Single page React application built with TypeScript, Vite, and Tailwind CSS v4.
- Backend/my-fastapi-app: Asynchronous Python backend utilizing FastAPI.
- Personal: Architectural specification documents.

## Setup Instructions

### Backend
1. Go to the backend folder:
   cd Backend/my-fastapi-app
2. Create and activate a virtual environment:
   python -m venv .venv
   .venv/Scripts/activate
3. Install dependencies:
   pip install "fastapi[standard]"
4. Start development server:
   fastapi dev main.py

### Frontend
1. Go to the frontend folder:
   cd Frontend
2. Install dependencies:
   npm install
3. Start development server:
   npm run dev
