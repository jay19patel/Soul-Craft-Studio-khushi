"""Auth views: register, login, logout, profile (me), Google OAuth."""
import logging
from datetime import timedelta

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import permissions, status, views
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

logger = logging.getLogger(__name__)


class RegisterView(views.APIView):
    """Register a new user with email + password and send a welcome email."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email    = request.data.get('email', '').strip()
        password = request.data.get('password', '')
        name     = request.data.get('name', '')

        if not email or not password:
            return Response({'detail': 'Email and password are required.'},
                            status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=email).exists():
            return Response({'detail': 'An account with this email already exists.'},
                            status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            username=email, email=email, password=password, first_name=name
        )
        logger.info("user_registered", extra={"user_id": user.id, "email": email})

        from ..utils import send_welcome_email
        send_welcome_email(user)

        refresh = RefreshToken.for_user(user)
        return Response({
            'user':    {'id': user.id, 'email': user.email, 'full_name': user.first_name},
            'access':  str(refresh.access_token),
            'refresh': str(refresh),
        }, status=status.HTTP_201_CREATED)


class LoginView(views.APIView):
    """Authenticate user with email + password and return JWT tokens."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email    = request.data.get('email', '')
        password = request.data.get('password', '')

        user = authenticate(username=email, password=password)
        if not user:
            return Response({'detail': 'Invalid credentials.'},
                            status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(user)
        logger.info("user_logged_in", extra={"user_id": user.id})
        return Response({
            'user': {
                'id': user.id, 'email': user.email,
                'full_name': user.first_name, 'is_superuser': user.is_superuser,
            },
            'token':   str(refresh.access_token),  # kept for frontend compatibility
            'access':  str(refresh.access_token),
            'refresh': str(refresh),
        })


class LogoutView(views.APIView):
    """Logout endpoint — client is responsible for discarding the token."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        return Response({'detail': 'Successfully logged out.'})


class MeView(views.APIView):
    """Get or update the authenticated user's own profile."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        u = request.user
        return Response({
            'id': u.id, 'email': u.email,
            'full_name': u.first_name, 'is_superuser': u.is_superuser,
        })

    def put(self, request):
        u         = request.user
        full_name = request.data.get('full_name')
        password  = request.data.get('password')

        if full_name:
            u.first_name = full_name
        if password:
            u.set_password(password)
        u.save()

        return Response({
            'id': u.id, 'email': u.email,
            'full_name': u.first_name, 'is_superuser': u.is_superuser,
        })


# ── Google OAuth ──────────────────────────────────────────────────────────────

from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView


class GoogleLogin(SocialLoginView):
    """Google OAuth2 login via postmessage (popup) flow."""

    adapter_class = GoogleOAuth2Adapter
    client_class  = OAuth2Client
    callback_url  = "postmessage"

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        # Send welcome email only for brand-new Google accounts
        if response.status_code == 200 and hasattr(self, 'user') and self.user:
            user = self.user
            if user.date_joined >= timezone.now() - timedelta(seconds=30):
                from ..utils import send_welcome_email
                send_welcome_email(user)
        return response
