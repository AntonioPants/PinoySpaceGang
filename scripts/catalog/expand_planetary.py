"""Stage the 40 added Moon/Mars study areas; publish only with an explicit --publish.

Usage: python -m scripts.catalog.expand_planetary [--offline] [--publish]
A failed site is reported and skipped; a failed batch never publishes.
"""
import argparse

from . import build
from .planetary_sites import IDS
from .register import register


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true')
    parser.add_argument('--publish', action='store_true')
    args = parser.parse_args(argv)
    staged, failures = [], []
    for sid in IDS:
        try:
            build.main(['--site', sid] + (['--offline'] if args.offline else []))
            staged.append(sid)
        except Exception as exc:
            failures.append({'site': sid, 'error': str(exc)[:400]})
            print(f'FAILED {sid}: {exc}', flush=True)
    report = {'operation': 'planetary-expansion', 'staged': staged, 'failures': failures, 'published': False}
    build.dump(build.ROOT/'data/planetary-expansion-report.json', report)
    if failures:
        raise RuntimeError('Planetary expansion not published; see data/planetary-expansion-report.json')
    if args.publish:
        register(list(IDS))
        report['published'] = True
        build.dump(build.ROOT/'data/planetary-expansion-report.json', report)
    print(f'{len(staged)} planetary study areas staged; published={report["published"]}', flush=True)


if __name__ == '__main__':
    main()
