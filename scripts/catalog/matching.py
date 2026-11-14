"""Evidence-gated comparisons for every Earth/planetary combination.

Percentages are engineering similarity, never validated scientific accuracy.
Unknown or incompatible quantities cannot silently become a total score.
"""
import math
from heapq import nsmallest
from .accuracy import site_samples, audit_pair
from .scoring import FEATURES
from . import analog_score, terrain_features

VERSION = '2.1.0'
TOP_K = 10
# No minimum score cutoff: rank eligible terrain and retain ten per target.
MIN_EXPLORATORY_SCORE_PERCENT = 0.0
ENVIRONMENT = {
    'wind_speed_10m': ('m/s', 10.0),
    'air_temperature_2m': ('K', 100.0),
    'surface_temperature': ('K', 100.0),
    'albedo': ('1', 0.5),
}
CONTRACT = ('quantity_definition', 'statistic', 'temporal_basis', 'spatial_support', 'reference_height_m')
SOURCES = {
    'moon': 'https://science.nasa.gov/moon/weather-on-the-moon/',
    'mars': 'https://science.nasa.gov/mars/facts/',
}


def comparable_value(p, unit):
    value = p.get('value')
    if (not isinstance(value, (int,float)) or isinstance(value,bool) or not math.isfinite(value)
            or p.get('status') not in ('measured','derived','modeled')):
        return None
    if not (p.get('source') or {}).get('url') or not p.get('method') or not p.get('time_coverage'):
        return None
    if p.get('unit') == 'degC' and unit == 'K':
        return value+273.15
    return value if p.get('unit') == unit else None


def environment_feature(key, a, b):
    unit, scale = ENVIRONMENT[key]
    result = {'property':key, 'similarity_percent':None, 'unit':unit,
              'fixed_difference_scale':scale, 'status':'insufficient_evidence'}
    if 'not_applicable' in (a.get('status'),b.get('status')):
        return dict(result, status='physically_inapplicable',
                    reason='An atmospheric quantity absent on the Moon cannot be equated with a missing or zero Earth measurement.')
    if a.get('value') is None or b.get('value') is None:
        return dict(result, reason='At least one site lacks this quantity. Thermal brightness bins cannot substitute for annual surface or air temperature.')
    x,y=comparable_value(a,unit),comparable_value(b,unit)
    if x is None or y is None:
        return dict(result, reason='Requires finite sourced measurements/derived or modeled values, compatible units, processing method and time coverage. Assumptions are excluded.')
    ca,cb=a.get('comparison_contract') or {},b.get('comparison_contract') or {}
    if not all(key in ca and key in cb and ca[key]==cb[key] for key in CONTRACT):
        return dict(result, status='incompatible_or_unreviewed', reason='Product definition, statistic, temporal basis, spatial support and reference height must have an explicitly reviewed matching comparison contract.')
    if not all(isinstance(c.get(k),str) and c[k].strip() for c in (ca,cb) for k in CONTRACT if k!='reference_height_m'):
        return dict(result, status='incompatible_or_unreviewed', reason='Comparison definitions cannot be blank or null.')
    if not all(str(c.get('review_source_url','')).startswith('https://') for c in (ca,cb)):
        return dict(result, status='incompatible_or_unreviewed', reason='A sourced compatibility review is required; matching field names alone are insufficient.')
    expected_height=10 if key=='wind_speed_10m' else 2 if key=='air_temperature_2m' else None
    if ca['reference_height_m']!=expected_height:
        return dict(result, status='incompatible_or_unreviewed', reason='Reference height does not match the quantity being scored.')
    if key=='albedo' and not (0<=x<=1 and 0<=y<=1) or key=='wind_speed_10m' and min(x,y)<0 or unit=='K' and min(x,y)<0:
        return dict(result, reason='Value outside physical range.')
    return dict(result,status='comparable',earth_value=x,planetary_value=y,
        similarity_percent=round(100*max(0,1-abs(x-y)/scale),4),
        reason='Fixed-scale engineering similarity after unit conversion and explicit compatibility review; not independent scientific validation.')


