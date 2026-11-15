import type { CatalogSite } from '../../../../../app/sim/src/catalog';
import type { TerrainProfile } from '../../../lib/types';

export interface TerrainSiteMetadata {
  id?: string; name?: string; body?: 'earth'|'moon'|'mars'; latitude?: number;
  source?: string; sourceUrl?: string; nativeResolutionM?: number;
  /** Explicit scene lighting, not a computed ephemeris. */
  solarElevationDeg?: number; solarAzimuthDeg?: number;
  tint?: string;
  /** Fallback support and desired statistics. These never feed physics. */
  widthM?: number; depthM?: number; reliefM?: number; meanSlopeDeg?: number; roughnessM?: number;
}
export interface TerrainData {
  name:string; body:string; rows:number; columns:number; dx:number; dy:number;
  width:number; depth:number; heights:Float32Array; slopes:Float32Array;
  mean:number; meanSlope:number|null; p95Slope:number|null; relief:number; roughness:number;
  synthetic:boolean; note:string; source:string;
  /** The raw elevation file the grid was cut from (provenance; often a multi-gigabyte GeoTIFF). */
  sourceUrl?:string;
  /** A page describing the elevation dataset, for people to read. */
  sourcePage?:string; nativeResolution?:number;
  sunElevation:number; sunAzimuth:number; tint:string; missing:number;
}
/** The open elevation datasets the terrain packs are cut from: a readable name and the product's description page. */
const DATASETS:Array<{match:RegExp;name:string;page:string}>=[
  {match:/copernicus-dem|COP-DEM/i,name:'Copernicus DEM GLO-30 (ESA)',page:'https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM'},
  {match:/LOLA/i,name:'LRO LOLA global DEM, 118 m (NASA / USGS)',page:'https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m'},
  {match:/MOLA/i,name:'MGS MOLA global DEM, 463 m (NASA / USGS)',page:'https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m'},
];
/** A link people can open: never a raw data file, which a browser would start downloading. */
const readablePage=(url?:string)=>url&&/^https?:\/\//.test(url)&&!/\.(tif{1,2}|img|f32|zip|gz|nc|h5)(\?|$)/i.test(url)?url:undefined;
export const datasetOf=(url?:string)=>url?DATASETS.find(d=>d.match.test(url)):undefined;
const finite = (v:unknown):v is number => typeof v==='number'&&Number.isFinite(v);
const positive = (v:unknown):v is number => finite(v)&&v>0;
export function slopeGrid(h:Float32Array,rows:number,cols:number,dx:number,dy:number):Float32Array {
  const out=new Float32Array(h.length).fill(NaN);
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const i=r*cols+c,l=Math.max(0,c-1),rr=Math.min(cols-1,c+1),n=Math.max(0,r-1),s=Math.min(rows-1,r+1);
    if(![h[i],h[r*cols+l],h[r*cols+rr],h[n*cols+c],h[s*cols+c]].every(Number.isFinite))continue;
    out[i]=Math.atan(Math.hypot((h[r*cols+rr]-h[r*cols+l])/((rr-l)*dx),(h[s*cols+c]-h[n*cols+c])/((s-n)*dy)))*180/Math.PI;
  }
  return out;
}
function stats(h:Float32Array,rows:number,cols:number,dx:number,dy:number){
  const valid=Array.from(h).filter(Number.isFinite);
  if(!valid.length)throw new Error('DEM has no valid elevation samples.');
  let min=Infinity,max=-Infinity,sum=0;
  for(const z of valid){min=Math.min(min,z);max=Math.max(max,z);sum+=z;}
  const slopes=slopeGrid(h,rows,cols,dx,dy),ss=Array.from(slopes).filter(Number.isFinite).sort((a,b)=>a-b);
  let variance=0,count=0;
  for(let r=1;r<rows-1;r++)for(let c=1;c<cols-1;c++){
    const values:number[]=[];
    for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)values.push(h[(r+y)*cols+c+x]);
    if(!values.every(Number.isFinite))continue;
    const mean=values.reduce((a,b)=>a+b,0)/9;
    variance+=values.reduce((a,b)=>a+(b-mean)**2,0)/9;count++;
  }
  return {slopes,mean:sum/valid.length,relief:max-min,meanSlope:ss.length?ss.reduce((a,b)=>a+b,0)/ss.length:null,
    p95Slope:ss.length?ss[Math.ceil(.95*ss.length)-1]:null,roughness:count?Math.sqrt(variance/count):0,missing:h.length-valid.length};
}
function seedOf(id:string){let seed=2166136261;for(const ch of id)seed=Math.imul(seed^ch.charCodeAt(0),16777619);return seed>>>0;}
/** Deterministic bounded search: exact relief scaling, approximate slope/RMS fit.
 * RMS is a 3x3 display-grid height deviation, not necessarily the catalog's measurement scale.
 * Aggregate statistics cannot reconstruct a location. No synthetic output leaves this viewer.
 */
