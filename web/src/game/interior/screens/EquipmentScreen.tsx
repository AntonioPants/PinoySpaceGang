import type { MissionConfig, MissionSettings } from '../../../lib/types';
import { equipmentLoadouts } from '../../equipment';
import { GEAR_PRESETS, GEAR_TUNING, gearFromSettings, gearStats, isGearPreset, withGear, type GearPresetId } from '../../../lib/gear';
import { Segmented, Slider } from './ui';

const GEAR_CHOICES: { value: GearPresetId; label: string }[] = [
  { value: 'standard-four', label: 'Standard 4' }, { value: 'wide-four', label: 'Wide 4' }, { value: 'survey-six', label: 'Survey 6' },
  { value: 'apollo-four', label: 'Apollo 4' }, { value: 'surveyor-three', label: 'Surveyor 3' }, { value: 'change-four', label: "Chang'e 4" },
  { value: 'vikram-four', label: 'Vikram 4' }, { value: 'slim-five', label: 'SLIM 5' }, { value: 'nova-six', label: 'Nova-C 6' }, { value: 'viking-three', label: 'Viking 3' },
];

/**
 * Choose a lander loadout and its landing gear, then trim mass, propellant, thrust and the gear's
 * shock absorbers. The gear figures are computed live from the same model the descent flies.
 * The page must fit its 840 x 490 monitor without scrolling (see interior.css).
 */
export default function EquipmentScreen({ mission, settings, onSettingsChange }: { mission: MissionConfig; settings: MissionSettings; onSettingsChange: (s: MissionSettings) => void }) {
  const set = <K extends keyof MissionSettings>(key: K, value: MissionSettings[K]) => onSettingsChange({ ...settings, [key]: value });
  const gravity = settings.environment === 'earth' ? 9.81 : mission.planetaryTarget.gravity;
  const gear = gearFromSettings(settings), gearId = isGearPreset(settings.landingGearId) ? settings.landingGearId : undefined;
  const mass = settings.dryMassKg + settings.fuelMassKg + (gear?.gearMassKg ?? 0);
  const twr = settings.thrusterForceN / (mass * gravity);
  const stats = gear ? gearStats(gear, gravity) : null;
  const matches = (l: typeof equipmentLoadouts[number]) => Object.entries(l.settings).every(([k, v]) => settings[k as keyof MissionSettings] === v);
  return <>
    <header><h2>Equipment</h2><span className={`mon-readout ${twr < 1 ? 'warn' : ''}`}>Thrust to weight <b>{twr.toFixed(2)}</b></span></header>
    <div className="mon-columns">
      <section>
        <h3>Loadout</h3>
        <div className="mon-cards">{equipmentLoadouts.map(l => <button key={l.id} type="button" aria-pressed={matches(l)} onClick={() => onSettingsChange({ ...settings, ...l.settings })}>
          <strong>{l.name}</strong><span>{l.detail}</span></button>)}</div>
        {gearId && gear && stats ? <>
          <Segmented label={`Landing gear${gear.gearId === 'custom' ? ' · trimmed' : ''}`} value={gearId} options={GEAR_CHOICES} onChange={id => onSettingsChange(withGear(settings, id))} />
          <dl className="mon-stats">
            <div><dt>Absorbs sink rate</dt><dd>{stats.maxSinkMps.toFixed(2)}<small> m/s</small></dd></div>
            <div><dt>Static tip angle</dt><dd>{stats.staticTipDeg.toFixed(1)}<small>°</small></dd></div>
            <div><dt>Holds slope here</dt><dd>{stats.holdsSlopeDeg.toFixed(1)}<small>°</small></dd></div>
            <div><dt>Fuelled mass</dt><dd>{Math.round(mass).toLocaleString()}<small> kg</small></dd></div>
          </dl>
        </> : <p className="mon-note">No landing gear model on this mission: the fixed touchdown limits apply.</p>}
      </section>
      <section>
        <h3>Vehicle{gear ? ` · gear ${gear.legs} legs, ${GEAR_PRESETS[gearId!].gearMassKg} kg` : ''}</h3>
        <Slider label="Propellant" value={settings.fuelMassKg} min={20} max={2000} step={10} unit="kg" onChange={v => set('fuelMassKg', v)} />
        <Slider label="Dry mass" value={settings.dryMassKg} min={100} max={10000} step={50} unit="kg" onChange={v => set('dryMassKg', v)} />
        <Slider label="Maximum thrust" value={settings.thrusterForceN} min={200} max={50000} step={100} unit="N" onChange={v => set('thrusterForceN', v)} />
        {gear && <>
          <Slider label="Gear stroke" value={gear.strokeM} min={GEAR_TUNING.strokeM.min} max={GEAR_TUNING.strokeM.max} step={0.05} unit="m" onChange={v => set('gearStrokeM', Math.round(v * 100) / 100)} />
          <Slider label="Damping (stiff to soft)" value={Math.round(gear.dampingRatio * 100)} min={GEAR_TUNING.dampingRatio.min * 100} max={GEAR_TUNING.dampingRatio.max * 100} step={5} unit="%" onChange={v => set('gearDampingRatio', v / 100)} />
        </>}
      </section>
    </div>
  </>;
}
