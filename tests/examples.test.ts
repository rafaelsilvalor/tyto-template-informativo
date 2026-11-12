import { readFileSync } from 'node:fs';

import { defineTemplate, formatCatalogue, parseManifest } from '@tyto/core';
import { compileTemplate } from '@tyto/template-kit/testing';
import { describe, expect, it } from 'vitest';

import { build } from '../src/template.js';

/**
 * The example brief, compiled the way Tyto compiles it (Tyto ADR 0152), against the HTML the
 * template produced last time it was reviewed: three rulings and the back cover.
 *
 * Nothing is measured and every face is a placeholder, so the snapshot moves when the
 * composition does and not when a machine has another font. No brand kit either: the logo and
 * signature are the house's and stay out of this public repository.
 */

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

const manifest = parseManifest(read('../templates/informativo/manifest.yaml'), 'manifest.yaml');
if (!manifest.ok) throw new Error(manifest.error.map((item) => item.message).join('\n'));
const template = defineTemplate(manifest.value, build);
const formats = formatCatalogue({ grid: { w: 1080, h: 1350, kind: 'grid' } });

describe('the example informativo', () => {
  it('compiles to four grid frames, the HTML the template drew last time', async () => {
    const result = await compileTemplate({
      brief: read('../templates/informativo/examples/informativo.brief'),
      template,
      formats,
    });
    if (!result.ok) throw new Error(result.error.map((item) => item.message).join('\n'));

    expect(result.value.frames).toHaveLength(4);
    for (const [index, frame] of result.value.frames.entries()) {
      await expect(frame.html).toMatchFileSnapshot(`./__snapshots__/informativo-${index + 1}.html`);
    }
  });
});
