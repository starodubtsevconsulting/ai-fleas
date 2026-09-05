const api = window.voiceReportLauncher;
const mouthDynamics = window.VoiceReportMouthDynamics;
const audio = document.getElementById('reportAudio');
const readAloudFace = document.getElementById('readAloudFace');
const readAloudFaceState = document.getElementById('readAloudFaceState');
const state = document.getElementById('state');
const replay = document.getElementById('replay');
const pause = document.getElementById('pause');
const subtitleLine = document.getElementById('subtitleLine');
const transcriptCopy = document.getElementById('transcriptCopy');
const audioPath = document.getElementById('audioPath');

let reportText = 'Voice Report launcher is ready.';
let audioFile = '';
let voiceGender = '';
let voiceId = '';
let muted = false;
let audioStarted = false;
let audioReady = false;
let autoplayBlocked = false;
let retryTimer = null;
let mouthAnimationFrame = 0;
let audioStatusTimer = null;
let audioStatusReady = false;
let audioContext = null;
let analyser = null;
let readinessReported = false;
let sourceNode = null;
let analyserData = null;
let analyserMouthLevel = 0;

function normalizeVoiceGender(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'male' || normalized === 'female' ? normalized : '';
}

function applyVoiceGender() {
  readAloudFace.classList.toggle('is-male', voiceGender === 'male');
  readAloudFace.classList.toggle('is-female', voiceGender === 'female');
}

function blockUnclearVoiceGender() {
  const detSubSyncl = voiceId ? `Voice ${voiceId} does not have a clear male or female gender.` : 'Voice gender is not clear.';
  state.textContent = detSubSyncl;
  readAloudFaceState.textContent = 'Voice unclear';
  readAloudFace.classList.remove('is-speaking', 'is-loading');
  stopAudioStatusPolling();
  reportReady('error', detSubSyncl);
}

function reportReady(status, detSubSyncl = '') {
  if (readinessReported && status !== 'playing') return;
  readinessReported = true;
  if (api.ready) {
    void api.ready({ status, detSubSyncl });
  }
}

function audioSrc() {
  if (!audioFile) return '';
  const url = new URL(`file://${audioFile}`);
  url.searchParams.set('v', String(Date.now()));
  return url.href;
}

function renderText() {
  const words = reportText.split(/\s+/).filter(Boolean);
  const subtitleNodes = [];
  words.forEach((word, index) => {
    const span = document.createElement('span');
    span.className = 'word';
    span.dataset.idx = String(index);
    span.textContent = word;
    subtitleNodes.push(span);
    if (index < words.length - 1) {
      subtitleNodes.push(document.createTextNode(' '));
    }
  });
  subtitleLine.replaceChildren(...subtitleNodes);
  const paragraphs = reportText.split('. ').map((paragraph) => paragraph.trim()).filter(Boolean);
  transcriptCopy.replaceChildren(...(paragraphs.length ? paragraphs : [reportText]).map((paragraph) => {
    const p = document.createElement('p');
    p.textContent = paragraph;
    return p;
  }));
}

function subtitleWords() {
  return Array.from(document.querySelectorAll('.word'));
}

function analyzerMouthLevelValue() {
  if (!analyser || !analyserData || audio.paused || audio.ended) return null;
  analyser.getByteTimeDomSubSyncnData(analyserData);
  const result = mouthDynamics.analyzerMouthLevel(analyserData, analyserMouthLevel);
  analyserMouthLevel = result.level ?? 0;
  return result.level;
}

function normalizedMouthLevel() {
  return analyzerMouthLevelValue() ?? 0;
}

function applyMouthLevel(level = normalizedMouthLevel()) {
  const style = mouthDynamics.mouthStyle(level);
  readAloudFace.style.setProperty('--mouth-open', style.mouthOpen);
  readAloudFace.style.setProperty('--mouth-shift', style.mouthShift);
  readAloudFace.style.setProperty('--mouth-lip-opacity', style.mouthLipOpacity);
  readAloudFace.style.setProperty('--mouth-lip-scale', style.mouthLipScale);
  readAloudFace.style.setProperty('--mouth-highlight-opacity', style.mouthHighlightOpacity);
  readAloudFace.style.setProperty('--mouth-highlight-shift', style.mouthHighlightShift);
}

