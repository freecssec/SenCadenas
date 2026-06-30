"""
Views SenCadenas — Logique métier de l'API
"""
from django.contrib.auth.models import User
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate

from .models import VaultEntry
from .serializers import RegisterSerializer, UserSerializer, VaultEntrySerializer


#   AUTH

class RegisterView(APIView):
    """POST /api/auth/register/ — Créer un compte"""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            # Générer les tokens JWT
            refresh = RefreshToken.for_user(user)
            return Response({
                'message': 'Compte créé avec succès !',
                'user': UserSerializer(user).data,
                'tokens': {
                    'access':  str(refresh.access_token),
                    'refresh': str(refresh),
                }
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    """POST /api/auth/login/ — Se connecter"""
    permission_classes = [AllowAny]

    # Protection brute-force : max 5 tentatives (géré par le throttling DRF)
    throttle_scope = 'anon'

    def post(self, request):
        email    = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '')

        if not email or not password:
            return Response(
                {'error': 'Email et mot de passe requis.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Authentifier avec email comme username
        user = authenticate(request, username=email, password=password)

        if user is None:
            # Message générique pour ne pas révéler si l'email existe
            return Response(
                {'error': 'Identifiants incorrects.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.is_active:
            return Response(
                {'error': 'Ce compte est désactivé.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Générer les tokens JWT
        refresh = RefreshToken.for_user(user)
        return Response({
            'message': 'Connexion réussie !',
            'user': UserSerializer(user).data,
            'tokens': {
                'access':  str(refresh.access_token),
                'refresh': str(refresh),
            }
        })


class LogoutView(APIView):
    """POST /api/auth/logout/ — Se déconnecter"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            token = RefreshToken(refresh_token)
            token.blacklist()  # Invalider le refresh token
            return Response({'message': 'Déconnexion réussie.'})
        except Exception:
            return Response(
                {'error': 'Token invalide.'},
                status=status.HTTP_400_BAD_REQUEST
            )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_me(request):
    """GET /api/auth/me/ — Profil de l'utilisateur connecté"""
    return Response(UserSerializer(request.user).data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_profile(request):
    """PATCH /api/auth/me/ — Modifier le profil"""
    user = request.user
    user.first_name = request.data.get('first_name', user.first_name)
    user.last_name  = request.data.get('last_name',  user.last_name)

    # Changer l'email
    new_email = request.data.get('email', '').strip().lower()
    if new_email and new_email != user.email:
        if User.objects.filter(email=new_email).exclude(pk=user.pk).exists():
            return Response(
                {'error': 'Cet email est déjà utilisé.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        user.email    = new_email
        user.username = new_email

    user.save()
    return Response(UserSerializer(user).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """POST /api/auth/change-password/ — Changer le mot de passe maître"""
    user             = request.user
    current_password = request.data.get('current_password', '')
    new_password     = request.data.get('new_password', '')

    # Vérifier l'ancien mot de passe
    if not user.check_password(current_password):
        return Response(
            {'error': 'Mot de passe actuel incorrect.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Validation NIST : minimum 15 caractères
    if len(new_password) < 15:
        return Response(
            {'error': 'Le nouveau mot de passe doit contenir au moins 15 caractères (NIST).'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if current_password == new_password:
        return Response(
            {'error': 'Le nouveau mot de passe doit être différent de l\'ancien.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    user.set_password(new_password)
    user.save()
    return Response({'message': 'Mot de passe mis à jour avec succès.'})

#   COFFRE-FORT

class VaultEntryListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/vault/       — Récupérer toutes les entrées
    POST /api/vault/       — Créer une nouvelle entrée
    """
    serializer_class   = VaultEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Chaque utilisateur ne voit QUE ses propres entrées
        queryset = VaultEntry.objects.filter(user=self.request.user)

        # Filtres optionnels
        entry_type = self.request.query_params.get('type')
        favorite   = self.request.query_params.get('favorite')
        search     = self.request.query_params.get('search')

        if entry_type:
            queryset = queryset.filter(type=entry_type)
        if favorite == 'true':
            queryset = queryset.filter(favorite=True)
        if search:
            queryset = queryset.filter(name__icontains=search)

        return queryset

    def perform_create(self, serializer):
        # Associer automatiquement l'entrée à l'utilisateur connecté
        serializer.save(user=self.request.user)


class VaultEntryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/vault/<id>/ — Voir une entrée
    PUT    /api/vault/<id>/ — Modifier complètement
    PATCH  /api/vault/<id>/ — Modifier partiellement
    DELETE /api/vault/<id>/ — Supprimer
    """
    serializer_class   = VaultEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Sécurité : un utilisateur ne peut accéder qu'à SES entrées
        return VaultEntry.objects.filter(user=self.request.user)