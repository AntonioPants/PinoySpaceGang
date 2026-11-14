import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, CircleHelp, Download, ExternalLink, Globe2, Layers3, MapPin, Orbit, Radio, Rocket, Settings2, SlidersHorizontal } from 'lucide-react';
import Globe from './components/Globe';
import TerrainChart from './components/TerrainChart';
import Dialog from './components/Dialog';
import TerrainExplorer from './components/TerrainExplorer';
import ConditionsImport from './components/ConditionsImport';
import EquipmentPicker from './game/EquipmentPicker';
import AnalogComparison from './components/AnalogComparison';
import type { FlightTelemetry } from '../../app/sim/src/types';
import { recommendedAnalogs, loadCatalog, pairingOf, type Catalog } from './lib/catalog';
import { hiddenBelowCutoff, percent } from './lib/matching';
import { normalizeTargetId } from './data/sites';
import { hasWeatherProfile, loadWeatherProfile } from './lib/weather';
import type { EnvironmentProfile } from '../../app/lib/environment.mjs';
import { buildMission, defaultSettings, gravityFor, loadProfile, validateSettings } from './lib/mission';
import type { Body, MissionConfig, MissionSettings, TerrainProfile } from './lib/types';

const STORAGE_KEY = 'analog-atlas-draft-v1';
const OpeningGame = lazy(() => import('./game/opening/OpeningGame'));
const GameSession = lazy(() => import('./game/GameSession'));
const FlightReport = lazy(() => import('./components/FlightReport'));
const FlightReportNHB = lazy(() => import('./components/FlightReportNHB'));
const MoonGlobe = lazy(() => import('./components/MoonGlobe'));
function restoreDraft(catalog: Catalog) {
  const { targets } = catalog;
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (typeof raw?.targetId === 'string') raw.targetId = normalizeTargetId(raw.targetId);
    if (raw && targets.some(t => t.id === raw.targetId) && raw.settings && validateSettings({ ...defaultSettings, ...raw.settings }).length === 0) {
      const analogId = recommendedAnalogs(catalog,raw.targetId).find(s => s.id === raw.analogId)?.id;
      return { targetId: raw.targetId as string, analogId, settings: { ...defaultSettings, ...raw.settings } as MissionSettings };
    }
  } catch { /* Browser storage can be disabled; the mission remains usable in memory. */ }
  return { targetId: targets[0].id, analogId: undefined, settings: defaultSettings };
}
const coord = (value: number, lat = false) => `${Math.abs(value).toFixed(2)}° ${lat ? value < 0 ? 'S' : 'N' : value < 0 ? 'W' : 'E'}`;

/** Loads the data team's site catalog, then opens the mission workspace on it. */
export default function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController(); setError('');
    loadCatalog(abort.signal).then(setCatalog).catch(e => { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load the site catalog.'); });
    return () => abort.abort();
  }, [attempt]);
  if (!catalog) return <main className="main-shell" id="mission-main"><div className={`data-notice ${error ? 'warning' : ''}`} role="status">
    {error ? <><span>{error}</span><button className="text-button" onClick={() => setAttempt(v => v + 1)}>Retry</button></> : <><span className="status-dot pending" />Loading site catalog…</>}
  </div></main>;
  return new URLSearchParams(location.search).has('engineering-planner') ? <Mission catalog={catalog} /> : <Suspense fallback={<p role="status">Preparing mission worlds…</p>}><OpeningGame catalog={catalog}/></Suspense>;
}

