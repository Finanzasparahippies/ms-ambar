"""
Django settings for ms-ambar project.
"""

from pathlib import Path
import environ
from datetime import timedelta

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

import sys
BASE_DIR_STR = str(BASE_DIR)
if BASE_DIR_STR not in sys.path:
    sys.path.insert(0, BASE_DIR_STR)

import os
env = environ.Env()
# Read environment-specific .env file
ENVIRONMENT = os.environ.get("ENVIRONMENT", "local")
if ENVIRONMENT == "staging":
    environ.Env.read_env(BASE_DIR.parent / ".env.staging")
else:
    environ.Env.read_env(BASE_DIR.parent / ".env")

# Quick-start development settings - unsuitable for production
ENVIRONMENT = env("DJANGO_ENV", default=env("ENVIRONMENT", default="local"))
ENV_TAG = f"[{ENVIRONMENT.upper()}]"
DEBUG = env.bool("DEBUG", default=True)
SECRET_KEY = env("SECRET_KEY", default="django-insecure-key")

ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["*"])
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    "cloudinary_storage",
    "cloudinary",
    "django_ckeditor_5",
    # Local apps
    "apps.users",
    "apps.tickets",
    "apps.shop",
    "apps.blog",
    "apps.bookings",
    "apps.performance",
    "apps.dashboard",
    "apps.gallery",
    "apps.music",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.performance.middleware.PerformanceMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

# Database
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("DB_NAME", default="msambar"),
        "USER": env("DB_USER", default="postgres"),
        "PASSWORD": env("DB_PASSWORD", default="postgres"),
        "HOST": env("DB_HOST", default="db"),
        "PORT": env("DB_PORT", default="5432"),
    }
}
DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = True

# Force using SQLite when running tests to avoid Supabase connection pooler conflicts
import sys
TESTING = False
if 'test' in sys.argv:
    TESTING = True
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
    # Override storage during tests to avoid Cloudinary HTTP requests
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }

# Authentication
AUTH_USER_MODEL = "users.User"

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'es-mx'
TIME_ZONE = 'America/Mexico_City'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = Path(env("STATIC_ROOT", default=str(BASE_DIR / "staticfiles")))

# Media files (User-uploaded files)
MEDIA_URL = '/media/'
MEDIA_ROOT = Path(env("MEDIA_ROOT", default=str(BASE_DIR / "media")))

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Stripe Settings
STRIPE_PUBLISHABLE_KEY = env("STRIPE_PUBLISHABLE_KEY", default="")
STRIPE_SECRET_KEY = env("STRIPE_SECRET_KEY", default="")
STRIPE_WEBHOOK_SECRET = env("STRIPE_WEBHOOK_SECRET", default="")

# Cloudflare Turnstile Anti-Spam
CLOUDFLARE_TURNSTILE_SECRET_KEY = env("CLOUDFLARE_TURNSTILE_SECRET_KEY", default="")

# Marketing & Advertising APIs (Google Ads & Meta/Facebook Ads)
GOOGLE_ADS_DEVELOPER_TOKEN = env("GOOGLE_ADS_DEVELOPER_TOKEN", default="")
GOOGLE_ADS_CLIENT_ID = env("GOOGLE_ADS_CLIENT_ID", default="")
GOOGLE_ADS_CLIENT_SECRET = env("GOOGLE_ADS_CLIENT_SECRET", default="")
GOOGLE_ADS_CUSTOMER_ID = env("GOOGLE_ADS_CUSTOMER_ID", default="")

META_ADS_ACCESS_TOKEN = env("META_ADS_ACCESS_TOKEN", default="")
META_ADS_ACCOUNT_ID = env("META_ADS_ACCOUNT_ID", default="")
META_ADS_PIXEL_ID = env("META_ADS_PIXEL_ID", default="")

# Frontend URL
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:3000")

# Backend/API URL (used for absolute media URLs in email campaigns)
BACKEND_URL = env("BACKEND_URL", default="http://localhost:8000")

# Music External Platform Credentials
SPOTIFY_CLIENT_ID = env("SPOTIFY_CLIENT_ID", default="")
SPOTIFY_CLIENT_SECRET = env("SPOTIFY_CLIENT_SECRET", default="")
YOUTUBE_API_KEY = env("YOUTUBE_API_KEY", default="")
ITUNES_SEARCH_URL = env("ITUNES_SEARCH_URL", default="https://itunes.apple.com/search")


# REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": False,
}

# CORS and CSRF Settings
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True


CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost",
    "http://127.0.0.1",
    "https://*.github.dev",
    "https://*.app.github.dev",
]

frontend_url = env("FRONTEND_URL", default="")
if frontend_url and frontend_url not in CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS.append(frontend_url)

for host in ALLOWED_HOSTS:
    if host and host not in ['*', 'localhost', '127.0.0.1', 'backend', 'backend-staging', 'nginx-staging']:
        if not host.startswith("http://") and not host.startswith("https://"):
            CSRF_TRUSTED_ORIGINS.append(f"https://{host}")
            CSRF_TRUSTED_ORIGINS.append(f"http://{host}")

