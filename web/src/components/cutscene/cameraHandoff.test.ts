import {describe,it,expect} from 'vitest';
import {Vector3} from 'three';
import {openingCameraPose} from './cameraHandoff';
import {clearHandoff,leaveHandoff,peekOpeningHandoff} from './engine';
describe('cinematic to live camera',()=>{
  const at=new Vector3(-400,1000,0),position=at.clone().add(new Vector3(-34,10,0)),look=at.clone().add(new Vector3(4,1,0));
  const opening={offset:[-30,12,3] as [number,number,number],look:[2,1.5,0] as [number,number,number]};
  it('starts at the final cinematic framing and ends at the live camera without changing its inputs',()=>{
    const start=openingCameraPose(at,position,look,opening,0),end=openingCameraPose(at,position,look,opening,.9);
    expect(start.position).toEqual(at.clone().add(new Vector3(...opening.offset)));
    expect(end.position).toEqual(position);expect(end.look).toEqual(look);
    expect(position.distanceTo(at)).toBeGreaterThan(30);
  });
  it('follows the real simulation position during the blend, including off-centre targets',()=>{
    const shift=new Vector3(82,-10,27),first=openingCameraPose(at,position,look,opening,.45);
    const moved=openingCameraPose(at.clone().add(shift),position.clone().add(shift),look.clone().add(shift),opening,.45);
    expect(moved.position.distanceTo(first.position.clone().add(shift))).toBeLessThan(1e-9);
    expect(moved.look.distanceTo(first.look.clone().add(shift))).toBeLessThan(1e-9);
  });
  it('does not reuse a cinematic camera after a skip or cleared handoff',()=>{
    const canvas={toDataURL:()=> 'test'} as unknown as HTMLCanvasElement;
    leaveHandoff(canvas,opening);expect(peekOpeningHandoff()).toEqual(opening);
    leaveHandoff(canvas);expect(peekOpeningHandoff()).toBeNull();
    leaveHandoff(canvas,opening);clearHandoff();expect(peekOpeningHandoff()).toBeNull();
  });
});
