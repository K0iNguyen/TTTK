// Content script for text selection widget
let selectionWidget = null;
let selectedText = '';
let chatWindow = null;
let recordingWindow = null;
let isRecording = false;
let recordedAudioBlob = null;
let audioPlayer = null;

// Debug logging
console.log('TTTM Content Script Loaded!');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('TTTM: Received message:', message);
  
  if (message.action === 'openRecordingWindow') {
    // Open recording window without selected text (from popup)
    showRecordingWindow('');
  }
  
  sendResponse({ success: true });
});

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
      <button class="tttm-widget-btn" id="tttm-ask-prof" title="Ask Professor">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 9H14V4H5V21H19V9Z"/>
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
  `;

    document.head.appendChild(style);
    document.body.appendChild(widget);

    // Add event listeners
    widget.querySelector('#tttm-ask-prof').addEventListener('click', handleAskProfessor);

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
                    Hi! I can help you with questions. You can type or record your question.
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
            <button class="tttm-chat-mic" id="tttm-chat-mic" title="Record Question">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"/>
                </svg>
            </button>
        </div>
        <div class="tttm-chat-recording-section" style="display: none;">
            <div class="tttm-recording-status" id="tttm-chat-recording-status">
                Click "Start Recording" to record your question
            </div>
            <div class="tttm-chat-recording-controls">
                <button class="tttm-recording-btn tttm-start-btn" id="tttm-chat-start-recording">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"/>
                    </svg>
                    Start Recording
                </button>
                <button class="tttm-recording-btn tttm-stop-btn" id="tttm-chat-stop-recording" style="display: none;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6,19h4V5H6V19M14,5V19H18V5H14Z"/>
                    </svg>
                    Stop Recording
                </button>
            </div>
            <div class="tttm-chat-playback-controls" id="tttm-chat-playback-controls" style="display: none;">
                <button class="tttm-playback-btn tttm-play-btn" id="tttm-chat-play-recording">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
                    </svg>
                    <span class="play-text">Play Recording</span>
                    <div class="sound-bar" id="tttm-chat-sound-bar">
                        <div class="bar"></div>
                        <div class="bar"></div>
                        <div class="bar"></div>
                        <div class="bar"></div>
                        <div class="bar"></div>
                    </div>
                </button>
                <button class="tttm-playback-btn tttm-record-again-btn" id="tttm-chat-record-again">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"/>
                    </svg>
                    Record Again
                </button>
                <button class="tttm-playback-btn tttm-transcribe-btn" id="tttm-chat-transcribe">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
                    </svg>
                    Transcribe
                </button>
            </div>
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

        .tttm-chat-mic {
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

        .tttm-chat-mic:hover {
            background: #34495e;
        }

        .tttm-chat-mic.recording {
            background: #e74c3c;
            animation: pulse 1.5s infinite;
        }

        .tttm-chat-recording-section {
            padding: 12px 16px;
            border-top: 1px solid #eee;
            background: #f8f9fa;
        }

        .tttm-chat-recording-status {
            text-align: center;
            padding: 12px;
            background: white;
            border-radius: 6px;
            font-size: 13px;
            color: #666;
            border: 1px solid #ddd;
            margin-bottom: 12px;
        }

        .tttm-chat-recording-status.recording {
            background: #fff3cd;
            border-color: #ffc107;
            color: #856404;
            animation: pulse 1.5s infinite;
        }

        .tttm-chat-recording-controls {
            display: flex;
            gap: 8px;
            justify-content: center;
            margin-bottom: 8px;
        }

        .tttm-chat-playback-controls {
            display: flex;
            gap: 8px;
            justify-content: center;
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
    
    // Chat mic button event listener
    chatContainer.querySelector('#tttm-chat-mic').addEventListener('click', handleChatMicClick);
    
    // Chat recording event listeners
    chatContainer.querySelector('#tttm-chat-start-recording').addEventListener('click', startChatRecording);
    chatContainer.querySelector('#tttm-chat-stop-recording').addEventListener('click', stopChatRecording);
    chatContainer.querySelector('#tttm-chat-play-recording').addEventListener('click', playChatRecording);
    chatContainer.querySelector('#tttm-chat-record-again').addEventListener('click', recordChatAgain);
    chatContainer.querySelector('#tttm-chat-transcribe').addEventListener('click', transcribeChatRecording);

    return chatContainer;
}

// Create recording window
function createRecordingWindow() {
    const recordingContainer = document.createElement('div');
    recordingContainer.id = 'tttm-recording-window';
    recordingContainer.innerHTML = `
        <div class="tttm-recording-header">
            <div class="tttm-recording-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"/>
                </svg>
                Voice Recording Test
            </div>
            <button class="tttm-recording-close" id="tttm-recording-close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
            </button>
        </div>
        <div class="tttm-recording-content">
            <div class="tttm-selected-text">
                <div class="tttm-selected-label">Selected text:</div>
                <div class="tttm-selected-content" id="tttm-recording-selected-content"></div>
            </div>
            <div class="tttm-recording-status" id="tttm-recording-status">
                Click "Start Recording" to begin voice recording. Make sure microphone is set up first.
            </div>
            <div class="tttm-recording-controls">
                <button class="tttm-recording-btn tttm-start-btn" id="tttm-start-recording">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"/>
                    </svg>
                    Start Recording
                </button>
                <button class="tttm-recording-btn tttm-stop-btn" id="tttm-stop-recording" style="display: none;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6,19h4V5H6V19M14,5V19H18V5H14Z"/>
                    </svg>
                    Stop Recording
                </button>
            </div>
            <div class="tttm-playback-controls" id="tttm-playback-controls" style="display: none;">
                <button class="tttm-playback-btn tttm-play-btn" id="tttm-play-recording">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
                    </svg>
                    <span class="play-text">Play Recording</span>
                    <div class="sound-bar" id="tttm-sound-bar">
                        <div class="bar"></div>
                        <div class="bar"></div>
                        <div class="bar"></div>
                        <div class="bar"></div>
                        <div class="bar"></div>
                    </div>
                </button>
                <button class="tttm-playback-btn tttm-record-again-btn" id="tttm-record-again">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"/>
                    </svg>
                    Record Again
                </button>
            </div>
        </div>
    `;

    // Add recording window styles
    const recordingStyle = document.createElement('style');
    recordingStyle.textContent = `
        #tttm-recording-window {
            position: fixed;
            top: 50%;
            right: 20px;
            transform: translateY(-50%);
            width: 350px;
            height: 400px;
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

        #tttm-recording-window.show {
            opacity: 1;
            transform: translateY(-50%) scale(1);
        }

        .tttm-recording-header {
            background: #2c3e50;
            color: white;
            padding: 12px 16px;
            border-radius: 12px 12px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .tttm-recording-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
            font-size: 14px;
        }

        .tttm-recording-close {
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            opacity: 0.8;
            transition: opacity 0.2s ease;
        }

        .tttm-recording-close:hover {
            opacity: 1;
            background: rgba(255, 255, 255, 0.1);
        }

        .tttm-recording-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            padding: 16px;
            gap: 16px;
        }

        .tttm-recording-status {
            text-align: center;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            font-size: 14px;
            color: #666;
            border: 2px dashed #dee2e6;
        }

        .tttm-recording-status.recording {
            background: #fff3cd;
            border-color: #ffc107;
            color: #856404;
            animation: pulse 1.5s infinite;
        }

        .tttm-recording-controls {
            display: flex;
            gap: 12px;
            justify-content: center;
        }

        .tttm-recording-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s ease;
        }

        .tttm-start-btn {
            background: #28a745;
            color: white;
        }

        .tttm-start-btn:hover {
            background: #1e7e34;
        }

        .tttm-stop-btn {
            background: #dc3545;
            color: white;
        }

        .tttm-stop-btn:hover {
            background: #c82333;
        }

        .tttm-playback-controls {
            display: flex;
            gap: 12px;
            justify-content: center;
            margin-top: 12px;
        }

        .tttm-playback-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s ease;
        }

        .tttm-play-btn {
            background: #007bff;
            color: white;
        }

        .tttm-play-btn:hover {
            background: #0056b3;
        }

        .tttm-record-again-btn {
            background: #28a745;
            color: white;
        }

        .tttm-record-again-btn:hover {
            background: #1e7e34;
        }

        .tttm-transcribe-btn {
            background: #6f42c1;
            color: white;
        }

        .tttm-transcribe-btn:hover {
            background: #5a32a3;
        }

        .tttm-transcribe-btn:disabled {
            background: #bdc3c7;
            cursor: not-allowed;
        }

        .tttm-play-btn {
            position: relative;
            overflow: hidden;
        }

        .play-text {
            margin-right: 8px;
        }

        .sound-bar {
            display: flex;
            align-items: flex-end;
            gap: 2px;
            height: 20px;
            margin-left: 8px;
        }

        .sound-bar .bar {
            width: 3px;
            background: white;
            border-radius: 1px;
            transition: height 0.1s ease;
        }

        .sound-bar .bar:nth-child(1) { height: 4px; }
        .sound-bar .bar:nth-child(2) { height: 8px; }
        .sound-bar .bar:nth-child(3) { height: 12px; }
        .sound-bar .bar:nth-child(4) { height: 8px; }
        .sound-bar .bar:nth-child(5) { height: 4px; }

        .sound-bar.playing .bar {
            animation: soundWave 0.5s ease-in-out infinite;
        }

        .sound-bar.playing .bar:nth-child(1) { animation-delay: 0s; }
        .sound-bar.playing .bar:nth-child(2) { animation-delay: 0.1s; }
        .sound-bar.playing .bar:nth-child(3) { animation-delay: 0.2s; }
        .sound-bar.playing .bar:nth-child(4) { animation-delay: 0.3s; }
        .sound-bar.playing .bar:nth-child(5) { animation-delay: 0.4s; }

        @keyframes soundWave {
            0%, 100% { height: 4px; }
            50% { height: 16px; }
        }

        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }
    `;

    document.head.appendChild(recordingStyle);
    document.body.appendChild(recordingContainer);

    // Add event listeners
    recordingContainer.querySelector('#tttm-recording-close').addEventListener('click', closeRecordingWindow);
    recordingContainer.querySelector('#tttm-start-recording').addEventListener('click', startRecording);
    recordingContainer.querySelector('#tttm-stop-recording').addEventListener('click', stopRecording);
    recordingContainer.querySelector('#tttm-play-recording').addEventListener('click', playRecording);
    recordingContainer.querySelector('#tttm-record-again').addEventListener('click', recordAgain);

    return recordingContainer;
}

// Show recording window
function showRecordingWindow(text) {
    if (!recordingWindow) {
        recordingWindow = createRecordingWindow();
    }

    // Set the selected text
    const selectedContent = recordingWindow.querySelector('#tttm-recording-selected-content');
    if (text && text.trim()) {
        selectedContent.textContent = text;
        selectedContent.parentElement.style.display = 'block';
    } else {
        selectedContent.parentElement.style.display = 'none';
    }

    // Show the window
    setTimeout(() => {
        recordingWindow.classList.add('show');
    }, 10);
}

// Close recording window
function closeRecordingWindow() {
    if (recordingWindow) {
        recordingWindow.classList.remove('show');
        setTimeout(() => {
            recordingWindow.remove();
            recordingWindow = null;
        }, 300);
    }
}

// Start recording
async function startRecording() {
    if (isRecording) return;
    
    try {
        // Update status to show we're requesting permission
        const status = recordingWindow.querySelector('#tttm-recording-status');
        status.textContent = 'Requesting microphone access...';
        status.classList.remove('recording');
        
        // Request microphone access directly
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: true,
            video: false 
        });
        
        window.mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
        });
        window.audioChunks = [];
        
        window.mediaRecorder.ondataavailable = (event) => {
            window.audioChunks.push(event.data);
        };
        
        window.mediaRecorder.onstop = () => {
            const audioBlob = new Blob(window.audioChunks, { type: 'audio/webm' });
            
            // Store the recorded audio for playback
            recordedAudioBlob = audioBlob;
            
            // Create audio player for playback
            audioPlayer = new Audio(URL.createObjectURL(audioBlob));
            
            // Send audio to backend for processing
            sendAudioToBackend(audioBlob);
            
            // Clean up
            window.audioChunks = [];
            window.mediaRecorder = null;
            
            // Stop all tracks in the stream
            stream.getTracks().forEach(track => track.stop());
            
            console.log('Recording completed and sent to backend');
        };
        
        window.mediaRecorder.start();
        console.log('Recording started');
        
        isRecording = true;
        
        // Update UI
        const startBtn = recordingWindow.querySelector('#tttm-start-recording');
        const stopBtn = recordingWindow.querySelector('#tttm-stop-recording');
        
        startBtn.style.display = 'none';
        stopBtn.style.display = 'flex';
        status.textContent = 'Recording... Speak now!';
        status.classList.add('recording');
        
    } catch (error) {
        console.error('Error starting recording:', error);
        
        const status = recordingWindow.querySelector('#tttm-recording-status');
        if (error.name === 'NotAllowedError') {
            status.textContent = 'Microphone access denied. Please use "Set Up Mic" in the extension popup.';
        } else if (error.name === 'NotFoundError') {
            status.textContent = 'No microphone found. Please connect a microphone and try again.';
        } else {
            status.textContent = 'Error accessing microphone: ' + error.message;
        }
        status.classList.remove('recording');
    }
}

// Stop recording
function stopRecording() {
    if (!isRecording || !window.mediaRecorder) return;
    
    try {
        if (window.mediaRecorder.state !== 'inactive') {
            window.mediaRecorder.stop();
            console.log('Recording stopped');
            
            isRecording = false;
            
            // Update UI
            const startBtn = recordingWindow.querySelector('#tttm-start-recording');
            const stopBtn = recordingWindow.querySelector('#tttm-stop-recording');
            const status = recordingWindow.querySelector('#tttm-recording-status');
            const playbackControls = recordingWindow.querySelector('#tttm-playback-controls');
            
            startBtn.style.display = 'none';
            stopBtn.style.display = 'none';
            playbackControls.style.display = 'flex';
            status.textContent = 'Recording completed! You can now play it back or record again.';
            status.classList.remove('recording');
        }
    } catch (error) {
        console.error('Error stopping recording:', error);
        alert('Error stopping recording: ' + error.message);
    }
}

// Play recorded audio
function playRecording() {
    if (audioPlayer && recordedAudioBlob) {
        const soundBar = recordingWindow.querySelector('#tttm-sound-bar');
        const playText = recordingWindow.querySelector('.play-text');
        
        // Start sound bar animation
        soundBar.classList.add('playing');
        playText.textContent = 'Playing...';
        
        // Play the audio
        audioPlayer.play();
        console.log('Playing recorded audio');
        
        // Listen for when audio ends
        audioPlayer.onended = () => {
            soundBar.classList.remove('playing');
            playText.textContent = 'Play Recording';
        };
        
        // Listen for when audio is paused
        audioPlayer.onpause = () => {
            soundBar.classList.remove('playing');
            playText.textContent = 'Play Recording';
        };
    }
}

// Record again
function recordAgain() {
    // Reset UI
    const startBtn = recordingWindow.querySelector('#tttm-start-recording');
    const stopBtn = recordingWindow.querySelector('#tttm-stop-recording');
    const status = recordingWindow.querySelector('#tttm-recording-status');
    const playbackControls = recordingWindow.querySelector('#tttm-playback-controls');
    const soundBar = recordingWindow.querySelector('#tttm-sound-bar');
    const playText = recordingWindow.querySelector('.play-text');
    
    startBtn.style.display = 'flex';
    stopBtn.style.display = 'none';
    playbackControls.style.display = 'none';
    status.textContent = 'Click "Start Recording" to begin voice recording. Make sure microphone is set up first.';
    status.classList.remove('recording');
    
    // Reset sound bar
    soundBar.classList.remove('playing');
    playText.textContent = 'Play Recording';
    
    // Clear previous recording
    recordedAudioBlob = null;
    if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer = null;
    }
}

// Chat recording functions
async function startChatRecording() {
    if (isRecording) return;
    
    try {
        // Update status to show we're requesting permission
        const status = chatWindow.querySelector('#tttm-chat-recording-status');
        status.textContent = 'Requesting microphone access...';
        status.classList.remove('recording');
        
        // Request microphone access directly
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: true,
            video: false 
        });
        
        window.mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
        });
        window.audioChunks = [];
        
        window.mediaRecorder.ondataavailable = (event) => {
            window.audioChunks.push(event.data);
        };
        
        window.mediaRecorder.onstop = () => {
            const audioBlob = new Blob(window.audioChunks, { type: 'audio/webm' });
            
            // Store the recorded audio for playback
            recordedAudioBlob = audioBlob;
            
            // Create audio player for playback
            audioPlayer = new Audio(URL.createObjectURL(audioBlob));
            
            // Send audio to backend for processing
            sendAudioToBackend(audioBlob);
            
            // Clean up
            window.audioChunks = [];
            window.mediaRecorder = null;
            
            // Stop all tracks in the stream
            stream.getTracks().forEach(track => track.stop());
            
            console.log('Chat recording completed and sent to backend');
        };
        
        window.mediaRecorder.start();
        console.log('Chat recording started');
        
        isRecording = true;
        
        // Update UI
        const startBtn = chatWindow.querySelector('#tttm-chat-start-recording');
        const stopBtn = chatWindow.querySelector('#tttm-chat-stop-recording');
        
        startBtn.style.display = 'none';
        stopBtn.style.display = 'flex';
        status.textContent = '🔴 Recording... Speak your question now!';
        status.classList.add('recording');
        
    } catch (error) {
        console.error('Error starting chat recording:', error);
        
        const status = chatWindow.querySelector('#tttm-chat-recording-status');
        if (error.name === 'NotAllowedError') {
            status.textContent = 'Microphone access denied. Please use "Set Up Mic" in the extension popup.';
        } else if (error.name === 'NotFoundError') {
            status.textContent = 'No microphone found. Please connect a microphone and try again.';
        } else {
            status.textContent = 'Error accessing microphone: ' + error.message;
        }
        status.classList.remove('recording');
    }
}

function stopChatRecording() {
    if (!isRecording || !window.mediaRecorder) return;
    
    try {
        if (window.mediaRecorder.state !== 'inactive') {
            window.mediaRecorder.stop();
            console.log('Chat recording stopped');
            
            isRecording = false;
            
            // Update UI
            const startBtn = chatWindow.querySelector('#tttm-chat-start-recording');
            const stopBtn = chatWindow.querySelector('#tttm-chat-stop-recording');
            const status = chatWindow.querySelector('#tttm-chat-recording-status');
            const playbackControls = chatWindow.querySelector('#tttm-chat-playback-controls');
            
            startBtn.style.display = 'none';
            stopBtn.style.display = 'none';
            playbackControls.style.display = 'flex';
            status.textContent = 'Recording completed! You can now play it back or record again.';
            status.classList.remove('recording');
        }
    } catch (error) {
        console.error('Error stopping chat recording:', error);
        alert('Error stopping recording: ' + error.message);
    }
}

function playChatRecording() {
    if (audioPlayer && recordedAudioBlob) {
        const soundBar = chatWindow.querySelector('#tttm-chat-sound-bar');
        const playText = chatWindow.querySelector('#tttm-chat-play-recording .play-text');
        
        // Start sound bar animation
        soundBar.classList.add('playing');
        playText.textContent = 'Playing...';
        
        // Play the audio
        audioPlayer.play();
        console.log('Playing chat recording');
        
        // Listen for when audio ends
        audioPlayer.onended = () => {
            soundBar.classList.remove('playing');
            playText.textContent = 'Play Recording';
        };
        
        // Listen for when audio is paused
        audioPlayer.onpause = () => {
            soundBar.classList.remove('playing');
            playText.textContent = 'Play Recording';
        };
    }
}

function recordChatAgain() {
    // Reset UI
    const startBtn = chatWindow.querySelector('#tttm-chat-start-recording');
    const stopBtn = chatWindow.querySelector('#tttm-chat-stop-recording');
    const status = chatWindow.querySelector('#tttm-chat-recording-status');
    const playbackControls = chatWindow.querySelector('#tttm-chat-playback-controls');
    const soundBar = chatWindow.querySelector('#tttm-chat-sound-bar');
    const playText = chatWindow.querySelector('#tttm-chat-play-recording .play-text');
    const inputContainer = chatWindow.querySelector('.tttm-chat-input-container');
    const recordingSection = chatWindow.querySelector('.tttm-chat-recording-section');
    
    startBtn.style.display = 'flex';
    stopBtn.style.display = 'none';
    playbackControls.style.display = 'none';
    status.textContent = 'Click "Start Recording" to record your question';
    status.classList.remove('recording');
    
    // Reset sound bar
    soundBar.classList.remove('playing');
    playText.textContent = 'Play Recording';
    
    // Show input container and hide recording section
    inputContainer.style.display = 'flex';
    recordingSection.style.display = 'none';
    
    // Clear previous recording
    recordedAudioBlob = null;
    if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer = null;
    }
}

async function transcribeChatRecording() {
    if (!recordedAudioBlob) {
        console.error('No audio to transcribe');
        return;
    }

    const transcribeBtn = chatWindow.querySelector('#tttm-chat-transcribe');
    const status = chatWindow.querySelector('#tttm-chat-recording-status');
    
    try {
        // Disable button and show status
        transcribeBtn.disabled = true;
        transcribeBtn.textContent = 'Transcribing...';
        status.textContent = 'Transcribing audio to text...';
        
        // Create FormData with the audio blob
        const formData = new FormData();
        formData.append('audio', recordedAudioBlob, 'recording.webm');
        
        // Send to transcription API
        const response = await fetch('http://localhost:8080/api/transcribe', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.transcription) {
                // Show input container and hide recording section
                const inputContainer = chatWindow.querySelector('.tttm-chat-input-container');
                const recordingSection = chatWindow.querySelector('.tttm-chat-recording-section');
                const chatInput = chatWindow.querySelector('#tttm-chat-input');
                
                inputContainer.style.display = 'flex';
                recordingSection.style.display = 'none';
                
                // Set the transcribed text in the input
                chatInput.value = data.transcription;
                chatInput.focus();
                
                status.textContent = 'Transcription completed! You can now edit and send.';
            } else {
                throw new Error('No transcription received');
            }
        } else {
            throw new Error('Transcription failed');
        }
        
    } catch (error) {
        console.error('Error transcribing audio:', error);
        status.textContent = 'Transcription failed: ' + error.message;
        
        // Re-enable button
        transcribeBtn.disabled = false;
        transcribeBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
            </svg>
            Transcribe
        `;
    }
}

