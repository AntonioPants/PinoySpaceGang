import type { LanderConfig, SimState, Vec2 } from '../../src/index.ts';

interface Props {
  hud: SimState | null;
  lander: LanderConfig | null;
  aim: Vec2;
}

export function Hud({ hud, lander, aim }: Props) {
  const lim = lander?.limits;
  const vz = hud ? -hud.velocity.z : 0;
  const vh = hud ? Math.hypot(hud.velocity.x, hud.velocity.y) : 0;
  const low = (hud?.altitudeAGL ?? Infinity) < 30;
  const bad = { color: 'var(--bad)' };
  const fmt = (v: number | undefined, d: number, unit: string) => (hud && v !== undefined ? `${v.toFixed(d)} ${unit}` : '–');
  const tilt = hud ? (Math.atan(Math.hypot(Math.tan(hud.tiltX), Math.tan(hud.tiltY))) * 180) / Math.PI : undefined;

  return (
    <div className="hud">
      <div><span>Altitude AGL</span><b>{fmt(hud?.altitudeAGL, 1, 'm')}</b></div>
      <div><span>Time</span><b>{fmt(hud?.t, 1, 's')}</b></div>
      <div><span>Sink rate</span><b style={lim && low && vz > lim.maxVerticalMps ? bad : undefined}>{fmt(vz, 2, 'm/s')}</b></div>
      <div><span>Lateral</span><b style={lim && low && vh > lim.maxHorizontalMps ? bad : undefined}>{fmt(vh, 2, 'm/s')}</b></div>
      <div>
        <span>Throttle</span>
        <b>{fmt(hud ? hud.throttle * 100 : undefined, 0, '%')}</b>
        <div className="bar"><i style={{ width: `${(hud?.throttle ?? 0) * 100}%` }} /></div>
      </div>
      <div>
        <span>Fuel</span>
        <b style={hud && lander && hud.fuelKg < lander.fuelKg * 0.1 ? bad : undefined}>{fmt(hud?.fuelKg, 0, 'kg')}</b>
        <div className="bar"><i style={{ width: `${hud && lander ? (hud.fuelKg / lander.fuelKg) * 100 : 0}%` }} /></div>
      </div>
      <div><span>Tilt</span><b>{fmt(tilt, 1, '°')}</b></div>
      <div><span>To aim point</span><b>{fmt(hud ? Math.hypot(hud.position.x - aim.x, hud.position.y - aim.y) : undefined, 1, 'm')}</b></div>
    </div>
  );
}
