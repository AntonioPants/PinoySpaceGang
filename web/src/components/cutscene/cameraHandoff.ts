import {Vector3} from 'three';
import type {OpeningHandoff} from './engine';

/** Move with the simulated lander while easing from the cinematic's final framing. */
export function openingCameraPose(at:Vector3,position:Vector3,look:Vector3,opening:OpeningHandoff,age:number){
  const u=Math.min(1,Math.max(0,age/.9)),blend=u*u*(3-2*u);
  return {
    position:at.clone().add(new Vector3(...opening.offset).lerp(position.clone().sub(at),blend)),
    look:at.clone().add(new Vector3(...opening.look).lerp(look.clone().sub(at),blend)),
  };
}
