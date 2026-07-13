FROM python:3.12-slim

WORKDIR /app

# Copy the requirements file from the backend2 folder
COPY backend2/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all the python files from backend2 into the container
COPY backend2/ .

# Run the FastAPI server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