function synthesize(id:string,width:number,depth:number,relief:number,slope?:number,roughness?:number){
  const n=49,seed=seedOf(id),phase=seed/4294967296*2*Math.PI;
  let best=new Float32Array(n*n),loss=Infinity;
  for(const frequency of [1,2,4,8,12])for(const fine of [0,.15,.4,.8]){
    const h=new Float32Array(n*n);let min=Infinity,max=-Infinity;
    for(let r=0;r<n;r++)for(let c=0;c<n;c++){
      const x=c/(n-1),y=r/(n-1);
      const z=Math.sin(x*Math.PI*2*frequency+phase)*Math.cos(y*Math.PI*frequency+phase*.7)
        +fine*Math.sin((x+y)*Math.PI*16+phase)*Math.cos((x-y)*Math.PI*12);
      h[r*n+c]=z;min=Math.min(min,z);max=Math.max(max,z);
    }
    for(let i=0;i<h.length;i++)h[i]=(h[i]-min)/(max-min||1)*relief;
    const s=stats(h,n,n,width/(n-1),depth/(n-1));
    const error=(finite(slope)?((s.meanSlope!-slope)/Math.max(1,slope))**2:0)
      +(finite(roughness)?((s.roughness-roughness)/Math.max(1,roughness))**2:0);
    if(error<loss){loss=error;best=h;}
  }
  return best;
}
export function prepareTerrain(profile:TerrainProfile|null|undefined,entry:CatalogSite|undefined,meta:TerrainSiteMetadata={},fallbackBody='earth'):TerrainData {
  const manifest=profile?.manifest,body=meta.body??entry?.body??manifest?.body.toLowerCase()??fallbackBody;
  const q=(key:string)=>{const v=entry?.conditions[key]?.value;return finite(v)?v:undefined;};
  const grid=manifest?.grid as (NonNullable<typeof manifest>['grid']&{order?:string;row_order?:string;column_order?:string;nodata?:number})|undefined;
  let rows=grid?.rows??entry?.terrain?.rows??49,columns=grid?.columns??entry?.terrain?.columns??49;
  let dx=grid?.spacing_m??entry?.terrain?.spacing_m??100,dy=dx;
  if(!Number.isInteger(rows)||!Number.isInteger(columns)||rows<2||columns<2||rows*columns>1_000_000||!positive(dx))throw new Error('Unsupported DEM dimensions or spacing.');
  let width=(columns-1)*dx,depth=(rows-1)*dy;
  let heights:Float32Array,synthetic=false,note='Real DEM; heights shown relative to each patch mean, with 1× vertical scale.';
  if(profile?.buffer?.byteLength){
    if(grid?.dtype!=='float32'||grid.byte_order!=='little-endian'||profile.buffer.byteLength!==rows*columns*4)throw new Error('DEM buffer or float32 encoding does not match its manifest.');
    const rowOrder=grid.row_order??(grid.order?.includes('south-first')?'south_to_north':'north_to_south');
    const colOrder=grid.column_order??'west_to_east';
    if(!['north_to_south','south_to_north'].includes(rowOrder)||colOrder!=='west_to_east'||grid.order?.includes('east-first'))throw new Error('Unsupported DEM row/column order.');
    const view=new DataView(profile.buffer);heights=new Float32Array(rows*columns);
    for(let r=0;r<rows;r++)for(let c=0;c<columns;c++){
      const sourceRow=rowOrder==='south_to_north'?rows-1-r:r;
      const v=view.getFloat32((sourceRow*columns+c)*4,true);
      heights[r*columns+c]=!Number.isFinite(v)||v===grid.nodata?NaN:v;
    }
  }else{
    const relief=meta.reliefM??(finite(q('elevation_max'))&&finite(q('elevation_min'))?q('elevation_max')!-q('elevation_min')!:manifest?.statistics?.relief_m);
    if(!finite(relief)||relief<0)throw new Error('DEM unavailable; catalog relief is required for a labelled synthetic illustration.');
    width=positive(meta.widthM)?meta.widthM:width;depth=positive(meta.depthM)?meta.depthM:depth;
    rows=columns=49;dx=width/(columns-1);dy=depth/(rows-1);synthetic=true;
    const slope=meta.meanSlopeDeg??q('slope_mean'),roughness=meta.roughnessM??q('roughness_rms');
    heights=synthesize(meta.id??entry?.id??manifest?.id??body,width,depth,relief,slope,roughness);
    note=`Statistical illustration, not reconstructed terrain. Requested relief ${relief.toFixed(1)} m; mean slope ${finite(slope)?slope.toFixed(2)+'°':'unknown'}; RMS ${finite(roughness)?roughness.toFixed(1)+' m':'unknown'}. Fit is approximate; RMS support may differ from catalog. ${!grid&&!entry?.terrain&&!meta.widthM?'Assumed 4,800 m footprint.':''}`;
  }
  const source=manifest?.source as (NonNullable<typeof manifest>['source']&{native_spacing_m_approx?:number})|undefined;
  return {name:meta.name??entry?.name??manifest?.name??'Unnamed site',body,rows,columns,dx,dy,width,depth,heights,...stats(heights,rows,columns,dx,dy),synthetic,note,
    // A known dataset's own name and description page first: the loader fills generic names and copies the raw file into `catalog`.
    source:meta.source??datasetOf(meta.sourceUrl??source?.url)?.name??source?.dataset??(body==='moon'?'Lunar DEM':body==='mars'?'Martian DEM':'Earth DEM'),sourceUrl:meta.sourceUrl??source?.url??source?.catalog,
    sourcePage:datasetOf(meta.sourceUrl??source?.url)?.page??readablePage(source?.catalog),
    nativeResolution:meta.nativeResolutionM??source?.native_spacing_m_approx,
    sunElevation:finite(meta.solarElevationDeg)?Math.max(.5,Math.min(90,meta.solarElevationDeg)):body==='moon'&&Math.abs(meta.latitude??entry?.latitude??0)>75?5:body==='earth'?45:30,
    sunAzimuth:finite(meta.solarAzimuthDeg)?meta.solarAzimuthDeg:315,tint:meta.tint??(body==='moon'?'#999b9b':body==='mars'?'#b18b71':'#a7a088')};
}
/** Telemetry is x=east, y=north; north-first viewer coordinates are x=east, z=south. */
export function heightAt(data:TerrainData,x:number,north:number):number|null{
  const c=(x+data.width/2)/data.dx,r=(data.depth/2-north)/data.dy;
  if(!finite(c)||!finite(r)||c<0||r<0||c>data.columns-1||r>data.rows-1)return null;
  const c0=Math.min(data.columns-2,Math.floor(c)),r0=Math.min(data.rows-2,Math.floor(r)),u=c-c0,v=r-r0;
  const h=[data.heights[r0*data.columns+c0],data.heights[r0*data.columns+c0+1],data.heights[(r0+1)*data.columns+c0],data.heights[(r0+1)*data.columns+c0+1]];
  if(!h.every(Number.isFinite))return null;
  return (h[0]*(1-u)+h[1]*u)*(1-v)+(h[2]*(1-u)+h[3]*u)*v-data.mean;
}
/**
 * The central width x depth of a larger patch, resampled bilinearly at about its own spacing, so two
 * sites are drawn over the same ground area. Mars packs are 16 km wide and Earth and Moon packs 4.8 km:
 * side by side at one scale the Mars patch would be over three times the size. No data is invented:
 * every sample is interpolated inside the measured grid, and the statistics are recomputed for the window.
 */
export function cropTerrain(data:TerrainData,width:number,depth:number):TerrainData{
  if(!positive(width)||!positive(depth)||(data.width<=width*1.02&&data.depth<=depth*1.02))return data;
  const w=Math.min(width,data.width),d=Math.min(depth,data.depth);
  const columns=Math.max(2,Math.round(w/data.dx))+1,rows=Math.max(2,Math.round(d/data.dy))+1,dx=w/(columns-1),dy=d/(rows-1);
  const heights=new Float32Array(rows*columns);
  for(let r=0;r<rows;r++)for(let c=0;c<columns;c++)heights[r*columns+c]=heightAt(data,c*dx-w/2,d/2-r*dy)??NaN;
  return {...data,rows,columns,dx,dy,width:w,depth:d,heights,...stats(heights,rows,columns,dx,dy),
    note:`${data.note} Showing the central ${w.toFixed(0)} × ${d.toFixed(0)} m of the ${data.width.toFixed(0)} × ${data.depth.toFixed(0)} m measured patch, the same ground area as the other site.`};
}
