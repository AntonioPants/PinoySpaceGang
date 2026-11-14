"""Stage the 23-site global expansion; publish only with an explicit --publish.

Usage: python -m scripts.catalog.expand_global [--offline] [--publish]
Individual failures do not discard successful staged sites. A failed batch never
publishes; rerun after fixing the reported source/access problem to reuse caches.
"""
import argparse

from . import build
from .global_sites import IDS
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
            failures.append({'site': sid, 'error': str(exc)})
            print(f'FAILED {sid}: {exc}', flush=True)
    report = {'operation': 'global-expansion', 'staged': staged, 'failures': failures, 'published': False}
    build.dump(build.ROOT/'data/catalog-expansion-report.json', report)
    if failures:
        raise RuntimeError('Global expansion not published; see data/catalog-expansion-report.json')
    if args.publish:
        register(list(IDS))
        report['published'] = True
        build.dump(build.ROOT/'data/catalog-expansion-report.json', report)
    print(f'{len(staged)} global study areas staged; published={report["published"]}', flush=True)


if __name__ == '__main__':
    main()
