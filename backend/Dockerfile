FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
COPY backend/requirements.txt /srv/requirements.txt
RUN python -m pip install --no-cache-dir -r /srv/requirements.txt && useradd -u 10001 -r -m tis
COPY backend/hybrid_detector /srv/hybrid_detector
USER 10001:10001
EXPOSE 8000
# Supply API secrets through your deployment secret store. Bind private service at the gateway.
CMD ["uvicorn", "hybrid_detector.serve:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-access-log"]
