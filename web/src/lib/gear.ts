import { GEAR } from '../components/cutscene/lander';
import type { MissionConfig } from './types';

/**
 * What the selected landing gear changes in the physics. Only its footprint: the legs stand on
 * the foot circle that is drawn, so ground slope, roughness and rocks are measured across that
 * radius. Nothing else about the gear is modelled: stability, leg count, pad size and stroke
 * need measured gear data (Yousef) and are not guessed here.
 */
export function gearFootprintM(mission: MissionConfig): number | undefined {
  const id = mission.equipment?.landingGearId;
  return id ? GEAR[id]?.radius : undefined;
}
