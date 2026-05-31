import * as Speech from "expo-speech";

type Listener = (speaking: boolean) => void;

let _speaking = false;
const _listeners = new Set<Listener>();

function notify() {
  _listeners.forEach(l => l(_speaking));
}

export const readAloudController = {
  speak(text: string, rate = 0.9, pitch = 1.0) {
    Speech.stop();
    _speaking = true;
    notify();
    Speech.speak(text, {
      rate,
      pitch,
      language: "en-US",
      onDone: () => { _speaking = false; notify(); },
      onStopped: () => { _speaking = false; notify(); },
      onError: () => { _speaking = false; notify(); },
    });
  },

  stop() {
    Speech.stop();
    _speaking = false;
    notify();
  },

  get isSpeaking() {
    return _speaking;
  },

  subscribe(listener: Listener): () => void {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },
};
