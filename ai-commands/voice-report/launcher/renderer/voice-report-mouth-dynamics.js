(function attachVoiceReportMouthDynamics(root) {
  function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, value || 0));
  }

  function syntheticMouthLevel({ visualSpeaking, audioPaused, audioEnded, currentTime = 0, nowSeconds = 0 }) {
    if (!visualSpeaking && (audioPaused || audioEnded)) return 0;
    const t = (!audioPaused && !audioEnded ? currentTime : nowSeconds) || nowSeconds;
    const syllable = Math.abs(Math.sin(t * 16));
    const consonant = Math.abs(Math.sin(t * 31 + 0.8));
    const phrase = Math.max(0, Math.sin(t * 5.2 - 0.6));
    return clamp(0.08 + syllable * 0.58 + consonant * 0.28 + phrase * 0.18);
  }

  function analyzerMouthLevel(timeData, previousLevel = 0) {
    if (!timeData || !timeData.length) return { level: null, rms: 0, target: 0 };
    let sumSquares = 0;
    for (let index = 0; index < timeData.length; index += 1) {
      const normalized = (timeData[index] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / timeData.length);
    const target = clamp((rms - 0.012) * 18);
    const response = target > previousLevel ? 0.72 : 0.3;
    const level = previousLevel + (target - previousLevel) * response;
    return { level: clamp(level), rms, target };
  }

  function mouthStyle(level) {
    const normalized = clamp(level);
    return {
      mouthOpen: String(0.18 + normalized * 2.35),
      mouthShift: `${normalized * 1.5}px`,
      mouthLipOpacity: String(0.9 - normalized * 0.42),
      mouthLipScale: String(1 + normalized * 0.08),
      mouthHighlightOpacity: String(0.78 - normalized * 0.56),
      mouthHighlightShift: `${normalized * -2}px`
    };
  }

  function estimatedDurationMs({ audioDuration, text }) {
    if (audioDuration && Number.isFinite(audioDuration)) {
      return Math.max(1800, Math.min(120000, audioDuration * 1000));
    }
    const wordCount = String(text || '').split(/\s+/).filter(Boolean).length;
    return Math.max(1800, Math.min(120000, wordCount * 380));
  }

  const api = { clamp, syntheticMouthLevel, analyzerMouthLevel, mouthStyle, estimatedDurationMs };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.VoiceReportMouthDynamics = api;
})(typeof window !== 'undefined' ? window : globalThis);
