"""
URLs principales — SenCadenas
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from vault.views import LoginView, RegisterView

urlpatterns = [
    # Admin Django
    path('admin/', admin.site.urls),

    # Auth
    path('api/auth/register/', RegisterView.as_view(),   name='register'),
    path('api/auth/login/',    LoginView.as_view(),      name='login'),
    path('api/auth/refresh/',  TokenRefreshView.as_view(), name='token_refresh'),

    # Coffre-fort
    path('api/', include('vault.urls')),
]