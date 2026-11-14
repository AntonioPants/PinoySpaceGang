import { useEffect, useState, type ChangeEvent } from 'react';
import { Upload, SlidersHorizontal } from 'lucide-react';
import { targets } from '../data/sites';
import { defaultSettings } from '../lib/mission';
import { downloadJson, parseConditions, parseSettingsFile, type SettingsProposal } from '../lib/importSettings';
import type { MissionSettings } from '../lib/types';
export default function ConditionsImport({ settings, targetId, onApply }: { settings: MissionSettings; targetId: string; onApply: (p: SettingsProposal) => void }) {
  const [text, setText] = useState('Earth, manual, fuel 500 kg, thrust 20 kN, wind 12 m/s');
  const [proposal, setProposal] = useState<SettingsProposal | null>(null), [error, setError] = useState('');
  const [applied, setApplied] = useState(false);
  useEffect(() => { setProposal(null); }, [settings, targetId]);
  function parse(action: () => SettingsProposal) { setError(''); setApplied(false); setProposal(null); try { setProposal(action()); } catch (e) { setError(e instanceof Error ? e.message : 'Could not read settings.'); } }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    setError(''); setProposal(null); setApplied(false);
    if (file.size > 128 * 1024) { setError('Choose a JSON settings file under 128 KB.'); return; }
    if (!file.name.toLowerCase().endsWith('.json')) { setError('Use a .json settings file or an exported mission JSON.'); return; }
    try { const content = await file.text(); parse(() => parseSettingsFile(content, settings)); } catch { setError('Could not read the file. Please try again.'); }
  }
  const previewTarget = targets.find(t => t.id === (proposal?.targetId ?? targetId))!;
  const isVacuum = proposal?.settings.environment === 'planetary' && previewTarget.body === 'Moon';
  return <details className="conditions-import"><summary><SlidersHorizontal size={16} /> Import mission conditions</summary><p>Upload a settings file or enter values below. Review the changes before applying them.</p>
    <div className="import-actions"><label className="subtle-button upload-label"><Upload size={15} /> Upload JSON<input aria-label="Upload mission settings JSON" type="file" accept=".json,application/json" onChange={upload} /></label><button className="text-button" onClick={() => downloadJson({ schemaVersion:'1.0.0', settings:defaultSettings }, 'mission-settings-template.json')}>Get template</button></div>
    <label htmlFor="conditions-text" className="field-help">Describe conditions (comma-separated)</label><textarea id="conditions-text" value={text} onChange={e => { setText(e.target.value); setProposal(null); setApplied(false); setError(''); }} rows={3} />
    <small>Use explicit values: Earth / planetary, manual / autonomous, fuel kg, dry mass kg, thrust N or kN, wind m/s, slope deg, dust %, glare %, lidar / camera / no hazard sensor. Matching is rule-based; files stay on your device.</small>
    <button className="subtle-button" onClick={() => parse(() => parseConditions(text, settings))}>Preview conditions</button>
    {error && <p role="alert" className="import-error">{error}</p>}
    {proposal && <div className="import-preview"><h4>Review changes</h4><p>Target: {previewTarget.name} · {proposal.settings.environment === 'earth' ? 'Earth field test' : `${previewTarget.body} physics`}</p><dl>{Object.entries(proposal.settings).filter(([key]) => proposal.changed.includes(key)).map(([key, value]) => <div key={key}><dt>{({ mode:'Control', environment:'Environment', fuelMassKg:'Fuel (kg)', dryMassKg:'Dry mass (kg)', thrusterForceN:'Thrust (N)', maxSlopeToleranceDeg:'Slope limit (deg)', windSpeedMs:'Requested wind (m/s)', dust:'Dust (0–1)', glare:'Glare (0–1)', hazardSensor:'Hazard sensor', siteConditions:'Dust & glare from site data', realWeatherMonth:'Real weather month (0 = manual wind)', weatherScenario:'Weather scenario' } as Record<string,string>)[key]}</dt><dd>{({ MANUAL_CONTROL: 'Manual', AUTONOMOUS_HAZARD_AVOID: 'Autonomous', earth: 'Earth field test', planetary: 'Planetary physics' } as Record<string,string>)[String(value)] ?? String(value)}</dd></div>)}</dl>{isVacuum && proposal.settings.windSpeedMs > 0 && <p className="amber">Lunar vacuum overrides the requested wind to 0 m/s.</p>}<button className="primary-button" onClick={() => { const patch = Object.fromEntries(Object.entries(proposal.settings).filter(([key]) => proposal.changed.includes(key))); onApply({ ...proposal, settings: { ...settings, ...patch } }); setProposal(null); setApplied(true); }}>Apply conditions</button><button className="text-button" onClick={() => setProposal(null)}>Cancel</button></div>}
    {applied && <p role="status" className="accent-text">Conditions applied. You can still adjust every setting below.</p>}
  </details>;
}
