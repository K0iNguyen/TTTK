#!/usr/bin/env python3
"""
Startup script for the TTTM message receiver server.
"""

import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from window_chat import app, logger

if __name__ == '__main__':
    logger.info("="*50)
    logger.info("TTTM Message Receiver Server")
    logger.info("="*50)
    logger.info("Server will start on http://localhost:8080")
    logger.info("Make sure your browser extension is loaded and active")
    logger.info("Press Ctrl+C to stop the server")
    logger.info("="*50)
    
    try:
        app.run(host='localhost', port=8080, debug=True)
    except KeyboardInterrupt:
        logger.info("\nServer stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}")