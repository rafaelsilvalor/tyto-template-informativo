import { noBrandKit } from '@tyto/core';
import { NO_BREAK_SPACE } from '@tyto/template-kit';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CALL,
  DEFAULT_CLOSING,
  NUMBER_DEFAULTS,
  build,
  roleOf,
  rulingOf,
} from './template.js';

import type { AssetRef, RichText, TemplateContext } from '@tyto/core';

/**
 * The composition's rules on the `Scene`, without Tyto: a slide's context built by hand, with
 * nothing measured unless a test hands in a `measure`, so line counts come from the template's
 * own estimate.
 */

/** A slide's fields by name, each its lines; `[]` is a field written with no lines. */
type Fields = Record<string, readonly string[]>;

interface Options {
  readonly contracapa?: boolean;
  readonly titulo?: readonly string[];
  readonly values?: Record<string, unknown>;
  readonly fundo?: AssetRef;
  readonly measure?: (node: unknown) => { lines: number } | undefined;
  readonly report?: (item: unknown) => void;
}

const range = { start: 0, end: 1 };
const brk = { kind: 'break', range } as const;
const words = (value: string): RichText => [{ kind: 'text', value, range }];
const linesOf = (values: readonly string[]): RichText =>
  values.flatMap((value, index) => [...(index === 0 ? [] : [brk]), ...words(value)]);
const asset = (id: string): AssetRef => ({ id, source: 'file', path: `${id}.png`, hash: id });

const slot = (name: string, values: readonly string[]) => ({
  name,
  value: { kind: 'rich-text', text: linesOf(values) },
  adjustments: [],
});

