import { useEffect, useRef } from 'react';
import type { FrameListener } from '../../react/useLanderSim.ts';
import { createSideRenderer } from '../draw.ts';

interface Props {
  onFrame: (fn: FrameListener) => () => void;
  paused: boolean;
}

/** Chase-camera side view, drawn imperatively every animation frame (not via React renders). */
export function SideView({ onFrame, paused }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const draw = createSideRenderer();
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      draw(ctx, null, null, 0, false);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const off = onFrame((sim, dt, input) => draw(ctx, sim, input, dt, pausedRef.current));
    return () => {
      off();
      ro.disconnect();
    };
  }, [onFrame]);

  return <canvas ref={ref} className="side" />;
}
