import {useEffect,useState} from 'react';
import {loadCatalog,scoreLabel,type Catalog} from '../../../lib/catalog';
import {evidenceFor} from '../../../components/AnalogEvidence';
import LandingEvidence from '../../../components/LandingEvidence';
import type { MissionConfig, MissionSettings } from '../../../lib/types';
import { overall, type Check } from '../checklist';
import { Light, STATUS_PHRASE } from './ui';

/** The link to mission control: what is being flown, where, and whether it is clear to launch. */
export default function MissionControlScreen({ mission, settings, checks }: { mission: MissionConfig; settings: MissionSettings; checks: Check[] }) {
  const body = mission.planetaryTarget.body, earth = settings.environment === 'earth';
  const state = overall(checks);
  const [catalog,setCatalog]=useState<Catalog|null>(null);
  useEffect(()=>{let active=true;loadCatalog().then(c=>{if(active)setCatalog(c);}).catch(()=>{});return()=>{active=false;};},[]);
  const evidence=catalog?evidenceFor(catalog,mission.planetaryTarget.id,mission.earthAnalog.id):null;
  return <>
    <header><h2>Mission control</h2><span className="mon-link"><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" />Link open</span></header>
    <div className="mon-columns">
      <section>
        <h3>Flight plan</h3>
        <dl className="mon-facts">
          <div><dt>Departed</dt><dd>{mission.planetaryTarget.name}<small>{body}</small></dd></div>
          <div><dt>Test site</dt><dd>{mission.earthAnalog.name}<small>Earth</small></dd></div>
          <div><dt>Analog match</dt><dd>{catalog?scoreLabel(catalog,mission.planetaryTarget.id,mission.earthAnalog.id):'Loading evidence…'}<small title={evidence?.matches[0]} style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:220}}>Match: {evidence?.matches[0]??'Not reviewed'}</small><small title={evidence?.differences[0]} style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:220}}>Limit: {evidence?.differences[0]??'No reviewed geological analogy'}</small><LandingEvidence compact targetId={mission.planetaryTarget.id} earthId={mission.earthAnalog.id}/></dd></div>
          <div><dt>Test physics</dt><dd>{earth ? <>9.81 m/s²<small>Earth field test, Earth air</small></> : body === 'Moon' ? <>1.62 m/s²<small>Moon gravity, vacuum</small></> : <>{mission.planetaryTarget.gravity} m/s²<small>Mars gravity, thin air</small></>}</dd></div>
        </dl>
      </section>
      <section>
        <h3>Launch readiness</h3>
        <div className={`mon-banner ${state}`}>{STATUS_PHRASE[state]}</div>
        <ul className="mon-checks">{checks.map(c => <li key={c.id}><Light status={c.status} /><div><strong>{c.label}</strong><p>{c.detail}</p></div></li>)}</ul>
      </section>
    </div>
  </>;
}
