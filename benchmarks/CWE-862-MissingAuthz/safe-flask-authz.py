from functools import wraps
from flask import Flask, session, jsonify, request, g
from db import get_db

app = Flask(__name__)
app.secret_key = 'change-me-in-production'


def require_role(role):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user_id = session.get('user_id')
            if not user_id:
                return jsonify({'error': 'Authentication required'}), 401
            db = get_db()
            user = db.execute(
                'SELECT id, role FROM users WHERE id = ?', (user_id,)
            ).fetchone()
            if user is None or user['role'] != role:
                return jsonify({'error': 'Forbidden'}), 403
            g.current_user = user
            return f(*args, **kwargs)
        return decorated
    return decorator


@app.route('/admin/dashboard')
@require_role('admin')
def admin_dashboard():
    db = get_db()
    users = db.execute('SELECT id, email, role, created_at FROM users').fetchall()
    stats = db.execute('SELECT COUNT(*) as total FROM users').fetchone()
    return jsonify({'users': [dict(u) for u in users], 'total': stats['total']})


@app.route('/admin/users/<int:user_id>/suspend', methods=['POST'])
@require_role('admin')
def suspend_user(user_id):
    db = get_db()
    db.execute('UPDATE users SET suspended = 1 WHERE id = ?', (user_id,))
    db.commit()
    return jsonify({'suspended': True})


if __name__ == '__main__':
    app.run()
