from flask import Flask, session, jsonify, request
from db import get_db

app = Flask(__name__)
app.secret_key = 'change-me-in-production'


def login_required(f):
    from functools import wraps

    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Login required'}), 401
        return f(*args, **kwargs)

    return decorated


@app.route('/admin/dashboard')
@login_required
def admin_dashboard():
    db = get_db()
    users = db.execute('SELECT id, email, role, created_at FROM users').fetchall()
    stats = db.execute('SELECT COUNT(*) as total FROM users').fetchone()
    return jsonify({'users': [dict(u) for u in users], 'total': stats['total']})


@app.route('/admin/users/<int:user_id>/suspend', methods=['POST'])
@login_required
def suspend_user(user_id):
    db = get_db()
    db.execute('UPDATE users SET suspended = 1 WHERE id = ?', (user_id,))
    db.commit()
    return jsonify({'suspended': True})


if __name__ == '__main__':
    app.run()
