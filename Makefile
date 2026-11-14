# Field Shift - common tasks. Windows users without make: see scripts/dev.ps1
PY ?= engine/.venv/Scripts/python
ifeq ($(OS),)
PY = engine/.venv/bin/python
endif

.PHONY: setup engine engine-offline web build test snapshot types

setup:            ## create the Python venv, install engine + web dependencies
	python -m venv engine/.venv
	$(PY) -m pip install -r engine/requirements.txt
	cd web && npm install

engine:           ## run the science engine on :8000 (docs at /docs)
	cd engine && ../$(PY) -m uvicorn fieldshift.api:app --port 8000

engine-offline:   ## demo mode: no network, pilot-farm snapshot only
	cd engine && FIELDSHIFT_OFFLINE=1 ../$(PY) -m uvicorn fieldshift.api:app --port 8000

web:              ## run the frontend on :3000 (dev mode)
	cd web && npm run dev

build:            ## production build of the frontend (then: cd web && npm start)
	cd web && npm run build

test:             ## engine unit tests (synthetic fixtures, no network) + frontend type check
	cd engine && ../$(PY) -m pytest
	cd web && npm run typecheck

snapshot:         ## re-download the pilot-farm data snapshot (POWER, SoilGrids, MODIS ~15 min)
	cd engine && ../$(PY) -m scripts.fetch_snapshot

types:            ## regenerate OpenAPI schema + TypeScript types from the pydantic models
	cd engine && ../$(PY) -m scripts.export_openapi
	cd web && npm run gen:types
