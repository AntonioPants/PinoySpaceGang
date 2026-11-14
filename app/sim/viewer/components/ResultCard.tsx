import type { FlightSummary, FlightTelemetry } from '../../src/index.ts';

const COLORS: Record<FlightSummary['outcome'], string> = {
  success: 'var(--ok)',
  'hard-landing': 'var(--warn)',
  'tip-over': 'var(--bad)',
  crash: 'var(--bad)',
  timeout: 'var(--bad)',
};

export function ResultCard({ summary, getTelemetry, fileName }: { summary: FlightSummary; getTelemetry: () => FlightTelemetry; fileName: string }) {
  const color = COLORS[summary.outcome];
  const download = () => {
    const blob = new Blob([JSON.stringify(getTelemetry(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const rows: Array<[string, string]> = [
    ['Sink rate', `${summary.verticalSpeedMps.toFixed(2)} m/s`],
    ['Lateral speed', `${summary.horizontalSpeedMps.toFixed(2)} m/s`],
    ['Ground slope', `${summary.slopeDeg.toFixed(1)}°`],
    ['Rocks under legs', `${summary.roughnessM.toFixed(2)} m`],
    ['Fuel used / left', `${summary.fuelUsedKg.toFixed(0)} / ${summary.fuelRemainingKg.toFixed(0)} kg`],
    ['Miss distance', `${summary.distanceFromTargetM.toFixed(1)} m${summary.diverted ? ' (diverted)' : ''}`],
    ['Flight time', `${summary.flightTimeS.toFixed(1)} s`],
  ];
  return (
    <div className="result" style={{ borderColor: color }}>
      <div className="outcome" style={{ color }}>{summary.outcome}</div>
      <div>Survivability <b>{summary.survivability}%</b></div>
      {summary.failureReasons.length > 0 && (
        <ul>{summary.failureReasons.map((r) => <li key={r}>{r}</li>)}</ul>
      )}
      <table>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}><td>{k}</td><td>{v}</td></tr>
          ))}
        </tbody>
      </table>
      <SiteConditions env={getTelemetry().environment} />
      <div className="buttons"><button onClick={download}>Download telemetry JSON</button></div>
    </div>
  );
}

function SiteConditions({ env }: { env: FlightTelemetry['environment'] }) {
  const wind = Math.hypot(env.wind.x, env.wind.y);
  const sources = Object.entries(env.sources);
  return (
    <div className="conditions">
      <h2>Site conditions</h2>
      <table>
        <tbody>
          <tr><td>Gravity / air</td><td>{env.gravity} m/s² · {env.airDensity} kg/m³</td></tr>
          <tr><td>Wind</td><td>{wind.toFixed(1)} m/s</td></tr>
          <tr><td>Rock abundance</td><td>{(env.rockAbundance * 100).toFixed(1)}% · {env.rocksGenerated} boulders</td></tr>
          <tr><td>Dust / glare</td><td>{env.interference.dust.toFixed(2)} / {env.interference.glare.toFixed(2)}</td></tr>
        </tbody>
      </table>
      {sources.length > 0 && (
        <ul className="sources">
          {sources.map(([k, v]) => <li key={k}><b>{k}</b>: {v}</li>)}
        </ul>
      )}
    </div>
  );
}
