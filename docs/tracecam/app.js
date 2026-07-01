const els = {
  video: document.getElementById('video'),
  liveCanvas: document.getElementById('liveCanvas'),
  outputCanvas: document.getElementById('outputCanvas'),
  startButton: document.getElementById('startButton'),
  permissionCard: document.getElementById('permissionCard'),
  shutterButton: document.getElementById('shutterButton'),
  retakeButton: document.getElementById('retakeButton'),
  saveButton: document.getElementById('saveButton'),
  cameraButton: document.getElementById('cameraButton'),
  statusText: document.getElementById('statusText'),
  progressBar: document.getElementById('progressBar'),
  scanWindow: document.getElementById('scanWindow'),
  modeSelect: document.getElementById('modeSelect'),
  directionSelect: document.getElementById('directionSelect'),
  slitWidth: document.getElementById('slitWidth'),
  speed: document.getElementById('speed'),
  glitch: document.getElementById('glitch'),
  widthValue: document.getElementById('widthValue'),
  speedValue: document.getElementById('speedValue'),
  glitchValue: document.getElementById('glitchValue'),
  emptyPreview: document.getElementById('emptyPreview')
};
const liveCtx = els.liveCanvas.getContext('2d', { willReadFrequently: true });
const outCtx = els.outputCanvas.getContext('2d');
let stream = null, isScanning = false, raf = null, cursor = 0, lastFrameTime = 0, finalBlobUrl = null, scanHasImage = false;
const output = { vertical: { width: 1800, height: 2400 }, horizontal: { width: 2400, height: 1800 } };
function getMode() { return els.modeSelect.value; }
function getDirection() { return els.directionSelect.value; }
function getSlitWidth() { return Number(els.slitWidth.value); }
function getSpeed() { return Number(els.speed.value); }
function getGlitch() { return Number(els.glitch.value) / 100; }
function updateLabels() {
  els.widthValue.textContent = getSlitWidth();
  els.speedValue.textContent = getSpeed();
  els.glitchValue.textContent = els.glitch.value;
  const horizontal = getMode() === 'horizontal';
  els.scanWindow.classList.toggle('horizontal', horizontal);
  els.statusText.textContent = horizontal ? 'Hold shutter and move up or down slowly.' : 'Hold shutter and move left or right slowly.';
}
async function startCamera() {
  stopCamera();
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
    els.video.srcObject = stream;
    await els.video.play();
    els.permissionCard.classList.add('hidden');
    els.statusText.textContent = 'Ready. Hold the shutter to trace.';
  } catch (err) {
    els.permissionCard.classList.remove('hidden');
    els.statusText.textContent = 'Camera permission is needed.';
    alert('Could not open camera. On iPhone, use Safari/Chrome and allow camera permission.');
    console.error(err);
  }
}
function stopCamera() { if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null; } }
function setupCanvases() {
  const mode = getMode();
  const size = output[mode];
  els.outputCanvas.width = size.width; els.outputCanvas.height = size.height;
  outCtx.fillStyle = '#050505'; outCtx.fillRect(0, 0, size.width, size.height);
  els.liveCanvas.width = els.video.videoWidth || 1280; els.liveCanvas.height = els.video.videoHeight || 720;
  const maxCursor = mode === 'vertical' ? size.width : size.height;
  cursor = getDirection() === 'reverse' ? maxCursor : 0;
  els.progressBar.style.width = '0%'; scanHasImage = false; els.emptyPreview.style.display = 'grid';
}
function startScan(event) {
  event?.preventDefault(); if (!stream || isScanning) return;
  setupCanvases(); isScanning = true; lastFrameTime = 0;
  document.body.classList.add('scanning'); els.shutterButton.classList.add('scanning');
  els.statusText.textContent = 'Scanning, keep moving slowly.'; if (navigator.vibrate) navigator.vibrate(20);
  raf = requestAnimationFrame(scanLoop);
}
function stopScan(event) {
  event?.preventDefault(); if (!isScanning) return;
  isScanning = false; cancelAnimationFrame(raf);
  document.body.classList.remove('scanning'); els.shutterButton.classList.remove('scanning');
  els.statusText.textContent = scanHasImage ? 'Trace complete. Save or retake.' : 'Ready. Hold the shutter to trace.';
  if (navigator.vibrate) navigator.vibrate([18, 40, 18]);
}
function scanLoop(time) { if (!isScanning) return; if (time - lastFrameTime >= 1000 / 60) { captureStrip(); lastFrameTime = time; } raf = requestAnimationFrame(scanLoop); }
function captureStrip() {
  const videoW = els.video.videoWidth, videoH = els.video.videoHeight; if (!videoW || !videoH) return;
  if (els.liveCanvas.width !== videoW || els.liveCanvas.height !== videoH) { els.liveCanvas.width = videoW; els.liveCanvas.height = videoH; }
  liveCtx.drawImage(els.video, 0, 0, videoW, videoH);
  const mode = getMode(), slit = getSlitWidth(), step = Math.max(1, slit * getSpeed()), reverse = getDirection() === 'reverse', glitch = getGlitch();
  if (mode === 'vertical') {
    const sourceX = Math.floor(videoW / 2 - slit / 2), pasteX = reverse ? cursor - step : cursor;
    const jitterY = Math.random() < glitch ? Math.round((Math.random() - .5) * 34) : 0;
    outCtx.save(); outCtx.globalAlpha = Math.random() < glitch ? 0.88 + Math.random() * .24 : 1;
    outCtx.drawImage(els.liveCanvas, sourceX, 0, slit, videoH, pasteX, jitterY, step, els.outputCanvas.height); outCtx.restore();
    cursor += reverse ? -step : step; const max = els.outputCanvas.width; updateProgress(reverse ? (max - cursor) / max : cursor / max);
    if ((!reverse && cursor >= max) || (reverse && cursor <= 0)) stopScan();
  } else {
    const sourceY = Math.floor(videoH / 2 - slit / 2), pasteY = reverse ? cursor - step : cursor;
    const jitterX = Math.random() < glitch ? Math.round((Math.random() - .5) * 34) : 0;
    outCtx.save(); outCtx.globalAlpha = Math.random() < glitch ? 0.88 + Math.random() * .24 : 1;
    outCtx.drawImage(els.liveCanvas, 0, sourceY, videoW, slit, jitterX, pasteY, els.outputCanvas.width, step); outCtx.restore();
    cursor += reverse ? -step : step; const max = els.outputCanvas.height; updateProgress(reverse ? (max - cursor) / max : cursor / max);
    if ((!reverse && cursor >= max) || (reverse && cursor <= 0)) stopScan();
  }
  scanHasImage = true; els.emptyPreview.style.display = 'none';
}
function updateProgress(value) { els.progressBar.style.width = `${Math.max(0, Math.min(1, value)) * 100}%`; }
function retake() { stopScan(); setupCanvases(); els.statusText.textContent = 'Ready. Hold the shutter to trace.'; }
async function saveImage() {
  if (!scanHasImage) { els.statusText.textContent = 'Make a trace first.'; return; }
  els.outputCanvas.toBlob(async blob => {
    if (!blob) return;
    const fileName = `tracecam-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'TraceCam scan' }); return; } catch (err) { console.warn('Share cancelled or failed', err); } }
    if (finalBlobUrl) URL.revokeObjectURL(finalBlobUrl);
    finalBlobUrl = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = finalBlobUrl; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
  }, 'image/png', 1);
}
function bindHoldButton(button, start, stop) { button.addEventListener('pointerdown', start); button.addEventListener('pointerup', stop); button.addEventListener('pointercancel', stop); button.addEventListener('pointerleave', stop); button.addEventListener('touchstart', start, { passive: false }); button.addEventListener('touchend', stop, { passive: false }); }
els.startButton.addEventListener('click', startCamera); els.cameraButton.addEventListener('click', startCamera); els.retakeButton.addEventListener('click', retake); els.saveButton.addEventListener('click', saveImage); bindHoldButton(els.shutterButton, startScan, stopScan);
[els.modeSelect, els.directionSelect, els.slitWidth, els.speed, els.glitch].forEach(el => { el.addEventListener('input', updateLabels); el.addEventListener('change', () => { updateLabels(); if (!isScanning) retake(); }); });
window.addEventListener('beforeunload', stopCamera); updateLabels(); setupCanvases();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