function contextOf(fields: Fields, options: Options = {}): TemplateContext {
  return {
    format: 'grid',
    size: { w: 1080, h: 1350 },
    idPrefix: 'artwork-0-grid',
    artwork: { id: 'artwork-0', index: 0, count: 2 },
    slots: {
      lamina: slot('lamina', []),
      ...Object.fromEntries(
        Object.entries(fields).map(([name, lines]) => [name, slot(name, lines)]),
      ),
      ...(options.titulo === undefined ? {} : { titulo: slot('titulo', options.titulo) }),
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

const names = (context: TemplateContext): string[] =>
  flat(frameOf(context).children).flatMap((node) => (node.name === undefined ? [] : [node.name]));

/** The words a text draws; a space glued by `keepTogether` (U+00A0) reads as a space. */
const textOf = (node: Node | undefined): string =>
  (node?.runs ?? [])
    .map((item) => item.text ?? '\n')
    .join('')
    .replaceAll(NO_BREAK_SPACE, ' ');

const topOf = (context: TemplateContext, name: string): number =>
  named(context, name)?.transform?.y ?? Number.NaN;

/** The card's top and its height, tabs included. */
function cardBox(context: TemplateContext): { top: number; height: number } {
  const sheet = named(context, 'folha');
  const top = named(context, 'cartao')?.transform?.y ?? Number.NaN;
  const sheetTop = sheet?.transform?.y ?? Number.NaN;
  return { top, height: sheetTop + (sheet?.size?.h ?? Number.NaN) };
}

const ruling: Fields = {
  tema: ['Direito Administrativo'],
  pergunta: ['Uma autarquia pode cobrar taxa pela **certidão**?'],
  resposta: ['**Não.** A certidão é serviço de interesse do próprio cidadão.'],
  fonte: ['Recurso de exemplo 1.234/ZZ, julgado em 01/02/2026.'],
};

describe('a ruling slide', () => {
  it('reads each section from its own field, absent when the brief does not write it', () => {
    const parts = rulingOf(contextOf({ pergunta: ['um', 'dois'], resposta: ['três'] }));
    expect(parts.question).toHaveLength(2);
    expect(parts.answer).toHaveLength(1);
    expect(parts.subject).toBeUndefined();
    expect(parts.source).toBeUndefined();
  });

  it('is one 1080×1350 frame', () => {
    expect(frameOf(contextOf(ruling)).size).toEqual({ w: 1080, h: 1350 });
  });

  it('centres the card, tabs included, on the slide', () => {
    const { top, height } = cardBox(contextOf(ruling));
    expect(Math.abs(top + height / 2 - 675)).toBeLessThanOrEqual(1);
  });

  it('draws only the sections the brief writes', () => {
    const drawn = names(contextOf({ pergunta: ['Só a pergunta?'] }));
    expect(drawn).toContain('pergunta');
    expect(drawn).not.toContain('tema');
    expect(drawn).not.toContain('bloco-resposta');
    expect(drawn).not.toContain('fonte');
  });

  it('closes up a missing section: the question keeps its own gap under the title', () => {
    const withBand = contextOf(ruling);
    const withoutBand = contextOf({ ...ruling, tema: [] });
    const titleFoot = topOf(withBand, 'titulo');
    expect(topOf(withoutBand, 'titulo')).toBe(titleFoot);
    expect(topOf(withoutBand, 'pergunta')).toBeLessThan(topOf(withBand, 'pergunta'));
  });

  it('keeps the same gap under the question whatever its length', () => {
    // A question of one line and one of three, measured: the answer block stands the same
    // distance under the question's last line.
    // The runs come back as they went in, as a measure that broke nothing would hand them. Any
    // size over 40 takes one more line, so the question stays at 40 and the gap is all that moves.
    const measure = (lines: number) => (node: unknown) => {
      const { name, runs } = node as { name?: string; runs: readonly { size?: number }[] };
      const grown = (runs[0]?.size ?? 40) > 40 ? 1 : 0;
      return { lines: name === 'pergunta' ? lines + grown : 1, runs };
    };
    const gapUnder = (lines: number) => {
      const context = contextOf(ruling, { measure: measure(lines) });
      return topOf(context, 'bloco-resposta') - topOf(context, 'pergunta') - (lines - 1) * 60;
    };
    expect(gapUnder(3)).toBe(gapUnder(1));
  });

  it('grows the card with its words, never past the maximum', () => {
    const short = cardBox(contextOf(ruling)).height;
    const long: Fields = {
      tema: ['Tema'],
      pergunta: ['Pergunta longa '.repeat(8)],
      resposta: ['Resposta longa '.repeat(30)],
      fonte: ['Fonte'],
    };
    const reports: unknown[] = [];
    const tall = cardBox(contextOf(long, { report: (item) => reports.push(item) }));
    expect(tall.height).toBeGreaterThan(short);
    expect(tall.height).toBeLessThanOrEqual(NUMBER_DEFAULTS['card-max-height']);
    expect(reports).toEqual([]);
  });

  it('shrinks the question and the answer together when the card is full', () => {
    const context = contextOf({
      tema: ['Tema'],
      pergunta: ['Pergunta longa '.repeat(8)],
      resposta: ['Resposta longa '.repeat(30)],
    });
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
    const huge: Fields = {
      pergunta: ['Pergunta '.repeat(200)],
      resposta: ['Resposta '.repeat(400)],
    };
    build(contextOf(huge, { report: (item) => reports.push(item as { code?: string }) }));
    expect(reports.some((item) => item.code === 'W_TEMPLATE_OVERFLOW')).toBe(true);
  });

  it('sets the question in italic', () => {
    const runs = named(contextOf(ruling), 'pergunta')?.runs ?? [];
    expect(
      runs.filter((item) => item.text !== undefined).every((item) => item.style === 'italic'),
    ).toBe(true);
  });

  it('keeps each written line of a field as its own line', () => {
    const context = contextOf({ ...ruling, resposta: ['Primeiro.', 'Segundo.'] });
    expect(textOf(named(context, 'resposta'))).toBe('Primeiro.\nSegundo.');
  });
});

describe('the title', () => {
  it('is the reference’s two lines in capitals when the brief writes no titulo', () => {
    const context = contextOf(ruling);
    expect(textOf(named(context, 'chapeu'))).toBe('DESTAQUES DO');
    expect(textOf(named(context, 'titulo'))).toBe('INFORMATIVO');
  });

  it('takes the brief’s lines: the first the kicker, the rest the title', () => {
    const context = contextOf(ruling, { titulo: ['Destaques do', 'Informativo TRZ 412'] });
    expect(textOf(named(context, 'chapeu'))).toBe('DESTAQUES DO');
    expect(textOf(named(context, 'titulo'))).toBe('INFORMATIVO TRZ 412');
  });

  it('is the title alone with one line, and nothing with none', () => {
    const one = contextOf(ruling, { titulo: ['Informativo STF 1229'] });
    expect(named(one, 'chapeu')).toBeUndefined();
    expect(textOf(named(one, 'titulo'))).toBe('INFORMATIVO STF 1229');

    const none = contextOf(ruling, { titulo: [] });
    expect(named(none, 'chapeu')).toBeUndefined();
    expect(named(none, 'titulo')).toBeUndefined();
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
    expect(roleOf(contextOf({}, { contracapa: true }))).toBe('contracapa');
    expect(roleOf(contextOf(ruling))).toBe('ruling');
  });

  it('says the reference’s words when nothing is written, and drops the title’s number', () => {
    const context = contextOf(
      {},
      { contracapa: true, titulo: ['Destaques do', 'Informativo TRZ 412'] },
    );
    expect(textOf(named(context, 'chamada-texto'))).toBe(DEFAULT_CALL);
    expect(textOf(named(context, 'fecho'))).toBe(DEFAULT_CLOSING);
    expect(textOf(named(context, 'titulo'))).toBe('INFORMATIVO TRZ');
  });

  it('takes its call and its closing from its fields, and hides one written empty', () => {
    const replaced = contextOf(
      { chamada: ['Salve este post!'], fecho: ['Até a próxima!'] },
      { contracapa: true },
    );
    expect(textOf(named(replaced, 'chamada-texto'))).toBe('Salve este post!');
    expect(textOf(named(replaced, 'fecho'))).toBe('Até a próxima!');

    const hidden = contextOf({ chamada: [] }, { contracapa: true });
    expect(named(hidden, 'chamada')).toBeUndefined();
    expect(textOf(named(hidden, 'fecho'))).toBe(DEFAULT_CLOSING);
  });

  it('centres its card too', () => {
    const { top, height } = cardBox(contextOf({}, { contracapa: true }));
    expect(Math.abs(top + height / 2 - 675)).toBeLessThanOrEqual(1);
  });
});