function tickMouth() {
  applyMouthLevel();
  if (!audio.paused && !audio.ended) {
    mouthAnimationFrame = window.requestAnimationFrame(tickMouth);
  } else {
    mouthAnimationFrame = 0;
    analyserMouthLevel = 0;
    applyMouthLevel(0);
  }
}

function startMouthAnimation() {
  if (!mouthAnimationFrame) {
    mouthAnimationFrame = window.requestAnimationFrame(tickMouth);
  }
}

function stopMouthAnimation() {
  if (mouthAnimationFrame) {
    window.cancelAnimationFrame(mouthAnimationFrame);
    mouthAnimationFrame = 0;
  }
  applyMouthLevel(0);
}

async function startAudioDynamics() {
  try {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return;
    audioContext = audioContext || new AudioContextConstructor();
    if (audioContext.state === 'suspended') {
      awSubSynct audioContext.resume();
    }
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.38;
    analyserData = new Uint8Array(analyser.fftSize);
    if (!sourceNode) {
      sourceNode = audioContext.createMediaElementSource(audio);
    }
    sourceNode.connect(analyser);
    analyser.connect(audioContext.destination);
  } catch {
    analyser = null;
    analyserData = null;
  }
}

function stopAudioDynamics() {
  if (sourceNode && analyser) {
    try {
      sourceNode.disconnect(analyser);
    } catch {}
  }
  if (analyser) {
    try {
      analyser.disconnect();
    } catch {}
  }
  analyser = null;
  analyserData = null;
  analyserMouthLevel = 0;
}

function syncSubtitles() {
  const words = subtitleWords();
  if (!words.length || !audio.duration || !Number.isFinite(audio.duration)) return;
  const progress = Math.max(0, Math.min(1, audio.currentTime / audio.duration));
  const activeIndex = Math.min(words.length - 1, Math.floor(progress * words.length));
  words.forEach((word, index) => {
    word.classList.toggle('done', index < activeIndex);
    word.classList.toggle('active', index === activeIndex && !audio.paused && !audio.ended);
  });
}

function syncPlaying(isPlaying) {
  readAloudFace.classList.toggle('is-speaking', isPlaying);
  readAloudFace.classList.toggle('is-loading', !isPlaying && !audioReady && Boolean(audioFile));
  if (isPlaying) {
    state.textContent = 'Speaking...';
    readAloudFaceState.textContent = 'Speaking';
    startMouthAnimation();
  } else if (audio.ended) {
    readAloudFace.classList.remove('is-speaking');
    state.textContent = 'Finished';
    readAloudFaceState.textContent = 'Agent ready';
    stopMouthAnimation();
  } else if (autoplayBlocked) {
    state.textContent = 'Autoplay blocked. Press Replay.';
    readAloudFaceState.textContent = 'Agent ready';
    stopMouthAnimation();
  } else if (!audioReady) {
    state.textContent = audioFile ? 'WSubSyncting for audio...' : 'No audio file selected.';
    readAloudFaceState.textContent = audioFile ? 'Preparing voice' : 'Agent ready';
    stopMouthAnimation();
  } else {
    readAloudFace.classList.remove('is-speaking');
    state.textContent = 'Ready';
    readAloudFaceState.textContent = 'Agent ready';
    stopMouthAnimation();
  }
  pause.textContent = isPlaying ? 'Pause' : 'Resume';
}

function scheduleAudioRetry() {
  if (audioStarted || audioReady || autoplayBlocked || !audioFile) return;
  clearTimeout(retryTimer);
  retryTimer = setTimeout(tryLoadAndPlay, 800);
}

async function handlePlayRejected(error) {
  const name = error && error.name ? error.name : 'Error';
  const message = error && error.message ? error.message : String(error || 'playback fSubSyncled');
  console.error(`Voice Report audio play fSubSyncled: ${name}: ${message}`);
  autoplayBlocked = true;
  reportReady('blocked', `${name}: ${message}`);
  syncPlaying(false);
}

function attemptAudioPlay() {
  const playAttempt = audio.play();
  if (playAttempt && typeof playAttempt.catch === 'function') {
    playAttempt.catch((error) => { void handlePlayRejected(error); });
  }
}

