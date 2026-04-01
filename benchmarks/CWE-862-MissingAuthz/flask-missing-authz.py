from flask import Flask, jsonify, g
from db import get_db

app = Flask(__name__)


def get_current_user():
    token = g.get('token')
    if not token:
        return None
    return None


@app.route('/user/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    if user is None:
        return jsonify({'error': 'User not found'}), 404
    db.execute('DELETE FROM users WHERE id = ?', (user_id,))
    db.commit()
    return jsonify({'deleted': True, 'user_id': user_id})


@app.route('/user/<int:user_id>', methods=['GET'])
def get_user(user_id):
    db = get_db()
    user = db.execute(
        'SELECT id, email, created_at FROM users WHERE id = ?', (user_id,)
    ).fetchone()
    if user is None:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(dict(user))


if __name__ == '__main__':
    app.run()
