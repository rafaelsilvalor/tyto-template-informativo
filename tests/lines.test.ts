import { readFileSync } from 'node:fs';

import { type FaceCache, defineTemplate, formatCatalogue, parseManifest } from '@tyto/core';
import { NO_BREAK_SPACE } from '@tyto/template-kit';
import { compileTemplate } from '@tyto/template-kit/testing';
import { describe, expect, it } from 'vitest';

import { build } from '../src/template.js';

import type { Frame, SceneNode, SuppliedValues, TextNode } from '@tyto/core';

/**
 * Where the question, the answer and the source break, with the house's tools rather than new
 * ones: the kit's `keepTogether`, with this template's rule for a short word, so no line ends on
 * `a`, `e`, `o`, `é`, `à` or `de`; and the kit's `settle` (Tyto ADR 0167), so none ends on a
 * word of its own. Rafael's slide of 2026-11-12 had both: "…de votos, se a / questão" and a last
 * line holding "julgado?".
 *
 * Measured against faces whose every character is half an em wide, standing in for CircularXX
 * and Roboto, which CI does not have: the breaks are then known and read off the scene, as
 * `voce-conhece`'s orphan tests do.
 */

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');
const manifest = parseManifest(read('../templates/informativo/manifest.yaml'), 'manifest.yaml');
if (!manifest.ok) throw new Error(manifest.error.map((item) => item.message).join('\n'));
const template = defineTemplate(manifest.value, build);
const formats = formatCatalogue({ grid: { w: 1080, h: 1350, kind: 'grid' } });

const faces: FaceCache = {
  get: () => ({ advance: (characters: string) => characters.length * 0.5, contentHeight: 1 }),
};

/** Letter spacing off: only a word moved down from the line above may clear an orphan. */
const MOVE_ONLY = { 'orphan-tracking': { value: 0 } } as const;

/** The words that may not end a line: they stay with the word after them. */
const SHORT = new Set(['a', 'à', 'o', 'e', 'é', 'de']);

async function question(text: string, values?: SuppliedValues) {
  const result = await compileTemplate({
    brief: `---\ntemplate: informativo\nformats: [grid]\n---\n::lamina\n::pergunta\n  ${text}\n`,
    template,
    formats,
    faces,
    ...(values === undefined ? {} : { values }),
  });
  if (!result.ok) throw new Error(result.error.map((item) => item.message).join('\n'));
  const frame = result.value.scene.artworks[0]?.frames[0];
  if (frame === undefined) throw new Error('no frame');
  const found = nodes(frame).find((node) => node.name === 'pergunta');
  if (found?.kind !== 'text') throw new Error('no question');
  const orphans = result.diagnostics.filter((item) => item.code === 'W_TEMPLATE_ORPHAN');
  return { node: found, orphans };
}

function nodes(node: Frame | SceneNode): SceneNode[] {
  const children = 'children' in node ? node.children : [];
  return [
    ...('kind' in node && node.kind !== undefined ? [node as SceneNode] : []),
    ...children.flatMap(nodes),
  ];
}

/** Each laid line's words; a no-break space joins two words into one. */
function laidLines(node: TextNode): string[][] {
  const lines: string[] = [''];
  for (const run of node.runs) {
    if (run.kind === 'break') lines.push('');
    else lines[lines.length - 1] += run.text;
  }
  return lines.map((line) => line.split(/ +/u).filter((word) => word !== ''));
}

/** Rafael's question of 2026-11-12, the one that ended on "se a" and on "julgado?". */
const RAFAEL =
  'A composição atual de um colegiado pode refazer a proclamação do resultado para corrigir ' +
  'erro na contagem de votos, se a questão já foi discutida e resolvida em embargos de ' +
  'declaração com trânsito em julgado?';

/**
 * At 40 px a 740 px line holds 37 characters: "Pode um juiz julgar outra vez se a" is 34, and
 * "questão" does not fit after it, so without the rule the first line ends on "a".
 */
const STRANDED = 'Pode um juiz julgar outra vez se a questão já foi resolvida?';

describe('the question', () => {
  it('ends no line on a short word: it goes down with the word after it', async () => {
    const { node } = await question(STRANDED);
    const lines = laidLines(node);

    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines.slice(0, -1)) {
      const last = (line.at(-1) ?? '').split(NO_BREAK_SPACE).at(-1) ?? '';
      expect(SHORT.has(last.toLowerCase())).toBe(false);
    }
  });

  it('glues a short word to the next one, and leaves a word that only ends in one alone', async () => {
    const { node } = await question('Ela pede a revisão da casa e nada mais?');
    const text = node.runs.map((run) => (run.kind === 'text' ? run.text : '\n')).join('');

    expect(text).toContain('a\u00A0revisão');
    expect(text).toContain('e\u00A0nada');
    expect(text).not.toContain('casa\u00A0e');
  });

  it('ends on two words or more, by a word moved down, at its own size', async () => {
    const { node, orphans } = await question(RAFAEL, MOVE_ONLY);

    expect(laidLines(node).at(-1)?.length).toBeGreaterThan(1);
    expect(node.letterSpacing).toBe(0);
    expect(orphans).toEqual([]);
  });
});
