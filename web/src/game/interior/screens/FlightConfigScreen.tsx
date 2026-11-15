import { sensors } from '../../opening/equipmentCatalog';
import type { ControlCenterProps } from '../../contracts';
import type { MissionSettings } from '../../../lib/types';
import { Dropdown, Segmented, Slider } from './ui';

type Props = Pick<ControlCenterProps, 'mission' | 'settings' | 'onSettingsChange' | 'weatherAvailable' | 'weather'>;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** How the descent is flown and in what conditions: strategy, sensor, environment, wind, interference. */
export default function FlightConfigScreen({ mission, settings, onSettingsChange, weatherAvailable, weather }: Props) {
  const set = <K extends keyof MissionSettings>(key: K, value: MissionSettings[K]) => onSettingsChange({ ...settings, [key]: value });
  const body = mission.planetaryTarget.body, earth = settings.environment === 'earth';
  const vacuum = !earth && body === 'Moon';
  const real = earth && settings.realWeatherMonth > 0;
  const hour = real ? weather?.months[String(settings.realWeatherMonth)]?.scenarios[settings.weatherScenario] : null;
  return <div className="flight-config-content">
    <header><h2>Flight configuration</h2><span className="mon-readout">{settings.mode === 'MANUAL_CONTROL' ? 'Manual flight' : 'Autonomous flight'}</span></header>
    <div className="mon-columns">
      <section>
        <h3>Guidance</h3>
        <Segmented label="Control" value={settings.mode} onChange={v => set('mode', v)} options={[{ value: 'AUTONOMOUS_HAZARD_AVOID', label: 'Autonomous' }, { value: 'MANUAL_CONTROL', label: 'Manual' }]} />
        <Segmented label="Sensor interference" value={settings.siteConditions} onChange={v => set('siteConditions', v)} options={[{ value: true, label: 'From site data' }, { value: false, label: 'Manual' }]} />
        {settings.siteConditions ? <p className="mon-note">Dust and glare come from the test site’s surface data.</p> : <div className="mon-pair">
          <Slider label="Dust" value={Math.round(settings.dust * 100)} min={0} max={100} step={5} unit="%" onChange={v => set('dust', v / 100)} />
          <Slider label="Glare" value={Math.round(settings.glare * 100)} min={0} max={100} step={5} unit="%" onChange={v => set('glare', v / 100)} />
        </div>}
      </section>
      <section>
        <h3>Environment</h3>
        <Segmented label="Test physics" value={settings.environment} onChange={v => set('environment', v)} options={[{ value: 'planetary', label: `${body} gravity` }, { value: 'earth', label: 'Earth field test' }]} />
        {earth && <Dropdown label="Wind source" value={weatherAvailable ? settings.realWeatherMonth : 0} onChange={v => set('realWeatherMonth', v)}
          options={[{ value: 0, label: 'Manual wind' }, ...(weatherAvailable ? MONTHS.map((m, i) => ({ value: i + 1, label: `${m.slice(0, 3)} weather` })) : [])]} />}
        {real && weatherAvailable && <Segmented label="Modelled hour" value={settings.weatherScenario} onChange={v => set('weatherScenario', v)} options={[{ value: 'typical', label: 'Typical' }, { value: 'high_wind', label: 'High wind' }]} />}
        {!real && <Slider label="Wind" value={vacuum ? 0 : settings.windSpeedMs} min={0} max={30} step={1} unit="m/s" disabled={vacuum} onChange={v => set('windSpeedMs', v)}
          note={vacuum ? 'Lunar vacuum: no wind.' : 'Your scenario input, toward grid east.'} />}
        {real && <p className="mon-note">{hour ? `Modelled hour ${hour.timestamp_utc.slice(0, 10)}: ${hour.wind_speed_m_s.toFixed(1)} m/s from ${hour.wind_from_deg.toFixed(0)}°, air ${hour.air_density_kg_m3.toFixed(3)} kg/m³. Regional reanalysis, not a pad measurement.` : 'The weather profile is checked before departure.'}</p>}
        {earth && !weatherAvailable && <p className="mon-note">No weather profile exists for this site.</p>}
      </section>
    </div>
    <div className="flight-sensors">
      <Segmented label="Hazard sensor" value={settings.hazardSensor} onChange={v => set('hazardSensor', v)} options={sensors.map(s => ({ value: s.id, label: s.name }))} />
    </div>
  </div>;
}
