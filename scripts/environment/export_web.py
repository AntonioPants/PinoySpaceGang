"""Copy offline environmental profiles to a React/Next/Vite public directory."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
ROOT = Path(__file__).resolve().parents[2]

def export(destination):
    source = ROOT / 'data/environment'
    catalog = json.loads((source / 'catalog.json').read_text())
    files = ['catalog.json']
    for site in catalog['sites']:
        file = site['file']
        if Path(file).name != file or not file.endswith('.json'):
            raise ValueError('Invalid catalog filename')
        if hashlib.sha256((source / file).read_bytes()).hexdigest() != site['sha256']:
            raise ValueError(f'Checksum mismatch: {file}')
        files.append(file)
    destination.mkdir(parents=True, exist_ok=True)
    for file in files:
        shutil.copy2(source / file, destination / file)
    print(f'Exported {len(files)} files to {destination}')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'app/sim/viewer/public/environment')
    export(parser.parse_args().output)
