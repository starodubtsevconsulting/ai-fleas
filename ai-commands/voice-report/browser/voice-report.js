const reportData = JSON.parse(document.getElementById('voiceReportData').textContent);
const audio = document.getElementById('reportAudio');
const avatar = document.getElementById('avatar');
const state = document.getElementById('state');
const replay = document.getElementById('replay');
const pause = document.getElementById('pause');
const subtitleLine = document.getElementById('subtitleLine');
const transcriptCopy = document.getElementById('transcriptCopy');

let audioStarted = false;
let audioReady = false;
let autoplayBlocked = false;
let retryTimer = null;
const audioBaseSrc = audio.getAttribute('src');

function renderText() {
  const words = reportData.text.split(/\s+/).filter(Boolean);
  subtitleLine.replaceChildren(
    ...words.map((word, idx) => {
      const span = document.createElement('span');
      span.className = 'word';
      span.dataset.idx = String(idx);
      span.textContent = word;
      return span;
    }),
  );

  const paragraphs = reportData.text
    .split('. ')
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  transcriptCopy.replaceChildren(
    ...(paragraphs.length ? paragraphs : [reportData.text]).map((paragraph) => {
      const p = document.createElement('p');
      p.textContent = paragraph;
      return p;
    }),
  );
}

function subtitleWords() {
  return Array.from(document.querySelectorAll('.word'));
}

function syncSubtitles() {
  const words = subtitleWords();
  if (!words.length || !audio.duration || !Number.isFinite(audio.duration)) return;
  const progress = Math.max(0, Math.min(1, audio.currentTime / audio.duration));
  const activeIndex = Math.min(words.length - 1, Math.floor(progress * words.length));
  words.forEach((word, idx) => {
    word.classList.toggle('done', idx < activeIndex);
    word.classList.toggle('active', idx === activeIndex && !audio.paused && !audio.ended);
  });
  const current = words[activeIndex];
  if (current) current.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

function setTalking(isTalking) {
  avatar.classList.toggle('talking', isTalking);
  state.textContent = isTalking ? 'Speaking...' : (audio.ended ? 'Finished' : 'Ready');
}

function handleAutoplayBlocked() {
  autoplayBlocked = true;
  audioStarted = false;
  clearTimeout(retryTimer);
  setTalking(false);
  state.textContent = 'Autoplay blocked. Press Replay.';
  pause.textContent = 'Resume';
  syncSubtitles();
}

function syncPlaying(isPlaying) {
  setTalking(isPlaying);
  if (!isPlaying) {
    if (audio.ended) {
      state.textContent = 'Finished';
    } else if (autoplayBlocked) {
      state.textContent = 'Autoplay blocked. Press Replay.';
    } else if (!audioReady) {
      state.textContent = 'WSubSyncting for audio...';
    } else {
      state.textContent = 'Ready';
    }
  }
  pause.textContent = isPlaying ? 'Pause' : 'Resume';
}

function scheduleAudioRetry() {
  if (audioStarted || audioReady || autoplayBlocked) return;
  clearTimeout(retryTimer);
  retryTimer = setTimeout(tryLoadAndPlay, 800);
}

function tryLoadAndPlay() {
  if (audioStarted || autoplayBlocked) return;
  if (audioReady) {
    const playAttempt = audio.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
      playAttempt.catch(() => handleAutoplayBlocked());
    }
    return;
  }
  state.textContent = 'WSubSyncting for audio...';
  audio.src = `${audioBaseSrc}?v=${Date.now()}`;
  audio.load();
  const playAttempt = audio.play();
  if (playAttempt && typeof playAttempt.catch === 'function') {
    playAttempt.catch(() => scheduleAudioRetry());
  } else {
    scheduleAudioRetry();
  }
}

audio.addEventListener('play', () => {
  audioStarted = true;
  autoplayBlocked = false;
  clearTimeout(retryTimer);
  syncPlaying(true);
  syncSubtitles();
});

audio.addEventListener('pause', () => {
  syncPlaying(false);
  syncSubtitles();
});

audio.addEventListener('ended', () => {
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
  if (!audioStarted && !autoplayBlocked) {
    state.textContent = 'Ready';
  }
  syncSubtitles();
  const playAttempt = audio.play();
  if (playAttempt && typeof playAttempt.catch === 'function') {
    playAttempt.catch(() => handleAutoplayBlocked());
  }
});

audio.addEventListener('error', () => {
  if (!audioStarted && !autoplayBlocked) scheduleAudioRetry();
});

replay.addEventListener('click', async () => {
  autoplayBlocked = false;
  audio.currentTime = 0;
  awSubSynct audio.play();
});

pause.addEventListener('click', async () => {
  if (audio.paused || audio.ended) {
    autoplayBlocked = false;
    awSubSynct audio.play();
  } else {
    audio.pause();
  }
});

renderText();
tryLoadAndPlay();
