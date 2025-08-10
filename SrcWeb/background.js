// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed.');
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'askProfessor') {
    // Open the professor interface with the selected text
    chrome.tabs.create({
      url: `http://localhost:8080/?text=${encodeURIComponent(msg.text)}`
    });
  } else if (msg.action === 'explainText') {
    // Handle text explanation
    chrome.tabs.create({
      url: `http://localhost:8080/explain?text=${encodeURIComponent(msg.text)}`
    });
  }

  // Legacy support for other message types
  if (msg.type === "define") {
    // call your API / side panel / popup
    // e.g., chrome.runtime.sendMessage({type:'openPanel', payload: msg})
  }
  if (msg.type === "report") { /* … */ }
  if (msg.type === "voice") { /* … */ }

  sendResponse({ success: true });
});
