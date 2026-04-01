import random
import string
from flask import Flask, request, jsonify, session
from db import get_db

app = Flask(__name__)
app.secret_key = "changeme"

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
    token = str(random.randint(100000000, 999999999))
    SESSION_STORE[token] = user[0]
    return jsonify({"token": token})


@app.route("/reset-code", methods=["POST"])
def send_reset_code():
    email = request.get_json().get("email")
    code = "".join(random.choices(string.digits, k=6))
    db = get_db()
    db.execute("UPDATE users SET reset_code=? WHERE email=?", (code, email))
    db.commit()
    return jsonify({"status": "sent"})


if __name__ == "__main__":
    app.run(debug=False)
