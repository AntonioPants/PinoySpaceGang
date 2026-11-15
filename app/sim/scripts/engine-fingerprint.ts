/** Hash actual simulation code and baseline setup, independent of checkout newlines. */
import {createHash} from 'node:crypto';
import {readdirSync,readFileSync} from 'node:fs';
const root=new URL('../../../',import.meta.url);
export function engineFingerprint():string {
  const files=readdirSync(new URL('app/sim/src/',root),{recursive:true}).map(String)
    .filter(p=>p.endsWith('.ts')).map(p=>'app/sim/src/'+p.replaceAll('\\','/'));
  files.push('app/sim/scripts/landing-similarity.ts','app/sim/scripts/catalog-node.ts',
    'web/src/lib/fidelity.ts','web/src/lib/simulation.ts','web/src/lib/gear.ts');
  const hash=createHash('sha256');
  for(const path of files.sort())hash.update(path+'\0'+readFileSync(new URL(path,root),'utf8').replace(/\r\n/g,'\n')+'\0');
  return hash.digest('hex');
}
