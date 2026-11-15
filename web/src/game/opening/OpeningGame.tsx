import { ComparisonToggle, ComparisonLegend, useTerrainComparison } from '../../components/TerrainComparison';
import { lazy, startTransition, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { preloadScenes } from '../integrations';
import { ArrowLeft, ArrowRight, Flag, MapPin, Orbit, X, Maximize } from 'lucide-react';
import { analogsFor, recommendedAnalogs, pairingOf, matchOf, scoreLabel, type Catalog } from '../../lib/catalog';
import { buildMission, defaultSettings, loadProfile } from '../../lib/mission';
import { hasWeatherProfile, loadWeatherProfile } from '../../lib/weather';
import { describeLanding, PATCH_CENTRE, type LandingPoint } from '../../lib/landing';
import { gearFromSettings } from '../../lib/gear';
import type { EnvironmentProfile } from '../../../../app/lib/environment.mjs';
import type { FlightTelemetry } from '../../../../app/sim/src/types';
import type { Body, MissionConfig, MissionSettings, TerrainProfile } from '../../lib/types';
import AnalogEvidence, { evidenceFor } from '../../components/AnalogEvidence';
import LandingEvidence from '../../components/LandingEvidence';
import Dialog from '../../components/Dialog';
import WorldScene, { type WorldHandle } from './WorldScene';
import type { GlobeHandle } from '../../components/MoonGlobe';
import { analyseClick, clickConfigured, ClickError, clickLandformLabel, clickMatch, clickScoreLabel, customAnalogs, customTarget, formatPoint, SERVICE_UNAVAILABLE, snap, type ClickResult } from '../../lib/analogClick';
import EquipmentBay from './EquipmentBay';
import { equipmentSettings, initialEquipment, type EquipmentSelection } from './equipmentCatalog';
import { CutsceneAudio, soundOn } from '../../components/cutscene/audio';
import './opening.css';
const GameSession=lazy(()=>import('../GameSession'));
const MoonGlobe=lazy(()=>import('../../components/MoonGlobe'));
// Antonio's in-character debrief: the astronaut walks to a bridge monitor and the report opens on it.
const DebriefScene=lazy(()=>import('../debrief/DebriefScene'));
type Stage='title'|'worlds'|'destination'|'earth'|'equipment'|'journey'|'report';
/** A point the player pinned on the Moon or Mars, and how far its analysis has got. */
type Pin={body:Body;lat:number;lon:number}&({status:'pinned'|'analysing'}|{status:'ready';result:ClickResult}|{status:'failed';message:string});

export default function OpeningGame({catalog}:{catalog:Catalog}) {
  const [online,setOnline]=useState(navigator.onLine);
  useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[]);
  const [stage,setStage]=useState<Stage>('title'),[body,setBody]=useState<Body>('Moon'),[hover,setHover]=useState<Body|null>(null);
  const worldStage=useRef<'title'|'worlds'|'destination'|'earth'>('title');
  const worldVisible=stage==='title'||stage==='worlds'||stage==='destination'||stage==='earth';
  if(worldVisible)worldStage.current=stage as typeof worldStage.current;
  const [siteMenu,setSiteMenu]=useState(false);
  const [terrainInfo,setTerrainInfo]=useState(false);
  const [measuredView,setMeasuredView]=useState(false);
  const [targetId,setTargetId]=useState(catalog.targets[0].id),[analogId,setAnalogId]=useState(''),[surface,setSurface]=useState(false);
  useEffect(()=>setTerrainInfo(false),[stage,analogId]);
  const comparison = useTerrainComparison(targetId);
  const [equipment,setEquipment]=useState<EquipmentSelection>(initialEquipment),[settings,setSettings]=useState<MissionSettings>(defaultSettings);
  const [loaded,setLoaded]=useState<TerrainProfile|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const [weatherState,setWeather]=useState<{id:string;data:EnvironmentProfile}|null>(null);
  const [mission,setMission]=useState<MissionConfig|null>(null),[flight,setFlight]=useState<FlightTelemetry|null>(null),[credits,setCredits]=useState(false),[allSites,setAllSites]=useState(false);
  // The simple globe (WorldScene) stays mounted from the title to the terrain; the detailed Cesium globe is a
  // layer above it that fades in once it has tiles and the fly-in has finished, with the camera handed across.
  const worldHandle=useRef<WorldHandle|null>(null),globeHandle=useRef<GlobeHandle|null>(null);
  const [globeReady,setGlobeReady]=useState(false),[worldSettled,setWorldSettled]=useState(false),[globeShown,setGlobeShown]=useState(false),[worldPaused,setWorldPaused]=useState(false),[leaving,setLeaving]=useState(false);
  const [worldsReady,setWorldsReady]=useState(false),[worldError,setWorldError]=useState(''),[worldAttempt,setWorldAttempt]=useState(0),[startRequested,setStartRequested]=useState(false);
  const [launching,setLaunching]=useState(false),launchTimers=useRef<number[]>([]);
  // arriving: the title is flying in to the worlds, so the world screen's own text waits.
  const [arriving,setArriving]=useState(false),[hoverSite,setHoverSite]=useState<string|null>(null),[landing,setLanding]=useState<LandingPoint>(PATCH_CENTRE);
  useEffect(()=>()=>launchTimers.current.forEach(clearTimeout),[]);
  // Click anywhere: a pinned point, and whether its scored result is the target being explored (instead of a marked region).
  const [pin,setPin]=useState<Pin|null>(null),[pinActive,setPinActive]=useState(false),pinRequest=useRef<AbortController|null>(null);
  useEffect(()=>()=>pinRequest.current?.abort(),[]);
  const custom=pinActive&&pin?.status==='ready'?pin.result:null,click=custom?.response;
  const target=useMemo(()=>click?customTarget(click):catalog.targets.find(t=>t.id===targetId)!,[click,catalog,targetId]);
  // For a pinned point the Earth list is the server's on-demand order; for a marked region, the catalog's.
  const ranked=useMemo(()=>click?customAnalogs(catalog,click):analogsFor(catalog,targetId).filter(a=>a.available),[catalog,targetId,click]);
  const topTen=useMemo(()=>click?ranked.slice(0,10):recommendedAnalogs(catalog,targetId),[catalog,targetId,click,ranked]);
  const siteScore=(id:string)=>click?clickScoreLabel(click,id):scoreLabel(catalog,targetId,id);
  const dropPin=(point:{lat:number;lon:number})=>{pinRequest.current?.abort();setPinActive(false);
    const at={body,lat:snap(point.lat),lon:snap(point.lon)};
    setPin(clickConfigured()?{...at,status:'pinned'}:{...at,status:'failed',message:SERVICE_UNAVAILABLE});};
  const analysePin=()=>{if(!pin||pin.status==='analysing')return;const {body:world,lat,lon}=pin,abort=new AbortController();
    pinRequest.current?.abort();pinRequest.current=abort;setPin({body:world,lat,lon,status:'analysing'});
    analyseClick(world,lat,lon,{signal:abort.signal}).then(result=>{if(abort.signal.aborted)return;setPin({body:world,lat:result.response.point.lat,lon:result.response.point.lon,status:'ready',result});setPinActive(true);})
      .catch(e=>{if(abort.signal.aborted)return;setPin({body:world,lat,lon,status:'failed',message:e instanceof ClickError?e.message:SERVICE_UNAVAILABLE});});};
  const chooseTarget=(id:string)=>{setPinActive(false);setTargetId(id);};
  const shownPin=pin&&pin.body===body?pin:null;
  const candidates=allSites?ranked:topTen;
  const analog=ranked.find(a=>a.id===analogId)??topTen[0]??ranked[0];
  const profile=loaded?.manifest.id===analog.id?loaded:null;
  const weather=weatherState?.id===analog.id?weatherState.data:null;
  const pair=click?undefined:pairingOf(catalog,targetId,analog.id);
  // A flag belongs to one terrain: a new site starts with it at the patch centre.
  useEffect(()=>setLanding(PATCH_CENTRE),[analog.id]);
  useEffect(()=>{const abort=new AbortController();setLoaded(null);setError('');
    if(stage==='earth'||stage==='equipment'||stage==='journey')loadProfile(abort.signal,analog.manifestUrl,analog.id).then(p=>{if(!abort.signal.aborted)setLoaded(p);}).catch(e=>{if(!abort.signal.aborted)setError(e instanceof Error?e.message:'Terrain could not load.');});
    return()=>abort.abort();
    // Stage changes must not discard a loaded terrain pack during boarding.
  },[analog.id,analog.manifestUrl,retry,stage==='title'||stage==='worlds'||stage==='destination']);
  useEffect(()=>{const abort=new AbortController();setWeather(null);if(hasWeatherProfile(analog.id))loadWeatherProfile(analog.id,abort.signal).then(data=>{if(!abort.signal.aborted)setWeather({id:analog.id,data});}).catch(()=>{});return()=>abort.abort();},[analog.id]);
  useEffect(()=>{window.scrollTo(0,0);document.getElementById(stage==='earth'&&surface?'surface-title':'mission-title')?.focus({preventScroll:true});document.title='Analog Atlas — '+(stage==='title'?'Begin':stage==='worlds'?'Choose your world':stage==='equipment'?'Build your Lander':stage==='earth'?'Earth reconnaissance':stage==='destination'?'Choose your region':stage==='report'?'Expedition debrief':'Journey');},[stage,surface]);
  const reducedMotion=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wantGlobe=!leaving&&stage==='earth'&&!measuredView;
  /** The same camera in both views, whichever is about to show. On the ground it is a pose over the site; otherwise an orbit. */
  const handCamera=(to:'globe'|'world')=>{const world=worldHandle.current,globe=globeHandle.current;if(!world||!globe)return;
    const patch=stage==='earth'&&surface?world.surface():null,onSite=patch?.id===analog.id?patch:null;
    if(to==='globe'){if(onSite)globe.setSurface(analog,onSite.height,onSite.view);else{const orbit=world.orbit();if(orbit)globe.setOrbit(orbit);}}
    else{const ground=onSite&&globe.surface(analog,onSite.height);if(ground)world.setSurface(ground);else{const orbit=globe.orbit();if(orbit)world.setOrbit(orbit);}}};
  useEffect(()=>{
    if(wantGlobe&&globeReady&&worldSettled&&!globeShown){handCamera('globe');setGlobeShown(true);}
    else if(globeShown&&(!wantGlobe||!globeReady)){handCamera('world');setGlobeShown(false);setWorldPaused(false);}
  },[wantGlobe,globeReady,worldSettled,globeShown]);
  // The simple globe stops drawing once the detailed one fully covers it.
  useEffect(()=>{if(!globeShown)return;const timer=window.setTimeout(()=>setWorldPaused(true),reducedMotion()?0:650);return()=>clearTimeout(timer);},[globeShown]);
  useEffect(()=>{if(stage==='equipment'||stage==='journey'||stage==='report'){setGlobeShown(false);setWorldPaused(false);}},[stage]);
  /** Leave a screen that shows the detailed globe: fade it out over the simple one first, then move on. */
  const leave=(next:()=>void)=>{if(leaving)return;if(!globeShown||reducedMotion()){next();return;}setLeaving(true);launchTimers.current.push(window.setTimeout(()=>{setLeaving(false);next();},430));};
  const chooseBody=(next:Body)=>{setBody(next);setPinActive(false);setTargetId(catalog.targets.find(t=>t.body===next)!.id);setHover(null);setSurface(false);setStage('destination');};
  const findEarth=()=>leave(()=>{setAnalogId((topTen[0]??ranked[0]).id);setSurface(false);setMeasuredView(false);setAllSites(false);setStage('earth');});
  const back=()=>{if(stage==='equipment')setStage('earth');else if(stage==='earth')leave(()=>{setSurface(false);setMeasuredView(false);setStage('destination');});else leave(()=>setStage('worlds'));};
  function launch(){if(!profile||launching)return;try{const next=equipmentSettings(equipment,settings);const config=buildMission(target,profile,next,{terrainBase:analog.terrainBase,analogName:analog.name,terrainScore:click?(clickMatch(click,analog.id)?.terrain_similarity_percent??NaN)/100:pair?.terrain_score,weatherAvailable:hasWeatherProfile(analog.id),landingTarget:landing});config.equipment={...equipment,gearPhysics:'model'};
    // A pinned point is not a proposed pairing, whatever its terrain figure.
    if(click){if(!Number.isFinite(config.evidence.quantitativeSimilarityScore))config.evidence.quantitativeSimilarityScore=null;config.evidence.status='unvalidated-pair';}
    const board=()=>startTransition(()=>{setSettings(next);setMission(config);setFlight(null);setStage('journey');setLaunching(false);});
    const later=(run:()=>void,ms:number)=>{launchTimers.current.push(window.setTimeout(run,ms));};
    // The ship locks with a click, then leaves with a rush of air that carries into the journey.
    if(soundOn()){const audio=new CutsceneAudio();audio.start();audio.clunk();later(()=>audio.whoosh(1.5,.6),380);later(()=>audio.stop(),2400);}
    // Reduced motion keeps the sounds and skips the lift-off.
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)board();else{setLaunching(true);later(board,1750);}}catch(e){setError(e instanceof Error?e.message:'Choose equipment before launching.');}}
  const inOpening=['worlds','destination','earth','equipment'].includes(stage);
  const selectAnalog=(id:string)=>{setAnalogId(id);setSurface(true);setMeasuredView(true);setSiteMenu(false);};
  const fullscreen=()=>{if(document.fullscreenElement)void document.exitFullscreen();else void document.documentElement.requestFullscreen?.().catch(()=>{});};
  // Fetch the Earth inspection layer during the welcome screen as well.
  useEffect(()=>{if(stage!=='title')return;const timer=window.setTimeout(()=>void import('../../components/MoonGlobe').catch(()=>{}),600);return()=>clearTimeout(timer);},[stage,arriving]);
  // fetch the journey's code while the player is still choosing equipment, so Launch does not wait on it
  useEffect(()=>{if(stage==='equipment'){void import('../GameSession').catch(()=>{});preloadScenes();}},[stage]);
  // The whole title is the start control: a click, a tap, Enter or Space. The worlds' own text
  // appears once the flight in from the title has settled (reduced motion skips the flight).
  const startJourney=()=>{if(stage!=='title')return;
    if(!document.fullscreenElement)void document.documentElement.requestFullscreen?.().catch(()=>{});
    if(!worldsReady){setStartRequested(true);return;}
    setStartRequested(false);
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){setArriving(true);launchTimers.current.push(window.setTimeout(()=>setArriving(false),16000));
      // The launch: engines build to a roar, then a rush of air as the orbiter jumps to the worlds.
      if(soundOn()){const audio=new CutsceneAudio();audio.start();audio.setThrust(.35);const later=(run:()=>void,ms:number)=>{launchTimers.current.push(window.setTimeout(run,ms));};later(()=>{audio.setThrust(1);audio.explosion(.35);},1000);later(()=>audio.setThrust(.5),4000);later(()=>{audio.setThrust(.2);audio.whoosh(1.6,.6);},7000);later(()=>audio.stop(),9500);}}
    setStage('worlds');if(!document.fullscreenElement)void document.documentElement.requestFullscreen?.().catch(()=>{});};
  useEffect(()=>{if(startRequested&&worldsReady&&stage==='title')startJourney();},[startRequested,worldsReady,stage]);
  useEffect(()=>{if(stage!=='title'||credits)return;const key=(e:KeyboardEvent)=>{if((e.key==='Enter'||e.key===' ')&&!(e.target instanceof HTMLButtonElement)&&!(e.target instanceof HTMLAnchorElement)){e.preventDefault();startJourney();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[stage,credits]);
  const touch=useMemo(()=>window.matchMedia('(pointer: coarse)').matches,[]);
  // A list row and its region on the globe light up together.
  const siteHover=(id:string)=>({className:hoverSite===id?'is-hovered':undefined,onPointerEnter:()=>setHoverSite(id),onPointerLeave:()=>setHoverSite(current=>current===id?null:current),onFocus:()=>setHoverSite(id),onBlur:()=>setHoverSite(current=>current===id?null:current)});
  return <div className={`opening-game opening-${stage}${stage==='earth'&&surface?' on-surface':''}${launching?' is-launching':''}${arriving?' is-arriving':''}`}>
    <div className="game-network-status" role="status" title="Network connection reported by your browser; Cesium loading is reported separately.">{online?'● Online':'○ Offline'}{!online&&' · Offline reference worlds'}{wantGlobe&&!globeShown&&online&&' · Detailed terrain loading…'}</div>
    {<div inert={!worldVisible} style={worldVisible?{display:'contents'}:{position:'absolute',inset:0,visibility:'hidden',pointerEvents:'none'}}><WorldScene key={worldAttempt} onPrepared={ready=>{setWorldsReady(ready);if(!ready)setStage('title');}} onPreparationError={setWorldError} paused={!worldVisible||worldPaused} handle={worldHandle} onSettled={setWorldSettled} onSurfacePick={dropPin} pin={shownPin} stage={worldStage.current} body={body} hover={hover} targets={catalog.targets} analogs={candidates} targetId={custom?'':targetId} analogId={analog.id} selectedAnalog={analog} profile={profile} comparisonPack={comparison.pack} surface={surface} hoverSite={hoverSite} landing={landing} onHoverSite={setHoverSite} onLanding={setLanding} onBody={chooseBody} onHover={setHover} onTarget={chooseTarget} onAnalog={selectAnalog} onArrived={()=>setArriving(false)}/></div>}
    {<div style={!worldVisible?{visibility:'hidden',pointerEvents:'none'}:undefined} className={`opening-globe-layer lunar-destination${globeShown?' is-shown':''}`} inert={!globeShown} aria-hidden={!globeShown}><Suspense fallback={null}><MoonGlobe layered body="Earth" orbitRadii={5.5/1.5} points={candidates} selected={analog.id} surface={stage==='earth'&&surface}  paused={!worldVisible||!wantGlobe&&!globeShown&&globeReady} handle={globeHandle} onReady={setGlobeReady} hovered={hoverSite} onHover={setHoverSite} onSelect={selectAnalog}/></Suspense></div>}
    {stage!=='journey'&&<header className="game-topbar"><button className="game-wordmark" onClick={()=>leave(()=>setStage('title'))} aria-label="Return to title screen"><Orbit size={24}/><span>analog atlas</span></button>{inOpening&&<nav className="inspection-navigation" aria-label="Back navigation"><button className="game-back" onClick={()=>{setTerrainInfo(false);setSiteMenu(false);if(stage==='earth'&&surface){setSurface(false);setMeasuredView(false);}else if(stage==='worlds'){leave(()=>setStage('title'));}else back();}}><ArrowLeft size={16}/>Back</button></nav>}<span className="game-chapter">{stage==='title'?'':stage==='worlds'?'Choose your destination':stage==='destination'?'Destination / 01':stage==='earth'?'Earth reconnaissance / 02':stage==='equipment'?'Equipment bay / 03':'Mission debrief'}</span><div className="game-tools"><button aria-label="Toggle fullscreen" onClick={fullscreen}><Maximize size={17}/></button><button onClick={()=>setCredits(true)}>Credits</button></div></header>}
    {(stage==='title'||arriving)&&<main className={`title-screen${arriving?' is-leaving':''}`} onClick={startJourney}><span className="title-eyebrow">A planetary field expedition</span><h1 id={stage==='title'?'mission-title':undefined} tabIndex={-1}>ANALOG <span>ATLAS</span></h1><button className="title-prompt">{startRequested&&!worldsReady?'Preparing your worlds…':`${touch?'Tap':'Click'} anywhere to begin`}</button>{stage==='title'&&<p className="world-preparation" role="status">{worldError?<>{worldError} <button onClick={e=>{e.stopPropagation();setWorldError('');setWorldsReady(false);setWorldAttempt(n=>n+1);}}>Retry worlds</button></>:!worldsReady?'Preparing detailed worlds in the background…':online?'Detailed worlds ready':'Offline reference worlds ready'}</p>}</main>}

    {inOpening&&<>
      <div className="game-heading" key={stage}>
        <h1 id="mission-title" tabIndex={-1}>{stage==='worlds'?'Choose your world.':stage==='destination'?`Explore ${body==='Moon'?'the Moon':'Mars'}.`:stage==='earth'?(surface?analog.name:'Find its Earth counterpart.'):'Build your Lander.'}</h1>
        <p>{stage==='worlds'?'Choose a world. Find its echo on Earth. Prepare your expedition.':stage==='destination'?'Select a study region, or click anywhere on the surface to pin your own.':stage==='earth'?(surface?'Orbit the measured landscape. This is your test ground.':click?`${target.name}. An on-demand ranking for your pin, not a reviewed pairing.`:`${target.name}. Discover the proposed Earth testbeds.`):'Your spacecraft, your experiment. Choose your hardware and make it your own.'}</p>
      </div>
      {stage==='worlds'&&<><div className="world-labels"><button onPointerEnter={()=>setHover('Moon')} onFocus={()=>setHover('Moon')} onClick={()=>chooseBody('Moon')}><span>01</span><strong>The Moon</strong><small>Explore lunar regions <ArrowRight size={14}/></small></button><div><span>Home base</span><strong>Earth</strong><small>Find your test ground</small></div><button onPointerEnter={()=>setHover('Mars')} onFocus={()=>setHover('Mars')} onClick={()=>chooseBody('Mars')}><span>02</span><strong>Mars</strong><small>Explore Martian regions <ArrowRight size={14}/></small></button></div><div className="game-bottom-note">Hover to approach · Select to explore <span>World sizes and spacing are illustrative</span></div></>}
      {stage==='destination'&&<aside className="game-selector"><h2>Choose your region</h2>
        {shownPin?<div className={`pin-row is-${shownPin.status}`}>
          <button className="pin-site" aria-pressed={!!custom} disabled={shownPin.status!=='ready'} onClick={()=>setPinActive(true)}><MapPin size={16} aria-hidden="true"/><div><span>Your pin</span><strong>{shownPin.status==='ready'?shownPin.result.response.point.name??'Custom site':'Unnamed point'}</strong><small>{formatPoint(shownPin.lat,shownPin.lon)}</small></div></button>
          <p role="status" className={shownPin.status==='failed'?'pin-failed':undefined}>{shownPin.status==='pinned'?'Pinned. Analyse it to rank Earth sites for this spot.':shownPin.status==='analysing'?'Reading the elevation mosaic and scoring every Earth site…':shownPin.status==='ready'?`${shownPin.result.response.matches.length} Earth sites ranked on demand · ${shownPin.result.response.ranking_basis==='terrain_only'?'terrain only, landform unmapped':'landform and terrain'} · not reviewed`:shownPin.status==='failed'?shownPin.message:''}</p>
          {shownPin.status==='pinned'&&<button className="game-text" onClick={analysePin}>Analyse this spot</button>}
          {shownPin.status==='failed'&&clickConfigured()&&<button className="game-text" onClick={analysePin}>Try again</button>}
        </div>:<p className="pin-hint"><MapPin size={13} aria-hidden="true"/>Click anywhere on {body==='Moon'?'the Moon':'Mars'} to pin your own spot.</p>}
        <div className="game-site-list">{catalog.targets.filter(t=>t.body===body).map((t,i)=><button key={t.id} aria-pressed={!custom&&t.id===targetId} onClick={()=>chooseTarget(t.id)} {...siteHover(t.id)}><span>{String(i+1).padStart(2,'0')}</span><div><strong>{t.name}</strong><small>{t.region}</small></div><i/></button>)}</div><p className="site-description">{target.description}</p><button className="game-primary" onClick={findEarth}>Find Earth terrain <ArrowRight size={18}/></button></aside>}
      {stage==='earth'&&<><aside className="game-selector" hidden={surface&&!siteMenu}><h2>{allSites?'Earth test grounds':click?'Top 10 on-demand matches':'Top 10 Earth matches'}</h2>{allSites&&<label>Compare with <select aria-label="Atlas target" value={custom?'pin':targetId} onChange={e=>{if(e.target.value==='pin'){setPinActive(true);return;}chooseTarget(e.target.value);setBody(catalog.targets.find(t=>t.id===e.target.value)!.body);}}>{pin?.status==='ready'&&<option value="pin">Your pin: {pin.result.response.point.name??'Custom site'}</option>}{catalog.targets.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}{surface&&<button className="site-menu-close" aria-label="Close test sites" onClick={()=>setSiteMenu(false)}><X size={16}/></button>}<div className="game-site-list">{candidates.map((a,i)=><div key={a.id}>{a.id.startsWith('scan-')&&(i===0||!candidates[i-1].id.startsWith('scan-'))&&<h3 className="scan-heading">Discovered candidates</h3>}<button aria-pressed={surface&&a.id===analog.id} onClick={()=>selectAnalog(a.id)} {...siteHover(a.id)}><span className="site-signal"/><div><strong>{a.name}</strong><small>{a.region}</small><small className="analog-score">{siteScore(a.id)}</small>{click&&clickLandformLabel(click,a.id)&&<small>{clickLandformLabel(click,a.id)}</small>}{a.id.startsWith('scan-')&&<small className="scan-label">Discovered candidate · local geology not reviewed</small>}</div><ArrowRight size={15}/></button></div>)}</div><button className="game-text" onClick={()=>setAllSites(!allSites)}>{allSites?'Show top 10 matches':`Explore all ${ranked.length} test grounds`}</button><p className="site-description">{click?`On-demand ranking for a ${((click.window_m??4000)/1000).toFixed(0)} km window around your pin at ${click.comparison_resolution_m} m: engineering similarity, not validated and not reviewed. ${click.ranking_basis==='terrain_only'?'The landform here is unmapped, so sites are ranked by terrain shape alone.':'Analog % = landform (from the geologic map unit, unreviewed, counted at 75%) + terrain.'} A marked region's list also applies screening; this one does not.`:'Analog % = landform + terrain, not validated accuracy. White: curated; cyan: discovered windows near known regions. Gold: selected.'}</p></aside>
      {surface&&<><div className={`surface-brief terrain-info-sheet${terrainInfo?' is-open':''}`} id="terrain-info-sheet" inert={!terrainInfo} aria-hidden={!terrainInfo} onKeyDown={e=>{if(e.key==='Escape'){setTerrainInfo(false);document.getElementById('terrain-info-toggle')?.focus();}}}><button className="terrain-info-close" onClick={()=>{setTerrainInfo(false);document.getElementById('terrain-info-toggle')?.focus();}} aria-label="Close terrain information">Close ×</button><div className="surface-nav"><button className="game-back" onClick={()=>{setSurface(false);setMeasuredView(false);}}><ArrowLeft size={16}/>Return to orbit</button><button className="game-text" onClick={()=>{setTerrainInfo(false);setSiteMenu(!siteMenu);}}>Change test site</button></div><h2 id="surface-title" tabIndex={-1}>{analog.name}</h2><AnalogEvidence catalog={catalog} targetId={target.id} earthId={analog.id} custom={click?{click,target}:undefined}/><LandingEvidence targetId={target.id} earthId={analog.id}/>{profile?<>{measuredView||!globeShown ? <ComparisonLegend comparison={comparison} targetName={target.name} earthName={analog.name} earthSpacing={profile.sampleSpacingM}/> : comparison.enabled && <small>View measured terrain to inspect the comparison hologram.</small>}</>:error?<p role="alert">{error} <button className="game-text" onClick={()=>setRetry(r=>r+1)}>Retry terrain</button></p> :<p role="status">Approaching terrain…</p>}</div>{profile&&<div className="terrain-map-readout"><p>{profile.sampleSpacingM} m grid <span>/</span> {(profile.manifest.grid.width_m/1000).toFixed(1)} km measured patch</p><p className="landing-readout"><Flag size={14}/>Landing flag: {describeLanding(landing)}{(landing.x!==0||landing.y!==0)&&<button className="game-text" onClick={()=>setLanding(PATCH_CENTRE)}>Reset to centre</button>}</p><small>{measuredView||!globeShown?`${touch?'Tap':'Click'} inside the outlined ground to place your landing flag · Red dots mark slopes over 12°, where a lander may topple: flag one to test it (guidance steers off steep ground unless the hazard sensor is off or you fly manually) · Google 3D scenery when available.`:'Google 3D imagery is visual context; the measured DEM powers the landing experiment. View measured terrain to choose where to land.'}</small>{(globeReady||measuredView)&&<button className="game-text" onClick={()=>setMeasuredView(value=>!value)}>{measuredView?'View Google 3D terrain':'View measured terrain'}</button>}</div>}<div className="terrain-bottom-controls"><ComparisonToggle comparison={comparison}/><button id="terrain-info-toggle" className="game-primary" aria-expanded={terrainInfo} aria-controls="terrain-info-sheet" onClick={()=>{setSiteMenu(false);setTerrainInfo(open=>!open);}}>{terrainInfo?'Hide terrain information':'Terrain information ↑'}</button><button className="game-primary" disabled={!profile} onClick={()=>setStage('equipment')}>Select Equipment <ArrowRight size={18}/></button></div></>}

      </>}
      {stage==='equipment'&&<><EquipmentBay selection={equipment} onChange={setEquipment} launching={launching}/><div className="hangar-manifest"><span>{target.body} → Earth</span><strong>{analog.name}</strong><p>Landing at {describeLanding(landing)} · {(equipmentSettings(equipment,settings).dryMassKg+(gearFromSettings(equipmentSettings(equipment,settings))?.gearMassKg??0)).toLocaleString()} kg dry with gear · {(equipmentSettings(equipment,settings).thrusterForceN/1000).toFixed(0)} kN thrust</p><button className="game-primary" disabled={!profile||launching} onClick={launch}>Launch Journey <ArrowRight size={18}/></button>{error&&<p role="alert">{error}</p>}</div></>}
    </>}
    {launching&&<div className="launch-veil" aria-hidden="true"/>}
    {stage==='journey'&&mission&&profile&&<main className="journey-content"><h1 id="mission-title" tabIndex={-1} className="sr-only">Journey control</h1><Suspense fallback={<p role="status" className="late-status">Preparing your journey…</p>}><GameSession immersive target={target} entry={catalog.entries.get(analog.id)} initialMission={mission} settings={settings} profile={profile} weather={weather} weatherAvailable={hasWeatherProfile(analog.id)} onExit={next=>{setSettings(next);setEquipment(current=>({...current,landingGearId:next.landingGearId??current.landingGearId}));setStage('equipment');}} onReport={(result,config,next)=>{setFlight(result);setMission(config);setSettings(next);setStage('report');}}/></Suspense></main>}
    {stage==='report'&&flight&&mission&&profile&&<main className="debrief-stage"><h1 id="mission-title" tabIndex={-1} className="sr-only">Expedition debrief</h1><Suspense fallback={<p role="status" className="late-status">Preparing debrief…</p>}><DebriefScene mission={mission} flight={flight} profile={profile} match={custom?undefined:matchOf(catalog,targetId,analog.id)} evidence={custom?undefined:evidenceFor(catalog,targetId,analog.id)} analogEntry={catalog.entries.get(analog.id)} planetaryEntry={custom?undefined:catalog.entries.get(targetId)} planetaryProfile={custom?.profile} reducedMotion={window.matchMedia('(prefers-reduced-motion: reduce)').matches} onNewSite={()=>setStage('worlds')} onRetry={()=>{setEquipment({...equipment,hazardSensor:settings.hazardSensor,landingGearId:settings.landingGearId??equipment.landingGearId});setStage('equipment');}}/></Suspense></main>}
    {stage==='journey'&&<button className="journey-credits" onClick={()=>setCredits(true)}>Credits</button>}
    {credits&&<Dialog title="Expedition credits" onClose={()=>setCredits(false)}><div className="source-content"><p>Pinoy Space Gang · Eyad, Tim, Furgan, Antonio and Yousef.</p><h3>Worlds and terrain</h3><p>Moon and Mars: streamed Cesium ion terrain. Bundled reference imagery for offline use and Earth overview: NASA LRO/LROC, Viking MDIM and Blue Marble (sources in Asset credits). World sizes and distances are staged for navigation.</p><p>{profile?.manifest.attribution??'Earth elevation data: Copernicus DEM GLO-30. Planetary data: MOLA and LOLA.'}</p><p>Earth's reference imagery continues onto the surface, with illustrative elevation tint and lighting. Measured heights are limited to the selected DEM footprint; the curved surroundings are context, not additional terrain data. No footpad-scale detail is resolved. Equipment shapes are prototype visualizations.</p><h3>Click anywhere</h3><p>Pinned points are scored on demand from the USGS Astrogeology global elevation mosaics (MGS MOLA 463 m for Mars, LRO LOLA 118 m for the Moon). Landforms: USGS SIM 3292 global geologic map of Mars (1:20M) and the USGS Unified Geologic Map of the Moon (1:5M, 2020), through an unreviewed unit table. Place names: IAU Gazetteer of Planetary Nomenclature. Matching service hosted on Supabase. These rankings are not reviewed and not validated.</p><a href="/textures/ATTRIBUTION.md" target="_blank" rel="noreferrer">Asset credits and licences</a><p>Typography: Inter, DM Mono and Michroma, SIL Open Font License. Furgan’s procedural lander and cinematic modules are retained.</p><a href="/findings.html" target="_blank" rel="noreferrer">Findings · methods, discoveries and limits</a><br/><a href="?engineering-planner">Open engineering planner</a></div></Dialog>}
  </div>;
}
