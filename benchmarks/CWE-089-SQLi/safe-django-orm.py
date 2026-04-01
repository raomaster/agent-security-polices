from django.contrib.auth.models import User
from django.http import JsonResponse
from django.views import View
from django.db.models import Q


class UserSearchView(View):
    def get(self, request):
        username = request.GET.get('username', '')
        users = User.objects.filter(username=username)
        result = [{'id': u.id, 'username': u.username, 'email': u.email} for u in users]
        return JsonResponse({'users': result})


class UserProfileView(View):
    def get(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return JsonResponse({'error': 'Not found'}, status=404)
        return JsonResponse({'id': user.id, 'username': user.username, 'email': user.email})


class UserListView(View):
    ALLOWED_ORDER_FIELDS = {'id', 'username', 'email', 'date_joined'}

    def get(self, request):
        search = request.GET.get('q', '')
        order_by = request.GET.get('order_by', 'id')
        if order_by.lstrip('-') not in self.ALLOWED_ORDER_FIELDS:
            order_by = 'id'
        users = User.objects.filter(
            Q(username__icontains=search) | Q(email__icontains=search)
        ).order_by(order_by)
        return JsonResponse({'users': [u.username for u in users]})
