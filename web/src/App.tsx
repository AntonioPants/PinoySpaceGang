import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, CircleHelp, Download, ExternalLink, Globe2, Layers3, MapPin, Orbit, Radio, Rocket, Settings2, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import Globe from './components/Globe';
import TerrainChart from './components/TerrainChart';
import Dialog from './components/Dialog';
import TerrainExplorer from './components/TerrainExplorer';
import ConditionsImport from './components/ConditionsImport';
import Descent from './components/Descent';
import FlightReport from './components/FlightReport';
import type { FlightTelemetry } from '../../app/sim/src/types';
import { analogs, normalizeTargetId, targets } from './data/sites';
import { buildMission, defaultSettings, gravityFor, loadProfile, validateSettings } from './lib/mission';
import type { Body, MissionConfig, MissionSettings, TerrainProfile } from './lib/types';

const STORAGE_KEY = 'analog-atlas-draft-v1';
function restoreDraft() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (typeof raw?.targetId === 'string') raw.targetId = normalizeTargetId(raw.targetId);
    if (raw && targets.some(t => t.id === raw.targetId) && raw.settings && validateSettings({ ...defaultSettings, ...raw.settings }).length === 0) {
      return { targetId: raw.targetId as string, analogId: analogs.find(a => a.id === raw.analogId)?.id ?? analogs[0].id, settings: { ...defaultSettings, ...raw.settings } as MissionSettings };
    }
  } catch { /* Browser storage can be disabled; the mission remains usable in memory. */ }
  return { targetId: targets[0].id, analogId: analogs[0].id, settings: defaultSettings };
}
const coord = (value: number, lat = false) => `${Math.abs(value).toFixed(2)}° ${lat ? value < 0 ? 'S' : 'N' : value < 0 ? 'W' : 'E'}`;

