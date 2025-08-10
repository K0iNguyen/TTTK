// Popup functionality for TTTM Extension

// Get DOM elements
const setupMicBtn = document.getElementById('setupMic');
const checkMicStatusBtn = document.getElementById('checkMicStatus');
const statusDiv = document.getElementById('status');

// Set Up Mic functionality - requests microphone permission
setupMicBtn.addEventListener('click', async () => {
  try {
    showStatus('Requesting microphone access...', 'info');
    
    // For Chrome extensions, we need to request permission in the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab) {
      // Inject a script to request microphone permission in the active tab
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
          try {
            // Request microphone permission
            const stream = await navigator.mediaDevices.getUserMedia({ 
              audio: true,
              video: false 
            });
            
            // If successful, stop the stream immediately
            stream.getTracks().forEach(track => track.stop());
            
            return { success: true, message: 'Microphone access granted!' };
          } catch (error) {
            return { success: false, error: error.message, name: error.name };
          }
        }
      });
      
      // Check the result after a short delay
      setTimeout(async () => {
        const permission = await navigator.permissions.query({ name: 'microphone' });
        if (permission.state === 'granted') {
          showStatus('Microphone access granted! You can now use voice recording.', 'success');
        } else {
          showStatus('Microphone access denied. Please allow microphone access in Chrome settings.', 'error');
        }
      }, 1000);
      
    } else {
      showStatus('No active tab found', 'error');
    }
    
  } catch (error) {
    console.error('Error requesting microphone access:', error);
    
    if (error.name === 'NotAllowedError') {
      showStatus('Microphone access denied. Please allow microphone access in Chrome settings.', 'error');
    } else if (error.name === 'NotFoundError') {
      showStatus('No microphone found. Please connect a microphone and try again.', 'error');
    } else {
      showStatus('Error accessing microphone: ' + error.message, 'error');
    }
  }
});

// Check Mic Status functionality - opens recording window for testing
checkMicStatusBtn.addEventListener('click', async () => {
  try {
    showStatus('Opening recording window to test microphone...', 'info');
    
    // Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab) {
      // Send message to content script to open recording window
      chrome.tabs.sendMessage(tab.id, { 
        action: 'openRecordingWindow',
        source: 'popup'
      });
      
      showStatus('Recording window opened. Test your microphone!', 'success');
    } else {
      showStatus('No active tab found', 'error');
    }
    
  } catch (error) {
    console.error('Error opening recording window:', error);
    showStatus('Error opening recording window: ' + error.message, 'error');
  }
});

// Helper function to show status messages
function showStatus(message, type = 'info') {
  statusDiv.textContent = message;
  statusDiv.className = `status-message ${type}`;
  
  // Clear status after 5 seconds for success/info messages
  if (type === 'success' || type === 'info') {
    setTimeout(() => {
      statusDiv.textContent = '';
      statusDiv.className = 'status-message';
    }, 5000);
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  // Popup is ready - no automatic actions
});