extra_csrf = env.list("CSRF_TRUSTED_ORIGINS", default=[])
for origin in extra_csrf:
    if origin and origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(origin)

CORS_EXPOSE_HEADERS = ['Content-Type', 'X-CSRFToken']
CORS_ALLOW_METHODS = [
    "DELETE",
    "GET",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
]

# Email Configuration
EMAIL_BACKEND = env("EMAIL_BACKEND", default='config.email_backends.FailoverEmailBackend')
EMAIL_HOST = env("EMAIL_HOST", default="smtp.zoho.com")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", default=False)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="Ms Ambar <hola@msambar.com>")

# SMTP Brevo (Plan Gratuito)
BREVO_EMAIL_HOST = env("BREVO_EMAIL_HOST", default="smtp-relay.brevo.com")
BREVO_EMAIL_PORT = env.int("BREVO_EMAIL_PORT", default=587)
BREVO_EMAIL_USE_TLS = env.bool("BREVO_EMAIL_USE_TLS", default=True)
BREVO_EMAIL_HOST_USER = env("BREVO_EMAIL_HOST_USER", default="")
BREVO_EMAIL_HOST_PASSWORD = env("BREVO_EMAIL_HOST_PASSWORD", default="")
BREVO_DEFAULT_FROM_EMAIL = env("BREVO_DEFAULT_FROM_EMAIL", default="Ms Ambar <hola@msambar.com>")

# SMTP Amazon SES (Plan Premium/Failover)
SES_EMAIL_HOST = env("SES_EMAIL_HOST", default="email-smtp.us-east-1.amazonaws.com")
SES_EMAIL_PORT = env.int("SES_EMAIL_PORT", default=587)
SES_EMAIL_USE_TLS = env.bool("SES_EMAIL_USE_TLS", default=True)
SES_EMAIL_HOST_USER = env("SES_EMAIL_HOST_USER", default="")
SES_EMAIL_HOST_PASSWORD = env("SES_EMAIL_HOST_PASSWORD", default="")
SES_DEFAULT_FROM_EMAIL = env("SES_DEFAULT_FROM_EMAIL", default="Ms Ambar <hola@msambar.com>")

# Determinación dinámica del entorno activo para aislamiento estricto de logs (production, staging, test, local)
if TESTING:
    LOG_ENV = "test"
else:
    LOG_ENV = ENVIRONMENT.lower()

ENV_TAG = f"[{LOG_ENV.upper()}]"

