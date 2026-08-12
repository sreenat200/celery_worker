import os
import ssl
from celery import Celery
from dotenv import load_dotenv

# Load env variables (you can point this to ../nestjs-backend/.env or have a separate one)
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'nestjs-backend', '.env'))

redis_url = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')

app = Celery('media_worker', broker=redis_url, backend=redis_url, include=['tasks', 'seed_store'])

_ssl_opts = {'ssl_cert_reqs': ssl.CERT_NONE} if redis_url.startswith('rediss://') else None

app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    broker_use_ssl=_ssl_opts,
    redis_backend_use_ssl=_ssl_opts,
    broker_connection_retry_on_startup=True,
    broker_connection_retry=True,
    broker_heartbeat=30,
    worker_cancel_long_running_tasks_on_connection_loss=False,
    broker_transport_options={
        'visibility_timeout': 3600,
        'socket_keepalive': True,
        'socket_timeout': 30,
        'socket_connect_timeout': 30,
        'retry_on_timeout': True,
        'health_check_interval': 25,
    },
    redis_backend_transport_options={
        'socket_keepalive': True,
        'socket_timeout': 30,
        'socket_connect_timeout': 30,
        'retry_on_timeout': True,
        'health_check_interval': 25,
    },
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_routes={
        'media_worker.tasks.*': {'queue': 'media_queue'}
    }
)
