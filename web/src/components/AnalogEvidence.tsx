import { matchOf, pairingOf, scoreLabel, type Catalog } from '../lib/catalog';
import { LANDFORM_RELATION } from '../lib/matching';
import ComparisonValidity from './ComparisonValidity';

export function evidenceFor(catalog: Catalog, targetId: string, earthId: string) {
  const pair = pairingOf(catalog, targetId, earthId), entry = catalog.entries.get(earthId);
  const match = matchOf(catalog, targetId, earthId);
  return {
    matches: pair?.explanation?.matches?.slice(0, 3) ?? ['Terrain descriptors provide an exploratory comparison; a geological analogy has not been reviewed.'],
    differences: [...new Set([...(pair?.explanation?.differences ?? []), ...(entry?.limitations ?? [])])],
    source: pair?.explanation?.sources?.[0] ?? entry?.evidence_url,
    relation: match?.landform ? LANDFORM_RELATION[match.landform.relation] : 'Landform relation not reviewed for this pair',
  };
}
export default function AnalogEvidence({catalog,targetId,earthId}:{catalog:Catalog;targetId:string;earthId:string}) {
  const evidence = evidenceFor(catalog,targetId,earthId), target = catalog.targets.find(t=>t.id===targetId)!;
  return <section className="analog-evidence" aria-label="Analog evidence">
    <strong>{scoreLabel(catalog,targetId,earthId)}</strong><small>{evidence.relation} · Engineering similarity, not validated accuracy.</small>
    {earthId.startsWith('scan-') && <p>Found by terrain scan; local geology not reviewed. A new window near a known region.</p>}
    {/* The strongest match and the main limit stay visible; the full lists fold away. */}
    <p className="evidence-line"><b>Matches:</b> {evidence.matches[0]}</p>
    <p className="evidence-line"><b>Breaks down:</b> {evidence.differences[0] ?? 'No pair-specific differences reviewed.'}</p>
    <details><summary>More: evidence and limits</summary>
      <h3>Why it matches</h3><ul>{evidence.matches.map(s=><li key={s}>{s}</li>)}</ul>
      <h3>Where the analogy breaks down</h3><ul>{(evidence.differences.length?evidence.differences:['No pair-specific differences reviewed.']).slice(0,3).map(s=><li key={s}>{s}</li>)}</ul>
      <p>What Earth cannot reproduce: {target.gravity} m/s² target gravity versus 9.81 m/s² on Earth; {target.body==='Moon'?'vacuum':'thin Martian air'}; the target radiation environment. Radiation is not simulated.</p>
      {evidence.source&&<a href={evidence.source} target="_blank" rel="noreferrer">Supporting source</a>}
    </details>
    <ComparisonValidity catalog={catalog} targetId={targetId} earthId={earthId}/>
  </section>;
}
