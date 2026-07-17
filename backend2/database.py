import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Local dev: force SQLite even if DATABASE_URL is set in .env (e.g. pointing to Neon).
# Set USE_SQLITE=false (or unset it) in production to use DATABASE_URL instead.
USE_SQLITE = os.getenv("USE_SQLITE", "true").lower() == "true"

SQLALCHEMY_DATABASE_URL = (
    "sqlite:///./useanchor.sqlite3"
    if USE_SQLITE
    else os.getenv("DATABASE_URL", "sqlite:///./useanchor.sqlite3")
)

# If it's SQLite, we need connect_args={"check_same_thread": False}. 
# For PostgreSQL (Neon), we do not.
connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

