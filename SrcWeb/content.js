// Content script for text selection widget
let selectionWidget = null;
let selectedText = '';
let chatWindow = null;

// Debug logging
console.log('TTTM Content Script Loaded!');

// Immediate test - create a visible element
const testDiv = document.createElement('div');
testDiv.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: green;
    color: white;
    padding: 5px 10px;
    z-index: 999999;
    font-size: 12px;
    border-radius: 3px;
`;
testDiv.textContent = 'TTTM Loaded';
document.body.appendChild(testDiv);

// Create the selection widget
function createSelectionWidget() {
    const widget = document.createElement('div');
    widget.id = 'tttm-selection-widget';
    widget.innerHTML = `
    <div class="tttm-widget-container">
      <button class="tttm-widget-btn" id="tttm-ask-prof" title="Ask Professor2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 9H14V4H5V21H19V9Z"/>
        </svg>
      </button>
      <button class="tttm-widget-btn" id="tttm-explain" title="Explain2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11,18H13V16H11V18M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,6A4,4 0 0,0 8,10H10A2,2 0 0,1 12,8A2,2 0 0,1 14,10C14,12 11,11.75 11,15H13C13,12.75 16,12.5 16,10A4,4 0 0,0 12,6Z"/>
        </svg>
      </button>
      <button class="tttm-widget-btn" id="tttm-close" title="Close">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
        </svg>
      </button>
    </div>
  `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
    #tttm-selection-widget {
      position: absolute;
      z-index: 10000;
      background: #2c3e50;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 4px;
      display: flex;
      gap: 2px;
      opacity: 0;
      transform: translateY(-10px);
      transition: all 0.2s ease;
      pointer-events: none;
    }

    #tttm-selection-widget.show {
      opacity: 1;
      transform: translateY(0);
      pointer-events: all;
    }

    .tttm-widget-container {
      display: flex;
      gap: 2px;
    }

    .tttm-widget-btn {
      background: transparent;
      border: none;
      color: white;
      padding: 8px;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s ease;
    }

    .tttm-widget-btn:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .tttm-widget-btn:active {
      background: rgba(255, 255, 255, 0.2);
    }

    #tttm-close {
      opacity: 0.7;
    }

    #tttm-close:hover {
      opacity: 1;
    }
  `;

    document.head.appendChild(style);
    document.body.appendChild(widget);

    // Add event listeners
    widget.querySelector('#tttm-ask-prof').addEventListener('click', handleAskProfessor);
    widget.querySelector('#tttm-explain').addEventListener('click', handleExplain);
    widget.querySelector('#tttm-close').addEventListener('click', hideWidget);

    return widget;
}

// Position the widget near the selection
function positionWidget(selection) {
    if (!selectionWidget) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const widgetRect = selectionWidget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    let left = rect.left + (rect.width / 2) - (widgetRect.width / 2);
    let top = rect.top - widgetRect.height - 10;

    // Adjust if widget goes outside viewport
    if (left < 10) left = 10;
    if (left + widgetRect.width > viewportWidth - 10) {
        left = viewportWidth - widgetRect.width - 10;
    }

    if (top < 10) {
        top = rect.bottom + 10;
    }

    selectionWidget.style.left = `${left + window.scrollX}px`;
    selectionWidget.style.top = `${top + window.scrollY}px`;
}

// Show the widget
function showWidget() {
    console.log('TTTM: showWidget called');
    if (!selectionWidget) {
        console.log('TTTM: Creating new widget');
        selectionWidget = createSelectionWidget();
    }

    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        console.log('TTTM: Positioning and showing widget');
        positionWidget(selection);
        selectionWidget.classList.add('show');
        console.log('TTTM: Widget should be visible now');
    } else {
        console.log('TTTM: No selection range found');
    }
}

// Hide the widget
function hideWidget() {
    if (selectionWidget) {
        selectionWidget.classList.remove('show');
    }
}

// Handle text selection
function handleSelection() {
    console.log('TTTM: Selection event triggered');
    const selection = window.getSelection();
    const text = selection.toString().trim();
    console.log('TTTM: Selected text:', text);

    if (text.length > 0) {
        selectedText = text;
        console.log('TTTM: Showing widget for text:', text);
        setTimeout(showWidget, 100); // Small delay to ensure selection is complete
    } else {
        console.log('TTTM: No text selected, hiding widget');
        hideWidget();
    }
}

