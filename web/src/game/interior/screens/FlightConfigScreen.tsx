import type { ControlCenterProps } from '../../contracts';
import ConsoleControls from '../../ConsoleControls';

type Props = Pick<ControlCenterProps, 'mission' | 'settings' | 'onSettingsChange' | 'weatherAvailable' | 'weather'>;

/** Strategy, sensor, environment, wind and interference: the same controls as the flat console. */
export default function FlightConfigScreen(props: Props) {
  const { mission, settings, weather } = props;
  const vacuum = settings.environment === 'planetary' && mission.planetaryTarget.body === 'Moon';
  const real = settings.environment === 'earth' && settings.realWeatherMonth > 0;
  const hour = real ? weather?.months[String(settings.realWeatherMonth)]?.scenarios[settings.weatherScenario] : null;
  return <>
    <header><h2>Flight configuration</h2><span className="monitor-tag">{settings.mode === 'MANUAL_CONTROL' ? 'Manual' : 'Autonomous'}</span></header>
    <ConsoleControls {...props} />
    <p className="monitor-note">{vacuum ? 'Lunar vacuum forces wind to zero.' : real ? (hour ? `Modelled hour ${hour.timestamp_utc.slice(0, 10)}: wind from ${hour.wind_from_deg.toFixed(0)}°, air ${hour.air_density_kg_m3.toFixed(3)} kg/m³. Regional reanalysis, not a pad measurement.` : 'The weather profile is checked before departure.') : 'Wind is your scenario input, toward grid east.'}</p>
  </>;
}
