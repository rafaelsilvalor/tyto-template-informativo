import { noBrandKit } from '@tyto/core';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CALL,
  DEFAULT_CLOSING,
  NUMBER_DEFAULTS,
  build,
  roleOf,
  rulingOf,
} from './template.js';

import type { AssetRef, RichText, SlotValue, TemplateContext } from '@tyto/core';

/**
 * The composition's rules on the `Scene`, without Tyto: a slide's context built by hand, with
 * nothing measured unless a test hands in a `measure`, so line counts come from the template's
 * own estimate.
 */

interface Options {
  readonly contracapa?: boolean;
  readonly values?: Record<string, unknown>;
  readonly fundo?: AssetRef;
  readonly measure?: (node: unknown) => { lines: number } | undefined;
  readonly report?: (item: unknown) => void;
}

const range = { start: 0, end: 1 };
const brk = { kind: 'break', range } as const;
const words = (value: string): RichText => [{ kind: 'text', value, range }];
const paragraphs = (...values: string[]): RichText =>
  values.flatMap((value, index) => [...(index === 0 ? [] : [brk]), ...words(value)]);
const asset = (id: string): AssetRef => ({ id, source: 'file', path: `${id}.png`, hash: id });

function contextOf(lamina: RichText, options: Options = {}): TemplateContext {
  const value: SlotValue = { kind: 'rich-text', text: lamina };
  return {
    format: 'grid',
    size: { w: 1080, h: 1350 },
    idPrefix: 'artwork-0-grid',
    artwork: { id: 'artwork-0', index: 0, count: 2 },
    slots: {
      informativo: {
        name: 'informativo',
        value: { kind: 'rich-text', text: words('TRZ 412') },
        adjustments: [],
      },
      lamina: { name: 'lamina', value, adjustments: [] },
      ...(options.fundo === undefined
        ? {}
        : { fundo: { name: 'fundo', value: { kind: 'image', asset: options.fundo } } }),
    },
    adjustments: options.contracapa === true ? { contracapa: true } : {},
    values: options.values ?? {},
    brand: noBrandKit,
    measure: options.measure ?? (() => undefined),
    report: options.report ?? (() => undefined),
  } as unknown as TemplateContext;
}

interface Node {
  readonly kind: string;
  readonly name?: string;
  readonly blend?: string;
  readonly runs?: readonly { readonly text?: string; readonly size?: number; style?: string }[];
  readonly size?: { readonly w: number; readonly h: number };
  readonly transform?: { readonly x: number; readonly y: number };
  readonly children?: readonly Node[];
  readonly asset?: AssetRef;
}

const frameOf = (context: TemplateContext) =>
  build(context) as unknown as { size: { w: number; h: number }; children: readonly Node[] };

/** Every node, depth first, groups included. */
const flat = (nodes: readonly Node[]): Node[] =>
  nodes.flatMap((node) => [node, ...flat(node.children ?? [])]);

const named = (context: TemplateContext, name: string): Node | undefined =>
  flat(frameOf(context).children).find((node) => node.name === name);

const textOf = (node: Node | undefined): string =>
  (node?.runs ?? []).map((item) => item.text ?? '\n').join('');

/** The card's top and its height, tabs included. */
function cardBox(context: TemplateContext): { top: number; height: number } {
  const card = named(context, 'cartao');
  const sheet = named(context, 'folha');
  const top = card?.transform?.y ?? Number.NaN;
  const sheetTop = sheet?.transform?.y ?? Number.NaN;
  return { top, height: sheetTop + (sheet?.size?.h ?? Number.NaN) };
}

const ruling = paragraphs(
  'Direito Administrativo',
  'Uma autarquia pode cobrar taxa pela **certidão**?',
  '**Não.** A certidão é serviço de interesse do próprio cidadão.',
  'Recurso de exemplo 1.234/ZZ, julgado em 01/02/2026.',
);

