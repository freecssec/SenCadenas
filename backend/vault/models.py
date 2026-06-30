"""
Modèles SenCadenas — Structure de la base de données
"""
from django.db import models
from django.contrib.auth.models import User


class VaultEntry(models.Model):
    """
    Un élément du coffre-fort (mot de passe, carte, note)
    Le mot de passe est stocké chiffré côté serveur.
    """

    TYPE_CHOICES = [
        ('login', 'Mot de passe'),
        ('card',  'Carte bancaire'),
        ('note',  'Note sécurisée'),
    ]

    # Relation avec l'utilisateur
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,  # Supprime les entrées si l'utilisateur est supprimé
        related_name='vault_entries'
    )

    # Type d'entrée
    type     = models.CharField(max_length=10, choices=TYPE_CHOICES, default='login')
    name     = models.CharField(max_length=200)
    favorite = models.BooleanField(default=False)

    #Champs LOGIN
    username = models.CharField(max_length=200, blank=True, default='')
    password = models.TextField(blank=True, default='')  # sera chiffré
    url      = models.URLField(max_length=500, blank=True, default='')

    #Champs CARTE
    card_holder = models.CharField(max_length=200, blank=True, default='')
    card_number = models.CharField(max_length=50,  blank=True, default='')  # chiffré
    expiry      = models.CharField(max_length=10,  blank=True, default='')
    cvv         = models.CharField(max_length=10,  blank=True, default='')  # chiffré

    #Champs NOTE
    note = models.TextField(blank=True, default='')  # chiffré

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']  # Plus récents en premier
        verbose_name = 'Entrée du coffre'
        verbose_name_plural = 'Entrées du coffre'

    def __str__(self):
        return f"{self.user.username} — {self.name} ({self.type})"