"""Generate judge-facing findings from catalog numbers; never type scores by hand."""
import argparse
import html
import json
from pathlib import Path
import re
import shutil
from .publication import publication

ROOT = Path(__file__).resolve().parents[2]

def generate(public, landing):
    from .comparison_notes import comparison_notes
    from .analog_score import landform
    data = json.loads((public / 'sites.json').read_text(encoding='utf-8'))
    sites = {s['id']: s for s in data['sites']}
    scores = data['analog_matching']['selection']['screening']
    flights = {(r['planetary_id'], r['earth_id']): r['stress'] for r in landing['rows']}
    pairs = {(p['planetary_id'], p['earth_id']): p for p in data['pairings']}
    name = lambda s: re.sub(r'\bbase-\s*', 'base ', re.sub(r'\s*study\s*area\b', '', re.sub(r':\s*[\d.]+\s*km.*$', '', s), flags=re.I)).strip()
    rows = []
    for target in (s for s in data['sites'] if s['role'] == 'planetary_target'):
        for scanned in (False, True):
            eligible = [s for s in scores if s['planetary_id'] == target['id'] and
                        s['earth_id'].startswith('scan-') == scanned and
                        isinstance(s['central_upper_bound_percent'], (int, float))]
            if not eligible:
                continue
            best = sorted(eligible, key=lambda s: (-s['central_upper_bound_percent'], s['earth_id']))[0]
            earth = sites[best['earth_id']]
            key = (target['id'], earth['id'])
            differences = pairs.get(key, {}).get('explanation', {}).get('differences', [])
            notes=comparison_notes(earth,target,landform(earth['morphology'],target['morphology'],earth.get('inferred_landforms',()))['relation'])
            limitation = differences[0] if differences else ('Unreviewed exploratory pair. '+notes['differences'][0]+' '+notes['differences'][2])
            stress = flights.get(key)
            rows.append([name(target['name']), 'Scanned window' if scanned else 'Curated site', name(earth['name']),
                         f"{best['central_upper_bound_percent']:.1f}%", str(stress['score']) if stress else 'Not computed', limitation,
                         earth['id']])
    header = ['Target', 'Origin', 'Earth window', 'Analog match', 'Landing / 100', 'Main difference', 'Stable ID']
    md = '| ' + ' | '.join(header) + ' |\n|' + '|'.join(['---'] * len(header)) + '|\n'
    md += '\n'.join('| ' + ' | '.join(v.replace('|', '/') for v in row) + ' |' for row in rows) + '\n'
    return md, header, rows

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--publish', action='store_true', help='Stop dev servers first; publish staged files transactionally.')
    args = parser.parse_args()
    stage = ROOT / 'data/staged'
    landing = json.loads((stage / 'landing-similarity.json').read_text(encoding='utf-8'))
    import hashlib
    public = ROOT / 'web/public'
    if hashlib.sha256((public/'sites.json').read_bytes()).hexdigest() != landing['catalog_sha256']:
        raise ValueError('Regenerate landing baseline for the current catalog')
    md, header, rows = generate(public, landing)
    (ROOT / 'docs/FINDINGS.md').write_text('# Generated catalog findings\n\nBest score within each origin across the current published catalog. The default ten retain literature-tier priority. These are engineering comparisons, not scientific validation. Scanned windows are near known regions; local geology is unreviewed. A high landing score is agreement between sampled simulations, not a success probability or safety rating.\n\n' + md, encoding='utf-8')
    table = '<table><thead><tr>' + ''.join('<th>'+html.escape(h)+'</th>' for h in header) + '</tr></thead><tbody>'
    table += ''.join('<tr>'+''.join('<td>'+html.escape(v)+'</td>' for v in row)+'</tr>' for row in rows)+'</tbody></table>'
    article = (ROOT/'docs/SUBMISSION.md').read_text(encoding='utf-8')
    page = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Analog Atlas findings</title><style>body{background:#0c1219;color:#eee;font:16px system-ui;margin:24px}a{color:#e7c889}table{border-collapse:collapse;font-size:14px}td,th{border:1px solid #445;padding:10px;text-align:left}pre{white-space:pre-wrap;font:inherit;line-height:1.6}.table{overflow:auto}</style><a href="/">Return to Analog Atlas</a><h1>Findings: new windows near known regions</h1><p>Analog match is engineering similarity. Landing behaviour is a fixed-lander simulation comparison, not validated accuracy. Planetary grids are 150–500 m; local geology at scan windows has not been reviewed.</p><div class="table">'+table+'</div><h2>Submission and sources</h2><pre>'+html.escape(article)+'</pre></html>'
    (stage/'findings.html').write_text(page,encoding='utf-8')
    if args.publish:
        with publication(public) as destination:
            for filename in ('landing-similarity.json','findings.html'):
                shutil.copyfile(stage/filename,destination/filename)
    print(f'{len(rows)} findings rows; {len(landing["rows"])} landing pairs; '+('published' if args.publish else 'staged'))

if __name__ == '__main__':
    main()
