/**
 * Go / no-go checks shown on the mission control and launch monitors. They read the same
 * settings the parent validates at launch; they never change a setting or decide the flight.
 */
import { validateSettings } from '../../lib/mission';
import type { MissionConfig, MissionSettings } from '../../lib/types';

export type CheckStatus = 'go' | 'caution' | 'hold';
export interface Check { id: string; label: string; status: CheckStatus; detail: string }

export interface ChecklistInput {
  mission: MissionConfig; settings: MissionSettings;
  weatherAvailable: boolean; weatherLoaded: boolean;
  /** The parent's launch error, if the last launch attempt was refused. */
  error: string;
}

export function buildChecklist({ mission, settings, weatherAvailable, weatherLoaded, error }: ChecklistInput): Check[] {
  const checks: Check[] = [];
  const invalid = validateSettings(settings);
  checks.push(invalid.length
    ? { id: 'settings', label: 'Settings', status: 'hold', detail: invalid.join(' ') }
    : { id: 'settings', label: 'Settings', status: 'go', detail: 'All settings are within range.' });

  // the gravity the descent will fly in: Earth for a field test, otherwise the target body's
  const gravity = settings.environment === 'earth' ? 9.81 : mission.planetaryTarget.gravity;
  const twr = settings.thrusterForceN / ((settings.dryMassKg + settings.fuelMassKg) * gravity);
  checks.push(twr >= 1
    ? { id: 'thrust', label: 'Thrust to weight', status: 'go', detail: `${twr.toFixed(2)} at ${gravity.toFixed(2)} m/s². The vehicle can hover.` }
    : { id: 'thrust', label: 'Thrust to weight', status: 'caution', detail: `${twr.toFixed(2)} at ${gravity.toFixed(2)} m/s². The vehicle cannot hover and is likely to crash.` });

  const real = settings.environment === 'earth' && settings.realWeatherMonth > 0;
  if (real && !weatherAvailable) checks.push({ id: 'weather', label: 'Weather', status: 'hold', detail: 'This site has no weather profile. Select manual wind.' });
  else if (real && !weatherLoaded) checks.push({ id: 'weather', label: 'Weather', status: 'caution', detail: 'The weather profile is still loading.' });
  else if (real) checks.push({ id: 'weather', label: 'Weather', status: 'go', detail: 'Modelled weather sets wind and air density.' });
  else if (settings.environment === 'planetary' && mission.planetaryTarget.body === 'Moon') checks.push({ id: 'weather', label: 'Weather', status: 'go', detail: 'Lunar vacuum: no wind.' });
  else checks.push({ id: 'weather', label: 'Weather', status: 'go', detail: `Manual wind, ${settings.windSpeedMs} m/s toward grid east.` });

  if (error) checks.push({ id: 'launch', label: 'Last launch attempt', status: 'hold', detail: error });
  return checks;
}

/** Hold if anything holds, otherwise caution if anything cautions, otherwise go. */
export function overall(checks: Check[]): CheckStatus {
  return checks.some(c => c.status === 'hold') ? 'hold' : checks.some(c => c.status === 'caution') ? 'caution' : 'go';
}