// Send audio to backend
async function sendAudioToBackend(audioBlob) {
    try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        
        const response = await fetch('http://localhost:5000/process_audio', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Audio processed:', data);
            
            // Update status with transcription
            const status = recordingWindow.querySelector('#tttm-recording-status');
            if (data.transcription) {
                status.textContent = `Transcription: ${data.transcription}`;
            } else {
                status.textContent = 'Audio processed successfully';
            }
        } else {
            throw new Error('Failed to process audio');
        }
    } catch (error) {
        console.error('Error sending audio:', error);
        const status = recordingWindow.querySelector('#tttm-recording-status');
        status.textContent = 'Error processing audio: ' + error.message;
    }
}

// Handle chat microphone button click
function handleChatMicClick() {
    console.log('TTTM: Chat mic button clicked');
    
    // Show the recording section
    const recordingSection = chatWindow.querySelector('.tttm-chat-recording-section');
    recordingSection.style.display = 'block';
    
    // Hide the input container
    const inputContainer = chatWindow.querySelector('.tttm-chat-input-container');
    inputContainer.style.display = 'none';
    
    // Focus on the recording section
    setTimeout(() => {
        const startBtn = chatWindow.querySelector('#tttm-chat-start-recording');
        if (startBtn) {
            startBtn.focus();
        }
    }, 100);
}

// Show chat window
function showChatWindow(text) {
    if (!chatWindow) {
        chatWindow = createChatWindow();
    }

    // Set the selected text
    const selectedContent = chatWindow.querySelector('#tttm-selected-content');
    if (text && text.trim()) {
        selectedContent.textContent = text;
        selectedContent.parentElement.style.display = 'block';
    } else {
        selectedContent.parentElement.style.display = 'none';
    }

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
                selectedText: selectedText || '',
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



// Event listeners
document.addEventListener('mouseup', handleSelection);
document.addEventListener('keyup', handleSelection);

// Hide widget when clicking elsewhere
document.addEventListener('mousedown', (e) => {
    if (selectionWidget && !selectionWidget.contains(e.target) &&
        (!chatWindow || !chatWindow.contains(e.target)) &&
        (!recordingWindow || !recordingWindow.contains(e.target))) {
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