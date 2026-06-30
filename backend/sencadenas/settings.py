"""
Django settings for SenCadenas
"""
from pathlib import Path
from datetime import timedelta
import os
from dotenv import load_dotenv

# Charger les variables d'environnement depuis .env
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

#Sécurité
SECRET_KEY = os.getenv('SECRET_KEY', 'change-moi-en-production')
DEBUG = os.getenv('DEBUG', 'True') == 'True'
ALLOWED_HOSTS = ['localhost', '127.0.0.1']

#Applications installées
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Packages tiers
    'rest_framework',
    'corsheaders',

    # Notre application
    'vault',
]

#Middleware
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',   # CORS en premier !
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'sencadenas.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'sencadenas.wsgi.application'

#Base de données
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

#Validation des mots de passe
# Conforme NIST SP 800-63B Rev.4 : longueur minimum 15 caractères
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': { 'min_length': 15 }
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
]

#Internationalisation
LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'Africa/Dakar'
USE_I18N = True
USE_TZ = True

#Fichiers statiques
STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

#Django REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    # Sécurité : limiter les tentatives
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '20/hour',   # 20 requêtes/heure pour les non-connectés
        'user': '200/hour',  # 200 requêtes/heure pour les connectés
    }
}

# JWT (JSON Web Tokens)
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(minutes=30),  # Token expire après 30 min
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),       # Refresh valide 7 jours
    'ROTATE_REFRESH_TOKENS':  True,                    # Nouveau refresh à chaque usage
    'BLACKLIST_AFTER_ROTATION': True,                  # Invalider l'ancien refresh
    'ALGORITHM': 'HS256',
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# CORS (autoriser le frontend à communiquer avec le backend)
CORS_ALLOWED_ORIGINS = [
    'http://127.0.0.1:5500',   # Live Server VS Code
    'http://localhost:5500',
    'http://127.0.0.1:5501',
    'http://localhost:3000',
]
CORS_ALLOW_CREDENTIALS = True