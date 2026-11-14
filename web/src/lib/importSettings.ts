import { normalizeTargetId, targets } from '../data/sites';
import { validateSettings } from './mission';
import type { MissionSettings } from './types';
export interface SettingsProposal { settings: MissionSettings; targetId?: string; changed: string[] }
const fields = ['mode', 'environment', 'fuelMassKg', 'dryMassKg', 'thrusterForceN', 'maxSlopeToleranceDeg', 'windSpeedMs', 'dust', 'glare', 'hazardSensor', 'siteConditions', 'realWeatherMonth', 'weatherScenario'] as const;
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function proposal(patch: Record<string, unknown>, current: MissionSettings, targetId?: unknown): SettingsProposal {
  if (typeof targetId === 'string') targetId = normalizeTargetId(targetId);
  if (!Object.keys(patch).length && !targetId) throw new Error('No supported mission settings found.');
  const unknown = Object.keys(patch).filter(k => !fields.includes(k as typeof fields[number]));
  if (unknown.length) throw new Error(`Unknown settings: ${unknown.join(', ')}. Use the downloadable template.`);
  if (targetId !== undefined && !targets.some(t => t.id === targetId)) throw new Error('Unknown planetary target ID.');
  const settings = { ...current, ...patch } as MissionSettings;
  const errors = validateSettings(settings); if (errors.length) throw new Error(errors.join(' '));
  return { settings, targetId: targetId as string | undefined, changed: [...Object.keys(patch), ...(targetId ? ['targetId'] : [])] };
}
export function parseSettingsFile(text: string, current: MissionSettings): SettingsProposal {
  const data: unknown = JSON.parse(text);
  if (!obj(data)) throw new Error('Expected a JSON object.');
  if (data.schemaVersion !== undefined && data.schemaVersion !== '1.0.0') throw new Error('Unsupported schemaVersion. Expected 1.0.0.');
  if (obj(data.strategy) && obj(data.environment)) {
    const patch: Record<string, unknown> = { ...data.strategy, environment: data.environment.mode, windSpeedMs: data.environment.windSpeedMs };
    if (data.environment.dust !== undefined) patch.dust = data.environment.dust;
    if (data.environment.glare !== undefined) patch.glare = data.environment.glare;
    if (data.environment.interferenceSource !== undefined) patch.siteConditions = data.environment.interferenceSource === 'site';
    if (obj(data.environment.realWeather)) { patch.realWeatherMonth = data.environment.realWeather.month; patch.weatherScenario = data.environment.realWeather.scenario; }
    else if (data.environment.realWeather === null) patch.realWeatherMonth = 0;
    return proposal(patch, current, obj(data.planetaryTarget) ? data.planetaryTarget.id : undefined);
  }
  if (obj(data.settings)) {
    const extras = Object.keys(data).filter(k => !['schemaVersion','settings','targetId'].includes(k));
    if (extras.length) throw new Error(`Unknown fields: ${extras.join(', ')}.`);
    return proposal(data.settings, current, data.targetId);
  }
  const { schemaVersion: _version, targetId, ...patch } = data;
  return proposal(patch, current, targetId);
}
/** Deliberately narrow local parser: every comma-separated clause must be understood. No AI claims. */
export function parseConditions(text: string, current: MissionSettings): SettingsProposal {
  const patch: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => { if (key in patch) throw new Error(`Repeated condition: ${key}. Please give one value.`); patch[key] = value; };
  const number = '(-?\\d+(?:\\.\\d+)?)';
  for (const raw of text.split(/[,;\n]+/).filter(s => s.trim())) {
    const clause = raw.trim().toLowerCase().replace(/\s+/g, ' ');
    if (/^(earth|earth field test)$/.test(clause)) { set('environment', 'earth'); continue; }
    if (/^(planetary|planetary physics)$/.test(clause)) { set('environment', 'planetary'); continue; }
    if (/^(lidar|camera|no hazard sensor)$/.test(clause)) { set('hazardSensor', clause === 'no hazard sensor' ? 'none' : clause); continue; }
    if (/^(manual|autonomous)$/.test(clause)) { set('mode', clause === 'manual' ? 'MANUAL_CONTROL' : 'AUTONOMOUS_HAZARD_AVOID'); continue; }
    const specs = [
      ['fuelMassKg', `^(?:fuel|propellant)(?: mass)?(?: is| of)?[ :=]*${number} kg$`, 1],
      ['dryMassKg', `^dry mass(?: is| of)?[ :=]*${number} kg$`, 1],
      ['thrusterForceN', `^(?:maximum )?thrust(?: is| of)?[ :=]*${number} kn$`, 1000],
      ['thrusterForceN', `^(?:maximum )?thrust(?: is| of)?[ :=]*${number} n$`, 1],
      ['windSpeedMs', `^(?:cross)?wind(?: is| of)?[ :=]*${number} m/s$`, 1],
      ['maxSlopeToleranceDeg', `^slope(?: tolerance)?[ :=]*${number} (?:deg|degrees|°)$`, 1],
      ['dust', `^dust[ :=]*${number}\\s*%$`, 0.01],
      ['glare', `^glare[ :=]*${number}\\s*%$`, 0.01],
    ] as const;
    let matched = false;
    for (const [key, expression, factor] of specs) {
      const match = clause.match(new RegExp(expression));
      if (match) { set(key, Number(match[1]) * factor); matched = true; break; }
    }
    // An explicit dust or glare value means manual interference.
    if (matched && (('dust' in patch) || ('glare' in patch))) patch.siteConditions = false;
    if (!matched) throw new Error(`Could not interpret “${raw.trim()}”. Use explicit values and units like “wind 12 m/s”. Nothing has been applied.`);
  }
  return proposal(patch, current);
}
export function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
