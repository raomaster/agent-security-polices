import json
import logging
from typing import Any
from flask import Flask, request, jsonify
from auth import require_api_key
from jsonschema import validate, ValidationError

app = Flask(__name__)
logger = logging.getLogger(__name__)

CACHE_ENTRY_SCHEMA = {
    'type': 'object',
    'required': ['key', 'value'],
    'properties': {
        'key': {'type': 'string', 'maxLength': 128},
        'value': {'type': ['string', 'number', 'boolean', 'null']},
        'ttl': {'type': 'integer', 'minimum': 1, 'maximum': 86400},
    },
    'additionalProperties': False,
}

@app.route('/api/cache/restore', methods=['POST'])
@require_api_key
def restore_cache():
    try:
        payload = json.loads(request.get_data(as_text=True))
        validate(instance=payload, schema=CACHE_ENTRY_SCHEMA)
    except (json.JSONDecodeError, ValidationError) as exc:
        return jsonify({'error': str(exc)}), 400

    logger.info('Cache entry restored: key=%s', payload['key'])
    return jsonify({'status': 'ok', 'key': payload['key']})

@app.route('/api/cache/list', methods=['GET'])
@require_api_key
def list_cache():
    return jsonify({'entries': []})

if __name__ == '__main__':
    app.run(debug=False)
