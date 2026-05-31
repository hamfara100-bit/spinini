import { AudioModule, createAudioPlayer } from "expo-audio";

let _player: ReturnType<typeof createAudioPlayer> | null = null;

export async function playSound(uri: string, volume = 1.0): Promise<void> {
  try {
    stopSound();
    await AudioModule.setAudioModeAsync({ playsInSilentMode: true });
    _player = createAudioPlayer({ uri });
    _player.volume = volume;
    _player.play();
  } catch {
    // ignore audio errors
  }
}

export function stopSound(): void {
  if (_player) {
    try { _player.remove(); } catch {}
    _player = null;
  }
}
