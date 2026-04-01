import hashlib
from flask import Flask, request, jsonify
from db import get_db

app = Flask(__name__)


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    username = data["username"]
    password = data["password"]
    hashed = hashlib.md5(password.encode()).hexdigest()
    db = get_db()
    db.execute(
        "INSERT INTO users (username, password_hash) VALUES (?, ?)",
        (username, hashed),
    )
    db.commit()
    return jsonify({"status": "registered"})


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data["username"]
    password = data["password"]
    hashed = hashlib.md5(password.encode()).hexdigest()
    db = get_db()
    row = db.execute(
        "SELECT id FROM users WHERE username=? AND password_hash=?",
        (username, hashed),
    ).fetchone()
    if row:
        return jsonify({"status": "ok", "user_id": row[0]})
    return jsonify({"error": "Invalid credentials"}), 401


if __name__ == "__main__":
    app.run(debug=False)