def comparison(earth, planet, audit, proposed, score=None):
    checks=[environment_feature(k,earth['conditions'].get(k,{}),planet['conditions'].get(k,{})) for k in ENVIRONMENT]
    # `score` is the analog_score.pair_score result; without it the legacy audit score is reported.
    reproduced=audit['catalog_features_reproduced']
    if score is None:
        terrain=audit['recomputed_terrain_score'] if reproduced else None
        legacy=audit['window_sensitivity']
        score={'analog_score_percent':None,'landform':analog_score.landform(earth['morphology'],planet['morphology'],earth.get('inferred_landforms') or ()),
            'window_sensitivity':legacy['assessment'],
            'terrain_range_percent':[legacy[k]*100 if legacy[k] is not None else None for k in ('score_min','score_max')]}
    else:
        terrain=score['terrain_percent']/100 if reproduced and score['terrain_percent'] is not None else None
    env_known=[c['similarity_percent'] for c in checks if c['similarity_percent'] is not None]
    env=sum(env_known)/4 if len(env_known)==4 else None
    total=0.5*terrain*100+0.5*env if terrain is not None and env is not None else None
    rounded=lambda v: round(v,4) if v is not None else None
    return {'earth_id':earth['id'],'planetary_id':planet['id'],
        'evidence_status':'literature_informed_proposal' if proposed else 'exploratory_terrain_only',
        'scientifically_validated':False, 'validated_accuracy_percent':None,
        'analog_score_percent':rounded(score['analog_score_percent']) if terrain is not None else None,
        'landform_match_percent':score['landform']['match_percent'],
        'landform':score['landform'],
        'terrain_similarity_percent':round(terrain*100,4) if terrain is not None else None,
        'environment_similarity_percent':round(env,4) if env is not None else None,
        'total_similarity_percent':round(total,4) if total is not None else None,
        'total_reason':'All terrain and climate criteria required. Missing, physically inapplicable or unreviewed climate quantities prevent an overall percentage. No independent accuracy benchmark exists.' if total is None else
            'Engineering terrain-and-climate index only; excludes geology, mechanics and landing safety. Not a validated accuracy percentage.',
        'evidence_coverage_percent':round((0.5 if terrain is not None else 0)+0.125*len(env_known),6)*100,
        'verification':{'input_hashes_checked':bool(audit['sources']['earth'] and audit['sources']['planetary']),
            'catalog_features_reproduced':audit['catalog_features_reproduced'],
            'window_sensitivity':score['window_sensitivity'],
            'terrain_range_percent':[rounded(v) for v in score['terrain_range_percent']]},
        'environment_features':checks,
        'atmosphere':{'earth':'terrestrial atmosphere','planetary':'airless (tenuous exosphere)' if planet['body']=='moon' else 'thin CO2 atmosphere',
            'status':'different_regime','source_url':SOURCES[planet['body']],
            'reason':'Body-level context, not a site-specific atmospheric measurement. Changing simulation gravity or atmosphere does not alter the Earth site.'},
        'geology':{'earth_morphology':earth['morphology'],'planetary_morphology':planet['morphology'],
            'earth_substrate':earth['substrate'],'planetary_substrate':planet['substrate'],
            'status':'interpretation_only','source_urls':[earth['evidence_url'],planet['evidence_url']]},
        'input_elevation_sha256':{body:audit['sources'][body]['elevation_sha256'] if audit['sources'][body] else None for body in ('earth','planetary')}}


def eligibility_reason(site):
    """Cheap data/scale filter, never an equality test on interpreted geology labels."""
    t = site.get('terrain')
    if not t:
        return 'No terrain pack.'
    numeric = lambda v: isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)
    native, spacing = t.get('native_resolution_m_approx'), t.get('spacing_m')
    if not all(numeric(v) and 0 < v <= 1000 for v in (native, spacing)):
        return 'Terrain sampling is missing or exceeds the 1 km comparison scale.'
    if any(not numeric(t.get(k)) or t[k]*spacing < 4500 for k in ('rows', 'columns')):
        return 'Footprint cannot support a 4 km window shifted by 250 m.'
    if t.get('row_order') != 'north_to_south' or t.get('column_order') != 'west_to_east':
        return 'Unsupported grid orientation.'
    for key in FEATURES:
        p = site.get('comparison_features', {}).get(key, {})
        if (not numeric(p.get('value')) or p.get('status') != 'derived'
                or p.get('analysis_resolution_m') != 1000
                or p.get('unit') != ('deg' if key == 'slope_mean' else 'm')):
            return f'Missing or incompatible derived feature: {key}.'
    return None


def rank_key(row):
    # Order by the analog score the UI displays, so each tier reads top-down by percentage.
    # The shifted-window range stays in the record as a stability check, not a rank input.
    shown = row['analog_score_percent']
    return (row['evidence_status'] != 'literature_informed_proposal',
            -(shown if shown is not None else -1), row['earth_id'])


