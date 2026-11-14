import type { Catalog, CatalogEntry } from '../lib/catalog';
import { LANDFORM_RELATION, percent } from '../lib/matching';

function LocationDetails({site, title}: {site: CatalogEntry; title: string}) {
  const readable = (value: unknown) => typeof value === 'string' ? value.replaceAll('_',' ') : 'Unknown';
  const quantities = [
    ['elevation_mean','Mean elevation'], ['slope_mean','Mean slope'],
    ...(site.body==='moon' ? [] : [['air_temperature_2m','Air temperature (2 m)'], ['wind_speed_10m','Wind speed (10 m)']]),
    ['surface_temperature','Surface temperature'], ['albedo','Albedo'],
    ...(site.body==='moon' ? [['bolometric_temperature_min','Regional thermal-bin minimum'], ['bolometric_temperature_max','Regional thermal-bin maximum']] : []),
  ];
  return <article className="location-detail" aria-label={title}>
    <h4>{title}</h4><strong>{site.name}</strong><p>{site.description}</p>
    <dl>
      <dt>Body / region</dt><dd>{readable(site.body)} / {site.region}</dd>
      <dt>Coordinates</dt><dd>{site.latitude.toFixed(4)}° latitude, {site.longitude.toFixed(4)}° east longitude</dd>
      <dt>Landform</dt><dd>{readable(site.morphology)}</dd>
      <dt>Surface material</dt><dd>{readable(site.substrate)}</dd>
      <dt>Atmosphere</dt><dd>{readable(site.classification?.atmosphere)}</dd>
      {quantities.map(([key,name])=>{
        const p=site.conditions[key];
        return <div key={key}><dt>{name}</dt><dd>{p?.value == null ? (p?.status==='not_applicable' ? 'Not applicable' : 'Unknown') :
          <>{Number(p.value.toFixed(2))} {p.unit} <small>({p.status})</small>
            <small className="comparison-period">{String(p.time_coverage ?? 'Time coverage unspecified')}</small>
            {p.source?.url && <a href={p.source.url} target="_blank" rel="noreferrer">Source</a>}</>}
          {p?.value == null && typeof p?.reason==='string' && <small className="comparison-period">{p.reason}</small>}
        </dd></div>;
      })}
    </dl>
    <p className="field-help">Values retain their own units and time coverage. Regional thermal bins are not annual air temperatures; elevations use each body's own datum.</p>
    <a href={site.evidence_url} target="_blank" rel="noreferrer">Location evidence</a>
  </article>;
}

export default function AnalogComparison({catalog,targetId,earthId}: {
  catalog: Catalog; targetId: string; earthId: string;
}) {
  const match = catalog.matching?.comparisons.find(p=>p.planetary_id===targetId && p.earth_id===earthId);
  const earth=catalog.entries.get(earthId), target=catalog.entries.get(targetId);
  return <section className="analog-comparison" aria-label="Earth match summary">
    <h3>Match summary</h3>
    <div className="comparison-metrics">
      <div><strong>{percent(match?.analog_score_percent)}</strong><span>Analog match</span></div>
      <div><strong>{match?.total_similarity_percent == null ? 'Not verified' : percent(match.total_similarity_percent)}</strong><span>Overall match</span></div>
      <div><strong>{percent(match?.terrain_similarity_percent)}</strong><span>Terrain match</span></div>
    </div>
    <p className="field-help">Selected from the current catalog. Analog match is half landform type{match?.landform ? ` (${LANDFORM_RELATION[match.landform.relation].toLowerCase()})` : ''} and half terrain match, which measures regional shape; an overall percentage needs compatible environmental data.</p>
    {match?.landform?.status === 'inferred_from_scan_region_unreviewed' && <p className="field-help">The landform contribution is inferred from nearby regional study sites and discounted by the matching model. Local landform and surface material remain unreviewed.</p>}
    {match?.evidence_status === 'exploratory_terrain_only' && <p className="field-help">Exploratory suggestion: no reviewed geological pairing is recorded for these locations.</p>}
    <div className="location-details-pair">
      {target && <LocationDetails site={target} title="Moon / Mars location"/>}
      {earth && <LocationDetails site={earth} title="Selected Earth location"/>}
    </div>
  </section>;
}
