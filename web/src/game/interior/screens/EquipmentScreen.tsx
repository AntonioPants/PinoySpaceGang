import type { MissionConfig, MissionSettings } from '../../../lib/types';
import { equipmentLoadouts } from '../../equipment';
import { landingGear } from '../../opening/equipmentCatalog';
import { Slider } from './ui';

/** Choose a lander loadout, then trim its mass, propellant and thrust. */
export default function EquipmentScreen({ mission, settings, onSettingsChange }: { mission: MissionConfig; settings: MissionSettings; onSettingsChange: (s: MissionSettings) => void }) {
  const set = <K extends keyof MissionSettings>(key: K, value: MissionSettings[K]) => onSettingsChange({ ...settings, [key]: value });
  const gravity = settings.environment === 'earth' ? 9.81 : mission.planetaryTarget.gravity;
  const twr = settings.thrusterForceN / ((settings.dryMassKg + settings.fuelMassKg) * gravity);
  const gear = landingGear.find(g => g.id === mission.equipment?.landingGearId);
  const matches = (l: typeof equipmentLoadouts[number]) => Object.entries(l.settings).every(([k, v]) => settings[k as keyof MissionSettings] === v);
  return <>
    <header><h2>Equipment</h2><span className={`mon-readout ${twr < 1 ? 'warn' : ''}`}>Thrust to weight <b>{twr.toFixed(2)}</b></span></header>
    <div className="mon-columns">
      <section>
        <h3>Loadout</h3>
        <div className="mon-cards">{equipmentLoadouts.map(l => <button key={l.id} type="button" aria-pressed={matches(l)} onClick={() => onSettingsChange({ ...settings, ...l.settings })}>
          <strong>{l.name}</strong><span>{l.detail}</span></button>)}</div>
        <p className="mon-note">Presets for the simulation, not specifications of real spacecraft. A loadout also sets the hazard sensor.</p>
        <dl className="mon-facts compact"><div><dt>Fuelled mass</dt><dd>{(settings.dryMassKg + settings.fuelMassKg).toLocaleString()} kg</dd></div>
          <div><dt>Hazard sensor</dt><dd>{settings.hazardSensor === 'none' ? 'None' : settings.hazardSensor === 'lidar' ? 'Lidar' : 'Camera'}</dd></div>
          {gear && <div><dt>Landing gear</dt><dd>{gear.name}<small>Chosen in the equipment bay. Shown only; not yet in the physics.</small></dd></div>}</dl>
      </section>
      <section>
        <h3>Vehicle</h3>
        <Slider label="Propellant" value={settings.fuelMassKg} min={50} max={2000} step={50} unit="kg" onChange={v => set('fuelMassKg', v)} />
        <Slider label="Dry mass" value={settings.dryMassKg} min={100} max={5000} step={100} unit="kg" onChange={v => set('dryMassKg', v)} />
        <Slider label="Maximum thrust" value={settings.thrusterForceN} min={1000} max={50000} step={500} unit="N" onChange={v => set('thrusterForceN', v)} />
        <Slider label="Slope limit" value={settings.maxSlopeToleranceDeg} min={1} max={30} step={1} unit="°" onChange={v => set('maxSlopeToleranceDeg', v)} />
      </section>
    </div>
  </>;
}
