export function playImagePasteSound() {
  try {
    const audioContext = new AudioContext();
    const currentTime = audioContext.currentTime;

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(440, currentTime + 0.08);

    gain.gain.setValueAtTime(0.3, currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.15);

    oscillator.start(currentTime);
    oscillator.stop(currentTime + 0.15);
  } catch {
  }
}
