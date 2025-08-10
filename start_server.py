#!/usr/bin/env python3
"""
Startup script for the TTTM chatbot server
"""

import os
import sys
from dotenv import load_dotenv

# Add the current directory to Python path so we can import from SrcPy
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from SrcPy.get_net import app, conversation_manager

load_dotenv()

def main():
    print("🚀 Starting TTTM Chatbot Server")
    print("=" * 40)
    
    # Check for OpenAI API key
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key or api_key == 'your-api-key-here':
        print("⚠️  Warning: OpenAI API key not set!")
        print("   Set your API key with: export OPENAI_API_KEY='your-key-here'")
        print("   Or the bot will use placeholder responses.")
    else:
        print("✅ OpenAI API key found")
    
    print("\n📡 Server will run on: http://localhost:5000")
    print("🌐 Extension should connect to this URL")
    print("\n🔧 Available endpoints:")
    print("   POST /api/chat/new - Create new conversation")
    print("   POST /api/chat/message - Send message")
    print("   GET  /api/chat/history/<id> - Get conversation history")
    print("   DELETE /api/chat/delete/<id> - Delete conversation")
    print("   GET  /api/conversations - List active conversations")
    
    print("\n🚀 Starting server...")
    print("   Press Ctrl+C to stop")
    print("=" * 40)
    
    try:
        app.run(host='localhost', port=5000, debug=True)
    except KeyboardInterrupt:
        print("\n\n👋 Server stopped by user")
        print("🧹 Cleaning up conversations...")
        conversation_manager.active_conversations.clear()
        print("✅ Cleanup complete")

if __name__ == "__main__":
    main()