describe('a ruling slide', () => {
  it('reads subject, question, answer paragraphs and the source from its lines', () => {
    const parts = rulingOf([
      words('tema'),
      words('pergunta'),
      words('um'),
      words('dois'),
      words('fonte'),
    ]);
    expect(parts.answer).toHaveLength(2);
    expect(parts.source).toEqual(words('fonte'));
    expect(rulingOf([words('tema'), words('pergunta'), words('um')]).source).toBeUndefined();
  });

  it('is one 1080×1350 frame', () => {
    expect(frameOf(contextOf(ruling)).size).toEqual({ w: 1080, h: 1350 });
  });

  it('centres the card, tabs included, on the slide', () => {
    const { top, height } = cardBox(contextOf(ruling));
    expect(Math.abs(top + height / 2 - 675)).toBeLessThanOrEqual(1);
  });

  it('grows the card with its words, never past the maximum', () => {
    const short = cardBox(contextOf(ruling)).height;
    const long = paragraphs(
      'Tema',
      'Pergunta longa '.repeat(8),
      'Resposta longa '.repeat(30),
      'Fonte',
    );
    const reports: unknown[] = [];
    const tall = cardBox(contextOf(long, { report: (item) => reports.push(item) }));
    expect(tall.height).toBeGreaterThan(short);
    expect(tall.height).toBeLessThanOrEqual(NUMBER_DEFAULTS['card-max-height']);
    expect(reports).toEqual([]);
  });

  it('shrinks the question and the answer together when the card is full', () => {
    const long = paragraphs('Tema', 'Pergunta longa '.repeat(8), 'Resposta longa '.repeat(30));
    const context = contextOf(long);
    const question = named(context, 'pergunta')?.runs?.[0]?.size ?? 0;
    const answer = named(context, 'resposta')?.runs?.[0]?.size ?? 0;
    expect(question).toBeLessThan(NUMBER_DEFAULTS['question-size']);
    expect(answer).toBeLessThan(NUMBER_DEFAULTS['answer-size']);
    expect(answer / question).toBeCloseTo(
      NUMBER_DEFAULTS['answer-size'] / NUMBER_DEFAULTS['question-size'],
      1,
    );
  });

  it('reports the overflow once the floors are reached, rather than drawing past the slide', () => {
    const reports: { code?: string }[] = [];
    const huge = paragraphs('Tema', 'Pergunta '.repeat(200), 'Resposta '.repeat(400));
    build(contextOf(huge, { report: (item) => reports.push(item as { code?: string }) }));
    expect(reports.some((item) => item.code === 'W_TEMPLATE_OVERFLOW')).toBe(true);
  });

  it('sets the question in italic', () => {
    const runs = named(contextOf(ruling), 'pergunta')?.runs ?? [];
    expect(
      runs.filter((item) => item.text !== undefined).every((item) => item.style === 'italic'),
    ).toBe(true);
  });

  it('titles the slide with the brief’s bulletin', () => {
    expect(textOf(named(contextOf(ruling), 'titulo'))).toBe('INFORMATIVO  TRZ 412');
  });
});

describe('the background and the paper', () => {
  it('lays the configured background first and the paper last, in multiply', () => {
    const context = contextOf(ruling, {
      values: { background: asset('fundo'), 'paper-texture': asset('papel') },
    });
    const children = frameOf(context).children;
    expect(children[0]?.name).toBe('fundo');
    expect(children.at(-1)).toMatchObject({ name: 'papel', blend: 'multiply' });
  });

  it('draws the brief’s fundo over the configuration’s background', () => {
    const context = contextOf(ruling, {
      fundo: asset('do-brief'),
      values: { background: asset('da-configuracao') },
    });
    expect(frameOf(context).children[0]?.asset?.id).toBe('do-brief');
  });
});

describe('the back cover', () => {
  it('is chosen by the brief’s {contracapa}', () => {
    expect(roleOf(contextOf([], { contracapa: true }))).toBe('contracapa');
    expect(roleOf(contextOf(ruling))).toBe('ruling');
  });

  it('says the reference’s words when its lamina is empty, and drops the number', () => {
    const context = contextOf([], { contracapa: true });
    expect(textOf(named(context, 'chamada-texto'))).toBe(DEFAULT_CALL);
    expect(textOf(named(context, 'fecho'))).toBe(DEFAULT_CLOSING);
    expect(textOf(named(context, 'titulo'))).toBe('INFORMATIVO  TRZ');
  });

  it('takes its call and its closing from the lamina’s lines', () => {
    const context = contextOf(paragraphs('Salve este post!', 'Até a próxima!'), {
      contracapa: true,
    });
    expect(textOf(named(context, 'chamada-texto'))).toBe('Salve este post!');
    expect(textOf(named(context, 'fecho'))).toBe('Até a próxima!');
  });

  it('centres its card too', () => {
    const { top, height } = cardBox(contextOf([], { contracapa: true }));
    expect(Math.abs(top + height / 2 - 675)).toBeLessThanOrEqual(1);
  });
});
