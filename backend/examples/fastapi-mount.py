"""Embed the private hybrid service in an existing FastAPI application.

Mount its fully authenticated sub-application instead of copying model logic:
  import your_existing_fastapi_app
  your_existing_fastapi_app.mount("/detector", detector)
Requires TIS_API_KEYS in the server process environment.
"""
from fastapi import FastAPI
from hybrid_detector.api import create_app, APISettings

existing_app = FastAPI()
detector = create_app(settings=APISettings.from_env())
existing_app.mount("/detector", detector)

# POST /detector/v1/analyze, header X-API-Key.
# Do NOT expose a service API key in a public static JavaScript frontend.
