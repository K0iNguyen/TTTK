#!/usr/bin/env python3
"""
Simple message receiver for TTTM browser extension.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

@app.route('/api/message', methods=['POST'])
def receive_message():
    """Receive and log messages from the browser extension"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Log the received message
        logger.info(f"Received message: {data}")
        
        return jsonify({'success': True, 'message': 'Message received'})
        
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    logger.info("Starting simple message receiver...")
    app.run(host='localhost', port=8080, debug=True)