"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { LanderSpec } from "./lander";
import { CutsceneEngine, type CutsceneKind } from "./engine";
import type { FlightLike, StartState } from "./flight";
import type { CutsceneEnv, EndingParams } from "./presets";
import { loadTerrainPack, peekTerrainPack, simToPack, type TerrainPack } from "./terrainPack";

interface Props {
  earthSceneryOffsetM?: number;
  /** Game scenes render to the entire host viewport without forced aspect ratio. */
  fullscreen?: boolean;
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
  requiredTerrainId?: string; // mission scenes must not silently use a procedural/wrong-site substitute
  landing?: { x: number; z: number };   // override: scene origin in pack metres
  equipment?: LanderSpec;      // the selected lander hardware, drawn on the ship
  muted?: boolean;
  showSkip?: boolean;           // false when the host page provides its own Skip control
  onDone?: () => void;         // fires when the cutscene ends or is skipped
  className?: string;
}

/**
 * Plays one cutscene. Mount it after a user click so sound is allowed to start.
 * The scene is centred on the sim's target (opening) or on the flight's touchdown point (ending).
 */
export default function Cutscene({ earthSceneryOffsetM, kind, env, flight, start, target, params, terrain, terrainUrl, requiredTerrainId, landing, equipment, muted = false, showSkip = true, onDone, className, fullscreen = false }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const engine = useRef<CutsceneEngine | null>(null);
  const done = useRef(onDone); done.current = onDone;
  const play = useRef<EndingParams>({}); play.current = { ...params, flight, start, target };
  // a pack loaded by an earlier scene is used at once, with no loading frame
  const [loaded, setLoaded] = useState<TerrainPack | null>(() => (terrainUrl ? peekTerrainPack(terrainUrl) : null));
  const [failed, setFailed] = useState(false);
  const pack = terrain ?? loaded;
  const wrongPack = !!(pack && requiredTerrainId && pack.manifest.id !== requiredTerrainId);
  const waiting = !!terrainUrl && !terrain && !loaded && !failed;
  const lp = flight?.summary?.landingPoint;
  const centre = kind === "opening" ? target ?? { x: 0, y: 0 } : lp ?? target ?? { x: 0, y: 0 };
  const origin = landing ?? (pack ? simToPack(pack, centre) : null);
  const envKey = JSON.stringify(env), landKey = JSON.stringify(origin), equipKey = JSON.stringify(equipment ?? null);

  useEffect(() => {
    if (terrain || !terrainUrl) return;
    const ctl = new AbortController();
    setFailed(false); setLoaded(peekTerrainPack(terrainUrl));
    loadTerrainPack(terrainUrl, ctl.signal).then(p => { if (!ctl.signal.aborted) setLoaded(p); }).catch(() => { if (!ctl.signal.aborted) setFailed(true); });
    return () => ctl.abort();
  }, [terrain, terrainUrl]);

  // Before the first paint: the screen keeps the previous scene until this one can draw (its first
  // frame is the previous scene's last, dissolving), so an empty black box is never shown.
  useLayoutEffect(() => {
    if (!box.current || waiting || (requiredTerrainId && (!pack || wrongPack))) return;
    const e = new CutsceneEngine(box.current, JSON.parse(envKey) as CutsceneEnv,
      { muted, showSkip, letterbox: !fullscreen, equipment: JSON.parse(equipKey) ?? undefined, terrain: pack ?? undefined, landing: JSON.parse(landKey) ?? undefined });
    engine.current = e;
    let live = true;
    const host = box.current;
    if (earthSceneryOffsetM !== undefined && pack) {
      void import('../../lib/attachSiteScenery').then(({ attachSiteScenery }) => {
        if (live) attachSiteScenery(e, host, pack, centre, earthSceneryOffsetM);
      }).catch(() => { /* Keep playing over the measured terrain. */ });
    }
    e.play(kind, play.current).then(() => { if (live) done.current?.(); });
    return () => { live = false; e.dispose(); engine.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earthSceneryOffsetM, kind, envKey, landKey, equipKey, pack, waiting, flight, requiredTerrainId, wrongPack, fullscreen]);

  useEffect(() => { engine.current?.setMuted(muted); }, [muted]);

  return (
    <div style={{ position: "relative", width: "100%", height: fullscreen ? "100%" : undefined }} className={className}>
      <div ref={box} style={{ width: "100%", height: fullscreen ? "100%" : undefined, aspectRatio: fullscreen ? undefined : "16 / 9", background: "#000" }} />
      {(waiting || failed || wrongPack) && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#999", fontSize: 14 }}>
          {waiting ? "Loading terrain..." : requiredTerrainId ? "Selected terrain unavailable. Skip this cinematic to continue your mission." : "Terrain pack not found; using the procedural landscape."}
        </div>
      )}
    </div>
  );
}
