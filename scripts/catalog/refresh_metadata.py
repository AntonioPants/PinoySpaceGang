"""Refresh reviewed handoff metadata without changing terrain or weather samples."""
import json
from .build import PUBLIC, dump
from .metadata import make_catalog, preserve_handoff
from .publication import publication
from .validate import validate


def main():
    with publication(PUBLIC) as stage:
        catalog = json.loads((stage/'sites.json').read_text(encoding='utf-8'))
        for record in catalog['sites']:
            preserve_handoff(record)
        dump(stage/'sites.json', make_catalog(catalog['sites']))
        validate(stage)


if __name__ == '__main__':
    main()
