import type { ControlCenterProps } from './contracts';
import ConsoleControls from './ConsoleControls';

/** The flat 2D console: the accessibility and no-WebGL fallback for the 3D ship interior. */
export default function SystemsConsole({ mission, settings, onSettingsChange, onLaunch, onExit, error, weatherAvailable, weather }: ControlCenterProps) {
  const vacuum = settings.environment === 'planetary' && mission.planetaryTarget.body === 'Moon';
  const real = settings.environment === 'earth' && settings.realWeatherMonth > 0;
  const hour = real ? weather?.months[String(settings.realWeatherMonth)]?.scenarios[settings.weatherScenario] : null;
  return <section className="systems-console" aria-label="Ship systems console">
    <div className="section-heading"><div><span className="badge ready">Systems console · flat view</span><h2>Prepare for departure</h2></div><span className="small-label">Departure: {mission.planetaryTarget.body}</span></div>
    <p>{mission.planetaryTarget.name} → {mission.earthAnalog.name}. Review your equipment and set the Earth test conditions before launch.</p>
    <div className="console-layout"><div className="console-loadout"><h3>Equipment manifest</h3><dl>
      <div><dt>Dry mass</dt><dd>{settings.dryMassKg} kg</dd></div><div><dt>Propellant</dt><dd>{settings.fuelMassKg} kg</dd></div>
      <div><dt>Maximum thrust</dt><dd>{settings.thrusterForceN.toLocaleString()} N</dd></div>
      <div><dt>Slope limit</dt><dd>{settings.maxSlopeToleranceDeg}°</dd></div>
    </dl><p>Experimental vehicle settings. Return to equipment setup to change the loadout.</p></div>
    <ConsoleControls mission={mission} settings={settings} onSettingsChange={onSettingsChange} weatherAvailable={weatherAvailable} weather={weather} /></div>
    <p className="field-help">{vacuum ? 'Lunar vacuum forces wind to zero.' : real ? 'Regional modelled weather sets wind and air density.' : 'Wind is an explicit scenario input toward grid east.'} Departure location and test physics are separate choices.</p>
    {real && <p className="field-help">{hour ? `NASA POWER: ${hour.timestamp_utc}, wind from ${hour.wind_from_deg.toFixed(0)}°, air density ${hour.air_density_kg_m3.toFixed(3)} kg/m³. Regional reanalysis, not a pad measurement.` : 'Weather data is not available yet. Launch will validate the profile before departure.'}</p>}
    {error && <p className="import-error" role="alert">{error}</p>}
    <div className="panel-actions"><button className="subtle-button" onClick={onExit}>Return to equipment</button><button className="primary-button" onClick={onLaunch}>Launch mission</button></div>
  </section>;
}
