import os
import jwt
from flask import Flask, request, jsonify
from functools import wraps
from models import User

app = Flask(__name__)
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'dev-secret')

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing token'}), 401
        token = auth_header.split(' ', 1)[1]
        payload = jwt.decode(token, SECRET_KEY)
        request.current_user_id = payload.get('sub')
        return f(*args, **kwargs)
    return decorated

@app.route('/api/dashboard', methods=['GET'])
@token_required
def dashboard():
    user = User.query.get(request.current_user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({'username': user.username, 'email': user.email, 'plan': user.plan})

@app.route('/api/settings', methods=['GET'])
@token_required
def settings():
    user = User.query.get(request.current_user_id)
    return jsonify({'notifications': user.notifications, 'theme': user.theme})

if __name__ == '__main__':
    app.run(debug=False)
