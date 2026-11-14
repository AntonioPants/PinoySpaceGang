import { createSimulationInputs, loadEnvironmentProfile, requireGroundParameters } from '../app/lib/environment.mjs';
const profile = await loadEnvironmentProfile('http://localhost/environment/', 'kilbourne_hole');
const inputs = createSimulationInputs(profile, { season: 'DJF', scenario: 'high_wind' });
const vector: [number, number, number] = inputs.weather.wind_vector_m_s;
requireGroundParameters(inputs, ['contact_friction']);
// @ts-expect-error Exactly one month or season is required.
createSimulationInputs(profile, { month: 1, season: 'DJF' });
// @ts-expect-error Unknown site IDs must not be accepted.
loadEnvironmentProfile('/', 'fake_site');
console.log(vector);
