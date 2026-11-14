import { describe, expect, it } from 'vitest';
import { buildLander } from './lander';

const count = (spec: Parameters<typeof buildLander>[0]) => buildLander(spec).group.children.length;

describe('buildLander equipment', () => {
  it('draws different hardware for different selections', () => {
    expect(count({ landingGearId: 'survey-six' })).toBeGreaterThan(count({ landingGearId: 'standard-four' }));
    expect(count({ vehicleId: 'payload' })).toBeGreaterThan(count({ vehicleId: 'survey' }));
    expect(count({ hazardSensor: 'lidar' })).toBeGreaterThan(count({ hazardSensor: 'none' }));
  });
  it('widens the stance with the wide gear', () => {
    expect(buildLander({ landingGearId: 'wide-four' }).footRadius).toBeGreaterThan(buildLander({ landingGearId: 'standard-four' }).footRadius);
  });
  it('still builds the generic lander with no selection', () => {
    expect(buildLander().group.children.length).toBeGreaterThan(0);
  });
});
