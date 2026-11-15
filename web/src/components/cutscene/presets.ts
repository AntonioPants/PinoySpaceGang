/** Look of an analog environment. Pick a preset by soil/terrain type from sites.json. */
export interface EnvLook {
  ground: string; groundDark: string; rock: string;
  skyTop: string; skyHorizon: string; fog: string; fogFar: number;
  sun: string; dust: [number, number, number];
  stars: boolean; relief: number;       // metres of procedural relief
}

export type PresetName = "desert" | "ice" | "volcanic" | "crater" | "lunar" | "mars";

export const PRESETS: Record<PresetName, EnvLook> = {
  desert:   { ground: "#c79a63", groundDark: "#8a5a34", rock: "#6b4a30", skyTop: "#3f78c4", skyHorizon: "#f0d6ae", fog: "#e9cfa6", fogFar: 1500, sun: "#fff1d0", dust: [0.80, 0.63, 0.42], stars: false, relief: 26 },
  ice:      { ground: "#e8f1f7", groundDark: "#9fb9cc", rock: "#5c6f7d", skyTop: "#4a86c8", skyHorizon: "#e6f0f7", fog: "#dfeaf2", fogFar: 1300, sun: "#ffffff", dust: [0.93, 0.96, 0.98], stars: false, relief: 18 },
  volcanic: { ground: "#4a4340", groundDark: "#221f1e", rock: "#151313", skyTop: "#56708f", skyHorizon: "#c9c2b6", fog: "#b8b0a4", fogFar: 1200, sun: "#ffe9c4", dust: [0.36, 0.33, 0.31], stars: false, relief: 34 },
  crater:   { ground: "#9a8f7d", groundDark: "#5d5547", rock: "#403a31", skyTop: "#6f93b8", skyHorizon: "#d9dcd6", fog: "#cfd2cc", fogFar: 1300, sun: "#fff6e0", dust: [0.66, 0.61, 0.53], stars: false, relief: 40 },
  lunar:    { ground: "#8d8d8d", groundDark: "#3f3f42", rock: "#2a2a2c", skyTop: "#000000", skyHorizon: "#050507", fog: "#000000", fogFar: 6000, sun: "#ffffff", dust: [0.62, 0.62, 0.62], stars: true, relief: 30 },
  mars:     { ground: "#b5653a", groundDark: "#6e3620", rock: "#4a2416", skyTop: "#8c6a4f", skyHorizon: "#e0b48a", fog: "#d6a67c", fogFar: 1300, sun: "#fff0dc", dust: [0.76, 0.48, 0.30], stars: false, relief: 28 },
};

/** Input for a cutscene. Everything except `name` is optional so it works before sites.json exists. */
export interface CutsceneEnv {
  name: string;                 // e.g. "Atacama Desert, Chile"
  subtitle?: string;            // e.g. "Earth analog for Jezero Crater, Mars"
  preset?: PresetName;
  look?: Partial<EnvLook>;      // override single colours
  elevation?: number[];         // metres along the landing slice (any length >= 2)
  seed?: number;
  /** Who flies the descent that follows: the player, or the autonomous guidance. Sets the hand-over caption. */
  control?: "manual" | "autonomous";
}

import type { FlightLike, StartState } from "./flight";

/** What a cutscene is driven by. With `flight` or `start` it follows the physics; the rest are fallbacks. */
export interface EndingParams {
  flight?: FlightLike;        // endings: replay the last seconds of this flight
  start?: StartState;         // opening: hand over at this state (relative to `target`)
  target?: { x: number; y: number };
  vy?: number;        // touchdown vertical speed, m/s (positive = down)
  vx?: number;        // touchdown horizontal speed, m/s
  tiltDeg?: number;   // lander tilt at contact
  reason?: string;    // shown under the crash title, e.g. "Vertical speed 14 m/s (limit 3)"
}
