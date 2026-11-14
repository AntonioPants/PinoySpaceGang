import type { MissionSettings } from '../../../lib/types';
import EquipmentPicker from '../../EquipmentPicker';

/** Choose the lander loadout and read its manifest. */
export default function EquipmentScreen({ settings, onSettingsChange }: { settings: MissionSettings; onSettingsChange: (s: MissionSettings) => void }) {
  return <>
    <header><h2>Equipment</h2><span className="monitor-tag">{(settings.dryMassKg + settings.fuelMassKg).toLocaleString()} kg fuelled</span></header>
    <EquipmentPicker settings={settings} onChange={onSettingsChange} />
    <dl className="monitor-facts">
      <div><dt>Dry mass</dt><dd>{settings.dryMassKg.toLocaleString()} kg</dd></div>
      <div><dt>Propellant</dt><dd>{settings.fuelMassKg.toLocaleString()} kg</dd></div>
      <div><dt>Maximum thrust</dt><dd>{settings.thrusterForceN.toLocaleString()} N</dd></div>
      <div><dt>Slope limit</dt><dd>{settings.maxSlopeToleranceDeg}°</dd></div>
      <div><dt>Hazard sensor</dt><dd>{settings.hazardSensor === 'none' ? 'None' : settings.hazardSensor === 'lidar' ? 'Lidar' : 'Camera'}</dd></div>
    </dl>
  </>;
}
