import {afterEach,describe,expect,it,vi} from 'vitest';
import {CutsceneEngine} from './engine';

afterEach(()=>vi.unstubAllGlobals());
describe('scene warm-up lifecycle',()=>{
  function preview(){return {disposed:false,scene:{},camera:{},renderer:{compile:vi.fn()},render:vi.fn()};}
  it('compiles and uploads the hidden scene before becoming ready',async()=>{
    const scene=preview();
    await CutsceneEngine.prototype.prepareView.call(scene as unknown as CutsceneEngine);
    expect(scene.renderer.compile).toHaveBeenCalledWith(scene.scene,scene.camera);
    expect(scene.render).toHaveBeenCalledTimes(1);
    expect(scene.renderer.compile.mock.invocationCallOrder[0]).toBeLessThan(scene.render.mock.invocationCallOrder[0]);
  });
  it('does no GPU work after an aborted warm-up or disposal',async()=>{
    const scene=preview(),ctl=new AbortController();ctl.abort();
    await CutsceneEngine.prototype.prepareView.call(scene as unknown as CutsceneEngine,ctl.signal);
    scene.disposed=true;
    await CutsceneEngine.prototype.prepareView.call(scene as unknown as CutsceneEngine);
    expect(scene.renderer.compile).not.toHaveBeenCalled();expect(scene.render).not.toHaveBeenCalled();
  });
  it('does not declare readiness when the horizon failed',async()=>{
    const scene={...preview(),scenery:{ready:false,failed:true}};
    await expect(CutsceneEngine.prototype.prepareView.call(scene as unknown as CutsceneEngine)).rejects.toThrow('Distant terrain could not load');
    expect(scene.renderer.compile).not.toHaveBeenCalled();
  });
  it('stages a frame without playing audio or starting an animation loop',()=>{
    const scene={begin:vi.fn(),step:vi.fn(),render:vi.fn(),audio:{start:vi.fn()}};
    CutsceneEngine.prototype.stagePreview.call(scene as unknown as CutsceneEngine,'opening',{target:{x:12,y:34}});
    expect(scene.begin).toHaveBeenCalledWith('opening',{target:{x:12,y:34}});
    expect(scene.step).toHaveBeenCalledWith(0);expect(scene.render).toHaveBeenCalledTimes(1);
    expect(scene.audio.start).not.toHaveBeenCalled();
  });
  it('suspends a hidden cached renderer without disposing it',()=>{
    const cancel=vi.fn(),request=vi.fn(()=>42);vi.stubGlobal('cancelAnimationFrame',cancel);vi.stubGlobal('requestAnimationFrame',request);
    const scene={disposed:false,raf:7,tick:vi.fn(),last:0,renderer:{dispose:vi.fn()}};
    CutsceneEngine.prototype.setActive.call(scene as unknown as CutsceneEngine,false);
    expect(cancel).toHaveBeenCalledWith(7);expect(request).not.toHaveBeenCalled();
    CutsceneEngine.prototype.setActive.call(scene as unknown as CutsceneEngine,true);
    expect(request).toHaveBeenCalledWith(scene.tick);expect(scene.renderer.dispose).not.toHaveBeenCalled();
  });
});
