"""Uvicorn entrypoint; require TIS_API_KEYS and explicit private deployment."""
from .api import create_app

app = create_app()
