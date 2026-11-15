// Landform-family agreement. A port of landform() in scripts/catalog/analog_score.py (1.0.0).

export const RELATED_AFFINITY = 0.5;
/** An unreviewed label earns less than a reviewed catalog label. */
export const INFERRED_FACTOR = 0.75;
/** A crater is a single feature: the label is never inferred for neighbouring windows. */
export const NOT_INFERABLE_FAMILIES: ReadonlySet<string> = new Set(['crater']);

export const FAMILIES: Readonly<Record<string, string>> = {
  volcanic_plain: 'volcanic', lava_field: 'volcanic',
  crater: 'crater', impact_crater: 'crater',
  dune_field: 'aeolian',
  delta: 'sedimentary', playa: 'sedimentary', badlands: 'sedimentary', canyon: 'sedimentary',
  rocky_desert: 'desert',
  polygonal_ground: 'periglacial',
  massif: 'massif',
};
export const FAMILY_NAMES = ['volcanic', 'crater', 'aeolian', 'sedimentary', 'desert', 'periglacial', 'massif'] as const;
const RELATED = new Set(['crater|volcanic', 'desert|sedimentary', 'crater|massif']);

export type Relation = 'unknown' | 'same_family' | 'related_family' | 'different_family';
export interface Landform { earth_family: string | null; planetary_family: string | null; relation: Relation; match_percent: number; status: string }

function relation(a: string | null, b: string | null): [Relation, number] {
  if (a === null || b === null) return ['unknown', 0];
  if (a === b) return ['same_family', 1];
  return RELATED.has([a, b].sort().join('|')) ? ['related_family', RELATED_AFFINITY] : ['different_family', 0];
}

const familyOf = (morphology: string | null | undefined) =>
  morphology != null && Object.prototype.hasOwnProperty.call(FAMILIES, morphology) ? FAMILIES[morphology] : null;

/**
 * Agreement between an Earth site and a planetary landform family.
 * `planetaryFactor` discounts an unreviewed planetary label (a geologic map unit or gazetteer
 * feature translated to a family for a clicked point) and `planetaryStatus` names it. The
 * discount is not compounded with the Earth side's inferred factor: a pairing with an
 * unreviewed label on either side is scored at the smaller factor once.
 */
export function landformForFamily(earthMorphology: string | null | undefined, planetaryFamily: string | null,
  inferredLandforms: readonly string[] = [], planetaryFactor = 1, planetaryStatus?: string): Landform {
  const a = familyOf(earthMorphology), b = planetaryFamily;
  const [rel, affinity] = relation(a, b);
  const result: Landform = { earth_family: a, planetary_family: b, relation: rel, match_percent: 100 * affinity * planetaryFactor,
    status: planetaryFactor !== 1 && planetaryStatus && a !== null && b !== null ? planetaryStatus : 'interpretation_only' };
  if (a === null && b !== null && inferredLandforms.length) {
    const families = [...new Set(inferredLandforms.map(familyOf).filter((f): f is string => f !== null))]
      .filter(f => !NOT_INFERABLE_FAMILIES.has(f)).sort();
    let best: { affinity: number; family: string } | null = null;
    for (const family of families) {
      const value = relation(family, b)[1];
      // Python: max(options, key=(affinity, family == b, family)); families ascend, so a later tie wins.
      if (!best || value > best.affinity || value === best.affinity && Number(family === b) >= Number(best.family === b)) best = { affinity: value, family };
    }
    if (best) {
      result.earth_family = best.family; result.relation = relation(best.family, b)[0];
      result.match_percent = 100 * Math.min(INFERRED_FACTOR, planetaryFactor) * best.affinity;
      result.status = 'inferred_from_scan_region_unreviewed';
    }
  }
  return result;
}

/** Exactly the pipeline's landform(): both sides given as catalog morphology labels. */
export function landform(earthMorphology: string | null | undefined, planetaryMorphology: string | null | undefined,
  inferredLandforms: readonly string[] = []): Landform {
  return landformForFamily(earthMorphology, familyOf(planetaryMorphology), inferredLandforms);
}
