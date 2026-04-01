from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from flask import Flask, request, jsonify
from db import get_db

app = Flask(__name__)
ph = PasswordHasher(time_cost=2, memory_cost=65536, parallelism=2)


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    username = data["username"]
    password = data["password"]
    hashed = ph.hash(password)
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
    db = get_db()
    row = db.execute(
        "SELECT id, password_hash FROM users WHERE username=?", (username,)
    ).fetchone()
    if not row:
        return jsonify({"error": "Invalid credentials"}), 401
    try:
        ph.verify(row[1], password)
    except VerifyMismatchError:
        return jsonify({"error": "Invalid credentials"}), 401
    return jsonify({"status": "ok", "user_id": row[0]})


if __name__ == "__main__":
    app.run(debug=False)
