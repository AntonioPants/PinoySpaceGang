import { sensors } from './opening/equipmentCatalog';
import type { ControlCenterProps } from './contracts';
import type { MissionSettings } from '../lib/types';

type Props = Pick<ControlCenterProps, 'mission' | 'settings' | 'onSettingsChange' | 'weatherAvailable' | 'weather'>;

/**
 * The mission condition controls: strategy, sensor, environment, wind or modelled weather, and
 * sensor interference. Shared by the flat console and the ship interior's flight-configuration
 * monitor, so the two always offer the same choices.
 */
export default function ConsoleControls({ mission, settings, onSettingsChange, weatherAvailable, weather }: Props) {
  const update = <K extends keyof MissionSettings>(key: K, value: MissionSettings[K]) => onSettingsChange({ ...settings, [key]: value });
  const vacuum = settings.environment === 'planetary' && mission.planetaryTarget.body === 'Moon';
  const real = settings.environment === 'earth' && settings.realWeatherMonth > 0;
  const hour = real ? weather?.months[String(settings.realWeatherMonth)]?.scenarios[settings.weatherScenario] : null;
  return (
    <div className="console-controls">
      <label>Control strategy<select value={settings.mode} onChange={e => update('mode', e.target.value as MissionSettings['mode'])}><option value="AUTONOMOUS_HAZARD_AVOID">Autonomous</option><option value="MANUAL_CONTROL">Manual</option></select></label>
      <label>Hazard sensor<select value={settings.hazardSensor} onChange={e => update('hazardSensor', e.target.value as MissionSettings['hazardSensor'])}>{sensors.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Test environment<select value={settings.environment} onChange={e => update('environment', e.target.value as MissionSettings['environment'])}><option value="planetary">{mission.planetaryTarget.body} physics on Earth terrain</option><option value="earth">Earth field test</option></select></label>
      <label>Wind speed (m/s)<input type="number" min={0} max={30} step={1} disabled={vacuum || real} value={vacuum ? 0 : real ? hour?.wind_speed_m_s.toFixed(1) ?? '' : settings.windSpeedMs} onChange={e => update('windSpeedMs', e.target.valueAsNumber)} /></label>
      {settings.environment === 'earth' && <label>Wind source<select value={settings.realWeatherMonth} onChange={e => update('realWeatherMonth', Number(e.target.value))}><option value={0}>Manual wind</option>{weatherAvailable ? ['January','February','March','April','May','June','July','August','September','October','November','December'].map((month, i) => <option key={month} value={i + 1}>{month} weather</option>) : settings.realWeatherMonth > 0 && <option value={settings.realWeatherMonth} disabled>Weather unavailable — select manual</option>}</select></label>}
      {real && weatherAvailable && <label>Weather scenario<select value={settings.weatherScenario} onChange={e => update('weatherScenario', e.target.value as MissionSettings['weatherScenario'])}><option value="typical">Typical modelled hour</option><option value="high_wind">High-wind modelled hour</option></select></label>}
      <label>Sensor interference<select value={settings.siteConditions ? 'site' : 'manual'} onChange={e => update('siteConditions', e.target.value === 'site')}><option value="site">From site data</option><option value="manual">Manual settings</option></select></label>
      {!settings.siteConditions && <>{(['dust', 'glare'] as const).map(key => <label key={key}>{key === 'dust' ? 'Dust' : 'Glare'} (%)<input type="number" min={0} max={100} step={5} value={Math.round(settings[key] * 100)} onChange={e => update(key, e.target.valueAsNumber / 100)} /></label>)}</>}
    </div>
  );
}
