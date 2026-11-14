import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { CatalogDetails } from '../viewer/components/CatalogDetails.tsx';
import { loadCatalogSite, readCatalog } from '../scripts/catalog-node.ts';

it('exposes generalized categories, temperatures, unknowns and downloadable provenance', () => {
  const site = loadCatalogSite(readCatalog(), 'kilbourne-hole-v1');
  const html = renderToStaticMarkup(<CatalogDetails site={site} />);
  for (const text of ['classification', 'morphology', 'substrate', 'atmosphere',
    'slope p95 class', 'roughness 3km', 'air temperature 2m', 'surface temperature',
    'friction', 'unknown', 'source', 'limitations', 'Download complete site record',
    'Comparison reliability checks', 'window sensitivity', 'validated accuracy percent', 'catalog features reproduced']) {
    expect(html).toContain(text);
  }
  expect(site.catalog?.record.conditions.friction.value).toBeNull();
});
