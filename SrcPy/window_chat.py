#!/usr/bin/env python3
"""
Message receiver for TTTM browser extension.
Handles messages from content.js including selected text and user questions.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for browser extension communication

class MessageHandler:
    """Handles incoming messages from the browser extension"""
    
    def __init__(self):
        self.message_history = []
    
    def process_message(self, selected_text, user_question):
        """Process the selected text and user question"""
        logger.info(f"Processing message - Selected text: {selected_text[:100]}...")
        logger.info(f"User question: {user_question}")
        
        # Store message in history
        message_data = {
            'timestamp': datetime.now().isoformat(),
            'selected_text': selected_text,
            'user_question': user_question
        }
        self.message_history.append(message_data)
        
        # Here you can add your AI/processing logic
        response = self.generate_response(selected_text, user_question)
        
        return response
    
    def generate_response(self, selected_text, user_question):
        """Generate a response based on the selected text and question"""
        # Placeholder response - replace with your actual AI/processing logic
        response = f"I understand you're asking about: '{user_question}' regarding the text: '{selected_text[:50]}...'"
        
        # You can integrate with OpenAI, local LLM, or other AI services here
        return response

# Initialize message handler
message_handler = MessageHandler()

@app.route('/api/message', methods=['POST'])
def receive_message():
    """Receive messages from the browser extension"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        selected_text = data.get('selectedText', '')
        user_question = data.get('userQuestion', '')
        
        if not selected_text or not user_question:
            return jsonify({'error': 'Missing selectedText or userQuestion'}), 400
        
        # Process the message
        response = message_handler.process_message(selected_text, user_question)
        
        return jsonify({
            'success': True,
            'response': response,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error processing message: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/explain', methods=['POST'])
def explain_text():
    """Handle text explanation requests"""
    try:
        data = request.get_json()
        selected_text = data.get('text', '')
        
        if not selected_text:
            return jsonify({'error': 'No text provided'}), 400
        
        # Generate explanation
        explanation = f"Explanation for: {selected_text}"
        # Add your explanation logic here
        
        return jsonify({
            'success': True,
            'explanation': explanation,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error explaining text: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/history', methods=['GET'])
def get_message_history():
    """Get message history"""
    return jsonify({
        'success': True,
        'history': message_handler.message_history
    })

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    logger.info("Starting TTTM message receiver server...")
    app.run(host='localhost', port=8080, debug=True)