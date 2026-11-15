import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildLander, GEAR, type LanderSpec } from './lander';
import { antennaPackages, liveries, solarArrays } from '../../lib/landerAppearance';

function inspect(spec?: LanderSpec) {
  const lander=buildLander(spec);
  let vertices=0, meshes=0;
  const bounds=new THREE.Box3().setFromObject(lander.group.children[0]);
  lander.group.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;vertices+=o.geometry.attributes.position.count;}});
  const result={vertices,meshes,bounds,footRadius:lander.footRadius,colours:lander.debrisColors};
  const materials=new Set<THREE.Material>();
  lander.group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();materials.add(o.material as THREE.Material);}});
  materials.forEach(m=>m.dispose());
  return result;
}

describe('buildLander equipment',()=>{
  it('draws different hardware for different selections',()=>{
    expect(inspect({landingGearId:'survey-six'}).vertices).toBeGreaterThan(inspect({landingGearId:'standard-four'}).vertices);
    expect(inspect({vehicleId:'payload'}).vertices).toBeGreaterThan(inspect({vehicleId:'survey'}).vertices);
    expect(inspect({hazardSensor:'lidar'}).vertices).toBeGreaterThan(inspect({hazardSensor:'none'}).vertices);
  });
  it('retains every physical foot radius and ground level',()=>{
    for(const [id,gear] of Object.entries(GEAR)) {
      const result=inspect({landingGearId:id});
      expect(result.footRadius).toBe(gear.radius);
      expect(result.bounds.min.y).toBeCloseTo(0,5);
    }
  });
  it('changes the silhouette with the selected attachments',()=>{
    const width=(solarArrayId:LanderSpec['solarArrayId'])=>inspect({solarArrayId}).bounds.getSize(new THREE.Vector3()).x;
    expect(width('extended')).toBeGreaterThan(width('standard'));
    expect(width('standard')).toBeGreaterThan(width('compact'));
    expect(new Set(antennaPackages.map(a=>inspect({antennaId:a.id}).bounds.max.y)).size).toBe(3);
  });
  it('builds all 45 appearance combinations within a small draw-call budget',()=>{
    for(const livery of liveries)for(const solar of solarArrays)for(const antenna of antennaPackages) {
      const result=inspect({vehicleId:'payload',landingGearId:'survey-six',hazardSensor:'camera',liveryId:livery.id,solarArrayId:solar.id,antennaId:antenna.id});
      // static body batched by material, plus one draw call per moving leg and per solar wing
      expect(result.meshes).toBeLessThanOrEqual(12+GEAR['survey-six'].legs+2);
      expect(result.colours[0]).toBe(livery.hull);
      expect(result.footRadius).toBe(GEAR['survey-six'].radius);
      expect(Number.isFinite(result.bounds.max.y)).toBe(true);
    }
  });
  it('keeps legacy missions and unrecognized appearance values usable',()=>{
    expect(inspect()).toEqual(inspect({liveryId:'heritage',solarArrayId:'standard',antennaId:'dish'}));
    expect(inspect({liveryId:'missing',solarArrayId:'missing',antennaId:'missing'} as unknown as LanderSpec)).toEqual(inspect());
  });
});
