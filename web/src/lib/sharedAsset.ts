/** A shared asset load has its own lifetime. A scene abort only detaches that consumer,
 * so skipping a cutscene cannot cancel a load the following scene is already using. */
export function sharedAsset<K,V>(load:(key:K)=>Promise<V>) {
  const entries=new Map<K,Promise<V>>();
  return (key:K,signal?:AbortSignal):Promise<V>=>{
    if(signal?.aborted)return Promise.reject(signal.reason??new DOMException('Aborted','AbortError'));
    let promise=entries.get(key);
    if(!promise){
      promise=Promise.resolve().then(()=>load(key)).catch(error=>{entries.delete(key);throw error;});
      entries.set(key,promise);
    }
    if(!signal)return promise;
    return new Promise<V>((resolve,reject)=>{
      const abort=()=>reject(signal.reason??new DOMException('Aborted','AbortError'));
      signal.addEventListener('abort',abort,{once:true});
      promise.then(value=>{signal.removeEventListener('abort',abort);if(!signal.aborted)resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});
    });
  };
}
