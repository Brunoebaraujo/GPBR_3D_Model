// Shared, gesture-unlocked audio. Procedural effects need no external downloads.
let context: AudioContext | undefined;
export function unlockAssemblyAudio() {
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume().catch(() => undefined);
  } catch { /* Assembly remains usable when audio is unavailable. */ }
}
function tone(frequency: number, duration: number, volume: number, delay = 0, end = frequency) {
  if (!context || context.state !== 'running') return;
  const audio = context, start = audio.currentTime + delay;
  const oscillator = audio.createOscillator(), gain = audio.createGain();
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(end, start + duration);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + .008);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  oscillator.connect(gain); gain.connect(audio.destination);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  oscillator.start(start); oscillator.stop(start + duration);
}
export function playAssemblySound(kind: 'creak' | 'click' | 'impact' | 'celebrate') {
  if (kind === 'creak') {
    tone(310, .18, .012, 0, 240);
    tone(467, .16, .007, .02, 390);
  } else if (kind === 'click') {
    [420, 1037, 1743].forEach((f, i) => tone(f, .09, .045 / (i + 1)));
  } else if (kind === 'impact') {
    [110, 283, 719, 1327].forEach((f, i) => tone(f, .42 / (1 + i * .25), .085 / (i + 1)));
  } else {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      tone(f, .38, .06, i * .12);
      tone(f * 2, .25, .012, i * .12);
    });
  }
}