# Asegurar la creación dinámica del directorio de logs aislado por entorno
LOGS_DIR = BASE_DIR / 'logs' / LOG_ENV
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# Logging configuration to display logs in console and log files with Nectar Labs styling
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': f'{ENV_TAG} [%(asctime)s] %(levelname)s [%(name)s] %(message)s',
            'datefmt': '%H:%M:%S'
        },
        'clean': {
            'format': f'{ENV_TAG} [%(asctime)s] %(levelname)s [%(name)s]: %(message)s',
            'datefmt': '%Y-%m-%d %H:%M:%S'
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'env_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': str(LOGS_DIR / f'{LOG_ENV}.log'),
            'maxBytes': 10 * 1024 * 1024,  # 10MB
            'backupCount': 5,
            'formatter': 'clean',
            'encoding': 'utf-8',
        },
        'tickets_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': str(LOGS_DIR / 'tickets.log'),
            'maxBytes': 10 * 1024 * 1024,  # 10MB
            'backupCount': 5,
            'formatter': 'clean',
            'encoding': 'utf-8',
        },
        'shop_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': str(LOGS_DIR / 'shop.log'),
            'maxBytes': 10 * 1024 * 1024,  # 10MB
            'backupCount': 5,
            'formatter': 'clean',
            'encoding': 'utf-8',
        },
        'blog_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': str(LOGS_DIR / 'blog.log'),
            'maxBytes': 10 * 1024 * 1024,  # 10MB
            'backupCount': 5,
            'formatter': 'clean',
            'encoding': 'utf-8',
        },
        'dashboard_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': str(LOGS_DIR / 'dashboard.log'),
            'maxBytes': 10 * 1024 * 1024,  # 10MB
            'backupCount': 5,
            'formatter': 'clean',
            'encoding': 'utf-8',
        },
        'events_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': str(LOGS_DIR / 'events.log'),
            'maxBytes': 10 * 1024 * 1024,  # 10MB
            'backupCount': 5,
            'formatter': 'clean',
            'encoding': 'utf-8',
        },
        'users_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': str(LOGS_DIR / 'users.log'),
            'maxBytes': 10 * 1024 * 1024,  # 10MB
            'backupCount': 5,
            'formatter': 'clean',
            'encoding': 'utf-8',
        },
        'gallery_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': str(LOGS_DIR / 'gallery.log'),
            'maxBytes': 10 * 1024 * 1024,  # 10MB
            'backupCount': 5,
            'formatter': 'clean',
            'encoding': 'utf-8',
        },
        'music_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': str(LOGS_DIR / 'music.log'),
            'maxBytes': 10 * 1024 * 1024,  # 10MB
            'backupCount': 5,
            'formatter': 'clean',
            'encoding': 'utf-8',
        },
    },
    'loggers': {
        'apps': {
            'handlers': ['console', 'env_file'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'apps.tickets': {
            'handlers': ['console', 'env_file', 'tickets_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'apps.tickets.delivery': {
            'handlers': ['console', 'env_file', 'tickets_file'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'apps.shop': {
            'handlers': ['console', 'env_file', 'shop_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'apps.events': {
            'handlers': ['console', 'env_file', 'events_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'apps.users': {
            'handlers': ['console', 'env_file', 'users_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'apps.blog': {
            'handlers': ['console', 'env_file', 'blog_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'apps.dashboard': {
            'handlers': ['console', 'env_file', 'dashboard_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'apps.gallery': {
            'handlers': ['console', 'env_file', 'gallery_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'apps.music': {
            'handlers': ['console', 'env_file', 'music_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'config': {
            'handlers': ['console', 'env_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'tests': {
            'handlers': ['console', 'env_file'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# Override email backend during tests to prevent standard mail functions from accessing real SMTP
if TESTING:
    EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'

# Cloudinary Configuration
import cloudinary
CLOUDINARY_STORAGE = {
    'CLOUD_NAME': env('CLOUDINARY_CLOUD_NAME', default=''),
    'API_KEY': env('CLOUDINARY_API_KEY', default=''),
    'API_SECRET': env('CLOUDINARY_API_SECRET', default=''),
}
cloudinary.config(
    cloud_name=CLOUDINARY_STORAGE['CLOUD_NAME'],
    api_key=CLOUDINARY_STORAGE['API_KEY'],
    api_secret=CLOUDINARY_STORAGE['API_SECRET'],
    secure=True
)

# File and Payload Upload Limits (100MB for batch image optimization)
DATA_UPLOAD_MAX_MEMORY_SIZE = 104857600  # 100MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 104857600  # 100MB
DATA_UPLOAD_MAX_NUMBER_FIELDS = 10000

# Skydropx Logistics Configuration
SKYDROPX_ENVIRONMENT = env("SKYDROPX_ENVIRONMENT", default="staging")
SKYDROPX_API_KEY = env("SKYDROPX_API_KEY", default=env("NECTAR_LABS_SKYDROPX_API_KEY", default=env("AMBAR_OWN_SKYDROPX_KEY", default="")))
SKYDROPX_API_SECRET = env("SKYDROPX_API_SECRET", default=env("NECTAR_LABS_SKYDROPX_API_SECRET", default=""))
SKYDROPX_WEBHOOK_SECRET = env("SKYDROPX_WEBHOOK_SECRET", default=env("NECTAR_LABS_SKYDROPX_WEBHOOK_SECRET", default="kPxZv17KoHJYNGZgsIxRFHWFw50knp0YdGlD6hmpgGQ"))
SKYDROPX_AUTO_ADVANCE = env.bool("SKYDROPX_AUTO_ADVANCE", default=False)

if ENVIRONMENT.lower() in ["production", "prod"] and SKYDROPX_AUTO_ADVANCE:
    from django.core.exceptions import ImproperlyConfigured
    raise ImproperlyConfigured("CRITICAL SECURITY: SKYDROPX_AUTO_ADVANCE no puede estar habilitado en entorno de producción.")

# Resolución inteligente de endpoint Skydropx Pro (Staging / Producción)
DEFAULT_SKYDROPX_URL = (
    "https://sb-pro.skydropx.com/api/v1"
    if SKYDROPX_ENVIRONMENT.lower() in ["staging", "sandbox", "pro_staging", "pro_sandbox", "test"]
    else "https://app.skydropx.com/api/v1"
)
SKYDROPX_API_URL = env("SKYDROPX_API_URL", default=DEFAULT_SKYDROPX_URL)

SHIPPING_ORIGIN_NAME = env("SHIPPING_ORIGIN_NAME", default="Almacén Oficial Ms Ambar")
SHIPPING_ORIGIN_PHONE = env("SHIPPING_ORIGIN_PHONE", default="6622140000")
SHIPPING_ORIGIN_STREET = env("SHIPPING_ORIGIN_STREET", default="Blvd. Kino 456")
SHIPPING_ORIGIN_SUBURB = env("SHIPPING_ORIGIN_SUBURB", default="Pitic")
SHIPPING_ORIGIN_CITY = env("SHIPPING_ORIGIN_CITY", default="Hermosillo")
SHIPPING_ORIGIN_STATE = env("SHIPPING_ORIGIN_STATE", default="SO")
SHIPPING_ORIGIN_POSTAL_CODE = env("SHIPPING_ORIGIN_POSTAL_CODE", default="83150")





