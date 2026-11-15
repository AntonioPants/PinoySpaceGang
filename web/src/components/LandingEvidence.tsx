import { useLandingSimilarity } from '../lib/landingSimilarity';
import { isCustomTarget } from '../lib/analogClick';
export default function LandingEvidence({targetId,earthId,compact=false}:{targetId:string;earthId:string;compact?:boolean}) {
  if (isCustomTarget(targetId)) return <div className="landing-evidence"><small>No landing baseline for a pinned point: the debrief flies the comparison landings on your pin's terrain after the flight.</small></div>;
  return <CatalogLandingEvidence targetId={targetId} earthId={earthId} compact={compact}/>;
}
function CatalogLandingEvidence({targetId,earthId,compact}:{targetId:string;earthId:string;compact:boolean}) {
  const row=useLandingSimilarity(targetId,earthId), s=row?.stress;
  return <div className="landing-evidence">{s?<><strong>Landing behaviour {s.score} / 100</strong><small>{Math.round(s.planetary.successRate*100)}% target / {Math.round(s.analog.successRate*100)}% Earth sampled landings succeed.</small></>:<small>Landing baseline not available for this pair.</small>}
    {!compact&&<small>Fixed baseline lander, target gravity; 25 blind trials per patch. Planetary grids: 150–500 m. Coarse operational comparison, not landing safety.</small>}
  </div>;
}