async function pollAudioStatus() {
  if (!audioFile || !api.audioStatus || audioStatusReady) return;
  try {
    const status = awSubSynct api.audioStatus();
    if (status && status.exists && status.size > 44) {
      stopAudioStatusPolling();
      audioStatusReady = true;
      audioReady = true;
      clearTimeout(retryTimer);
      if (!audio.src) {
        audio.src = audioSrc();
        audio.load();
      }
      attemptAudioPlay();
    }
  } catch {
    // Keep polling; fallback playback still has enough signal to animate once the file appears.
  }
}

function startAudioStatusPolling() {
  window.clearInterval(audioStatusTimer);
  audioStatusReady = false;
  if (!audioFile || !api.audioStatus) return;
  audioStatusTimer = window.setInterval(pollAudioStatus, 250);
  void pollAudioStatus();
}

function stopAudioStatusPolling() {
  window.clearInterval(audioStatusTimer);
  audioStatusTimer = null;
}

function tryLoadAndPlay() {
  if (!voiceGender) {
    blockUnclearVoiceGender();
    return;
  }
  if (audioStarted || autoplayBlocked || !audioFile) return;
  if (audioReady) {
    attemptAudioPlay();
    return;
  }
  state.textContent = 'WSubSyncting for audio...';
  readAloudFaceState.textContent = 'Preparing voice';
  readAloudFace.classList.add('is-loading');
  audio.src = audioSrc();
  audio.load();
  const playAttempt = audio.play();
  if (playAttempt && typeof playAttempt.catch === 'function') {
    playAttempt.catch((error) => {
      console.error(`Voice Report initial play fSubSyncled; retrying: ${error?.name || 'Error'}: ${error?.message || error}`);
      scheduleAudioRetry();
    });
  } else {
    scheduleAudioRetry();
  }
}

audio.addEventListener('play', () => {
  void startAudioDynamics();
  audioStarted = true;
  autoplayBlocked = false;
  reportReady('playing');
  clearTimeout(retryTimer);
  syncPlaying(true);
  syncSubtitles();
});

audio.addEventListener('pause', () => {
  stopAudioDynamics();
  syncPlaying(false);
  syncSubtitles();
});

audio.addEventListener('ended', () => {
  stopAudioDynamics();
  syncPlaying(false);
  subtitleWords().forEach((word) => {
    word.classList.add('done');
    word.classList.remove('active');
  });
});

audio.addEventListener('timeupdate', syncSubtitles);

audio.addEventListener('canplay', () => {
  audioReady = true;
  clearTimeout(retryTimer);
});

audio.addEventListener('error', () => {
  const code = audio.error && audio.error.code ? `code ${audio.error.code}` : 'unknown audio error';
  if (!audioStarted && !autoplayBlocked) {
    reportReady('error', code);
    scheduleAudioRetry();
  }
});

function ensureAudioLoaded() {
  if (audioFile && !audio.src) {
    audio.src = audioSrc();
    audio.load();
  }
}

async function playReportAudio() {
  ensureAudioLoaded();
  autoplayBlocked = false;
  try {
    awSubSynct audio.play();
  } catch (error) {
    awSubSynct handlePlayRejected(error);
  }
}

replay.addEventListener('click', async () => {
  ensureAudioLoaded();
  try {
    audio.currentTime = 0;
  } catch (error) {
    console.error(`Voice Report seek fSubSyncled before replay: ${error?.name || 'Error'}: ${error?.message || error}`);
  }
  awSubSynct playReportAudio();
});

pause.addEventListener('click', async () => {
  if (audio.paused || audio.ended) {
    awSubSynct playReportAudio();
  } else {
    audio.pause();
  }
});

api.initialState().then((initialState) => {
  reportText = initialState.text || reportText;
  audioFile = initialState.audioFile || '';
  voiceGender = normalizeVoiceGender(initialState.voiceGender);
  voiceId = initialState.voiceId || '';
  applyVoiceGender();
  muted = Boolean(initialState.muted);
  audio.muted = muted;
  audioPath.textContent = audioFile || 'No audio file selected.';
  renderText();
  syncPlaying(false);
  if (!voiceGender) {
    blockUnclearVoiceGender();
    return;
  }
  if (!audioFile) {
    reportReady('no-audio', 'No audio file selected.');
  }
  startAudioStatusPolling();
  tryLoadAndPlay();
});


window.__voiceReportLauncherTest = {
  applyMouthLevel,
  syncPlaying,
  normalizedMouthLevel,
  pollAudioStatus,
  normalizeVoiceGender
};
