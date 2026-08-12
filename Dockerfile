# ============================================================
# Simple Meesho - media worker (Python Celery)
#
# Consumes media_queue tasks enqueued by the NestJS backend:
# process_image, send_otp_email, seed_default_store_data.
#
# Build context: media-worker/ directory.
# Required service variables (set on the Railway worker service):
#   CELERY_BROKER_URL, CELERY_RESULT_BACKEND (redis://...)
#   DATABASE_URL, R2_* bucket credentials, EMAIL_* SMTP settings
# ============================================================

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Pillow needs a few system libs (wheels cover the rest on amd64)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg62-turbo \
    libopenjp2-7 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY celery_app.py tasks.py seed_store.py ./

CMD ["celery", "-A", "celery_app:app", "worker", "--queues=media_queue", "--concurrency=2", "--loglevel=info"]
