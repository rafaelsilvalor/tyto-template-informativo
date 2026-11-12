import { readFileSync } from 'node:fs';

import { defineTemplate, formatCatalogue, parseManifest } from '@tyto/core';
import { compileTemplate } from '@tyto/template-kit/testing';
import { describe, expect, it } from 'vitest';

import { COLOR_DEFAULTS, NUMBER_DEFAULTS, build } from '../src/template.js';

import type { SuppliedValues } from '@tyto/core';

/**
 * What a configuration may change in `informativo` (Tyto ADR 0153): each declared default pinned
 * to the constant the code falls back to, and a value set here found in the HTML.
 */

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

const manifest = parseManifest(read('../templates/informativo/manifest.yaml'), 'manifest.yaml');
if (!manifest.ok) throw new Error(manifest.error.map((item) => item.message).join('\n'));
const template = defineTemplate(manifest.value, build);
const formats = formatCatalogue({ grid: { w: 1080, h: 1350, kind: 'grid' } });

/** The two pictures, which the code reads with no fallback of its own. */
const IMAGE_DEFAULTS = {
  background: 'assets/fundo.png',
  'paper-texture': 'assets/papel.png',
};

const html = async (values?: SuppliedValues): Promise<string> => {
  const result = await compileTemplate({
    brief: read('../templates/informativo/examples/informativo.brief'),
    template,
    formats,
    ...(values === undefined ? {} : { values }),
  });
  if (!result.ok) throw new Error(result.error.map((item) => item.message).join('\n'));
  return result.value.frames.map((frame) => frame.html).join('\n');
};

describe('declared values', () => {
  const declared = manifest.value.values ?? {};

  it('declares each default equal to the one the code falls back to', () => {
    const defaults = Object.fromEntries(
      Object.entries(declared).map(([name, value]) => [name, value.default]),
    );
    expect(defaults).toEqual({ ...IMAGE_DEFAULTS, ...COLOR_DEFAULTS, ...NUMBER_DEFAULTS });
  });

  it('draws the same HTML with every colour and number supplied as with no values at all', async () => {
    const supplied = Object.fromEntries(
      Object.entries({ ...COLOR_DEFAULTS, ...NUMBER_DEFAULTS }).map(([name, value]) => [
        name,
        { value },
      ]),
    );
    expect(await html(supplied)).toBe(await html());
  });

  it('paints the accent a configured colour, found in the HTML', async () => {
    const painted = await html({ accent: { value: '#123456' } });

    expect(painted).toContain('#123456');
    expect(await html()).not.toContain('#123456');
  });
});
