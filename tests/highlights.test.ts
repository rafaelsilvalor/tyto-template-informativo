import { readFileSync } from 'node:fs';

import { type FaceCache, defineTemplate, formatCatalogue, parseManifest } from '@tyto/core';
import { compileTemplate } from '@tyto/template-kit/testing';
import { describe, expect, it } from 'vitest';

import { COLOR_DEFAULTS, build } from '../src/template.js';

import type { Frame, SceneNode, SuppliedValues, TextRun } from '@tyto/core';

/**
 * The slide's role and the brief's highlights, read through the kit (TYTO-552, TYTO-554): the
 * one flag the template honours, `{contracapa}`, and the one highlight colour, `destaque`, with
 * `highlight-color` kept as its old name.
 */

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');
const manifest = parseManifest(read('../templates/informativo/manifest.yaml'), 'manifest.yaml');
if (!manifest.ok) throw new Error(manifest.error.map((item) => item.message).join('\n'));
const template = defineTemplate(manifest.value, build);
const formats = formatCatalogue({ grid: { w: 1080, h: 1350, kind: 'grid' } });
const faces: FaceCache = {
  get: () => ({ advance: (characters: string) => characters.length * 0.5, contentHeight: 1 }),
};

function nodes(node: Frame | SceneNode): SceneNode[] {
  const children = 'children' in node ? node.children : [];
  return [
    ...('kind' in node && node.kind !== undefined ? [node as SceneNode] : []),
    ...children.flatMap(nodes),
  ];
}

/** Every slide's nodes, the brief compiled with `values` as a configuration supplies them. */
async function slides(body: string, values?: SuppliedValues): Promise<SceneNode[][]> {
  const result = await compileTemplate({
    brief: `---\ntemplate: informativo\nformats: [grid]\n---\n${body}`,
    template,
    formats,
    faces,
    ...(values === undefined ? {} : { values }),
  });
  if (!result.ok) throw new Error(result.error.map((item) => item.message).join('\n'));
  return result.value.scene.artworks.map((artwork) => nodes(artwork.frames[0]!));
}

/** A text run as the test reads it: its words, weight, style and colour as `#rrggbb`. */
interface Look {
  readonly weight: number;
  readonly style: string;
  readonly color: string;
}

function lookOf(found: SceneNode[], name: string, words: string): Look {
  const text = found.find((node) => node.name === name);
  if (text?.kind !== 'text') throw new Error(`no ${name}`);
  // The run that is these words, or else the one that holds them (an uncoloured span joins its
  // neighbours).
  const texts = text.runs.filter(
    (item): item is Extract<TextRun, { kind: 'text' }> => item.kind === 'text',
  );
  const run =
    texts.find((item) => item.text === words) ?? texts.find((item) => item.text.includes(words));
  if (run === undefined) throw new Error(`no run "${words}" in ${name}`);
  const paint = run.color as { kind: string; color: { r: number; g: number; b: number } };
  const hex = [paint.color.r, paint.color.g, paint.color.b]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('');
  return { weight: run.weight, style: run.style, color: `#${hex}` };
}

const QUESTION = '::lamina\n::pergunta\n  Pode **autarquia** cobrar {cor:destaque}taxa{/} hoje?\n';

describe("a slide's role", () => {
  it('is the back cover when the slide writes {contracapa}, a ruling otherwise', async () => {
    const [ruling, back] = await slides(`${QUESTION}\n::lamina {contracapa}\n`);
    const names = (found: SceneNode[]) => found.map((node) => node.name);

    expect(names(ruling!)).toContain('pergunta');
    expect(names(ruling!)).not.toContain('chamada');
    expect(names(back!)).toContain('chamada');
    expect(names(back!)).not.toContain('pergunta');
  });
});

describe('the highlight colour', () => {
  const colourOf = async (values?: SuppliedValues) => {
    const [found] = await slides(QUESTION, values);
    return {
      bold: lookOf(found!, 'pergunta', 'autarquia').color,
      mark: lookOf(found!, 'pergunta', 'taxa').color,
    };
  };

  it('is the default when nothing is set', async () => {
    expect(await colourOf()).toEqual({ bold: '#ae7d2e', mark: '#ae7d2e' });
    expect(COLOR_DEFAULTS.destaque).toBe(COLOR_DEFAULTS['highlight-color']);
  });

  it('is destaque when a configuration sets it', async () => {
    expect(await colourOf({ destaque: { value: '#123456' } })).toEqual({
      bold: '#123456',
      mark: '#123456',
    });
  });

  it('is the old highlight-color when a configuration sets only that', async () => {
    expect(await colourOf({ 'highlight-color': { value: '#654321' } })).toEqual({
      bold: '#654321',
      mark: '#654321',
    });
  });

  it('is destaque when a configuration sets both', async () => {
    const both = { destaque: { value: '#123456' }, 'highlight-color': { value: '#654321' } };
    expect(await colourOf(both)).toEqual({ bold: '#123456', mark: '#123456' });
  });
});

describe('where the highlights go', () => {
  const SET = { destaque: { value: '#123456' } };

  it('in the question: Medium, italic, in the colour', async () => {
    const [found] = await slides(QUESTION, SET);
    const plain = lookOf(found!, 'pergunta', 'Pode ');

    expect(lookOf(found!, 'pergunta', 'autarquia')).toEqual({
      weight: 500,
      style: 'italic',
      color: '#123456',
    });
    expect(lookOf(found!, 'pergunta', 'taxa')).toEqual({
      weight: 500,
      style: 'italic',
      color: '#123456',
    });
    expect(plain).toEqual({ weight: 400, style: 'italic', color: '#4d4d4d' });
  });

  it("in the title: the colour, at the title's own weight", async () => {
    const body = `::titulo\n  Destaques do\n  Informativo **TRZ** {cor:destaque}412{/}\n${QUESTION}`;
    const [found] = await slides(body, SET);

    expect(lookOf(found!, 'titulo', 'TRZ')).toMatchObject({ weight: 800, color: '#123456' });
    expect(lookOf(found!, 'titulo', '412')).toMatchObject({ weight: 800, color: '#123456' });
    expect(lookOf(found!, 'titulo', 'INFORMATIVO ').color).not.toBe('#123456');
  });

  it("on the answer's band: **…** Medium in the band's words, a {cor:destaque} span passes through uncoloured", async () => {
    const body = `${QUESTION}::resposta\n  **Não.** Veja o {cor:destaque}Tema 9{/} agora.\n`;
    const [found] = await slides(body, SET);

    expect(lookOf(found!, 'resposta', 'Não.')).toEqual({
      weight: 500,
      style: 'normal',
      color: '#ebeae9',
    });
    expect(lookOf(found!, 'resposta', 'Tema 9')).toEqual({
      weight: 300,
      style: 'normal',
      color: '#ebeae9',
    });
  });
});
