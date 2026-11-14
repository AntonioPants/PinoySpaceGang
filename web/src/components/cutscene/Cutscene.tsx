"use client";

import { useEffect, useRef, useState } from "react";
import { CutsceneEngine, type CutsceneKind } from "./engine";
import type { FlightLike, StartState } from "./flight";
import type { CutsceneEnv, EndingParams } from "./presets";
import { loadTerrainPack, simToPack, type TerrainPack } from "./terrainPack";

interface Props {
  /** "opening" before the simulation, "ending" after it. "success" / "crash" are stand-ins without a flight. */
  kind: CutsceneKind;
  env: CutsceneEnv;
  /** Ending: the finished flight, i.e. `sim.telemetry()`. Its last seconds are replayed. */
  flight?: FlightLike;
  /** Opening: SimInput.start and SimInput.target, so the cutscene hands over where the sim begins. */
  start?: StartState;
  target?: { x: number; y: number };
  params?: EndingParams;       // only for the "success" / "crash" stand-ins
  terrain?: TerrainPack;       // real terrain, already loaded
  terrainUrl?: string;         // or a pack folder to load, e.g. "/terrain/kilbourne-hole-v1/"
  landing?: { x: number; z: number };   // override: scene origin in pack metres
  muted?: boolean;
  onDone?: () => void;         // fires when the cutscene ends or is skipped
  className?: string;
}

/**
 * Plays one cutscene. Mount it after a user click so sound is allowed to start.
 * The scene is centred on the sim's target (opening) or on the flight's touchdown point (ending).
 */
export default function Cutscene({ kind, env, flight, start, target, params, terrain, terrainUrl, landing, muted = false, onDone, className }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const engine = useRef<CutsceneEngine | null>(null);
  const done = useRef(onDone); done.current = onDone;
  const play = useRef<EndingParams>({}); play.current = { ...params, flight, start, target };
  const [loaded, setLoaded] = useState<TerrainPack | null>(null);
  const [failed, setFailed] = useState(false);
  const pack = terrain ?? loaded;
  const waiting = !!terrainUrl && !terrain && !loaded && !failed;
  const lp = flight?.summary?.landingPoint;
  const centre = kind === "opening" ? target ?? { x: 0, y: 0 } : lp ?? target ?? { x: 0, y: 0 };
  const origin = landing ?? (pack ? simToPack(pack, centre) : null);
  const envKey = JSON.stringify(env), landKey = JSON.stringify(origin);

  useEffect(() => {
    if (terrain || !terrainUrl) return;
    const ctl = new AbortController();
    setFailed(false);
    loadTerrainPack(terrainUrl, ctl.signal).then(setLoaded).catch(() => { if (!ctl.signal.aborted) setFailed(true); });
    return () => ctl.abort();
  }, [terrain, terrainUrl]);

  useEffect(() => {
    if (!box.current || waiting) return;
    const e = new CutsceneEngine(box.current, JSON.parse(envKey) as CutsceneEnv,
      { muted, terrain: pack ?? undefined, landing: JSON.parse(landKey) ?? undefined });
    engine.current = e;
    let live = true;
    e.play(kind, play.current).then(() => { if (live) done.current?.(); });
    return () => { live = false; e.dispose(); engine.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, envKey, landKey, pack, waiting, flight]);

  useEffect(() => { engine.current?.setMuted(muted); }, [muted]);

  return (
    <div style={{ position: "relative", width: "100%" }} className={className}>
      <div ref={box} style={{ width: "100%", aspectRatio: "16 / 9", background: "#000" }} />
      {(waiting || failed) && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#999", fontSize: 14 }}>
          {waiting ? "Loading terrain..." : "Terrain pack not found; using the procedural landscape."}
        </div>
      )}
    </div>
  );
}