export default function App() {
  const [draft] = useState(restoreDraft);
  const [targetId, setTargetId] = useState(draft.targetId);
  const [settings, setSettings] = useState<MissionSettings>(draft.settings);
  const target = targets.find(t => t.id === targetId)!;
  const [step, setStep] = useState(0), [analogId, setAnalogId] = useState(draft.analogId);
  const analog = analogs.find(a => a.id === analogId)!;
  const [loadedProfile, setProfile] = useState<TerrainProfile | null>(null);
  const profile = loadedProfile?.manifest.id === analogId ? loadedProfile : null;
  const [loadError, setLoadError] = useState(''), [retry, setRetry] = useState(0);
  const [dialog, setDialog] = useState<'sources' | 'mission' | null>(null);
  const [mission, setMission] = useState<MissionConfig | null>(null);
  const [saved, setSaved] = useState(false), [storageAvailable, setStorageAvailable] = useState(true);
  const [downloadError, setDownloadError] = useState('');
  const [terrainView, setTerrainView] = useState(false);
  const [flight, setFlight] = useState<FlightTelemetry | null>(null);
  const bodyPoints = useMemo(() => targets.filter(t => t.body === target.body), [target.body]);
  const sortedAnalogs = useMemo(() => [...analogs].sort((a, b) => Number(b.matches.includes(targetId)) - Number(a.matches.includes(targetId))), [targetId]);
  const vacuum = settings.environment === 'planetary' && target.body === 'Moon';
  const gravity = gravityFor(target, settings);
  const twr = settings.thrusterForceN / ((settings.dryMassKg + settings.fuelMassKg) * gravity);
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById('mission-title')?.focus({ preventScroll: true });
  }, [step]);
  useEffect(() => {
    const abort = new AbortController(); setLoadError(''); setProfile(null);
    if (!analog.manifestUrl) return () => abort.abort();
    loadProfile(abort.signal, analog.manifestUrl, analog.id).then(result => { if (!abort.signal.aborted) setProfile(result); }).catch(error => { if (!abort.signal.aborted) setLoadError(error instanceof Error ? error.message : 'Could not load terrain.'); });
    return () => abort.abort();
  }, [retry, analog]);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ targetId, analogId, settings })); setStorageAvailable(true); }
    catch { setStorageAvailable(false); }
    setSaved(false); setFlight(null); setMission(null);
  }, [targetId, analogId, settings]);
  const changeBody = (body: Body) => setTargetId(targets.find(t => t.body === body)!.id);
  const selectAnalog = (id: string) => {
    setAnalogId(id);
    setTerrainView(analogs.some(site => site.id === id && site.available));
  };
  const update = <K extends keyof MissionSettings>(key: K, value: MissionSettings[K]) => setSettings(s => ({ ...s, [key]: value }));
  function reviewMission() {
    if (!profile || !analog.available) return;
    setMission(buildMission(target, profile, settings)); setDialog('mission'); setDownloadError('');
  }
  function downloadMission() {
    if (!mission) return;
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(mission, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `mission-${target.id}.json`;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); setSaved(true);
    } catch { setDownloadError('The browser could not download this file. Try again in a standard browser.'); }
  }
  const terrainStatus = <div className={`data-notice ${loadError ? 'warning' : ''}`} role="status">
    {loadError ? <><span>{loadError}</span><button className="text-button" onClick={() => setRetry(v => v + 1)}>Retry download</button></> : <><span className={`status-dot ${profile ? '' : 'pending'}`} />{profile ? `${analog.name} terrain loaded` : 'Loading terrain pack…'}</>}
  </div>;
  return <>
    <a className="skip-link" href="#mission-main">Skip to mission workspace</a>
    <header className="app-header">
      <a href="#" onClick={e => { e.preventDefault(); setStep(0); }} className="brand" aria-label="Analog Atlas home"><Orbit size={31} strokeWidth={1.4} /><span>analog<span className="brand-light">atlas</span><small>Planetary field lab</small></span></a>
      <div className="header-right"><span className="team-name">Pinoy Space Gang <span>/</span> Mission 001</span><button className="subtle-button" onClick={() => setDialog('sources')}><Layers3 size={16} /> Data & sources</button></div>
    </header>
    <nav className="stepper" aria-label="Mission stages">
      {['Destination', 'Earth analog', 'Configure', 'Descent', 'Report'].map((label, i) => <button key={label} aria-current={step === i ? 'step' : undefined} disabled={(step === 3 && i !== 3) || (i === 3 && (!mission || step !== 3)) || (i === 4 && !flight) || (i === 2 && (!profile || !analog.available))} onClick={() => setStep(i)}>
        <span className="step-number">{step > i ? <Check size={14} /> : String(i + 1).padStart(2, '0')}</span><span>{label}</span>{i < 4 && <ChevronRight className="step-chevron" size={14} />}
      </button>)}
    </nav>
    <main id="mission-main">
      <section className="workspace-heading">
        <div><div className="breadcrumb">Mission workspace <span>/</span> {['Select a destination', 'Explore a testbed', 'Prepare your experiment', 'Fly the descent', 'Review the outcome'][step]}</div>
          <h1 id="mission-title" tabIndex={-1}>{['Select a destination.', 'Find your Earth testbed.', 'Configure the mission.', 'Descent control.', 'Flight report.'][step]}</h1>
          <p>{['Explore the Moon and Mars. Choose a region to test your landing strategy on Earth.', 'Inspect a measured landscape and the evidence behind its proposed pairing.', 'Set the vehicle, controls and environment before launch.', 'Follow the trajectory, manage thrust and monitor the landing.', 'Review the touchdown, inspect telemetry and prepare the next run.'][step]}</p></div>
        <div className="prototype-label"><Radio size={14} /><span>Mission workspace<small>{step === 0 ? 'Moon / Mars / Earth' : `${target.body} → Earth`}</small></span></div>
      </section>
      {step === 0 && <section className="workspace destination-workspace" aria-label="Planetary destination">
        <div className="planet-panel">
          <div className="planet-top"><div className="segmented" aria-label="Planet selection">{(['Moon', 'Mars'] as Body[]).map(body => <button key={body} aria-pressed={target.body === body} onClick={() => changeBody(body)}>{body === 'Moon' ? '◐' : '◉'} {body}</button>)}</div><span className="small-label">{bodyPoints.length} target regions</span></div>
          <Globe body={target.body} points={bodyPoints} selected={targetId} onSelect={setTargetId} />
          <div className="planet-label"><span>Selected planetary body</span><strong>{target.body === 'Moon' ? 'Luna' : 'Mars'}</strong><p>{target.body === 'Moon' ? 'Earth’s natural satellite' : 'Fourth planet from the Sun'}</p></div>
          <div className="planet-scale"><span>Scenario gravity</span><strong>{target.gravity.toFixed(2)} <small>m/s²</small></strong><span>{target.body === 'Moon' ? 'Vacuum environment' : 'Thin atmosphere'}</span></div>
        </div>
        <aside className="selection-panel">
          <div className="section-heading"><h2>Choose your destination</h2><span className="count">{bodyPoints.length}</span></div>
          <div className="target-list">{bodyPoints.map((site, index) => <button key={site.id} className={`target-card ${targetId === site.id ? 'selected' : ''}`} aria-pressed={targetId === site.id} onClick={() => setTargetId(site.id)}>
            <span className="target-index">{String(index + 1).padStart(2, '0')}</span><span><strong>{site.name}</strong><small>{site.region}</small></span><span className="radio-ring">{targetId === site.id && <span />}</span>
          </button>)}</div>
          <div className="site-details"><span className="small-label">Selected target</span><h3>{target.name}</h3><div className="coordinates"><MapPin size={13} />{coord(target.lat, true)} <span>/</span> {coord(target.lon)}</div><p>{target.description}</p><div className="tags">{target.interests.map(tag => <span key={tag}>{tag}</span>)}</div></div>
          <div className="note"><CircleHelp size={17} /><p>Study regions from the shared site catalog. Proposed Earth pairings support comparison; they do not establish landing safety.</p></div>
          <button className="primary-button wide" onClick={() => setStep(1)}>Explore Earth analogs <ArrowRight size={18} /></button>
        </aside>
      </section>}
      {step === 1 && <section className="workspace analog-workspace" aria-label="Earth analog comparison">
        <div className="analog-map-panel">
          <div className="panel-topline"><span><Globe2 size={17} /> Earth testbeds</span><span className="small-label">{analogs.filter(a => a.available).length} terrain packs</span></div>
          <div className="terrain-mode-switch segmented"><button aria-pressed={!terrainView} onClick={()=>setTerrainView(false)}>Earth globe</button><button aria-pressed={terrainView} disabled={!analog.available || !profile} onClick={()=>setTerrainView(true)}>Explore 3D terrain</button></div>
          {terrainView && analog.available && profile ? <TerrainExplorer key={analog.id} profile={profile} /> : <Globe body="Earth" points={analogs} selected={analogId} onSelect={selectAnalog} />}
          {!terrainView && analog.available && profile && <button className="terrain-enter text-button" onClick={()=>setTerrainView(true)}>Explore {analog.name} in 3D <ArrowRight size={14}/></button>}
          <div className="analog-list" aria-label="Earth testbed locations">{sortedAnalogs.map(site => <button key={site.id} className={site.id === analogId ? 'active' : ''} aria-pressed={site.id === analogId} onClick={() => selectAnalog(site.id)}><MapPin size={15} /><span><strong>{site.name}</strong><small>{!site.available ? 'Awaiting data' : site.matches.includes(targetId) ? 'Proposed pairing · Open terrain' : 'Other testbed · Open terrain'}</small></span>{site.id === analogId && <Check size={15} />}</button>)}</div>
        </div>
        <div className="analog-details">
          <div className="pair-label">{target.name} <ArrowRight size={14} /> Earth testbed</div>
          <div className="section-heading"><h2>{analog.name}</h2><span className={`badge ${analog.available ? 'ready' : ''}`}>{analog.available ? 'Terrain available' : 'Candidate'}</span></div>
          <p className="location-line">{analog.region} <span> / </span> {coord(analog.lat, true)}</p><p className="analog-description">{analog.description}</p>
          {analog.available ? <>
            {terrainStatus}
            {profile && <><div className="terrain-stats"><div><strong>{profile.sampleSpacingM}<small> m</small></strong><span>Grid spacing</span></div><div><strong>{(profile.manifest.grid.width_m / 1000).toFixed(1)}<small> km</small></strong><span>Patch width</span></div><div><strong>{profile.manifest.statistics.relief_m.toFixed(0)}<small> m</small></strong><span>Terrain relief</span></div></div><TerrainChart profile={profile} /></>}
            <section className="evidence-panel"><div className="section-heading"><h3><ShieldCheck size={18} /> Why this analog?</h3><span className="badge">Pairing unvalidated</span></div>
              <div className="evidence-row"><span className="evidence-mark">+</span><div><strong>{analog.matches.includes(targetId) ? 'Proposed catalog pairing' : 'Independent terrain experiment'}</strong><p>{analog.matches.includes(targetId) ? `The catalog proposes this terrain for comparison with ${target.name}. The measured surface supports broad-scale terrain experiments.` : `The catalog does not propose this location as a match for ${target.name}. You can still run an explicitly experimental scenario here.`}</p></div></div>
              <div className="evidence-row"><span className="evidence-mark">!</span><div><strong>Limits of this comparison</strong><p>Earth terrain does not reproduce planetary geology, lighting or atmosphere. A 30 m surface cannot resolve footpad-scale rocks, caves or landing hazards.</p></div></div>
              <div className="score-line"><span>Scientific equivalence</span><strong>Not validated</strong></div>
              <button className="text-button" onClick={() => setDialog('sources')}>Inspect evidence & sources <ExternalLink size={13} /></button>
            </section>
          </> : <div className="empty-data"><Layers3 size={26} /><h3>Terrain handoff pending</h3><p>This candidate is listed in the project brief. Choose Kilbourne Hole to configure a mission with real elevation data.</p><button className="subtle-button" onClick={() => selectAnalog(analogs[0].id)}>Use Kilbourne Hole</button></div>}
          <div className="panel-actions"><button className="subtle-button" onClick={() => setStep(0)}><ArrowLeft size={16} /> Destination</button><button className="primary-button" disabled={!analog.available || !profile} onClick={() => setStep(2)}>Configure mission <ArrowRight size={17} /></button></div>
        </div>
      </section>}
      {step === 2 && <section className="workspace configure-workspace" aria-label="Mission configuration">
        <div className="mission-overview"><div className="panel-topline"><span><Rocket size={17} /> Your mission</span><span className="badge ready">Draft</span></div>
          <h2>{target.name}</h2><p className="muted">Planetary target on {target.body}</p><div className="route-connector"><span /><span /><span /></div><h3>{analog.name}</h3><p className="muted">Earth terrain testbed · {analog.region}</p>
          {terrainStatus}{profile && <TerrainChart profile={profile} />}
          <div className="mission-summary"><div><span>Simulation gravity</span><strong>{gravity.toFixed(2)} m/s²</strong></div><div><span>Wet vehicle mass</span><strong>{settings.dryMassKg + settings.fuelMassKg} kg</strong></div><div><span>Initial thrust / weight</span><strong className="accent-text">{twr.toFixed(2)}</strong></div><div><span>Analog fidelity</span><strong>Unvalidated</strong></div></div>
          {twr < 1 && <div className="note warning"><CircleHelp size={18} /><p>Initial thrust is lower than vehicle weight. This configuration cannot initially hover; review thrust and mass.</p></div>}
          <div className="note"><CircleHelp size={18} /><p>These are experiment settings, not measured vehicle specifications. Changing gravity does not make the Earth terrain a planetary observation.</p></div>
          <button className="text-button" onClick={() => setStep(1)}><ArrowLeft size={15} /> Change Earth analog</button>
        </div>
        <div className="config-panel"><div className="section-heading"><h2><SlidersHorizontal size={21} /> Mission configuration</h2><button className="text-button" onClick={() => setSettings({ ...defaultSettings })}>Reset</button></div>
          <ConditionsImport settings={settings} targetId={targetId} onApply={proposal=>{setSettings(proposal.settings);if(proposal.targetId)setTargetId(proposal.targetId);setFlight(null);}} />
          <fieldset><legend>01 <span>Control strategy</span></legend><div className="strategy-options">{([{ mode: 'AUTONOMOUS_HAZARD_AVOID', name: 'Autonomous', detail: 'Hazard-avoidance controller' }, { mode: 'MANUAL_CONTROL', name: 'Manual', detail: 'Pilot-controlled thrust' }] as const).map(item => <button key={item.mode} className={settings.mode === item.mode ? 'selected' : ''} aria-pressed={settings.mode === item.mode} onClick={() => update('mode', item.mode)}>{item.mode === 'MANUAL_CONTROL' ? <Settings2 size={20} /> : <Orbit size={20} />}<strong>{item.name}</strong><small>{item.detail}</small></button>)}</div><p className="field-help">Lidar hazard detection and velocity sensing are enabled.</p></fieldset>
          <fieldset><legend>02 <span>Environment</span></legend><div className="segmented environment"><button aria-pressed={settings.environment === 'planetary'} onClick={() => update('environment', 'planetary')}>{target.body} physics scenario</button><button aria-pressed={settings.environment === 'earth'} onClick={() => update('environment', 'earth')}>Earth field test</button></div><p className="field-help">{vacuum ? 'Lunar gravity and vacuum over Earth terrain. Wind is disabled.' : settings.environment === 'earth' ? 'Earth gravity with user-defined wind. Soil mechanics remain unmeasured.' : 'Mars gravity over Earth terrain, with constant 0.02 kg/m³ atmospheric density.'}</p></fieldset>
          <fieldset><legend>03 <span>Vehicle & landing limits</span></legend><div className="slider-grid">
            <Slider label="Propellant mass" value={settings.fuelMassKg} min={50} max={2000} step={50} unit="kg" onChange={v => update('fuelMassKg', v)} />
            <Slider label="Dry vehicle mass" value={settings.dryMassKg} min={100} max={5000} step={100} unit="kg" onChange={v => update('dryMassKg', v)} />
            <Slider label="Maximum thrust" value={settings.thrusterForceN} min={1000} max={50000} step={500} unit="N" onChange={v => update('thrusterForceN', v)} />
            <Slider label="Slope tolerance" value={settings.maxSlopeToleranceDeg} min={1} max={30} step={1} unit="°" onChange={v => update('maxSlopeToleranceDeg', v)} />
            <Slider label="Crosswind" value={vacuum ? 0 : settings.windSpeedMs} min={0} max={30} step={1} unit="m/s" disabled={vacuum} onChange={v => update('windSpeedMs', v)} />
          <Slider label="Dust interference" value={Math.round(settings.dust*100)} min={0} max={100} step={5} unit="%" onChange={v => update('dust', v/100)} />
            <Slider label="Glare interference" value={Math.round(settings.glare*100)} min={0} max={100} step={5} unit="%" onChange={v => update('glare', v/100)} />
          </div></fieldset>
          <div className="config-footer"><span><span className="status-dot" />{storageAvailable ? 'Draft saved on this device' : 'Draft held in this session'}</span><button className="primary-button" disabled={!profile || validateSettings(settings).length > 0} onClick={reviewMission}>Review mission <ArrowRight size={17} /></button></div>
        </div>
      </section>}
      {step === 3 && mission && profile && <Descent mission={mission} profile={profile} onExit={()=>setStep(2)} onReport={report=>{setFlight(report);setStep(4);}} />}
      {step === 4 && flight && mission && <FlightReport flight={flight} mission={mission} onRetry={()=>setStep(2)} />}
      <footer className="workspace-footer"><span><span className="status-dot" /> {step === 0 ? 'Explore first. Validate with evidence.' : 'Real terrain. Explicit assumptions.'}</span><span>Earth data: Copernicus DEM <span className="footer-separator">/</span> <button className="text-button" onClick={() => setDialog('sources')}>Credits & limitations</button></span></footer>
    </main>
    {dialog === 'sources' && <Dialog title="Data, evidence & limitations" onClose={() => setDialog(null)}><div className="source-content">
      <h3>Earth terrain</h3><p>{profile?.manifest.source.dataset ?? 'Copernicus DEM GLO-30 Public'} · {analog.name}. A real terrain surface at 30 m grid spacing; not a validated match to the selected planetary site.</p>
      {profile && <><a href={profile.manifest.source.catalog} target="_blank" rel="noreferrer">Terrain data source <ExternalLink size={14} /></a><h3>Analog evidence</h3>{(profile.manifest.analog?.sources ?? (analog.source ? [analog.source] : [])).map((url, i) => <a key={url} href={url} target="_blank" rel="noreferrer">{analog.name}: reference {i + 1} <ExternalLink size={14} /></a>)}<h3>What this pack cannot establish</h3><ul>{profile.manifest.limitations.map(item => <li key={item}>{item}</li>)}</ul><p className="attribution">{profile.manifest.attribution}</p></>}
      {!profile && <p>Terrain metadata is unavailable. Load the terrain pack to inspect its full attribution and limitations.</p>}
      <h3>Planetary targets & globe imagery</h3><p>Target coordinates and proposed pairings come from the shared catalog. This journey simulates planetary conditions over Earth terrain; the catalog’s planetary DEMs and numerical terrain comparisons are not displayed here as validated equivalence.</p><a href={target.source} target="_blank" rel="noreferrer">Evidence for {target.name} <ExternalLink size={14} /></a><p>Moon and Earth reference textures: Three.js example assets. Mars surface: procedural illustration. Globes are navigation aids, not measurement surfaces. Interface typeface: IBM Plex Sans, SIL Open Font License.</p><a href="https://github.com/mrdoob/three.js/tree/dev/examples/textures/planets" target="_blank" rel="noreferrer">Globe texture source <ExternalLink size={14} /></a><a href="/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf" target="_blank" rel="noreferrer">Terrain licence <ExternalLink size={14} /></a>
    </div></Dialog>}
    {dialog === 'mission' && mission && <Dialog title="Review your mission" onClose={() => setDialog(null)}><div className="source-content"><div className="review-icon"><Rocket size={28} /></div><p><strong>{target.name}</strong> scenario on the <strong>{analog.name}</strong> terrain.</p><div className="mission-summary"><div><span>Control</span><strong>{settings.mode === 'MANUAL_CONTROL' ? 'Manual' : 'Autonomous'}</strong></div><div><span>Environment</span><strong>{settings.environment === 'earth' ? 'Earth field test' : `${target.body} physics scenario`}</strong></div><div><span>Terrain grid</span><strong>{profile?.manifest.grid.rows} × {profile?.manifest.grid.columns} at {mission.earthAnalog.sampleSpacingM} m</strong></div></div><div className="note"><CircleHelp size={18} /><p>The descent starts 1,000 m above ground with experimental vehicle settings. Review the model assumptions in descent control before launch.</p></div><button className="primary-button wide launch-mission" onClick={()=>{setFlight(null);setDialog(null);setStep(3);}}>Continue to descent <Rocket size={17}/></button><button className="subtle-button wide" onClick={downloadMission}><Download size={17} /> {saved ? 'Download mission again' : 'Download mission JSON'}</button>{saved && <p role="status" className="accent-text">Mission JSON prepared for download.</p>}{downloadError && <p role="alert">{downloadError}</p>}</div></Dialog>}
  </>;
}
function Slider({ label, value, min, max, step, unit, disabled, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; disabled?: boolean; onChange: (n: number) => void }) {
  const id = label.toLowerCase().replaceAll(' ', '-');
  return <div className={`slider-field ${disabled ? 'disabled' : ''}`}><label htmlFor={id}>{label}<output htmlFor={id}>{value.toLocaleString()} <span>{unit}</span></output></label><input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={e => onChange(Number(e.target.value))} /><div className="range-labels"><span>{min.toLocaleString()} {unit}</span><span>{max.toLocaleString()} {unit}</span></div></div>;
}
