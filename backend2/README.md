# useAnchor MVP Backend

This is the MVP backend for the useAnchor project, built with [FastAPI](https://fastapi.tiangolo.com/) and SQLite. It provides the core API endpoints required for the frontend and handles background safety tasks.

## Features

- **Authentication**: A mocked login endpoint (`/auth/login`) using dummy OTPs.
- **Trusted Contacts**: API to manage personal trusted networks.
- **Anchor Sessions**: Creating, checking in, and ending safety sessions.
- **Alerts & SOS**: Trigger manual SOS alerts and handle check-in responses.
- **Dead-Man Switch**: A background task (using `apscheduler`) that runs every minute to escalate overdue sessions to an active SOS state automatically.

## Prerequisites

- Python 3.9+
- pip (Python package installer)

## Setup Instructions

1. **Navigate to the backend directory**
   ```bash
   cd backend2
   ```

2. **Activate the virtual environment**
   
   On Windows:
   ```bash
   .\.venv\Scripts\activate
   ```
   
   On macOS/Linux:
   ```bash
   source .venv/bin/activate
   ```
   
   *(Note: If the `.venv` directory doesn't exist, you can create it with `python -m venv .venv`)*

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

## Running the Application

To start the FastAPI development server, run:

```bash
uvicorn main:app --reload
```

The application will start at `http://127.0.0.1:8000`.

## Interactive API Documentation

FastAPI provides automatic, interactive API documentation. Once the server is running, you can access the Swagger UI by navigating to:

[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

Here, you can view all available endpoints, their required parameters, and test them directly from your browser.

## Database Management

The MVP uses a file-based SQLite database for simplicity. 
- The database is automatically created as `useanchor.db` in the `backend2` root directory when you run the server for the first time.
- If you ever need to reset the data entirely, you can simply delete the `useanchor.db` file and restart the server to generate a fresh one.
