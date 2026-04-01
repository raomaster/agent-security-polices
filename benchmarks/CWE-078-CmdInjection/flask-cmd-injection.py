import os
from flask import Flask, request, jsonify

app = Flask(__name__)

UPLOAD_DIR = "/var/uploads"
OUTPUT_DIR = "/var/converted"


@app.route("/convert", methods=["POST"])
def convert_image():
    filename = request.args.get("filename", "")
    output_path = os.path.join(OUTPUT_DIR, "output.png")
    result = os.popen(f"convert {filename} {output_path}").read()
    return jsonify({"status": "ok", "output": result})


@app.route("/thumbnail", methods=["POST"])
def make_thumbnail():
    filename = request.args.get("filename", "")
    size = request.args.get("size", "128x128")
    input_path = os.path.join(UPLOAD_DIR, filename)
    output_path = os.path.join(OUTPUT_DIR, "thumb.png")
    os.system(f"convert {input_path} -thumbnail {size} {output_path}")
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=False)
