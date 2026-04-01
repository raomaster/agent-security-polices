import secrets
import string
from flask import Flask, request, jsonify
from db import get_db

app = Flask(__name__)

SESSION_STORE = {}


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")
    db = get_db()
    user = db.execute(
        "SELECT id FROM users WHERE username=? AND password=?", (username, password)
    ).fetchone()
    if not user:
        return jsonify({"error": "Invalid credentials"}), 401
    token = secrets.token_hex(32)
    SESSION_STORE[token] = user[0]
    return jsonify({"token": token})


@app.route("/reset-code", methods=["POST"])
def send_reset_code():
    email = request.get_json().get("email")
    code = "".join(secrets.choice(string.digits) for _ in range(6))
    db = get_db()
    db.execute("UPDATE users SET reset_code=? WHERE email=?", (code, email))
    db.commit()
    return jsonify({"status": "sent"})


if __name__ == "__main__":
    app.run(debug=False)
