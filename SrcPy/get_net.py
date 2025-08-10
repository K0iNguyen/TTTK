from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import uuid
from datetime import datetime
import logging
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__))) #don't delete this, this enables access to bot_api file
from bot_api import chat_api

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize OpenAI client (you'll need to set your API key)
openai_api_key = os.getenv('OPENAI_API_KEY', 'your-api-key-here')
chat_client = chat_api(openai_api_key)

class ChatbotConversation:
    """Unique conversation object for each text selection"""
    
    def __init__(self, selected_text, conversation_id=None):
        self.conversation_id = conversation_id or str(uuid.uuid4())
        self.selected_text = selected_text
        self.chat_history = []
        self.created_at = datetime.now()
        self.last_activity = datetime.now()
        
    def add_message(self, user_question, bot_response=None):
        """Add a message to the conversation history"""
        message = {
            'timestamp': datetime.now().isoformat(),
            'user_question': user_question,
            'bot_response': bot_response,
            'message_id': str(uuid.uuid4())
        }
        self.chat_history.append(message)
        self.last_activity = datetime.now()
        
    # def get_context(self):
    #     """Get conversation context for LLM"""
    #     return {
    #         'conversation_id': self.conversation_id,
    #         'selected_text': self.selected_text,
    #         'chat_history': self.chat_history,
    #         'created_at': self.created_at.isoformat(),
    #         'message_count': len(self.chat_history)
    #     }
        
    def generate_llm_response(self, user_question):
        """Generate LLM response based on selected text and conversation history"""
        try:
            # Build context from conversation history
            context_messages = []
            if self.chat_history:
                for msg in self.chat_history[-3:]:  # Last 3 messages for context
                    context_messages.append(f"User: {msg['user_question']}")
                    if msg['bot_response']:
                        context_messages.append(f"Assistant: {msg['bot_response']}")
            
            # Create comprehensive prompt
            prompt = f"""You are an AI assistant helping a user understand selected text from a webpage.
Selected Text: "{self.selected_text}"
Previous conversation context:
{chr(10).join(context_messages) if context_messages else "No previous context"}
Current question: {user_question}
Please provide a helpful, accurate response based on the selected text and the user's question. Keep your response concise but informative."""

            # Use the existing chat API
            response = chat_client.askSpecific(prompt)
            return response
            
        except Exception as e:
            logger.error(f"Error generating LLM response: {str(e)}")
            return f"I apologize, but I encountered an error processing your question. Please try again."

class ConversationManager:
    """Manages all active conversations"""
    
    def __init__(self):
        self.active_conversations = {}
        
    def create_conversation(self, selected_text):
        """Create a new conversation for selected text"""
        conversation = ChatbotConversation(selected_text)
        self.active_conversations[conversation.conversation_id] = conversation
        logger.info(f"Created new conversation: {conversation.conversation_id}")
        return conversation
        
    def get_conversation(self, conversation_id):
        """Get existing conversation by ID"""
        return self.active_conversations.get(conversation_id)
        
    def delete_conversation(self, conversation_id):
        """Delete conversation when chat window is closed"""
        if conversation_id in self.active_conversations:
            del self.active_conversations[conversation_id]
            logger.info(f"Deleted conversation: {conversation_id}")
            return True
        return False
        
    def cleanup_old_conversations(self, max_age_hours=24):
        """Clean up old conversations"""
        current_time = datetime.now()
        to_delete = []
        
        for conv_id, conversation in self.active_conversations.items():
            age = current_time - conversation.last_activity
            if age.total_seconds() > max_age_hours * 3600:
                to_delete.append(conv_id)
                
        for conv_id in to_delete:
            self.delete_conversation(conv_id)

def get_html():
    file = open("url.txt", "r")
    url = file.read()
    file.close()
    response = requests.get(url)
    file = open("page.html", "w", encoding='utf-8')
    file.write(response.text)
    file.close()

app = Flask(__name__)
# Enable CORS for the specific Chrome extension
CORS(app)  # Allow all origins for development

# Initialize conversation manager
conversation_manager = ConversationManager()

@app.route('/process_data', methods=['POST'])
def process_data():
    data = request.get_json()  # Get data sent as JSON
    variable_from_js = data.get('theURL') # Access the variable
    
    # Process variable_from_js in Python
    file = open("url.txt", "w")
    file.write(variable_from_js)
    file.close()
    get_html()
    processed_result = variable_from_js * 2 
    return jsonify(result=processed_result)

@app.route('/api/chat/new', methods=['POST'])
def create_new_chat():
    """Create a new chat conversation for selected text"""
    try:
        data = request.get_json()
        selected_text = data.get('selectedText', '')
        
        if not selected_text:
            return jsonify({'error': 'No selected text provided'}), 400
            
        # Create new conversation
        conversation = conversation_manager.create_conversation(selected_text)
        
        return jsonify({
            'success': True,
            'conversation_id': conversation.conversation_id,
            'selected_text': selected_text,
            'created_at': conversation.created_at.isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error creating new chat: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/chat/message', methods=['POST'])
def send_chat_message():
    """Send a message in an existing conversation"""
    try:
        data = request.get_json()
        conversation_id = data.get('conversation_id', '')
        user_question = data.get('userQuestion', '')
        
        if not conversation_id or not user_question:
            return jsonify({'error': 'Missing conversation_id or userQuestion'}), 400
            
        # Get conversation
        conversation = conversation_manager.get_conversation(conversation_id)
        if not conversation:
            return jsonify({'error': 'Conversation not found'}), 404
            
        # Generate LLM response
        logger.info(f"Generating LLM response for question: {user_question}")
        bot_response = conversation.generate_llm_response(user_question)
        logger.info(f"Generated bot response: {bot_response[:100]}...")
        
        # Add message to conversation
        conversation.add_message(user_question, bot_response)
        
        return jsonify({
            'success': True,
            'conversation_id': conversation_id,
            'user_question': user_question,
            'bot_response': bot_response,
            'message_count': len(conversation.chat_history)
        })
        
    except Exception as e:
        logger.error(f"Error sending chat message: {str(e)}")
        return jsonify({'error': str(e)}), 500

# @app.route('/api/chat/history/<conversation_id>', methods=['GET'])
# def get_chat_history(conversation_id):
#     """Get chat history for a conversation"""
#     try:
#         conversation = conversation_manager.get_conversation(conversation_id)
#         if not conversation:
#             return jsonify({'error': 'Conversation not found'}), 404
            
#         return jsonify({
#             'success': True,
#             'conversation': conversation.get_context()
#         })
        
#     except Exception as e:
#         logger.error(f"Error getting chat history: {str(e)}")
#         return jsonify({'error': str(e)}), 500

@app.route('/api/chat/delete/<conversation_id>', methods=['DELETE'])
def delete_chat_conversation(conversation_id):
    """Delete a conversation when chat window is closed"""
    try:
        success = conversation_manager.delete_conversation(conversation_id)
        
        return jsonify({
            'success': success,
            'message': 'Conversation deleted' if success else 'Conversation not found'
        })
        
    except Exception as e:
        logger.error(f"Error deleting conversation: {str(e)}")
        return jsonify({'error': str(e)}), 500

# @app.route('/api/conversations', methods=['GET'])
# def list_active_conversations():
#     """List all active conversations (for debugging)"""
#     try:
#         conversations = []
#         for conv_id, conversation in conversation_manager.active_conversations.items():
#             conversations.append({
#                 'conversation_id': conv_id,
#                 'selected_text': conversation.selected_text[:100] + '...' if len(conversation.selected_text) > 100 else conversation.selected_text,
#                 'message_count': len(conversation.chat_history),
#                 'created_at': conversation.created_at.isoformat(),
#                 'last_activity': conversation.last_activity.isoformat()
#             })
            
#         return jsonify({
#             'success': True,
#             'active_conversations': len(conversations),
#             'conversations': conversations
#         })
        
#     except Exception as e:
#         logger.error(f"Error listing conversations: {str(e)}")
#         return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)

