"""
Serializers — Convertir les modèles en JSON et valider les données entrantes
"""
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import VaultEntry

#   AUTH

class RegisterSerializer(serializers.ModelSerializer):
    """Inscription d'un nouvel utilisateur"""
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )

    class Meta:
        model = User
        fields = ('id', 'email', 'first_name', 'last_name', 'password', 'password_confirm')
        extra_kwargs = {
            'email':      {'required': True},
            'first_name': {'required': True},
        }

    def validate(self, data):
        # Vérifier que les mots de passe correspondent
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({
                'password_confirm': 'Les mots de passe ne correspondent pas.'
            })

        # Validation NIST : minimum 15 caractères
        if len(data['password']) < 15:
            raise serializers.ValidationError({
                'password': 'Le mot de passe maître doit contenir au moins 15 caractères (NIST SP 800-63B).'
            })

        # Validation Django (mots de passe courants)
        try:
            validate_password(data['password'])
        except Exception as e:
            raise serializers.ValidationError({'password': list(e)})

        # Vérifier que l'email n'est pas déjà utilisé
        if User.objects.filter(email=data['email']).exists():
            raise serializers.ValidationError({
                'email': 'Cette adresse e-mail est déjà utilisée.'
            })

        return data

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(
            username   = validated_data['email'],  # email comme username
            email      = validated_data['email'],
            first_name = validated_data.get('first_name', ''),
            last_name  = validated_data.get('last_name', ''),
            password   = validated_data['password'],
        )
        return user


class UserSerializer(serializers.ModelSerializer):
    """Informations de l'utilisateur connecté"""
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'email', 'first_name', 'last_name', 'full_name')

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.email

#   COFFRE-FORT

class VaultEntrySerializer(serializers.ModelSerializer):
    """Sérialiser les entrées du coffre"""

    class Meta:
        model = VaultEntry
        fields = (
            'id', 'type', 'name', 'favorite',
            'username', 'password', 'url',
            'card_holder', 'card_number', 'expiry', 'cvv',
            'note',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

    def validate_type(self, value):
        if value not in ['login', 'card', 'note']:
            raise serializers.ValidationError("Type invalide. Choisissez : login, card ou note.")
        return value

    def validate(self, data):
        entry_type = data.get('type', 'login')

        # Validation selon le type
        if entry_type == 'login' and not data.get('password'):
            raise serializers.ValidationError({'password': 'Le mot de passe est requis.'})

        if entry_type == 'card' and not data.get('card_number'):
            raise serializers.ValidationError({'card_number': 'Le numéro de carte est requis.'})

        if entry_type == 'note' and not data.get('note'):
            raise serializers.ValidationError({'note': 'Le contenu de la note est requis.'})

        return data