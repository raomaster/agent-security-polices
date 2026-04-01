import os
import zipfile
from flask import Flask, request, jsonify

app = Flask(__name__)
UPLOAD_DIR = '/var/app/uploads'
EXTRACT_DIR = '/var/app/extracted'


@app.route('/upload/archive', methods=['POST'])
def upload_archive():
    archive = request.files.get('archive')
    if not archive or not archive.filename.endswith('.zip'):
        return jsonify({'error': 'A .zip file is required'}), 400

    zip_path = os.path.join(UPLOAD_DIR, archive.filename)
    archive.save(zip_path)

    extracted = []
    with zipfile.ZipFile(zip_path, 'r') as zf:
        for member in zf.infolist():
            dest_path = os.path.join(EXTRACT_DIR, member.filename)
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            with zf.open(member) as src, open(dest_path, 'wb') as dst:
                dst.write(src.read())
            extracted.append(member.filename)

    return jsonify({'extracted': extracted})


if __name__ == '__main__':
    app.run()
