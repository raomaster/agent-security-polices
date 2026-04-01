from django.contrib.auth.models import User
from django.http import JsonResponse
from django.views import View


class UserSearchView(View):
    def get(self, request):
        username = request.GET.get('username', '')
        users = User.objects.raw(f"SELECT * FROM auth_user WHERE username = '{username}'")
        result = [{'id': u.id, 'username': u.username, 'email': u.email} for u in users]
        return JsonResponse({'users': result})


class UserProfileView(View):
    def get(self, request, user_id):
        email = request.GET.get('email', '')
        users = User.objects.raw(
            f"SELECT * FROM auth_user WHERE id = {user_id} AND email = '{email}'"
        )
        user_list = list(users)
        if not user_list:
            return JsonResponse({'error': 'Not found'}, status=404)
        u = user_list[0]
        return JsonResponse({'id': u.id, 'username': u.username, 'email': u.email})


class AdminUserView(View):
    def get(self, request):
        role = request.GET.get('role', 'user')
        users = User.objects.raw(
            "SELECT * FROM auth_user WHERE is_staff = 0 AND role = '" + role + "'"
        )
        return JsonResponse({'users': [u.username for u in users]})
