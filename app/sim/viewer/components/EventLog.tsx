import type { ReactNode } from 'react';
import type { SimEvent } from '../../src/index.ts';

function describe(e: SimEvent): ReactNode {
  switch (e.type) {
    case 'dustKickup':
      return `dust kick-up at ${e.altitudeM.toFixed(0)} m (intensity ${e.intensity.toFixed(2)})`;
    case 'hazardDetected':
      return (<><b className="warn">hazard</b> at aim: slope {e.slopeDeg.toFixed(1)}°, rocks {e.roughnessM.toFixed(2)} m</>);
    case 'divert':
      return (<><b className="ok">divert</b> {e.distanceM.toFixed(1)} m → ({e.to.x.toFixed(0)}, {e.to.y.toFixed(0)})</>);
    case 'fuelLow':
      return (<><b className="warn">fuel low</b> {e.fuelKg.toFixed(0)} kg</>);
    case 'fuelOut':
      return <b className="bad">fuel out</b>;
    case 'touchdown':
      return `touchdown — ${e.outcome} (sink ${e.verticalSpeedMps.toFixed(2)}, lateral ${e.horizontalSpeedMps.toFixed(2)} m/s)`;
    case 'crash':
      return (<><b className="bad">crash</b> at {e.impactSpeedMps.toFixed(1)} m/s</>);
    case 'tipOver':
      return (<><b className="bad">tip-over</b> on {e.slopeDeg.toFixed(1)}° ground</>);
    default:
      return e.type;
  }
}

export function EventLog({ events }: { events: SimEvent[] }) {
  return (
    <div>
      <h2>Events</h2>
      <ul className="log">
        {events
          .map((e, i) => (
            <li key={i}>
              <time>{e.t.toFixed(1)}s</time>
              {describe(e)}
            </li>
          ))
          .reverse()}
      </ul>
    </div>
  );
}