// Create chat window
function createChatWindow() {
    const chatContainer = document.createElement('div');
    chatContainer.id = 'tttm-chat-window';
    chatContainer.innerHTML = `
        <div class="tttm-chat-header">
            <div class="tttm-chat-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 9H14V4H5V21H19V9Z"/>
                </svg>
                Ask Professor
            </div>
            <button class="tttm-chat-close" id="tttm-chat-close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
            </button>
        </div>
        <div class="tttm-chat-content">
            <div class="tttm-selected-text">
                <div class="tttm-selected-label">Selected text:</div>
                <div class="tttm-selected-content" id="tttm-selected-content"></div>
            </div>
            <div class="tttm-chat-messages" id="tttm-chat-messages">
                <div class="tttm-message tttm-bot-message">
                    Hi! I can help you understand the selected text. What would you like to know about it?
                </div>
            </div>
        </div>
        <div class="tttm-chat-input-container">
            <input type="text" class="tttm-chat-input" id="tttm-chat-input" placeholder="Ask a question about the selected text...">
            <button class="tttm-chat-send" id="tttm-chat-send">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z"/>
                </svg>
            </button>
        </div>
    `;

    // Add chat window styles
    const chatStyle = document.createElement('style');
    chatStyle.textContent = `
        #tttm-chat-window {
            position: fixed;
            top: 50%;
            right: 20px;
            transform: translateY(-50%);
            width: 350px;
            height: 500px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            z-index: 10001;
            display: flex;
            flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            opacity: 0;
            transform: translateY(-50%) scale(0.9);
            transition: all 0.3s ease;
        }

        #tttm-chat-window.show {
            opacity: 1;
            transform: translateY(-50%) scale(1);
        }

        .tttm-chat-header {
            background: #2c3e50;
            color: white;
            padding: 12px 16px;
            border-radius: 12px 12px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .tttm-chat-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
            font-size: 14px;
        }

        .tttm-chat-close {
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            opacity: 0.8;
            transition: opacity 0.2s ease;
        }

        .tttm-chat-close:hover {
            opacity: 1;
            background: rgba(255, 255, 255, 0.1);
        }

        .tttm-chat-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .tttm-selected-text {
            padding: 12px 16px;
            border-bottom: 1px solid #eee;
            background: #f8f9fa;
        }

        .tttm-selected-label {
            font-size: 12px;
            color: #666;
            margin-bottom: 4px;
            font-weight: 500;
        }

        .tttm-selected-content {
            font-size: 13px;
            color: #333;
            max-height: 60px;
            overflow-y: auto;
            background: white;
            padding: 8px;
            border-radius: 6px;
            border: 1px solid #ddd;
        }

        .tttm-chat-messages {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .tttm-message {
            max-width: 80%;
            padding: 8px 12px;
            border-radius: 12px;
            font-size: 14px;
            line-height: 1.4;
        }

        .tttm-bot-message {
            background: #e3f2fd;
            color: #1565c0;
            align-self: flex-start;
        }

        .tttm-user-message {
            background: #2c3e50;
            color: white;
            align-self: flex-end;
        }

        .tttm-chat-input-container {
            padding: 12px 16px;
            border-top: 1px solid #eee;
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .tttm-chat-input {
            flex: 1;
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 20px;
            outline: none;
            font-size: 14px;
        }

        .tttm-chat-input:focus {
            border-color: #2c3e50;
        }

        .tttm-chat-send {
            background: #2c3e50;
            color: white;
            border: none;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.2s ease;
        }

        .tttm-chat-send:hover {
            background: #34495e;
        }

        .tttm-chat-send:disabled {
            background: #bdc3c7;
            cursor: not-allowed;
        }
    `;

    document.head.appendChild(chatStyle);
    document.body.appendChild(chatContainer);

    // Add event listeners
    chatContainer.querySelector('#tttm-chat-close').addEventListener('click', closeChatWindow);
    chatContainer.querySelector('#tttm-chat-send').addEventListener('click', sendMessage);
    chatContainer.querySelector('#tttm-chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    return chatContainer;
}

// Show chat window
function showChatWindow(text) {
    if (!chatWindow) {
        chatWindow = createChatWindow();
    }

    // Set the selected text
    const selectedContent = chatWindow.querySelector('#tttm-selected-content');
    selectedContent.textContent = text;

    // Show the window
    setTimeout(() => {
        chatWindow.classList.add('show');
    }, 10);

    // Focus on input
    setTimeout(() => {
        chatWindow.querySelector('#tttm-chat-input').focus();
    }, 300);
}

// Close chat window
function closeChatWindow() {
    if (chatWindow) {
        chatWindow.classList.remove('show');
        setTimeout(() => {
            chatWindow.remove();
            chatWindow = null;
        }, 300);
    }
}

// Send message in chat
function sendMessage() {
    const input = chatWindow.querySelector('#tttm-chat-input');
    const message = input.value.trim();

    if (!message) return;

    // Add user message to chat
    addMessageToChat(message, 'user');

    // Clear input
    input.value = '';

    // Send the message to Python backend
    console.log('TTTM: Sending to backend:', {
        selectedText: selectedText,
        userQuestion: message
    });

    // Send to Python backend
    sendToBackend(selectedText, message);
}

// Add message to chat
function addMessageToChat(message, sender) {
    const messagesContainer = chatWindow.querySelector('#tttm-chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `tttm-message tttm-${sender}-message`;
    messageDiv.textContent = message;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Handle Ask Professor button
function handleAskProfessor() {
    if (selectedText) {
        console.log('TTTM: Opening chat window with selected text:', selectedText);
        showChatWindow(selectedText);
        hideWidget();
    }
}

// Send message to Python backend
async function sendToBackend(selectedText, userQuestion) {
    try {
        const response = await fetch('http://localhost:8080/api/message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                selectedText: selectedText,
                userQuestion: userQuestion
            })
        });

        if (response.ok) {
            const data = await response.json();
            addMessageToChat(data.response, 'bot');
        } else {
            addMessageToChat("Sorry, I couldn't process your request. Please try again.", 'bot');
        }
    } catch (error) {
        console.error('TTTM: Error sending to backend:', error);
        addMessageToChat("Connection error. Make sure the Python server is running on localhost:8080", 'bot');
    }
}

