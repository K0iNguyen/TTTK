// try {
//     const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
// } catch (err) {
// };

// Button to explicitly request microphone permission
const askProf = document.getElementById('askProf');
askProf.addEventListener('click', async () => {
    chrome.tabs.create({ url: "http://localhost:8080/" });
});


// popup.js
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