from dotenv import load_dotenv
load_dotenv()

from pathlib import Path
from datetime import timedelta
import os
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("SECRET_KEY", "unsafe-secret-key")

DEBUG = os.getenv("DEBUG", "True") == "True"

ALLOWED_HOSTS = ["*"]


# ── Installed Apps ─────────────────────────────────────────────

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'rest_framework',
    'corsheaders',
    'drf_yasg',
    'csp',                          # ← django-csp

    'cloudinary',
    'cloudinary_storage',

    'apps.accounts',
    'apps.students',
    'apps.teachers',
    'apps.classes',
    'apps.subjects',
    'apps.attendance',
    'apps.results',
    'apps.fees.apps.FeesConfig',
    'apps.announcements',
    'apps.admissions',
    'apps.ai',
]


# ── Middleware ─────────────────────────────────────────────────

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'csp.middleware.CSPMiddleware',             # ← CSP must be near top
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]


ROOT_URLCONF = 'config.urls'


# ── Templates ──────────────────────────────────────────────────

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


# ── Database ───────────────────────────────────────────────────

DATABASES = {
    'default': dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
    )
}


# ── Password Validation ────────────────────────────────────────

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# ── Internationalization ───────────────────────────────────────

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'

USE_I18N = True
USE_TZ = True


# ── Static Files ───────────────────────────────────────────────

STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")
STATICFILES_DIRS = [
    BASE_DIR / "static",
]
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"


# ── Cloudinary / Media ─────────────────────────────────────────

CLOUDINARY_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY    = os.environ.get("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET", "")

if CLOUDINARY_CLOUD_NAME:

    import cloudinary

    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
        secure=True,
    )

    CLOUDINARY_STORAGE = {
        "CLOUD_NAME": CLOUDINARY_CLOUD_NAME,
        "API_KEY":    CLOUDINARY_API_KEY,
        "API_SECRET": CLOUDINARY_API_SECRET,
    }

    DEFAULT_FILE_STORAGE = "cloudinary_storage.storage.MediaCloudinaryStorage"

    MEDIA_URL = f"https://res.cloudinary.com/{CLOUDINARY_CLOUD_NAME}/image/upload/"

else:

    MEDIA_URL  = "/media/"
    MEDIA_ROOT = BASE_DIR / "media"


# ── Termii SMS ─────────────────────────────────────────────────

TERMII_API_KEY   = os.environ.get("TERMII_API_KEY", "")
TERMII_SENDER_ID = os.environ.get("TERMII_SENDER_ID", "LEADSTARS")


# ── Auth & CORS ────────────────────────────────────────────────

CORS_ALLOW_ALL_ORIGINS = True
CORS_EXPOSE_HEADERS = ["Content-Disposition"]

AUTH_USER_MODEL = 'accounts.User'


# ── Django REST Framework ──────────────────────────────────────

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
}


# ── JWT Settings ───────────────────────────────────────────────

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME":  timedelta(hours=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "AUTH_HEADER_TYPES":      ("Bearer",),
}


# ── Security Headers ───────────────────────────────────────────

# Allow Paystack to open its checkout iframe
X_FRAME_OPTIONS = "SAMEORIGIN"

# Prevents browser from blocking Paystack popup/iframe
SECURE_CROSS_ORIGIN_OPENER_POLICY = None

# ── Content Security Policy (django-csp) ───────────────────────
# Allows Paystack scripts, iframe checkout, and API calls
# Also allows Cloudinary images and Google Fonts

CSP_DEFAULT_SRC = ("'self'",)

CSP_SCRIPT_SRC = (
    "'self'",
    "'unsafe-inline'",               # Required by React build
    "'unsafe-eval'",                 # Required by React dev mode
    "https://js.paystack.co",
    "https://checkout.paystack.com",
    "https://standard.paystack.co",
)

CSP_FRAME_SRC = (
    "'self'",
    "https://checkout.paystack.com",
    "https://standard.paystack.co",
)

CSP_CONNECT_SRC = (
    "'self'",
    "https://api.paystack.co",
    "https://checkout.paystack.com",
    "https://standard.paystack.co",
)

CSP_IMG_SRC = (
    "'self'",
    "data:",
    "blob:",
    "https://res.cloudinary.com",
    "https://checkout.paystack.com",
    "https://standard.paystack.co",
)

CSP_STYLE_SRC = (
    "'self'",
    "'unsafe-inline'",               # Required by React inline styles
    "https://fonts.googleapis.com",
    "https://checkout.paystack.com",
)

CSP_FONT_SRC = (
    "'self'",
    "https://fonts.gstatic.com",
    "https://fonts.googleapis.com",
)

CSP_MEDIA_SRC = ("'self'",)

CSP_OBJECT_SRC = ("'none'",)

CSP_BASE_URI = ("'self'",)


# ── Logging ────────────────────────────────────────────────────

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {'class': 'logging.StreamHandler'},
    },
    'root': {
        'handlers': ['console'],
        'level': 'DEBUG',
    },
}
