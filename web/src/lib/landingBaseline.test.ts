import {afterEach,expect,it,vi} from 'vitest';
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});
it('rejects a baseline produced by another physics implementation before using any cached result',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({schema_version:'1.0.0',rows:[],engine_sha256:'stale-engine'})}));
  const {loadLandingSimilarity}=await import('./landingSimilarity');
  await expect(loadLandingSimilarity()).rejects.toThrow('different physics build');
  expect(fetch).toHaveBeenCalledTimes(1);
});
