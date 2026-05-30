import { getIsSoundEnabled } from "../composables/use-sound-settings";

function createAudioContext() {
  return new window.AudioContext();
}

function connectAudioNodes(
  oscillator: OscillatorNode,
  mainGain: GainNode,
  delay: DelayNode,
  delayGain: GainNode,
  delay2: DelayNode,
  delayGain2: GainNode,
  audioContext: AudioContext
) {
  oscillator.connect(mainGain);
  mainGain.connect(audioContext.destination);

  oscillator.connect(delay);
  delay.connect(delayGain);
  delayGain.connect(audioContext.destination);

  oscillator.connect(delay2);
  delay2.connect(delayGain2);
  delayGain2.connect(audioContext.destination);
}

function configureOscillator(
  oscillator: OscillatorNode,
  mainGain: GainNode,
  delay: DelayNode,
  delayGain: GainNode,
  delay2: DelayNode,
  delayGain2: GainNode,
  audioContext: AudioContext
) {
  connectAudioNodes(oscillator, mainGain, delay, delayGain, delay2, delayGain2, audioContext);

  oscillator.frequency.value = 1350;
  oscillator.type = "square";

  mainGain.gain.value = 0.4;
  mainGain.gain.setValueAtTime(0.4, audioContext.currentTime);
  mainGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.12);

  delay.delayTime.value = 0.15;
  delayGain.gain.value = 0.35;
  delayGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.35);

  delay2.delayTime.value = 0.3;
  delayGain2.gain.value = 0.2;
  delayGain2.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.12);
}

export function playTerminalBell() {
  if (!getIsSoundEnabled()) {
    return;
  }

  try {
    const audioContext = createAudioContext();

    const oscillator = audioContext.createOscillator();
    const mainGain = audioContext.createGain();
    const delay = audioContext.createDelay();
    const delayGain = audioContext.createGain();
    const delay2 = audioContext.createDelay();
    const delayGain2 = audioContext.createGain();

    configureOscillator(oscillator, mainGain, delay, delayGain, delay2, delayGain2, audioContext);
  } catch {
  }
}
