import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import raw from '../../public/sites.json';
import { displaySiteName, parseCatalog, recommendedAnalog, recommendedAnalogs } from './catalog';
import { percent } from './matching';
import AnalogComparison from '../components/AnalogComparison';

it('shows both location records with the match metrics and no audit breakdown or candidates',()=>{
  const catalog=parseCatalog(raw);
  const html=renderToStaticMarkup(<AnalogComparison catalog={catalog} targetId="shackleton-rim" earthId="kilbourne-hole-v1"/>);
  expect(catalog.matching?.comparisons.some(p=>p.planetary_id==='shackleton-rim' && p.earth_id==='kilbourne-hole-v1')).toBe(true);
  const shown=catalog.matching!.comparisons.find(p=>p.planetary_id==='shackleton-rim' && p.earth_id==='kilbourne-hole-v1')!;
  expect(shown.analog_score_percent).toBeCloseTo(0.5*shown.landform_match_percent!+0.5*shown.terrain_similarity_percent!,2);
  for(const text of ['Analog match','Overall match','Terrain match','Not verified','same landform type',percent(shown.analog_score_percent),percent(shown.terrain_similarity_percent)]) expect(html).toContain(text);
  for(const text of ['Moon / Mars location','Selected Earth location','Shackleton northern rim','Kilbourne Hole','Coordinates','Surface material','Wind speed (10 m)']) expect(html).toContain(text);
  const lunar=html.split('aria-label="Moon / Mars location"')[1].split('</article>')[0];
  expect(lunar).not.toContain('Air temperature (2 m)');
  expect(lunar).not.toContain('Wind speed (10 m)');
  expect(lunar).toContain('Regional thermal-bin minimum');
  expect(html).not.toContain('window sensitivity');
  for(const text of ['Environmental similarity','Model evidence coverage','Compare all','<table','50.0%']) expect(html).not.toContain(text);
});

it('recommends the top available evidence-backed location for each target',()=>{
  const catalog=parseCatalog(raw);
  for(const target of catalog.targets) {
    const first=catalog.matching!.comparisons.find(p=>p.planetary_id===target.id && p.candidate_rank===1)!;
    expect(recommendedAnalog(catalog,target.id)?.id).toBe(first.earth_id);
  }
  const first=recommendedAnalog(catalog,'arsia-flank')!;
  first.available=false;
  expect(recommendedAnalog(catalog,'arsia-flank')?.id).not.toBe(first.id);
});

it('preserves unknowns and genuine zero percentages',()=>{
  expect(percent(null)).toBe('Not established');
  expect(percent(undefined)).toBe('Not established');
  expect(percent(NaN)).toBe('Not established');
  expect(percent(0)).toBe('0.0%');
});

it('offers up to ten unique available candidates in the pipeline order for every target',()=>{
  const catalog=parseCatalog(raw);
  for (const target of catalog.targets) {
    const expected=catalog.matching!.comparisons.filter(p=>p.planetary_id===target.id)
      .sort((a,b)=>a.candidate_rank-b.candidate_rank).slice(0,10).map(p=>p.earth_id);
    const choices=recommendedAnalogs(catalog,target.id);
    expect(choices.map(s=>s.id)).toEqual(expected);
    expect(new Set(choices.map(s=>s.id)).size).toBe(expected.length);
    expect(expected.length).toBeGreaterThan(0);
    expect(expected.length).toBeLessThanOrEqual(10);
    expect(choices.every(s=>s.available)).toBe(true);
  }
});

it('skips unavailable and unreproduced candidates, without padding sparse evidence',()=>{
  const catalog=parseCatalog(structuredClone(raw));
  const target='marius-hills';
  const first=recommendedAnalogs(catalog,target)[0];
  first.available=false;
  expect(recommendedAnalogs(catalog,target)).toHaveLength(9);
  expect(recommendedAnalogs(catalog,target)).not.toContain(first);
  const rows=catalog.matching!.comparisons.filter(p=>p.planetary_id===target);
  for (const row of rows) row.verification.catalog_features_reproduced=false;
  expect(recommendedAnalogs(catalog,target)).toEqual([]);
  rows.find(p=>p.earth_id!==first.id)!.verification.catalog_features_reproduced=true;
  expect(recommendedAnalogs(catalog,target)).toHaveLength(1);
  expect(recommendedAnalogs(catalog,'missing-target')).toEqual([]);
});

it.each(['malapert-massif','mons-mouton'])('exposes the new lunar study area %s without Earth weather', id=>{
  const catalog=parseCatalog(raw);
  const earth=recommendedAnalog(catalog,id)!;
  const html=renderToStaticMarkup(<AnalogComparison catalog={catalog} targetId={id} earthId={earth.id}/>);
  expect(html).toContain(catalog.entries.get(id)!.name);
  expect(html).toContain('Exploratory suggestion');
  const lunar=html.split('aria-label="Moon / Mars location"')[1].split('</article>')[0];
  expect(lunar).not.toContain('Air temperature (2 m)');
  expect(lunar).not.toContain('Wind speed (10 m)');
  expect(lunar).toContain('Regional thermal-bin minimum');
  expect(lunar).toContain('Surface temperature');
});


it("offers exactly ten per target and keeps every ground available separately",()=>{
  const c=parseCatalog(raw);
  expect(c.analogs.filter(s=>s.available)).toHaveLength(102);
  for(const t of c.targets) expect(recommendedAnalogs(c,t.id)).toHaveLength(10);
  for(const s of c.entries.values()) expect(s.name).not.toMatch(/study\s*area/i);
});

it('removes compass offsets and keeps terrain patch names distinct and stable',()=>{
  expect(displaySiteName('Example study area region: 6.1 km E, 15.7 km S')).toBe('Example region');
  const catalog=parseCatalog(raw);
  const reversed=parseCatalog({...raw, sites:[...raw.sites].reverse()});
  expect(new Set(catalog.analogs.map(s=>s.name)).size).toBe(catalog.analogs.length);
  for(const site of catalog.entries.values()) {
    expect(site.name).not.toMatch(/\d+(?:\.\d+)?\s*km\s*[NSEW]\b/i);
    expect(reversed.entries.get(site.id)?.name).toBe(site.name);
  }
});