def attach_matching(catalog, public, *, exhaustive=False, sample_cache=None):
    from pathlib import Path
    public=Path(public)
    earth=sorted((s for s in catalog['sites'] if s['role']=='earth_analog'),key=lambda s:s['id'])
    targets=sorted((s for s in catalog['sites'] if s['role']=='planetary_target'),key=lambda s:s['id'])
    reasons={s['id']:eligibility_reason(s) for s in earth+targets}
    # Only share this ephemeral cache within one build of an immutable staged directory.
    # It is deliberately not persisted across changes to terrain files.
    samples = sample_cache if sample_cache is not None else {}
    for s in earth+targets:
        if reasons[s['id']] is not None:
            samples[s['id']] = None
        elif s['id'] not in samples:
            samples[s['id']] = site_samples(s,public)
    # Verify cheap descriptors from source bytes before using their score as a bound.
    # A stale cached descriptor must never prune a potentially good candidate.
    for site in earth+targets:
        sample = samples[site['id']]
        if reasons[site['id']] is not None:
            continue
        if not sample or not all(sample['samples']):
            reasons[site['id']] = 'Insufficient valid source samples for the comparison windows.'
        elif not all(math.isclose(sample['samples'][0][key]['value'],
                site['comparison_features'][key]['value'], rel_tol=1e-6, abs_tol=1e-6) for key in FEATURES):
            reasons[site['id']] = 'Catalog terrain descriptors do not reproduce from source samples.'
    proposals={(p['earth_id'],p['planetary_id']):p for p in catalog['pairings']}
    # Resolution-matched descriptors for the analog score: five shifted windows per site,
    # computed once per comparison resolution and shared by every pair.
    scales=analog_score.load_scales()
    grids,windows={},{}
    def window_features(site,resolution):
        key=(site['id'],resolution)
        if key not in windows:
            if site['id'] not in grids:
                grids[site['id']]=terrain_features.pack_grid(site,public)[:2]
            windows[key]=analog_score.window_features(*grids[site['id']],resolution)
        return windows[key]
    rows=[]
    screening=[]
    detailed=0
    reused=0
    for target in targets:
        group=[]
        candidates=[]
        for site in earth:
            reason=reasons[target['id']] or reasons[site['id']]
            screen={'earth_id':site['id'], 'planetary_id':target['id'],
                    'status':'filtered' if reason else 'eligible', 'reason':reason,
                    'central_upper_bound_percent':None}
            screening.append(screen)
            if reason:
                continue
            resolution=analog_score.resolution_for(target['terrain']['spacing_m'])
            score=analog_score.pair_score(site,target,window_features(site,resolution),
                window_features(target,resolution),scales.get(resolution))
            if score['analog_score_percent'] is None or score['valid_comparisons']!=25:
                screen.update(status='filtered',reason='Resolution-matched terrain descriptors are unavailable for the comparison windows.')
                continue
            upper=round(score['analog_score_percent'],4)
            screen['central_upper_bound_percent']=upper
            proposed=(site['id'],target['id']) in proposals
            candidates.append(((not proposed,-upper,site['id']),site,screen,score))
        for optimistic,site,screen,score in sorted(candidates,key=lambda c:c[0]):
            # The analog score is the rank score, so skip the detailed audit only
            # when it cannot enter the current top ten.
            if not exhaustive and len(group)==TOP_K and optimistic >= rank_key(group[-1]):
                screen.update(status='pruned',reason='Analog score cannot enter the top ten in the same evidence ordering.')
                continue
            pair=proposals.get((site['id'],target['id']))
            audit=pair['accuracy_check'] if pair else audit_pair(site,target,samples[site['id']],samples[target['id']])
            detailed+=1
            reused+=int(pair is not None)
            if not audit['catalog_features_reproduced'] or audit['window_sensitivity']['valid_comparisons']!=25:
                screen.update(status='filtered',reason='Detailed source reproduction or window coverage failed.')
                continue
            screen.update(status='evaluated',reason='Full window comparison performed; selection follows evidence tier and analog score.')
            group=nsmallest(TOP_K,[*group,comparison(site,target,audit,pair is not None,score)],key=rank_key)
        for rank,row in enumerate(group,1):
            row['candidate_rank']=rank
        rows.extend(group)
    catalog['analog_matching']={'method_version':VERSION,
        'scope':'Landform, terrain and climate similarity within the current catalog, not global nearest analog or validated accuracy.',
        'analog_score':{'method_version':analog_score.VERSION,'descriptor_version':terrain_features.VERSION,
            'weights':{'landform_family':analog_score.LANDFORM_WEIGHT,'terrain':1-analog_score.LANDFORM_WEIGHT},
            'related_family_affinity':analog_score.RELATED_AFFINITY,'inferred_landform_factor':analog_score.INFERRED_FACTOR,
            'terrain_similarity':'exp(-mean scaled feature difference / 2) at the planetary grid spacing, frozen scales in data/terrain-scales.json',
            'status':'engineering_index_chosen_against_catalog_benchmark_not_validated_accuracy'},
        'weights':{'terrain':0.5,'environment':0.5},
        'environment_weights':{key:0.25 for key in ENVIRONMENT},
        'weight_status':'engineering_assumption_not_calibrated',
        'ranking_method':'Literature-informed proposals first; then descending analog score (landform family + central-window terrain); stable site ID breaks ties. No minimum score cutoff is applied. Ranking is not a total-environment ranking.',
        'selection':{'top_k':TOP_K,'min_exploratory_score_percent':MIN_EXPLORATORY_SCORE_PERCENT,'algorithm':'Data/scale eligibility filter, analog score without a minimum cutoff, top-k ranking with window-sensitivity audit.',
            'potential_pairs':len(earth)*len(targets), 'detailed_pairs':detailed,
            'reused_proposal_audits':reused,'pruned_pairs':sum(s['status']=='pruned' for s in screening),
            'filtered_pairs':sum(s['status']=='filtered' for s in screening),
            'screening':screening},
        'comparisons':rows}
    return catalog
