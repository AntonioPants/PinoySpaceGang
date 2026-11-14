import type { ControlCenterProps } from './contracts';
import type { MissionSettings } from '../lib/types';

/** Functional 2D fallback until Tim supplies the interactive 3D interior. */
export default function SystemsConsole({ mission, settings, onSettingsChange, onLaunch, onExit, error, weatherAvailable, weather }: ControlCenterProps) {
  const update = <K extends keyof MissionSettings>(key: K, value: MissionSettings[K]) => onSettingsChange({ ...settings, [key]: value });
  const vacuum = settings.environment === 'planetary' && mission.planetaryTarget.body === 'Moon';
  const real = settings.environment === 'earth' && settings.realWeatherMonth > 0;
  const hour = real ? weather?.months[String(settings.realWeatherMonth)]?.scenarios[settings.weatherScenario] : null;
  return <section className="systems-console" aria-label="Ship systems console">
    <div className="section-heading"><div><span className="badge ready">Systems console · 2D prototype</span><h2>Prepare for departure</h2></div><span className="small-label">Departure: {mission.planetaryTarget.body}</span></div>
    <p>{mission.planetaryTarget.name} → {mission.earthAnalog.name}. Review your equipment and set the Earth test conditions before launch.</p>
    <div className="console-layout"><div className="console-loadout"><h3>Equipment manifest</h3><dl>
      <div><dt>Dry mass</dt><dd>{settings.dryMassKg} kg</dd></div><div><dt>Propellant</dt><dd>{settings.fuelMassKg} kg</dd></div>
      <div><dt>Maximum thrust</dt><dd>{settings.thrusterForceN.toLocaleString()} N</dd></div>
      <div><dt>Slope limit</dt><dd>{settings.maxSlopeToleranceDeg}°</dd></div>
    </dl><p>Experimental vehicle settings. Return to equipment setup to change the loadout.</p></div>
    <div className="console-controls">
      <label>Control strategy<select value={settings.mode} onChange={e => update('mode', e.target.value as MissionSettings['mode'])}><option value="AUTONOMOUS_HAZARD_AVOID">Autonomous</option><option value="MANUAL_CONTROL">Manual</option></select></label>
      <label>Hazard sensor<select value={settings.hazardSensor} onChange={e => update('hazardSensor', e.target.value as MissionSettings['hazardSensor'])}><option value="lidar">Lidar</option><option value="camera">Camera</option><option value="none">No hazard sensor</option></select></label>
      <label>Test environment<select value={settings.environment} onChange={e => update('environment', e.target.value as MissionSettings['environment'])}><option value="planetary">{mission.planetaryTarget.body} physics on Earth terrain</option><option value="earth">Earth field test</option></select></label>
      <label>Wind speed (m/s)<input type="number" min={0} max={30} step={1} disabled={vacuum || real} value={vacuum ? 0 : real ? hour?.wind_speed_m_s.toFixed(1) ?? '' : settings.windSpeedMs} onChange={e => update('windSpeedMs', e.target.valueAsNumber)} /></label>
      {settings.environment === 'earth' && <label>Wind source<select value={settings.realWeatherMonth} onChange={e => update('realWeatherMonth', Number(e.target.value))}><option value={0}>Manual wind</option>{weatherAvailable ? ['January','February','March','April','May','June','July','August','September','October','November','December'].map((month, i) => <option key={month} value={i + 1}>{month} weather</option>) : settings.realWeatherMonth > 0 && <option value={settings.realWeatherMonth} disabled>Weather unavailable — select manual</option>}</select></label>}
      {real && weatherAvailable && <label>Weather scenario<select value={settings.weatherScenario} onChange={e => update('weatherScenario', e.target.value as MissionSettings['weatherScenario'])}><option value="typical">Typical modelled hour</option><option value="high_wind">High-wind modelled hour</option></select></label>}
      <label>Sensor interference<select value={settings.siteConditions ? 'site' : 'manual'} onChange={e => update('siteConditions', e.target.value === 'site')}><option value="site">From site data</option><option value="manual">Manual settings</option></select></label>
      {!settings.siteConditions && <>{(['dust', 'glare'] as const).map(key => <label key={key}>{key === 'dust' ? 'Dust' : 'Glare'} (%)<input type="number" min={0} max={100} step={5} value={Math.round(settings[key] * 100)} onChange={e => update(key, e.target.valueAsNumber / 100)} /></label>)}</>}
    </div></div>
    <p className="field-help">{vacuum ? 'Lunar vacuum forces wind to zero.' : real ? 'Regional modelled weather sets wind and air density.' : 'Wind is an explicit scenario input toward grid east.'} Departure location and test physics are separate choices.</p>
    {real && <p className="field-help">{hour ? `NASA POWER: ${hour.timestamp_utc}, wind from ${hour.wind_from_deg.toFixed(0)}°, air density ${hour.air_density_kg_m3.toFixed(3)} kg/m³. Regional reanalysis, not a pad measurement.` : 'Weather data is not available yet. Launch will validate the profile before departure.'}</p>}
    <p className="field-help">The interactive 3D interior and cinematics are in development. This console already passes your settings to the live descent.</p>
    {error && <p className="import-error" role="alert">{error}</p>}
    <div className="panel-actions"><button className="subtle-button" onClick={onExit}>Return to equipment</button><button className="primary-button" onClick={onLaunch}>Launch mission</button></div>
  </section>;
}