// Send explanation request to Python backend
async function sendExplanationRequest(text) {
    try {
        const response = await fetch('http://localhost:8080/api/explain', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text
            })
        });

        if (response.ok) {
            const data = await response.json();
            // Show explanation in chat window
            showChatWindow(text);
            setTimeout(() => {
                addMessageToChat(`Explanation: ${data.explanation}`, 'bot');
            }, 500);
        } else {
            console.error('TTTM: Failed to get explanation');
        }
    } catch (error) {
        console.error('TTTM: Error getting explanation:', error);
    }
}

// Handle Explain button
function handleExplain() {
    if (selectedText) {
        console.log('TTTM: Requesting explanation for:', selectedText);
        sendExplanationRequest(selectedText);
        hideWidget();
    }
}

// Event listeners
document.addEventListener('mouseup', handleSelection);
document.addEventListener('keyup', handleSelection);

// Hide widget when clicking elsewhere
document.addEventListener('mousedown', (e) => {
    if (selectionWidget && !selectionWidget.contains(e.target) &&
        (!chatWindow || !chatWindow.contains(e.target))) {
        hideWidget();
    }
});

// Hide widget on scroll
document.addEventListener('scroll', hideWidget);

// Test function - create widget immediately for testing
setTimeout(() => {
    console.log('TTTM: Running test widget creation');
    const testWidget = document.createElement('div');
    testWidget.style.cssText = `
        position: fixed;
        top: 50px;
        right: 50px;
        background: red;
        color: white;
        padding: 10px;
        z-index: 99999;
        border-radius: 5px;
    `;
    testWidget.textContent = 'TTTM Test Widget - Extension is working!';
    document.body.appendChild(testWidget);

    setTimeout(() => {
        testWidget.remove();
    }, 3000);
}, 2000);