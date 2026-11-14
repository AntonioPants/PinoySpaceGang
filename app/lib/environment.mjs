/** Offline Earth environment adapter. SI units; +X east, +Y up, +Z south. */
const SITE_ID = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const MATERIAL_UNITS = { contact_friction: '1', bulk_density_kg_m3: 'kg/m3', cohesion_pa: 'Pa', friction_angle_deg: 'degree', bearing_capacity_pa: 'Pa' };

export function validateProfile(profile) {
  if (profile?.schema_version !== '1.0.0' || !SITE_ID.test(profile?.site?.id ?? '')) throw new Error('Unsupported environment profile');
  if (!profile.months || !profile.seasons || !profile.soil || !Array.isArray(profile.sources)) throw new Error('Incomplete environment profile');
  for (const key of Array.from({ length: 12 }, (_, i) => String(i + 1))) {
    if (!profile.months[key]?.statistics || !profile.months[key]?.scenarios) throw new Error(`Missing month ${key}`);
  }
  for (const key of ['DJF', 'MAM', 'JJA', 'SON']) {
    if (!profile.seasons[key]?.statistics || !profile.seasons[key]?.scenarios) throw new Error(`Missing season ${key}`);
  }
  return profile;
}

export async function loadEnvironmentProfile(baseUrl, siteId, { signal } = {}) {
  if (!SITE_ID.test(siteId)) throw new Error('Invalid site ID');
  const base = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`, globalThis.location?.href ?? 'http://localhost/');
  const response = await fetch(new URL(`${siteId}.json`, base), { signal });
  if (!response.ok) throw new Error(`Environment request failed (${response.status}): ${siteId}`);
  return validateProfile(await response.json());
}

/** Selects one actual modelled hour. Seasonal albedo/solar context stays separate. */
export function createSimulationInputs(profile, { month, season, scenario = 'typical', materialOverrides = {} } = {}) {
  validateProfile(profile);
  if ((month !== undefined) === (season !== undefined)) throw new Error('Select exactly one month or season');
  if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) throw new Error('Month must be 1..12');
  if (season !== undefined && !['DJF', 'MAM', 'JJA', 'SON'].includes(season)) throw new Error('Unknown season');
  if (!['typical', 'high_wind'].includes(scenario)) throw new Error('Unknown scenario');
  const period = month !== undefined ? profile.months[String(month)] : profile.seasons[season];
  const row = period.scenarios[scenario];
  if (!row) throw new Error('No complete weather record for this period');
  for (const k of ['air_temperature_k', 'pressure_pa', 'relative_humidity_pct', 'wind_speed_m_s', 'wind_from_deg', 'wind_east_m_s', 'wind_north_m_s', 'air_density_kg_m3', 'precipitation_mm_h']) {
    if (!Number.isFinite(row[k])) throw new Error(`Missing or invalid weather value: ${k}`);
  }
  if (row.air_temperature_k <= 0 || row.pressure_pa <= 0 || row.air_density_kg_m3 <= 0 || row.wind_speed_m_s < 0 || row.relative_humidity_pct < 0 || row.relative_humidity_pct > 100) throw new Error('Weather outside physical bounds');
  const ground = Object.fromEntries(Object.entries(MATERIAL_UNITS).map(([key, units]) => [key, { value: null, units, evidence: 'unavailable', source: null }]));
  for (const [key, parameter] of Object.entries(materialOverrides)) {
    if (!(key in MATERIAL_UNITS)) throw new Error(`Unknown ground parameter: ${key}`);
    if (!parameter || !Number.isFinite(parameter.value) || parameter.value < 0 || typeof parameter.source !== 'string' || !parameter.source.trim() || !['measured', 'assumed'].includes(parameter.evidence)) throw new Error(`Provide value, evidence and source for ${key}`);
    if (key === 'bulk_density_kg_m3' && parameter.value === 0) throw new Error('Bulk density must be positive');
    if (key === 'friction_angle_deg' && parameter.value >= 90) throw new Error('Friction angle must be less than 90 degrees');
    ground[key] = { ...parameter, units: MATERIAL_UNITS[key] };
  }
  return {
    siteId: profile.site.id, period: month ?? season, scenario,
    weather: { ...row, wind_vector_m_s: [row.wind_east_m_s, 0, -row.wind_north_m_s] },
    radiationContext: { ...period.radiation, evidence: profile.evidence.albedo, spatialSupport: profile.spatial_support.radiation, use: 'Monthly/seasonal background statistics, not instantaneous or pad-specific radiation' },
    ground,
    surfaceMaterials: profile.site.surface_materials,
    soilSurvey: profile.soil.survey ?? null,
    missingGroundParameters: Object.keys(ground).filter(key => ground[key].value === null),
    limitations: [...profile.limitations],
  };
}

/** Forces an explicit choice instead of converting unknown mechanics to zero. */
export function requireGroundParameters(inputs, names) {
  for (const name of names) {
    if (!Object.hasOwn(inputs.ground, name)) throw new Error(`Unknown ground parameter: ${name}`);
    if (inputs.ground[name].value === null) throw new Error(`Ground parameter unavailable: ${name}`);
  }
}
