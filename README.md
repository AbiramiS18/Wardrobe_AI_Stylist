# Wardrobe AI Stylist

An intelligent, AI-powered personal wardrobe manager and fashion stylist application. This project helps you organize your closet, automatically categorizes uploaded clothing items using Zero-Shot image classification, and provides personalized outfit recommendations based on current weather conditions and the occasion.

## Features

- **Digital Wardrobe Management**: Easily upload, categorize, and manage your clothing items.
- **AI Auto-Tagging**: Upload a photo of a clothing item, and the built-in Zero-Shot Vision-Language Model (VLM) will automatically detect and generate its name and category.
- **Smart Style Advisor**: Get personalized outfit recommendations using LLaMA 3.2 (via Ollama). The AI considers:
  - Your wardrobe contents (Tops, Bottoms, Dresses, Sarees, Shoes, Accessories)
  - The specific occasion (Casual, Formal, Party, etc.)
  - Real-time weather data from your city (via Open-Meteo)
- **Outfit Favorites**: Save your favorite generated looks for quick access later.
- **User Profiles**: Support for multiple profiles, allowing different people to manage their own separate wardrobes.
- **Responsive UI**: A modern, sleek, and responsive user interface built with React and Tailwind CSS.

## Technology Stack

**Frontend:**
- React 18, TypeScript, Vite
- Tailwind CSS
- shadcn/ui components
- React Router (if applicable)

**Backend:**
- Python & FastAPI
- MySQL (Database)
- [Ollama](https://ollama.com/) (Local LLM via `llama3.2` for styling logic)
- Hugging Face `transformers` & PyTorch (SigLIP Zero-Shot model for vision classification)
- Uvicorn

## Getting Started

### Prerequisites

1. **Node.js** (v18+)
2. **Python** (v3.9+)
3. **MySQL Server** running locally or remotely.
4. **Ollama** installed on your machine.
5. Pull the LLaMA 3.2 model for Ollama:
   ```bash
   ollama run llama3.2
   ```

### 1. Backend Setup

Navigate to the backend directory and set up a virtual environment:

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate
```

Install the required dependencies:

```bash
pip install -r requirements.txt
```

Set up your environment variables. Create a `.env` file in the `backend` directory (if not already present) with your database credentials:

```env
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=wardrobe_db
```

Start the FastAPI server:

```bash
uvicorn main:app --reload --port 8000
```
*Note: The first time you run the backend, it will download the Zero-Shot image classification model to process images.*

### 2. Frontend Setup

Open a new terminal window and navigate to the frontend directory:

```bash
cd frontend
```

Install the dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend will be available at `http://localhost:5173` (or the port specified by Vite).

## Project Structure

```
Wardrobe_AI_Stylist/
├── backend/
│   ├── main.py                 # FastAPI application and endpoints
│   ├── database.py             # MySQL database integration and queries
│   ├── image_classification.py # Zero-Shot HuggingFace VLM logic
│   ├── occasion_rules.json     # Configuration for AI prompts based on occasions
│   ├── requirements.txt
│   └── uploads/                # Directory for user-uploaded clothing images
└── frontend/
    ├── src/
    │   ├── components/         # React components (Dashboard, WardrobeTab, StyleAdvisorTab, etc.)
    │   ├── ui/                 # Reusable shadcn/ui components
    │   ├── App.tsx             # Main React application route
    │   └── main.tsx            # React entry point
    ├── package.json
    ├── tailwind.config.ts      # Tailwind CSS configuration
    └── vite.config.ts          # Vite bundler configuration
```
