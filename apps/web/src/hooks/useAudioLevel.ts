import { useEffect, useRef, useState } from 'react';

/**
 * Returns a real-time audio volume level (0–1) from a MediaStream.
 * Uses Web Audio API AnalyserNode — updates ~60fps via requestAnimationFrame.
 */
export function useAudioLevel(stream: MediaStream | null): number {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number>(0);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!stream) {
      setLevel(0);
      return;
    }

    let ctx: AudioContext;
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.75;

    let source: MediaStreamAudioSourceNode;
    try {
      source = ctx.createMediaStreamSource(stream);
    } catch {
      ctx.close();
      return;
    }
    source.connect(analyser);
    ctxRef.current = ctx;

    const data = new Uint8Array(analyser.frequencyBinCount);

    function tick() {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length / 255;
      // Boost low levels so even quiet speech is visible
      const boosted = Math.min(1, avg * 3.5);
      setLevel(boosted);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      source.disconnect();
      ctx.close().catch(() => {});
      ctxRef.current = null;
    };
  }, [stream]);

  return level;
}
