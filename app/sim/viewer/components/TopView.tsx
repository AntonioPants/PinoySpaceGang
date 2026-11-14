import { useEffect, useRef } from 'react';
import type { FrameListener } from '../../react/useLanderSim.ts';
import type { SimInput } from '../../src/index.ts';
import { drawTop, renderTopImage, type TopImage } from '../draw.ts';

interface Props {
  onFrame: (fn: FrameListener) => () => void;
  input: SimInput | null;
}

/** Top-down hazard map: the hillshade is rendered once per site, overlays every frame. */
export function TopView({ onFrame, input }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<{ key: unknown; image: TopImage } | null>(null);

  useEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    return onFrame((sim, _dt, inp) => {
      if (imageRef.current?.key !== inp.site) {
        imageRef.current = { key: inp.site, image: renderTopImage(inp.site, inp.target ?? { x: 0, y: 0 }) };
      }
      drawTop(ctx, sim, inp, imageRef.current.image);
    });
  }, [onFrame, input]);

  return <canvas ref={ref} className="top" width={440} height={440} />;
}
