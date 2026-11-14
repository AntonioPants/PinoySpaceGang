import type { SiteTerrain } from '../../src/types.ts';

const label = (key: string) => key.replace(/_/g, ' ');

/** Render every field, including provenance and explicit unknown/not-applicable values. */
function Value({ value }: { value: unknown }) {
  if (value === null) return <span>Unknown / unavailable (see status and reason)</span>;
  if (Array.isArray(value)) return value.length
    ? <ul>{value.map((item, i) => <li key={i}><Value value={item} /></li>)}</ul>
    : <span>None recorded</span>;
  if (typeof value === 'object' && value) {
    const fields = Object.entries(value);
    return fields.length ? <dl>{fields.map(([key, item]) => <div key={key}>
      <dt>{label(key)}</dt><dd><Value value={item} /></dd>
    </div>)}</dl> : <span>None recorded</span>;
  }
  if (typeof value === 'string' && /^https?:\/\//.test(value)) {
    return <a href={value} target="_blank" rel="noreferrer">{value}</a>;
  }
  return <span>{String(value)}</span>;
}

export function CatalogDetails({ site }: { site?: SiteTerrain }) {
  const data = site?.catalog;
  if (!data) return null;
  return <section className="catalog-details" aria-label="Site catalog data">
    <h2>Site categories and conditions</h2>
    <p>{data.record.name}. These are source-site properties; a planetary scenario does not turn Earth weather into planetary measurements.</p>
    <details open><summary>Pairing accuracy checks</summary>
      <p>Regional terrain similarity is not an accuracy percentage. These checks reproduce the grid measurements and test sensitivity to moving the analysis window. Independent scientific validation, environmental equivalence and landing safety remain unestablished.</p>
      {data.pairings.map(pair => <details key={`${pair.earth_id}-${pair.planetary_id}`}>
        <summary>{label(pair.earth_id)} → {label(pair.planetary_id)}</summary>
        <Value value={pair.accuracy_check ?? { status: 'unavailable', reason: 'No accuracy audit supplied in this catalog.' }} />
      </details>)}
    </details>
    {Object.entries(data.record).map(([key, value]) => <details key={key} open={key === 'classification'}>
      <summary>{label(key)}</summary><Value value={value} />
    </details>)}
    <details><summary>Proposed pairings and comparison results</summary><Value value={data.pairings} /></details>
    <details><summary>Seasonal environment profile (2015–2024)</summary>
      <p>Separate regional baseline, not the catalog's 2024 annual means. Includes all months, seasons, weather scenarios, radiation, soil context and source records. Selecting this site does not automatically apply a seasonal scenario.</p>
      <Value value={data.environment} />
    </details>
    {data.target && <details><summary>Planetary target data (separate record)</summary><Value value={data.target} /></details>}
    <details><summary>Simulation inputs and assumptions</summary>
      <Value value={{ wind: site.wind ?? null, albedo: site.albedo ?? null,
        soilType: site.soilType ?? null, sunElevationDeg: site.sunElevationDeg ?? null,
        sources: site.sources ?? {}, analogOf: site.analogOf ?? null }} />
    </details>
    <a download={`${site.id}-catalog.json`} href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`}>Download complete site record</a>
  </section>;
}
