import {describe,it,expect,vi} from 'vitest';
import {sharedAsset} from './sharedAsset';

describe('resident scene assets',()=>{
  it('joins concurrent warm-up and foreground loads, keeping the exact asset for view switches',async()=>{
    const asset={heights:new Float32Array([1,2,3])};
    const load=vi.fn(async()=>asset),get=sharedAsset(load);
    const [warm,foreground]=await Promise.all([get('site'),get('site')]);
    expect(warm).toBe(foreground);expect(await get('site')).toBe(asset);expect(load).toHaveBeenCalledTimes(1);
  });
  it('skipping a warm-up detaches it without cancelling the next scene',async()=>{
    let finish!:(v:object)=>void;
    const get=sharedAsset(()=>new Promise<object>(resolve=>{finish=resolve;}));
    const controller=new AbortController();
    const warming=get('site',controller.signal),next=get('site');
    const aborted=expect(warming).rejects.toMatchObject({name:'AbortError'});
    await Promise.resolve();controller.abort();const asset={};finish(asset);
    await aborted;expect(await next).toBe(asset);expect(await get('site')).toBe(asset);
  });
  it('retries failed loads and keeps different sites independent',async()=>{
    const load=vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce('moon').mockResolvedValueOnce('mars');
    const get=sharedAsset(load);
    await expect(get('moon')).rejects.toThrow('network');
    expect(await get('moon')).toBe('moon');expect(await get('mars')).toBe('mars');
    expect(load).toHaveBeenCalledTimes(3);
  });
  it('does not start work for an already cancelled consumer',async()=>{
    const load=vi.fn(),get=sharedAsset(load),controller=new AbortController();controller.abort();
    await expect(get('site',controller.signal)).rejects.toMatchObject({name:'AbortError'});
    expect(load).not.toHaveBeenCalled();
  });
});
