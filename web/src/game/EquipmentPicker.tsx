import type { MissionSettings } from '../lib/types';
import { equipmentLoadouts } from './equipment';
export default function EquipmentPicker({ settings, onChange }: { settings: MissionSettings; onChange: (settings: MissionSettings) => void }) {
  return <section className="equipment-picker" aria-label="Equipment loadout"><h3>Select equipment</h3><p className="field-help">Editable simulation presets, not specifications of real spacecraft.</p><div className="strategy-options">
    {equipmentLoadouts.map(loadout => <button key={loadout.id} className={Object.entries(loadout.settings).every(([k,v]) => settings[k as keyof MissionSettings] === v) ? 'selected' : ''} aria-pressed={Object.entries(loadout.settings).every(([k,v]) => settings[k as keyof MissionSettings] === v)} onClick={() => onChange({ ...settings, ...loadout.settings })}><strong>{loadout.name}</strong><small>{loadout.detail}</small></button>)}
  </div></section>;
}
