import { useEffect, useState } from "react";
import { Cutscene, DEFAULT_TERRAIN_URL, type CutsceneEnv, type FlightLike } from "./index";

// Test bench: open the web app with ?cutscene-demo. Flights were recorded from app/sim on the
// Kilbourne Hole pack (see README.md in this folder).
const ENV: CutsceneEnv = { name: "Kilbourne Hole, New Mexico, USA", subtitle: "Apollo field-training analog site", preset: "desert",
  look: { ground: "#b9a07c", groundDark: "#7d6a50", rock: "#4d4034" } };

export default function CutsceneDemo() {
  const [flights, setFlights] = useState<Record<string, FlightLike>>({});
  const [run, setRun] = useState<{ name: string; n: number } | null>(null);
  const [muted, setMuted] = useState(false);
  useEffect(() => { fetch("/cutscene-demo/flights.json").then((r) => r.json()).then(setFlights).catch(() => setFlights({})); }, []);
  const flight = run ? flights[run.name] : undefined;

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Cutscene test bench</h1>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={() => setRun({ name: "opening", n: (run?.n ?? 0) + 1 })}>Opening</button>
        {Object.entries(flights).map(([name, f]) => (
          <button key={name} onClick={() => setRun({ name, n: (run?.n ?? 0) + 1 })}>
            {f.summary?.outcome} ({f.summary?.verticalSpeedMps.toFixed(1)} m/s)
          </button>
        ))}
        <label><input type="checkbox" checked={muted} onChange={(e) => setMuted(e.target.checked)} /> Mute</label>
      </div>
      {run
        ? <Cutscene key={run.n} kind={flight ? "ending" : "opening"} flight={flight} env={ENV} muted={muted} terrainUrl={DEFAULT_TERRAIN_URL} />
        : <div style={{ aspectRatio: "16 / 9", background: "#000", color: "#888", display: "grid", placeItems: "center" }}>Pick a cutscene</div>}
    </main>
  );
}
