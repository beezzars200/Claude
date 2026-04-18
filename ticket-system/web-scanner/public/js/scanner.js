let html5QrCode;
let isProcessing = false;

const readerEl = document.getElementById('reader');
const resultEl = document.getElementById('result');
const resultIcon = document.getElementById('result-icon');
const resultName = document.getElementById('result-name');
const resultCompany = document.getElementById('result-company');
const resultMessage = document.getElementById('result-message');
const resultTime = document.getElementById('result-time');
const scanAgainBtn = document.getElementById('scan-again');

function showResult(data) {
  readerEl.closest('#reader-container').classList.add('hidden');
  resultEl.classList.remove('hidden');

  if (data.valid) {
    resultEl.className = 'result result-valid';
    resultIcon.textContent = '✓';
    resultName.textContent = data.name;
    resultCompany.textContent = data.company || '';
    resultMessage.textContent = 'Valid Ticket — Welcome!';
    resultTime.textContent = '';
  } else if (data.alreadyUsed) {
    resultEl.className = 'result result-invalid';
    resultIcon.textContent = '✗';
    resultName.textContent = data.name;
    resultCompany.textContent = data.company || '';
    resultMessage.textContent = 'ALREADY USED';
    if (data.scannedAt) {
      const d = new Date(data.scannedAt);
      resultTime.textContent = `First scanned: ${d.toLocaleString('en-GB')}`;
    }
  } else {
    resultEl.className = 'result result-invalid';
    resultIcon.textContent = '✗';
    resultName.textContent = 'Unknown Ticket';
    resultCompany.textContent = '';
    resultMessage.textContent = data.message || 'Invalid ticket';
    resultTime.textContent = '';
  }
}

async function onScanSuccess(decodedText) {
  if (isProcessing) return;
  isProcessing = true;

  // Extract ticket number — supports both raw UUID and full URL
  let ticketNumber = decodedText;
  if (decodedText.includes('/verify/')) {
    ticketNumber = decodedText.split('/verify/').pop();
  }

  try {
    const res = await fetch(`/api/scan/${encodeURIComponent(ticketNumber)}`, { method: 'POST' });
    const data = await res.json();
    html5QrCode.pause();
    showResult(data);
  } catch (err) {
    alert('Network error. Please check your connection.');
    isProcessing = false;
  }
}

scanAgainBtn.addEventListener('click', () => {
  resultEl.classList.add('hidden');
  readerEl.closest('#reader-container').classList.remove('hidden');
  isProcessing = false;
  html5QrCode.resume();
});

html5QrCode = new Html5Qrcode('reader');
html5QrCode.start(
  { facingMode: 'environment' },
  { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
  onScanSuccess
).catch(err => {
  document.getElementById('reader-container').innerHTML =
    '<p class="scanner-error">Camera access denied. Please allow camera permissions and reload.</p>';
});
