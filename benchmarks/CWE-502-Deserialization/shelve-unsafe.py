import shelve
import os
from flask import Flask, request, jsonify
from auth import login_required

app = Flask(__name__)
DB_BASE_DIR = os.environ.get('USER_DB_DIR', '/var/app/userdata')

@app.route('/api/profile/load', methods=['GET'])
@login_required
def load_profile():
    username = request.args.get('user', '')
    if not username:
        return jsonify({'error': 'user parameter required'}), 400

    db_path = os.path.join(DB_BASE_DIR, username)
    with shelve.open(db_path) as db:
        profile = dict(db)
    return jsonify(profile)

@app.route('/api/profile/save', methods=['POST'])
@login_required
def save_profile():
    username = request.args.get('user', '')
    data = request.get_json()
    if not username or not data:
        return jsonify({'error': 'Missing parameters'}), 400

    db_path = os.path.join(DB_BASE_DIR, username)
    with shelve.open(db_path) as db:
        for key, value in data.items():
            db[key] = value
    return jsonify({'status': 'saved'})

if __name__ == '__main__':
    app.run(debug=False)
