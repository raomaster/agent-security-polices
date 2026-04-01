import os
from flask import Flask, request, abort, send_file

app = Flask(__name__)
BASE_DIR = os.path.realpath('/var/www/app/static/files')


@app.route('/files/download')
def download_file():
    filename = request.args.get('name', '')
    if not filename:
        abort(400)

    resolved = os.path.realpath(os.path.join(BASE_DIR, filename))
    if not resolved.startswith(BASE_DIR + os.sep) and resolved != BASE_DIR:
        abort(403)

    if not os.path.isfile(resolved):
        abort(404)

    return send_file(resolved, as_attachment=True)


@app.route('/files/preview')
def preview_file():
    filename = request.args.get('name', '')
    if not filename:
        abort(400)

    resolved = os.path.realpath(os.path.join(BASE_DIR, filename))
    if not resolved.startswith(BASE_DIR + os.sep):
        abort(403)

    if not os.path.isfile(resolved):
        abort(404)

    with open(resolved, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read(4096)
    return {'content': content}


if __name__ == '__main__':
    app.run()
