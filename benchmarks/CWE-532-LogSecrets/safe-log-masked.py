import logging
from django.contrib.auth import authenticate
from django.http import JsonResponse
from django.views import View

logger = logging.getLogger(__name__)


class LoginView(View):
    def post(self, request):
        username = request.POST.get('username', '')
        password = request.POST.get('password', '')
        logger.info(f"Login attempt: {username}:****")
        user = authenticate(request, username=username, password=password)
        if user is not None:
            from django.contrib.auth import login
            login(request, user)
            return JsonResponse({'status': 'ok', 'user': username})
        return JsonResponse({'status': 'error', 'message': 'Invalid credentials'}, status=401)


class PasswordResetView(View):
    def post(self, request):
        email = request.POST.get('email', '')
        logger.debug(f"Password reset requested for {email}")
        user = _find_user_by_email(email)
        if user:
            reset_token = _generate_reset_token(user)
            _send_reset_email(email, reset_token)
            return JsonResponse({'status': 'email sent'})
        return JsonResponse({'status': 'not found'}, status=404)
