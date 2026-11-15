import { matchOf, pairingOf, scoreLabel, type Catalog } from '../lib/catalog';
import { LANDFORM_RELATION } from '../lib/matching';
import { clickEvidence, clickLandformLabel, clickScoreLabel, type ClickResponse } from '../lib/analogClick';
import type { PlanetarySite } from '../lib/types';

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
/** Evidence for a pinned point: an on-demand, unreviewed ranking. It never borrows a curated pairing's reviewed text. */
function PinEvidence({click,target,earthId}:{click:ClickResponse;target:PlanetarySite;earthId:string}) {
  const evidence = clickEvidence(click), landform = clickLandformLabel(click,earthId);
  return <section className="analog-evidence" aria-label="Analog evidence">
    <strong>{clickScoreLabel(click,earthId)}</strong><small>On-demand ranking for your pin · Engineering similarity, not validated accuracy, not reviewed.</small>
    {earthId.startsWith('scan-') && <p>Found by terrain scan; local geology not reviewed. A new window near a known region.</p>}
    <p className="evidence-line"><b>Basis:</b> {evidence.basis}</p>
    {landform&&<p className="evidence-line"><b>Landform:</b> {landform}</p>}
    <p className="evidence-line"><b>Breaks down:</b> {evidence.limits[0]}</p>
    <details><summary>More: evidence and limits</summary>
      <h3>Where this ranking breaks down</h3><ul>{evidence.limits.map(s=><li key={s}>{s}</li>)}</ul>
      <p>What Earth cannot reproduce: {target.gravity} m/s² target gravity versus 9.81 m/s² on Earth; {target.body==='Moon'?'vacuum':'thin Martian air'}; the target radiation environment. Radiation is not simulated.</p>
      <a href={click.provenance.dem.url} target="_blank" rel="noreferrer">Elevation source: {click.provenance.dem.product}</a>
    </details>
  </section>;
}
export default function AnalogEvidence({catalog,targetId,earthId,custom}:{catalog:Catalog;targetId:string;earthId:string;
  /** A scored pin and its synthetic target: shows on-demand copy instead of the catalog pairing. */
  custom?:{click:ClickResponse;target:PlanetarySite}}) {
  if (custom) return <PinEvidence click={custom.click} target={custom.target} earthId={earthId}/>;
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
  </section>;
}