function Mission({ catalog }: { catalog: Catalog }) {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  const targets = catalog.targets;
  const [draft] = useState(() => restoreDraft(catalog));
  const [targetId, setTargetId] = useState(draft.targetId);
  const [settings, setSettings] = useState<MissionSettings>(draft.settings);
  const target = targets.find(t => t.id === targetId)!;
  const choices = useMemo(() => recommendedAnalogs(catalog, targetId), [catalog, targetId]);
  const [selection, setSelection] = useState({ targetId: draft.targetId, analogId: draft.analogId });
  const analog = choices.find(s => selection.targetId === targetId && s.id === selection.analogId)
    ?? choices[0] ?? catalog.analogs[0];
  const analogId = analog.id;
  const [step, setStep] = useState(0);
  const pairing = pairingOf(catalog, targetId, analog.id);
  const weatherAvailable = hasWeatherProfile(analog.id);
  const [loadedWeather, setWeather] = useState<{ siteId: string; data: EnvironmentProfile } | null>(null), [weatherError, setWeatherError] = useState('');
  const weather = loadedWeather?.siteId === analog.id ? loadedWeather.data : null;
  useEffect(() => {
    const abort = new AbortController(); setWeather(null); setWeatherError('');
    if (!weatherAvailable) return;
    loadWeatherProfile(analog.id, abort.signal).then(data => { if (!abort.signal.aborted) setWeather({ siteId: analog.id, data }); }).catch(error => { if (!abort.signal.aborted) setWeatherError(error instanceof Error ? error.message : 'Could not load weather.'); });
    return () => abort.abort();
  }, [analog.id, weatherAvailable]);
  const realWeather = settings.environment === 'earth' && settings.realWeatherMonth > 0 && weatherAvailable;
  const weatherHour = realWeather && weather ? weather.months[String(settings.realWeatherMonth)]?.scenarios[settings.weatherScenario] : null;
  const [loadedProfile, setProfile] = useState<TerrainProfile | null>(null);
  const profile = loadedProfile?.manifest.id === analog.id ? loadedProfile : null;
  const [loadError, setLoadError] = useState(''), [retry, setRetry] = useState(0);
  const [dialog, setDialog] = useState<'sources' | 'mission' | null>(null);
  const [mission, setMission] = useState<MissionConfig | null>(null);
  const [saved, setSaved] = useState(false), [storageAvailable, setStorageAvailable] = useState(true);
  const [downloadError, setDownloadError] = useState('');
  const [terrainView, setTerrainView] = useState(false);
  const selectAnalog = (id: string) => {
    if (!choices.some(s => s.id === id)) return;
    setSelection({targetId, analogId: id}); setTerrainView(false);
  };
  const [flight, setFlight] = useState<FlightTelemetry | null>(null);
  const [flightSettings, setFlightSettings] = useState<MissionSettings>(draft.settings);
  // Design trial: ?style=nhb opens the report in the 1976 manual style (docs/DESIGN_FRAMEWORK.md).
  const [reportStyle, setReportStyle] = useState<'standard' | 'nhb'>(() => new URLSearchParams(location.search).get('style') === 'nhb' ? 'nhb' : 'standard');
  const bodyPoints = useMemo(() => targets.filter(t => t.body === target.body), [target.body]);
  const vacuum = settings.environment === 'planetary' && target.body === 'Moon';
  const gravity = gravityFor(target, settings);
  const twr = settings.thrusterForceN / ((settings.dryMassKg + settings.fuelMassKg) * gravity);
  useEffect(() => {
    const abort = new AbortController(); setLoadError(''); setProfile(null);
    if (!analog.terrainBase) return;
    loadProfile(abort.signal, analog.terrainBase, analog.id).then(result => { if (!abort.signal.aborted) setProfile(result); }).catch(error => { if (!abort.signal.aborted) setLoadError(error instanceof Error ? error.message : 'Could not load terrain.'); });
    return () => abort.abort();
  }, [retry, analog.terrainBase, analog.id]);
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById('mission-title')?.focus({ preventScroll: true });
  }, [step, reportStyle]);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ targetId, analogId, settings })); setStorageAvailable(true); }
    catch { setStorageAvailable(false); }
    setSaved(false); setFlight(null); setMission(null);
  }, [targetId, settings, analogId]);
  const changeBody = (body: Body) => setTargetId(targets.find(t => t.body === body)!.id);
  const update = <K extends keyof MissionSettings>(key: K, value: MissionSettings[K]) => setSettings(s => ({ ...s, [key]: value }));
  function reviewMission() {
    if (!profile || !analog.available) return;
    setMission(buildMission(target, profile, settings, { terrainBase: analog.terrainBase, analogName: analog.name, terrainScore: pairing?.terrain_score, weatherAvailable })); setDialog('mission'); setDownloadError('');
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
  if (step === 4 && flight && mission && profile && reportStyle === 'nhb') return <Suspense fallback={<p role="status">Preparing alternate report...</p>}><FlightReportNHB match={catalog.matching?.comparisons.find(p => p.planetary_id === target.id && p.earth_id === analog.id)} flight={flight} mission={mission} profile={profile} analogEntry={catalog.entries.get(analog.id)} planetaryEntry={catalog.entries.get(target.id)} onRetry={() => {setSettings(flightSettings);setReportStyle('standard');setStep(2);}} onStandardView={() => setReportStyle('standard')} /></Suspense>;
  return <>
    <a className="skip-link" href="#mission-main">Skip to mission workspace</a>
    <header className="app-header">
      <a href="?moon">Explore lunar terrain</a><span className="connection-status" role="status">{online ? 'Online' : 'Offline'}</span>
      <a href="#" onClick={e => { e.preventDefault(); setStep(0); }} className="brand" aria-label="Analog Atlas home"><Orbit size={31} strokeWidth={1.4} /><span>analog<span className="brand-light">atlas</span><small>Planetary flight simulator</small></span></a>
      <div className="header-right"><span className="team-name">Pinoy Space Gang <span>/</span> Mission 001</span><button className="subtle-button" onClick={() => setDialog('sources')}><Layers3 size={16} /> Data & sources</button></div>
    </header>
    <nav className="stepper" aria-label="Mission stages">
      {['Destination', 'Earth analog', 'Equipment', 'Mission', 'Debrief'].map((label, i) => <button key={label} aria-current={step === i ? 'step' : undefined} disabled={(step === 3 && i !== 3) || (i === 3 && (!mission || step !== 3)) || (i === 4 && !flight) || (i === 2 && (!profile || !analog.available))} onClick={() => { if (step === 4 && i < 3) setSettings(flightSettings); setStep(i); }}>
        <span className="step-number">{step > i ? <Check size={14} /> : String(i + 1).padStart(2, '0')}</span><span>{label}</span>{i < 4 && <ChevronRight className="step-chevron" size={14} />}
      </button>)}
    </nav>
    <main id="mission-main">
      <section className="workspace-heading">
        <div><div className="breadcrumb">Mission workspace <span>/</span> {['Select a destination', 'Explore a testbed', 'Prepare your experiment', 'Fly the descent', 'Review the outcome'][step]}</div>
          <h1 id="mission-title" tabIndex={-1}>{['Select a destination.', 'Choose your Earth testbed.', 'Prepare your equipment.', 'Mission control.', 'Flight debrief.'][step]}</h1>
          <p>{['Explore the Moon and Mars. Choose a region to test your landing strategy on Earth.', 'Compare up to ten Earth locations and choose one for your mission.', 'Choose a loadout and initial conditions. Fine-tune the experiment from the ship systems console.', 'Prepare aboard your ship, launch the mission and follow the Earth descent.', 'Review the touchdown, inspect telemetry and prepare the next run.'][step]}</p></div>
        <div className="prototype-label"><Radio size={14} /><span>Mission workspace<small>{step === 0 ? 'Moon / Mars / Earth' : `${target.body} → Earth`}</small></span></div>
      </section>
      {step === 0 && <section className="workspace destination-workspace" aria-label="Planetary destination">
        <div className="planet-panel">
          <div className="planet-top"><div className="segmented" aria-label="Planet selection">{(['Moon', 'Mars'] as Body[]).map(body => <button key={body} aria-pressed={target.body === body} onClick={() => changeBody(body)}>{body === 'Moon' ? '◐' : '◉'} {body}</button>)}</div><span className="small-label">{bodyPoints.length} target regions</span></div>
          {<Suspense fallback={<Globe body="Moon" points={bodyPoints} selected={targetId} onSelect={setTargetId} />}><MoonGlobe key={target.body} body={target.body === 'Mars' ? 'Mars' : 'Moon'} points={bodyPoints} selected={targetId} onSelect={setTargetId} /></Suspense>}
          <div className="planet-label"><span>Selected planetary body</span><strong>{target.body === 'Moon' ? 'Luna' : 'Mars'}</strong><p>{target.body === 'Moon' ? 'Earth’s natural satellite' : 'Fourth planet from the Sun'}</p></div>
          <div className="planet-scale"><span>Scenario gravity</span><strong>{target.gravity.toFixed(2)} <small>m/s²</small></strong><span>{target.body === 'Moon' ? 'Vacuum environment' : 'Thin atmosphere'}</span></div>
        </div>
        <aside className="selection-panel">
          <div className="section-heading"><h2>Choose your destination</h2><span className="count">{bodyPoints.length}</span></div>
          <div className="target-list">{bodyPoints.map((site, index) => <button key={site.id} className={`target-card ${targetId === site.id ? 'selected' : ''}`} aria-pressed={targetId === site.id} onClick={() => setTargetId(site.id)}>
            <span className="target-index">{String(index + 1).padStart(2, '0')}</span><span><strong>{site.name}</strong><small>{site.region}</small></span><span className="radio-ring">{targetId === site.id && <span />}</span>
          </button>)}</div>
          <div className="site-details"><span className="small-label">Selected target</span><h3>{target.name}</h3><div className="coordinates"><MapPin size={13} />{coord(target.lat, true)} <span>/</span> {coord(target.lon)}</div><p>{target.description}</p><div className="tags">{target.interests.map(tag => <span key={tag}>{tag}</span>)}</div></div>
          <div className="note"><CircleHelp size={17} /><p>Targets are study areas from the team’s site catalog, not approved landing sites. Planetary terrain is coarse (150–500 m per sample).</p></div>
          <button className="primary-button wide" disabled={!choices.length} onClick={() => setStep(1)}>Compare Earth locations <ArrowRight size={18} /></button>
          {!choices.length && <p role="status">No Earth candidates with verified terrain inputs are available for this target.</p>}
        </aside>
      </section>}
      {step === 1 && <section className="workspace analog-workspace" aria-label="Earth analog comparison">
        <div className="analog-map-panel">
          <div className="panel-topline"><span><Globe2 size={17} /> Earth testbeds</span><span className="small-label">{choices.length} candidates</span></div>
          <div className="terrain-mode-switch segmented"><button aria-pressed={!terrainView} onClick={()=>setTerrainView(false)}>Earth globe</button><button aria-pressed={terrainView} disabled={!analog.available || !profile} onClick={()=>setTerrainView(true)}>Explore 3D terrain</button></div>
          {terrainView && analog.available && profile ? <TerrainExplorer profile={profile} /> : <Globe body="Earth" points={choices} selected={analogId} onSelect={selectAnalog} />}
          <div className="analog-list" role="group" aria-label="Earth location candidates">
            {choices.map((site,index) => {
              const match = catalog.matching?.comparisons.find(p => p.planetary_id === targetId && p.earth_id === site.id);
              return <button key={site.id} className={site.id === analogId ? 'active' : ''} aria-pressed={site.id === analogId} onClick={() => selectAnalog(site.id)}>
                <span>{index+1}</span><span><strong>{site.name}</strong><small>{site.region}</small>
                  <small>Match {percent(match?.analog_score_percent)} · Terrain {percent(match?.terrain_similarity_percent)}</small>
                </span>{site.id === analogId && <Check size={15}/>}</button>;
            })}
          </div>
          <p className="field-help">Research-backed pairings first, then highest match (landform type plus terrain shape).{(h => h && h.count > 0 ? ` ${h.count} other location${h.count === 1 ? ' is' : 's are'} hidden because the match is below ${h.cutoff}%.` : '')(hiddenBelowCutoff(catalog.matching, targetId))} Scores are not validated accuracy.</p>
          {!terrainView && analog.available && profile && <button className="terrain-enter text-button" onClick={()=>setTerrainView(true)}>Zoom into {analog.name}’s measured terrain <ArrowRight size={14}/></button>}
        </div>
        <div className="analog-details">
          <div className="pair-label">{target.name} <ArrowRight size={14} /> Earth testbed</div>
          <div className="section-heading"><h2>{analog.name}</h2><span className={`badge ${analog.available ? 'mint' : ''}`}>{!analog.available ? 'Unavailable' : 'Selected'}</span></div>
          <p className="location-line">{analog.region} <span> / </span> {coord(analog.lat, true)}</p><p className="analog-description">{analog.description}</p>
          <AnalogComparison catalog={catalog} targetId={targetId} earthId={analog.id} />
          {analog.available ? <>
            {terrainStatus}
            {profile && <><div className="terrain-stats"><div><strong>{profile.sampleSpacingM}<small> m</small></strong><span>Grid spacing</span></div><div><strong>{((profile.manifest.grid.columns - 1) * profile.sampleSpacingM / 1000).toFixed(1)}<small> km</small></strong><span>Patch width</span></div><div><strong>{(profile.manifest.statistics?.relief_m ?? analog.reliefM)?.toFixed(0) ?? '–'}<small> m</small></strong><span>Terrain relief</span></div></div><TerrainChart profile={profile} /></>}

          </> : <div className="empty-data"><Layers3 size={26} /><h3>Terrain handoff pending</h3><p>No usable terrain is available for this recommendation yet.</p></div>}
          <div className="panel-actions"><button className="subtle-button" onClick={() => setStep(0)}><ArrowLeft size={16} /> Destination</button><button className="primary-button" disabled={!analog.available || !profile} onClick={() => setStep(2)}>Configure mission <ArrowRight size={17} /></button></div>
        </div>
      </section>}
      {step === 2 && <section className="workspace configure-workspace" aria-label="Mission configuration">
        <div className="mission-overview"><div className="panel-topline"><span><Rocket size={17} /> Your mission</span><span className="badge mint">Draft</span></div>
          <h2>{target.name}</h2><p className="muted">Planetary target on {target.body}</p><div className="route-connector"><span /><span /><span /></div><h3>{analog.name}</h3><p className="muted">Earth terrain testbed · {analog.region}</p>
          {terrainStatus}{profile && <TerrainChart profile={profile} />}
          <div className="mission-summary"><div><span>Simulation gravity</span><strong>{gravity.toFixed(2)} m/s²</strong></div><div><span>Wet vehicle mass</span><strong>{settings.dryMassKg + settings.fuelMassKg} kg</strong></div><div><span>Initial thrust / weight</span><strong className={twr < 1 ? 'amber' : 'mint-text'}>{twr.toFixed(2)}</strong></div><div><span>Analog fidelity</span><strong>Scored after the flight</strong></div></div>
          {twr < 1 && <div className="note warning"><CircleHelp size={18} /><p>Initial thrust is lower than vehicle weight. This configuration cannot initially hover; review thrust and mass.</p></div>}
          <div className="note"><CircleHelp size={18} /><p>These are experiment settings, not measured vehicle specifications. Changing gravity does not make the Earth terrain a planetary observation.</p></div>
          <button className="text-button" onClick={() => setStep(1)}><ArrowLeft size={15} /> Change Earth analog</button>
        </div>
        <div className="config-panel"><div className="section-heading"><h2><SlidersHorizontal size={21} /> Mission configuration</h2><button className="text-button" onClick={() => setSettings({ ...defaultSettings })}>Reset</button></div>
          <EquipmentPicker settings={settings} onChange={setSettings} />
          <ConditionsImport settings={settings} targetId={targetId} targets={targets} onApply={proposal=>{setSettings(proposal.settings);if(proposal.targetId)setTargetId(proposal.targetId);setFlight(null);}} />
          <fieldset><legend>01 <span>Control strategy</span></legend><div className="strategy-options">{([{ mode: 'AUTONOMOUS_HAZARD_AVOID', name: 'Autonomous', detail: 'Hazard-avoidance controller' }, { mode: 'MANUAL_CONTROL', name: 'Manual', detail: 'Pilot-controlled thrust' }] as const).map(item => <button key={item.mode} className={settings.mode === item.mode ? 'selected' : ''} aria-pressed={settings.mode === item.mode} onClick={() => update('mode', item.mode)}>{item.mode === 'MANUAL_CONTROL' ? <Settings2 size={20} /> : <Orbit size={20} />}<strong>{item.name}</strong><small>{item.detail}</small></button>)}</div><div className="segmented environment" aria-label="Hazard sensor">{([['lidar', 'Lidar'], ['camera', 'Camera'], ['none', 'No hazard sensor']] as const).map(([value, name]) => <button key={value} aria-pressed={settings.hazardSensor === value} onClick={() => update('hazardSensor', value)}>{name}</button>)}</div><p className="field-help">{settings.hazardSensor === 'lidar' ? 'Lidar maps hazards and is barely affected by glare.' : settings.hazardSensor === 'camera' ? 'A camera maps hazards but is degraded by glare and low sun.' : 'No hazard detection: the lander cannot see rocks or slopes and never diverts.'} Velocity sensing is enabled.</p></fieldset>
          <fieldset><legend>02 <span>Environment</span></legend><div className="segmented environment"><button aria-pressed={settings.environment === 'planetary'} onClick={() => update('environment', 'planetary')}>{target.body} physics scenario</button><button aria-pressed={settings.environment === 'earth'} onClick={() => update('environment', 'earth')}>Earth field test</button></div><p className="field-help">{vacuum ? 'Lunar gravity and vacuum over Earth terrain. Wind is disabled.' : settings.environment === 'earth' ? 'Earth gravity with user-defined wind. Soil mechanics remain unmeasured.' : 'Mars gravity over Earth terrain, with constant 0.02 kg/m³ atmospheric density.'}</p>
            {settings.environment === 'earth' && (weatherAvailable ? <>
              <div className="segmented environment"><button aria-pressed={!realWeather} onClick={() => update('realWeatherMonth', 0)}>Manual wind</button><button aria-pressed={realWeather} onClick={() => update('realWeatherMonth', settings.realWeatherMonth || 7)}>Real weather</button></div>
              {realWeather && <div className="weather-pickers"><label>Month <select aria-label="Weather month" value={settings.realWeatherMonth} onChange={e => update('realWeatherMonth', Number(e.target.value))}>{['January','February','March','April','May','June','July','August','September','October','November','December'].map((name, i) => <option key={name} value={i + 1}>{name}</option>)}</select></label><label>Hour <select aria-label="Weather scenario" value={settings.weatherScenario} onChange={e => update('weatherScenario', e.target.value as MissionSettings['weatherScenario'])}><option value="typical">Typical</option><option value="high_wind">High wind</option></select></label></div>}
              {realWeather && <p className="field-help">{weatherError ? weatherError : !weather ? 'Loading weather profile…' : weatherHour ? `One real modelled hour for ${analog.name}: ${weatherHour.wind_speed_m_s.toFixed(1)} m/s from ${weatherHour.wind_from_deg.toFixed(0)}°, air ${weatherHour.air_density_kg_m3.toFixed(2)} kg/m³ (NASA POWER, ${weatherHour.timestamp_utc.slice(0, 10)}). Regional reanalysis, not a measurement at the pad.` : 'No complete weather record for this month and scenario.'}</p>}
            </> : <p className="field-help">No real weather profile exists for {analog.name}; wind is your scenario setting.</p>)}</fieldset>
          <fieldset><legend>03 <span>Vehicle & landing limits</span></legend><div className="slider-grid">
            <Slider label="Propellant mass" value={settings.fuelMassKg} min={50} max={2000} step={50} unit="kg" onChange={v => update('fuelMassKg', v)} />
            <Slider label="Dry vehicle mass" value={settings.dryMassKg} min={100} max={5000} step={100} unit="kg" onChange={v => update('dryMassKg', v)} />
            <Slider label="Maximum thrust" value={settings.thrusterForceN} min={1000} max={50000} step={500} unit="N" onChange={v => update('thrusterForceN', v)} />
            <Slider label="Slope tolerance" value={settings.maxSlopeToleranceDeg} min={1} max={30} step={1} unit="°" onChange={v => update('maxSlopeToleranceDeg', v)} />
            <Slider label="Crosswind" value={vacuum ? 0 : settings.windSpeedMs} min={0} max={30} step={1} unit="m/s" disabled={vacuum || realWeather} onChange={v => update('windSpeedMs', v)} />
          </div></fieldset>
          <fieldset><legend>04 <span>Sensor interference</span></legend><div className="segmented environment"><button aria-pressed={settings.siteConditions} onClick={() => update('siteConditions', true)}>From site data</button><button aria-pressed={!settings.siteConditions} onClick={() => update('siteConditions', false)}>Set manually</button></div>
            <p className="field-help">{settings.siteConditions ? `Dust and glare are derived from ${analog.name}’s catalog surface data (material${analog.substrate ? `: ${analog.substrate}` : ' unknown'}, albedo, sun elevation). The values used are listed in the flight report.` : 'Dust and glare are your scenario assumptions, not measurements.'}</p>
            {!settings.siteConditions && <div className="slider-grid">
            <Slider label="Dust interference" value={Math.round(settings.dust*100)} min={0} max={100} step={5} unit="%" onChange={v => update('dust', v/100)} />
            <Slider label="Glare interference" value={Math.round(settings.glare*100)} min={0} max={100} step={5} unit="%" onChange={v => update('glare', v/100)} />
          </div>}</fieldset>
          <div className="config-footer"><span><span className="status-dot" />{storageAvailable ? 'Draft saved on this device' : 'Draft held in this session'}</span><button className="primary-button" disabled={!profile || validateSettings(settings).length > 0 || (realWeather && !weatherHour)} onClick={reviewMission}>Review mission <ArrowRight size={17} /></button></div>
        </div>
      </section>}
      {step === 3 && mission && profile && <Suspense fallback={<div className="flight-workspace empty-data" role="status">Preparing ship systems…</div>}><GameSession target={target} entry={catalog.entries.get(analog.id)} initialMission={mission} settings={settings} profile={profile} weather={weather} weatherAvailable={weatherAvailable} onExit={next => {setSettings(next);setStep(2);}} onReport={(report, finalMission, finalSettings)=>{setMission(finalMission);setFlightSettings(finalSettings);setFlight(report);setStep(4);}} /></Suspense>}
      {step === 4 && flight && mission && profile && <Suspense fallback={<p role="status">Preparing debrief…</p>}><FlightReport match={catalog.matching?.comparisons.find(p => p.planetary_id === target.id && p.earth_id === analog.id)} analogEntry={catalog.entries.get(analog.id)} planetaryEntry={catalog.entries.get(target.id)} flight={flight} mission={mission} profile={profile} onRetry={()=>{setSettings(flightSettings);setStep(2);}} /></Suspense>}
      {step === 4 && flight && <p className="field-help"><button className="text-button" onClick={() => setReportStyle('nhb')}>View this report in the 1976 manual style (design trial)</button></p>}
      <footer className="workspace-footer"><span><span className="status-dot" /> {step === 0 ? 'Explore first. Validate with evidence.' : 'Real terrain. Explicit assumptions.'}</span><span>Earth data: Copernicus DEM <span className="footer-separator">/</span> <button className="text-button" onClick={() => setDialog('sources')}>Credits & limitations</button></span></footer>
    </main>
    {dialog === 'sources' && <Dialog title="Data, evidence & limitations" onClose={() => setDialog(null)}><div className="source-content">
      <h3>Earth terrain</h3><p>{profile?.manifest.source.dataset ?? 'Copernicus DEM GLO-30 Public'} · {analog.name}. A real terrain surface at {profile?.sampleSpacingM ?? 30} m grid spacing; not a validated match to the selected planetary site.</p>
      {profile && <>{(profile.manifest.source.catalog ?? profile.manifest.source.url) && <a href={profile.manifest.source.catalog ?? profile.manifest.source.url} target="_blank" rel="noreferrer">Elevation data source <ExternalLink size={14} /></a>}<h3>Analog evidence</h3>{(profile.manifest.analog?.sources ?? (analog.evidenceUrl ? [analog.evidenceUrl] : [])).map(url => <a key={url} href={url} target="_blank" rel="noreferrer">{new URL(url).hostname} <ExternalLink size={14} /></a>)}<h3>What this pack cannot establish</h3><ul>{profile.manifest.limitations.map(item => <li key={item}>{item}</li>)}</ul><p className="attribution">{profile.manifest.attribution}</p></>}
      {!profile && <p>Terrain metadata is unavailable. Load the terrain pack to inspect its full attribution and limitations.</p>}
      <h3>Planetary targets & globe imagery</h3><p>Targets, analogs and pairings come from the team’s site catalog. Planetary terrain is MOLA (Mars) and LOLA (Moon) at 150–500 m per sample. Pairing scores compare terrain descriptors only; they are proposals, not validated analogs.</p><a href={target.source} target="_blank" rel="noreferrer">Planetary data archive for {target.body} <ExternalLink size={14} /></a><p>Moon and Earth reference textures: Three.js example assets. Mars surface: procedural illustration. Globes are navigation aids, not measurement surfaces.</p><a href="https://github.com/mrdoob/three.js/tree/dev/examples/textures/planets" target="_blank" rel="noreferrer">Globe texture source <ExternalLink size={14} /></a><a href={profile?.manifest.license_url ?? "/terrain/kilbourne-hole-v1/COPERNICUS-LICENSE.pdf"} target="_blank" rel="noreferrer">Terrain licence <ExternalLink size={14} /></a>
    </div></Dialog>}
    {dialog === 'mission' && mission && <Dialog title="Review your mission" onClose={() => setDialog(null)}><div className="source-content"><div className="review-icon"><Rocket size={28} /></div><p><strong>{target.name}</strong> scenario on the <strong>{analog.name}</strong> terrain.</p><div className="mission-summary"><div><span>Control</span><strong>{settings.mode === 'MANUAL_CONTROL' ? 'Manual' : 'Autonomous'}</strong></div><div><span>Environment</span><strong>{settings.environment === 'earth' ? 'Earth field test' : `${target.body} physics scenario`}</strong></div><div><span>Terrain grid</span><strong>{profile?.manifest.grid.rows} × {profile?.manifest.grid.columns} at {mission.earthAnalog.sampleSpacingM} m</strong></div></div><div className="note"><CircleHelp size={18} /><p>Board the systems console to finalize conditions. Launch then enters the Earth descent at 1,000 m above ground with your selected equipment.</p></div><button className="primary-button wide launch-mission" onClick={()=>{setFlight(null);setDialog(null);setStep(3);}}>Board ship <Rocket size={17}/></button><button className="subtle-button wide" onClick={downloadMission}><Download size={17} /> {saved ? 'Download mission again' : 'Download mission JSON'}</button>{saved && <p role="status" className="accent-text">Mission JSON prepared for download.</p>}{downloadError && <p role="alert">{downloadError}</p>}</div></Dialog>}
  </>;
}
function Slider({ label, value, min, max, step, unit, disabled, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; disabled?: boolean; onChange: (n: number) => void }) {
  const id = label.toLowerCase().replaceAll(' ', '-');
  return <div className={`slider-field ${disabled ? 'disabled' : ''}`}><label htmlFor={id}>{label}<output htmlFor={id}>{value.toLocaleString()} <span>{unit}</span></output></label><input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={e => onChange(Number(e.target.value))} /><div className="range-labels"><span>{min.toLocaleString()} {unit}</span><span>{max.toLocaleString()} {unit}</span></div></div>;
}
