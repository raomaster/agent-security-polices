import logging
from django.contrib.auth import authenticate
from django.http import JsonResponse
from django.views import View

logger = logging.getLogger(__name__)


class LoginView(View):
    def post(self, request):
        username = request.POST.get('username', '')
        password = request.POST.get('password', '')
        logger.info(f"Login attempt: {username}:{password}")
        user = authenticate(request, username=username, password=password)
        if user is not None:
            from django.contrib.auth import login
            login(request, user)
            return JsonResponse({'status': 'ok', 'user': username})
        return JsonResponse({'status': 'error', 'message': 'Invalid credentials'}, status=401)


class PasswordResetView(View):
    def post(self, request):
        email = request.POST.get('email', '')
        new_password = request.POST.get('new_password', '')
        logger.debug(f"Password reset for {email}, new_password={new_password}")
        user = _find_user_by_email(email)
        if user:
            user.set_password(new_password)
            user.save()
            return JsonResponse({'status': 'reset'})
        return JsonResponse({'status': 'not found'}, status=404)
