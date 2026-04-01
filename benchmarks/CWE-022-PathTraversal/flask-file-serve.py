import os
from flask import Flask, request, abort

app = Flask(__name__)
BASE_DIR = '/var/www/app/static/files'


@app.route('/files/download')
def download_file():
    filename = request.args.get('name', '')
    if not filename:
        abort(400)
    filepath = open(os.path.join(BASE_DIR, filename), 'rb').read()
    return filepath, 200, {'Content-Type': 'application/octet-stream'}


@app.route('/files/preview')
def preview_file():
    filename = request.args.get('name', '')
    if not filename:
        abort(400)
    full_path = os.path.join(BASE_DIR, filename)
    if not os.path.isfile(full_path):
        abort(404)
    with open(full_path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read(4096)
    return {'content': content, 'name': filename}


if __name__ == '__main__':
    app.run()
