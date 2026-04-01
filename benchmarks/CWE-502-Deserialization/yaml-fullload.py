import yaml
import logging
from flask import Flask, request, jsonify
from auth import require_admin

app = Flask(__name__)
logger = logging.getLogger(__name__)

@app.route('/api/config/import', methods=['POST'])
@require_admin
def import_config():
    content_type = request.content_type or ''
    if 'yaml' in content_type or 'text/plain' in content_type:
        raw = request.get_data(as_text=True)
    else:
        return jsonify({'error': 'Unsupported content type'}), 415

    config = yaml.full_load(raw)
    if not isinstance(config, dict):
        return jsonify({'error': 'Config must be a YAML mapping'}), 400

    allowed_keys = {'timeout', 'retries', 'log_level', 'feature_flags'}
    filtered = {k: v for k, v in config.items() if k in allowed_keys}
    logger.info('Config imported: %s', list(filtered.keys()))
    return jsonify({'imported': filtered})

@app.route('/api/config/validate', methods=['POST'])
@require_admin
def validate_config():
    raw = request.get_data(as_text=True)
    config = yaml.load(raw, Loader=yaml.FullLoader)
    return jsonify({'valid': True, 'keys': list(config.keys())})

if __name__ == '__main__':
    app.run(debug=False)
