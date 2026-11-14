"""Write the API schema to web/lib/openapi.json so TypeScript types can be generated from it.

    python -m scripts.export_openapi            # from the engine/ folder
    npm run gen:types                           # from the web/ folder
"""
from __future__ import annotations

import json
from pathlib import Path

from fieldshift.api import app

OUT = Path(__file__).resolve().parents[2] / "web" / "lib" / "openapi.json"


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(app.openapi(), indent=1), encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
