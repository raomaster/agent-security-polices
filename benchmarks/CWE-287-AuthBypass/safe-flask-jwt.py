import os
import jwt
from flask import Flask, request, jsonify
from functools import wraps
from models import User

app = Flask(__name__)
SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
if not SECRET_KEY:
    raise RuntimeError('JWT_SECRET_KEY environment variable must be set')

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing token'}), 401
        token = auth_header.split(' ', 1)[1]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        request.current_user_id = payload['sub']
        return f(*args, **kwargs)
    return decorated

@app.route('/api/dashboard', methods=['GET'])
@token_required
def dashboard():
    user = User.query.get(request.current_user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({'username': user.username, 'email': user.email, 'plan': user.plan})

if __name__ == '__main__':
    app.run(debug=False)
