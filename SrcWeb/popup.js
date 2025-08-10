// Button to explicitly request microphone permission
const askProf = document.getElementById('askProf');
askProf.addEventListener('click', async () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs.length > 0) {
    const currentUrl = tabs[0].url;
    sendVariableToPython(currentUrl);
  }
  });
  // chrome.tabs.create({ url: "http://localhost:8080/" });
});


document.getElementById('setupMic').addEventListener('click', async () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("popup.html")});
});

document.getElementById('checkMicBtn').addEventListener('click', () => {
  navigator.permissions.query({ name: 'microphone' })
    .then(result => {
      const statusElem = document.getElementById('status');

      if (result.state === 'granted') {
        console.log('Microphone permission already granted.');
      } 
      else if (result.state === 'prompt') {
        statusElem.textContent = '⚠ Asking for microphone access...';
        requestMic();
      } 
      else if (result.state === 'denied') {
        console.log('Microphone access denied. Check Chrome settings.');
      }
    });
});

document.getElementById('micBtn').addEventListener('click', () => {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      showCustomPopup('Microphone access granted');
    })
    .catch(err => {
      showCustomPopup('Permission denied or error:', err);
    });
});


// Custom modal for lower popup
function showCustomPopup(message) {
  let modal = document.createElement('div');
  modal.style.position = 'fixed';
  modal.style.left = '50%';
  modal.style.bottom = '40px';
  modal.style.transform = 'translateX(-50%)';
  modal.style.background = '#fff';
  modal.style.border = '1px solid #888';
  modal.style.borderRadius = '8px';
  modal.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
  modal.style.padding = '16px 24px';
  modal.style.zIndex = 9999;
  modal.style.fontSize = '16px';
  modal.style.whiteSpace = 'pre-line';
  modal.innerHTML = message;
  document.body.appendChild(modal);
  setTimeout(() => {
    modal.remove();
  }, 2000);
}

function sendVariableToPython(url) {
    fetch('http://localhost:5000/process_data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ theURL: url }) // Send as JSON
    })
    .then(response => response.json())
    .then(data => {
        console.log('Response from Python:', data.result);
    })
    .catch(error => {
        console.error('Error:', error);
    });
}