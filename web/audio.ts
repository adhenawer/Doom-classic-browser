// SPDX-License-Identifier: GPL-2.0-or-later
// Call synchronously from a gameplay gesture so resume retains user activation.
export function requestGameAudio(engine: {_web_audio(): number; webAudioGesture?: boolean}, browser: Navigator = navigator) {
  try {
    const session = (browser as Navigator & {audioSession?: {type: string}}).audioSession;
    // Supported Safari versions can route game audio as media playback, including
    // when the device's ringer is silent. Older browsers keep their native policy.
    if (session && session.type !== 'playback') session.type = 'playback';
  } catch { /* An optional session policy must never prevent Web Audio resume. */ }
  const previous = engine.webAudioGesture;
  engine.webAudioGesture = true;
  try { return engine._web_audio(); }
  finally { engine.webAudioGesture = previous; }
}
