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
from textify import build_context_from_source
from typing import Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize OpenAI client (you'll need to set your API key)
openai_api_key = os.getenv('OPENAI_API_KEY', 'your-api-key-here')
chat_client = chat_api(openai_api_key)

class ChatbotConversation:
    """Unique conversation object for each text selection"""
    
    def __init__(self, selected_text, current_url=None, conversation_id=None):
        self.conversation_id = conversation_id or str(uuid.uuid4())
        self.selected_text = selected_text
        self.current_url = current_url
        self.chat_history = []
        self.created_at = datetime.now()
        self.last_activity = datetime.now()
        self.context: Dict[str, Any] = {}
    
    def set_context(self, context: Dict[str, Any]):
        """Store the full context dictionary (from build_context_from_source)."""
        self.context = context
        
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
        
    def get_page_url(self):
        """Get the stored page URL for this conversation"""
        return self.current_url
        
    # def get_context(self):
    #     """Get conversation context for LLM"""
    #     return {
    #         'conversation_id': self.conversation_id,
    #         'selected_text': self.selected_text,
    #         'chat_history': self.chat_history,
    #         'created_at': self.created_at.isoformat(),
    #         'message_count': len(self.chat_history)
    #     }
        
    def generate_initial_message(self):
        """Generate initial message with question options"""
        return """Hi! I can help you understand the selected text. What would you like to know about it?

Please choose from these options (type the number):
1. Ask for definition - Get the meaning of words or phrases
2. Create learning curriculum - Get a step-by-step learning plan
3. Find topic - Categorize and identify the main topic
4. Determine mood - Analyze the emotional tone of the text
5. Ask specific question - Ask any other question about the text

Type a number (1-5) to choose, or ask your own question directly."""

    def generate_llm_response(self, user_question):
        """Generate LLM response based on selected text, conversation history, and question type"""
        try:
            # Check if user is selecting a predefined option
            user_input = user_question.strip()
            
            # Handle numbered options
            if user_input in ['1', '2', '3', '4', '5']:
                return self.handle_predefined_option(user_input)
            
            # Check for option keywords
            if any(keyword in user_input.lower() for keyword in ['definition', 'define', 'meaning']):
                return self.handle_predefined_option('1')
            elif any(keyword in user_input.lower() for keyword in ['curriculum', 'learning plan', 'study plan']):
                return self.handle_predefined_option('2')
            elif any(keyword in user_input.lower() for keyword in ['topic', 'categorize', 'category']):
                return self.handle_predefined_option('3')
            elif any(keyword in user_input.lower() for keyword in ['mood', 'tone', 'emotion']):
                return self.handle_predefined_option('4')
            
            # For general questions, use askSpecific
            # return chat_client.askSpecific(f"Based on this selected text: '{self.selected_text}', please answer: {user_question}")

            # For general questions: prioritize the stored context, but allow extra info if clearly marked
            ctx_text = (
                self.context.get("context")
                if isinstance(self.context, dict) else f"Selection: {self.selected_text}"
            )

            prompt = (
                "Answer using BOTH the provided CONTEXT and your general knowledge.\n"
                "Guidelines:\n"
                "1) Lead with general knowledge and provide the best, up-to-date, consensus answer.\n"
                "2) If the CONTEXT adds a useful quote, number, definition, or example, incorporate it and cite the chunk like [Chunk 2].\n"
                "3) If CONTEXT and general knowledge conflict, explain the discrepancy and prefer the most reliable/consensus view.\n"
                "4) If the CONTEXT is sparse or off-topic, say so briefly and proceed using general knowledge.\n"
                "5) Keep the answer clear and concise\n\n"
                f"CONTEXT:\n{ctx_text}\n\n"
                f"QUESTION:\n{user_question}"
            )

            return chat_client.askSpecific(prompt)

            
        except Exception as e:
            logger.error(f"Error generating LLM response: {str(e)}")
            return f"I apologize, but I encountered an error processing your question. Please try again."
    
    def handle_predefined_option(self, option):
        """Handle predefined question options"""
        try:
            if option == '1':  # Definition
                return chat_client.askDefinition(self.selected_text)
            elif option == '2':  # Curriculum
                # For curriculum, we'll return the content instead of writing to file
                temp_file = "temp_curriculum.md"
                chat_client.askCurriculum(self.selected_text, temp_file)
                try:
                    with open(temp_file, "r", encoding='utf-8') as file:
                        curriculum_content = file.read()
                    os.remove(temp_file)  # Clean up temp file
                    return curriculum_content
                except:
                    return "I created a learning curriculum, but there was an issue retrieving it. Please try again."
            elif option == '3':  # Find Topic
                topic_result = chat_client.findTopic(self.selected_text, "general knowledge")
                if isinstance(topic_result, list) and len(topic_result) >= 2:
                    return f"Main Topic: {topic_result[0]}\n\nExplanation: {topic_result[1]}"
                else:
                    return f"Main Topic: {topic_result}"
            elif option == '4':  # Determine Mood
                mood = chat_client.determineMood(self.selected_text)
                return f"The mood/tone of this text is: {mood}"
            elif option == '5':  # Specific question
                return "Please go ahead and ask your specific question about the selected text."
            else:
                return "Please choose a valid option (1-5) or ask your question directly."
        except Exception as e:
            logger.error(f"Error handling predefined option {option}: {str(e)}")
            return f"I encountered an error processing your request. Please try again."

class ConversationManager:
    """Manages all active conversations"""
    
    def __init__(self):
        self.active_conversations = {}
        
    def create_conversation(self, selected_text, current_url=None):
        """Create a new conversation for selected text"""
        conversation = ChatbotConversation(selected_text, current_url)
        self.active_conversations[conversation.conversation_id] = conversation
        logger.info(f"Created new conversation: {conversation.conversation_id} for URL: {current_url}")
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

app = Flask(__name__)
# Enable CORS for the specific Chrome extension
CORS(app)  # Allow all origins for development

# Initialize conversation manager
conversation_manager = ConversationManager()

# @app.route('/api/chat/new', methods=['POST'])
# def create_new_chat():
#     """Create a new chat conversation for selected text"""
#     try:
#         data = request.get_json()
#         selected_text = data.get('selectedText', '')
#         current_url = data.get('currentUrl', '')

#         print("Current_url is: ", current_url)
        
#         if not selected_text:
#             return jsonify({'error': 'No selected text provided'}), 400
            
#         # Create new conversation with URL
#         conversation = conversation_manager.create_conversation(selected_text, current_url)
        
#         # Generate initial message with options
#         initial_message = conversation.generate_initial_message()
        
#         return jsonify({
#             'success': True,
#             'conversation_id': conversation.conversation_id,
#             'selected_text': selected_text,
#             'current_url': current_url,
#             'initial_message': initial_message,
#             'created_at': conversation.created_at.isoformat()
#         })
        
#     except Exception as e:
#         logger.error(f"Error creating new chat: {str(e)}")
#         return jsonify({'error': str(e)}), 500

@app.route('/api/chat/new', methods=['POST'])
def create_new_chat():
    """Create a new chat conversation for selected text"""
    try:
        data = request.get_json()
        selected_text = data.get('selectedText', '')
        current_url = data.get('currentUrl', '')
        print("Current_url is: ", current_url)

        if not selected_text:
            return jsonify({'error': 'No selected text provided'}), 400

        # Create new conversation
        conversation = conversation_manager.create_conversation(selected_text, current_url)

        try:
            with open(current_url, "r", encoding="utf-8") as f:
                html = f.read()
            ctx = build_context_from_source(
                selected_text=selected_text,
                url_or_html=html,
                top_k=3,
                max_tokens=320
            )
            conversation.set_context(ctx)  # <-- store dict as-is
        except Exception as e:
            logger.warning(f"Context build failed; fallback to selection only: {e}")
            conversation.set_context({
                "title": "",
                "context": f"Selection: {selected_text}",
                "selected_indices": [],
                "selected_chunks": []
            })

        initial_message = conversation.generate_initial_message()

        return jsonify({
            "success": True,
            "conversation_id": conversation.conversation_id,
            "selected_text": selected_text,
            "initial_message": initial_message,
            'current_url': current_url,
            'created_at': conversation.created_at.isoformat()
            # optional debug fields pulled from the dict
            # "context_ready": bool(conversation.context.get("context")),
            # "context_title": conversation.context.get("title", ""),
            # "context_chunks": len(conversation.context.get("selected_chunks", [])),
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