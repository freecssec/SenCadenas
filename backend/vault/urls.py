"""
URLs de l'application vault
"""
from django.urls import path
from . import views

urlpatterns = [
    # Profil utilisateur
    path('auth/me/',              views.get_me,         name='me'),
    path('auth/me/update/',       views.update_profile,  name='update_profile'),
    path('auth/change-password/', views.change_password, name='change_password'),
    path('auth/logout/',          views.LogoutView.as_view(), name='logout'),

    # Coffre-fort
    path('vault/',      views.VaultEntryListCreateView.as_view(), name='vault_list'),
    path('vault/<int:pk>/', views.VaultEntryDetailView.as_view(), name='vault_detail'),
]