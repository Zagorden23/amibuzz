// Browser Speech-to-Text wrapper for AmiBuzz Prompt Dictation
// Uses Web Speech API (supported in Chrome, Edge, Safari)

export function isSpeechRecognitionSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function createSpeechListener({ onResult, onError, onEnd, onStart }) {
  if (!isSpeechRecognitionSupported()) {
    throw new Error('Speech recognition is not supported in this browser. Please type your prompt.');
  }

  const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognitionClass();

  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  let finalTranscript = '';

  recognition.onstart = () => {
    finalTranscript = '';
    onStart?.();
  };

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }
    const current = finalTranscript || interim;
    if (current) onResult?.(current);
  };

  recognition.onerror = (event) => {
    onError?.(event.error || 'Speech recognition encountered an error.');
  };

  recognition.onend = () => {
    onEnd?.();
  };

  return {
    start: () => {
      try {
        recognition.start();
      } catch (err) {
        onError?.(err.message || 'Could not start microphone.');
      }
    },
    stop: () => {
      try {
        recognition.stop();
      } catch {}
    },
  };
}
