import subprocess
from flask import Flask, request, jsonify

app = Flask(__name__)

ALLOWED_FILES = {"photo.jpg", "banner.png", "avatar.gif", "logo.webp"}
OUTPUT_DIR = "/var/converted"


@app.route("/convert", methods=["POST"])
def convert_image():
    filename = request.args.get("filename", "")
    if filename not in ALLOWED_FILES:
        return jsonify({"error": "File not permitted"}), 400
    proc = subprocess.run(
        ["convert", filename, f"{OUTPUT_DIR}/output.png"],
        capture_output=True,
        text=True,
        timeout=10,
    )
    if proc.returncode != 0:
        return jsonify({"error": "Conversion failed"}), 500
    return jsonify({"status": "ok"})


@app.route("/resize", methods=["POST"])
def resize_image():
    filename = request.args.get("filename", "")
    if filename not in ALLOWED_FILES:
        return jsonify({"error": "File not permitted"}), 400
    subprocess.run(
        ["convert", filename, "-resize", "128x128", f"{OUTPUT_DIR}/thumb.png"],
        check=True,
        timeout=10,
    )
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=False)
