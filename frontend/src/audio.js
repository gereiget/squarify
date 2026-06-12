const DTMF_FREQUENCIES = {
  0: [941, 1336],
  1: [697, 1209],
  3: [697, 1477],
  6: [770, 1477],
  7: [852, 1209],
  9: [852, 1477]
};

function playDtmfTone(audioContext, digit, durationMs, delayMs = 0) {
  const frequencies = DTMF_FREQUENCIES[digit];
  if (!audioContext || !frequencies) {
    return;
  }

  const startAt = audioContext.currentTime + delayMs / 1000;
  const stopAt = startAt + durationMs / 1000;

  frequencies.forEach((frequency) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(0.06, startAt + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(stopAt);
  });
}

export function createGameSoundPlayer() {
  let audioContext = null;

  function ensureContext() {
    if (typeof window === "undefined") {
      return null;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }

    if (!audioContext) {
      audioContext = new AudioContextClass();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }

    return audioContext;
  }

  return {
    playLine() {
      playDtmfTone(ensureContext(), 1, 45);
    },
    playBox() {
      const context = ensureContext();
      playDtmfTone(context, 6, 55);
      playDtmfTone(context, 9, 70, 85);
    },
    playOtherLine() {
      playDtmfTone(ensureContext(), 3, 45);
    },
    playOtherBox() {
      const context = ensureContext();
      playDtmfTone(context, 7, 55);
      playDtmfTone(context, 0, 75, 85);
    },
    release() {
      if (!audioContext) {
        return;
      }

      audioContext.close().catch(() => {});
      audioContext = null;
    }
  };
}
