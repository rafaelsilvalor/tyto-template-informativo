/**
 * `informativo` — a court bulletin carousel of 1080×1350 slides on a paper card.
 *
 * ## The two kinds of slide
 *
 * | slide      | the brief writes          | drawn                                                   |
 * | ---------- | ------------------------- | ------------------------------------------------------- |
 * | ruling     | `::lamina` with its lines | the subject band, the question, the answer, the source  |
 * | back cover | `::lamina {contracapa}`   | the call to like the post, "Bons estudos!", the icons   |
 *
 * One `::lamina` is one slide in Tyto, and a template cannot add slides of its own, so the brief
 * marks the back cover.
 *
 * ## The card
 *
 * Both slides draw one card: two tabs over a rounded sheet, with the brand kit's signature on the
 * front tab. The card is as tall as what it holds and is centred on the slide. It never grows past
 * `card-max-height` (the reference's: 135 px from each edge); past that the question and the
 * answer shrink together, a pixel at a time, down to their floors, and below the floors the
 * overflow is reported.
 *
 * ## Paper and background
 *
 * Under the card lies the background, `background` (a declared image value, Tyto ADR 0153) unless
 * the brief writes `fundo`. Over everything lies the paper, `paper-texture`, in `multiply`, so the
 * grain darkens the card, the bands and the words alike. The repository ships a generated
 * background and a generated paper: the reference's are stock pictures and stay out of it.
 *
 * Every position is the reference art's (the maintainer's PSD), in the slide's pixels.
 */

import {
  colorValue,
  frame,
  group,
  image,
  imageValue,
  lineBreak,
  numberValue,
  rect,
  run,
  runsOf,
  solid,
  text,
  vector,
} from '@tyto/core/template';
import { drawLogo, oneInk, signatureOf } from '@tyto/house-style';
import { at, lines, plain, reportOverflow } from '@tyto/template-kit';

import type { RichText, TemplateBuild, TemplateContext, TextRun } from '@tyto/core';
import type { NodeDraft, TextDraft } from '@tyto/core/template';

/* -------------------------------------------------------------------------- the words -- */

/** The small line over the title, on every slide. */
export const KICKER = 'DESTAQUES DO';

/** The back cover's band and closing line when its `::lamina {contracapa}` writes none. */
export const DEFAULT_CALL =
  'Curta este post para sabermos se as informações foram úteis para você!';
export const DEFAULT_CLOSING = 'Bons estudos!';

/* ------------------------------------------------------------------------- the tokens -- */

/** The colours a configuration may change, by declared value name, each the reference's. */
export const COLOR_DEFAULTS = {
  /** The card and its front tab. */
  card: '#ebeae9',
  /** The back tab, the one with the arrow. */
  'back-tab': '#d6d5d1',
  /** The bands (subject, answer, call), the title, the heart. */
  accent: '#b58230',
  /** The lighter edge of each band. */
  'accent-edge': '#d8ab63',
  /** The title's words. */
  'title-color': '#b27c37',
  /** The words on the card, the arrow, the icons, the signature. */
  ink: '#4d4d4d',
  /** The words on a band. */
  'on-accent': '#ebeae9',
  /** A `**highlight**` in the question. */
  'highlight-color': '#ae7d2e',
  /** The logo, over the background. */
  logo: '#ebeae9',
} as const;

type ColorName = keyof typeof COLOR_DEFAULTS;

/** The numbers a configuration may change (Tyto ADR 0153). */
export const NUMBER_DEFAULTS = {
  /** The tallest the card may be, its tabs included. */
  'card-max-height': 1080,
  /** The question's size and its floor when the card is full. */
  'question-size': 40,
  'question-floor': 28,
  /** The answer's size and its floor. */
  'answer-size': 32,
  'answer-floor': 22,
} as const;

type NumberName = keyof typeof NUMBER_DEFAULTS;

/* -------------------------------------------------------------------------- the faces -- */

/** Fetched from Google Fonts when the machine lacks them (Tyto ADR 0120). */
const SERIF = { family: 'Newsreader', source: 'system' } as const;
const SANS = { family: 'Roboto', source: 'system' } as const;
/** Licensed: drawn from the machine, a bundled substitute elsewhere. */
const QUESTION_FACE = { family: 'CircularXX', source: 'system' } as const;

const LIGHT = 300;
const REGULAR = 400;
const MEDIUM = 500;
const SEMIBOLD = 600;
const EXTRABOLD = 800;

/**
 * Google's Newsreader 800 sets the title 4 % wider than the reference's NewsreaderRoman
 * (566 px against 589 px for `INFORMATIVO  STJ 906`, measured on the render): this closes it.
 */
const TITLE_TRACKING = -0.027;

/**
 * Where the capitals start under a line's top, per family, as the fraction of the size the
 * browser puts above them: half the leading's excess over ascent plus descent, then ascent less
 * the cap height, in the metrics the browser uses: OS/2 typo where the font sets USE_TYPO_METRICS
 * (CircularXX, Newsreader), hhea where it does not (Roboto), read from the files themselves.
 */
const METRICS = {
  Newsreader: { ascent: 0.735, descent: 0.265, cap: 0.67 },
  Roboto: { ascent: 0.928, descent: 0.244, cap: 0.711 },
  CircularXX: { ascent: 0.75, descent: 0.25, cap: 0.709 },
} as const;

type Family = keyof typeof METRICS;

/** A shape drawn by its outline only. */
const NO_FILL = solid({ r: 0, g: 0, b: 0, a: 0 });

function capOffset(family: Family, size: number, lineHeight: number): number {
  const m = METRICS[family];
  return size * ((lineHeight - (m.ascent + m.descent)) / 2 + (m.ascent - m.cap));
}

/** A glyph's advance, in em, for when nothing can be measured (a test, CI without the face). */
const ESTIMATED_ADVANCE = 0.5;

/* ------------------------------------------------------------------------ the geometry -- */

const SLIDE = { w: 1080, h: 1350 } as const;

/** The logo: the reference's owl, 70 px tall, fixed to the slide's corner. */
const LOGO = { x: 109, y: 65, height: 70 } as const;

/** The card, in the slide's x and in y from the top of its tabs. */
const CARD = {
  x: 85,
  w: 911,
  radius: 30,
  /** From the tabs' top to the sheet's top. */
  tabs: 69.6,
} as const;

/** Inside the sheet, every left edge and width the reference uses. */
const INNER = {
  bandX: 109,
  bandW: 862,
  edge: 10,
  textX: 151,
  textW: 790,
  /** The question wraps narrower: the reference breaks it before the right of the answer. */
  questionW: 740,
} as const;

/** The tabs, as paths in the slide's x and in y from their top (the reference's shapes). */
const FRONT_TAB =
  'M661.1 69.6V104.3H119V69.6H153.4C166.6 69.6 177.4 58.9 177.4 45.6V24C177.4 10.8 188.1 0 201.4 0' +
  'H578.7C591.9 0 602.7 10.8 602.7 24V45.6C602.7 58.9 613.4 69.6 626.6 69.6Z';
const BACK_TAB =
  'M871 69.6V104.3H553.9V69.6H588.3C601.6 69.6 612.3 58.9 612.3 45.6V24C612.3 10.8 623 0 636.3 0' +
  'H788.6C801.8 0 812.6 10.8 812.6 24V45.6C812.6 58.9 823.3 69.6 836.5 69.6Z';

/** The ruling's arrow on the back tab: on to the next slide. */
const ARROW_ON = 'M780.2 37.9L764.5 25.1V34.2H644V41.6H764.5V50.8Z';
/** The back cover's arrow: down, to the comments. */
const ARROW_DOWN = 'M690 20H718V40H727L712 57L697 40H706V28H690Z';

/** The signature on the front tab: Light 30 px, its capitals 22 px under the tabs' top. */
const SIGNATURE = { x: 215, capTop: 22, size: 30 } as const;

/** The group shadow: multiply, 20 %, 90° at 7 px, size 142 (Photoshop) → blur 71. */
const SHADOW = { y: 7, blur: 71, alpha: 0.2, grey: 49 } as const;

/** The ruling's vertical rhythm, in px, each the reference's. */
const RULING = {
  /** Sheet top → the kicker's capitals. */
  kicker: 52,
  kickerSize: 36,
  /** Kicker capitals → the title's capitals. */
  title: 50,
  titleSize: 48,
  /** Sheet top → subject band. */
  band: 178,
  bandH: 68,
  bandSize: 32,
  /** Band bottom → the question's capitals. */
  question: 56,
  questionLineHeight: 1.5,
  /** The question's last line → the answer block's top. */
  answerGap: 51,
  /** Answer block top → its first capitals; its last line → block bottom. */
  answerTop: 46,
  answerBottom: 26,
  answerLineHeight: 1.5,
  answerEdge: 13,
  /** Answer block bottom → the source's capitals. */
  source: 27,
  sourceSize: 24,
  sourceLineHeight: 1.2,
  /** The source's last line → sheet bottom. */
  bottom: 24,
} as const;

/** The back cover, from the sheet's top, the reference's. */
const BACK = {
  sheet: 812,
  kicker: 91,
  band: 195,
  bandH: 130,
  bandSize: 40,
  bandLineHeight: 1.2,
  closing: 362,
  closingSize: 72,
  heart: { x: 444, y: 453, d: 192 },
  icons: { x: 461, y: 684 },
} as const;

/* --------------------------------------------------------------------------- the build -- */

export type Role = 'ruling' | 'contracapa';

/** Which slide this `::lamina` is: the brief marks the back cover. */
export function roleOf(context: TemplateContext): Role {
  return context.adjustments['contracapa'] === true ? 'contracapa' : 'ruling';
}

export const build: TemplateBuild = (context: TemplateContext) => {
  const ink = (name: ColorName): string => colorValue(context, name, COLOR_DEFAULTS[name]);
  const number = (name: NumberName): number => numberValue(context, name, NUMBER_DEFAULTS[name]);

  // The brief's `fundo` wins over the configuration's `background`, whose default is the
  // generated one in `assets/`.
  const written = context.slots['fundo']?.value;
  const background = written?.kind === 'image' ? written.asset : imageValue(context, 'background');
  const paper = imageValue(context, 'paper-texture');

  const sheet =
    roleOf(context) === 'contracapa' ? backCover(context, ink) : ruling(context, ink, number);
  const height = CARD.tabs + sheet.height;
  const top = Math.round((SLIDE.h - height) / 2);
  const limit = number('card-max-height');
  if (height > limit) reportOverflow(context.report, top + height, top + limit);

  return frame({
    format: context.format,
    size: context.size,
    idPrefix: context.idPrefix,
    background: solid('#e2e1e1'),
    children: [
      ...(background === undefined
        ? []
        : [image({ name: 'fundo', asset: background, size: context.size, fit: 'cover' })]),
      at(LOGO.x, LOGO.y, drawLogo(context.brand, LOGO.height, oneInk(ink('logo')))),
      card(context, ink, top, sheet),
      ...(paper === undefined
        ? []
        : [
            image({
              name: 'papel',
              asset: paper,
              size: context.size,
              fit: 'cover',
              blend: 'multiply',
            }),
          ]),
    ],
  });
};

/* ---------------------------------------------------------------------------- the card -- */

interface Sheet {
  readonly height: number;
  /** The arrow on the back tab. */
  readonly arrow: string;
  /** Everything on the sheet, in y from the sheet's top. */
  readonly children: readonly NodeDraft[];
}

type Ink = (name: ColorName) => string;

function card(context: TemplateContext, ink: Ink, top: number, sheet: Sheet): NodeDraft {
  const tab = (name: string, d: string, color: string): NodeDraft =>
    vector({
      name,
      geometry: { kind: 'path', d, fillRule: 'nonzero' },
      size: { w: SLIDE.w, h: CARD.tabs + 35 },
      fill: solid(color),
    });
  return group({
    name: 'cartao',
    transform: { x: 0, y: top },
    effects: [
      {
        kind: 'shadow',
        x: 0,
        y: SHADOW.y,
        blur: SHADOW.blur,
        spread: 0,
        color: { r: SHADOW.grey, g: SHADOW.grey, b: SHADOW.grey, a: SHADOW.alpha },
      },
    ],
    children: [
      tab('aba-tras', BACK_TAB, ink('back-tab')),
      vector({
        name: 'seta',
        geometry: { kind: 'path', d: sheet.arrow, fillRule: 'nonzero' },
        size: { w: SLIDE.w, h: CARD.tabs },
        fill: solid(ink('ink')),
      }),
      tab('aba-frente', FRONT_TAB, ink('card')),
      plainText('assinatura', signatureOf(context.brand), {
        family: 'Roboto',
        font: SANS,
        x: SIGNATURE.x,
        capTop: SIGNATURE.capTop,
        size: SIGNATURE.size,
        weight: LIGHT,
        color: ink('ink'),
      }),
      rect({
        name: 'folha',
        size: { w: CARD.w, h: sheet.height },
        radius: CARD.radius,
        fill: solid(ink('card')),
        transform: { x: CARD.x, y: CARD.tabs },
      }),
      group({ name: 'conteudo', transform: { y: CARD.tabs }, children: sheet.children }),
    ],
  });
}

/** The two title lines: the kicker, then `INFORMATIVO` and the brief's `informativo`. */
function title(
  ink: Ink,
  court: string,
  capTop: number,
  align: 'left' | 'center',
): readonly NodeDraft[] {
  const x = align === 'left' ? INNER.textX : CARD.x;
  const width = align === 'left' ? INNER.textW : CARD.w;
  const placed = {
    family: 'Newsreader',
    font: SERIF,
    x,
    width,
    align,
    weight: EXTRABOLD,
    tracking: TITLE_TRACKING,
  } as const;
  return [
    plainText('chapeu', KICKER, {
      ...placed,
      capTop,
      size: RULING.kickerSize,
      color: ink('title-color'),
    }),
    plainText('titulo', `INFORMATIVO  ${court.toUpperCase()}`.trim(), {
      ...placed,
      capTop: capTop + RULING.title,
      size: RULING.titleSize,
      color: ink('title-color'),
    }),
  ];
}

/** A band: the accent with its lighter edge on the left (`side`) or on top. */
function band(
  ink: Ink,
  name: string,
  y: number,
  height: number,
  edge: 'side' | 'top',
): readonly NodeDraft[] {
  const radius = 6;
  return [
    rect({
      name,
      size: { w: INNER.bandW, h: height },
      radius,
      fill: solid(ink('accent-edge')),
      transform: { x: INNER.bandX, y },
    }),
    rect({
      name: `${name}-corpo`,
      size:
        edge === 'side'
          ? { w: INNER.bandW - INNER.edge, h: height }
          : { w: INNER.bandW, h: height - RULING.answerEdge },
      radius: edge === 'side' ? [0, radius, radius, 0] : [0, 0, radius, radius],
      fill: solid(ink('accent')),
      transform:
        edge === 'side'
          ? { x: INNER.bandX + INNER.edge, y }
          : { x: INNER.bandX, y: y + RULING.answerEdge },
    }),
  ];
}

/* -------------------------------------------------------------------------- the ruling -- */

/** A ruling slide's four parts, read from its lines (see the manifest). */
export interface Ruling {
  readonly subject: RichText | undefined;
  readonly question: RichText | undefined;
  readonly answer: readonly RichText[];
  readonly source: RichText | undefined;
}

/**
 * The first line is the subject, the second the question; with four lines or more the last is
 * the source, and every line between is a paragraph of the answer.
 */
export function rulingOf(written: readonly RichText[]): Ruling {
  const [subject, question, ...rest] = written;
  const source = rest.length >= 2 ? rest[rest.length - 1] : undefined;
  const answer = source === undefined ? rest : rest.slice(0, -1);
  return { subject, question, answer, source };
}

function ruling(context: TemplateContext, ink: Ink, number: (name: NumberName) => number): Sheet {
  const parts = rulingOf(slideLines(context));
  const limit = number('card-max-height') - CARD.tabs;
  const questionSize = number('question-size');
  const answerSize = number('answer-size');

  // The largest step at which the sheet fits, a pixel of the question at a time; the answer
  // shrinks in proportion. At the floors the sheet is drawn as it is and the overflow reported.
  const floorStep = Math.max(
    0,
    Math.ceil(
      Math.max(
        questionSize - number('question-floor'),
        ((answerSize - number('answer-floor')) * questionSize) / answerSize,
      ),
    ),
  );
  let laid = layRuling(context, ink, parts, questionSize, answerSize);
  for (let step = 1; laid.height > limit && step <= floorStep; step += 1) {
    const question = Math.max(number('question-floor'), questionSize - step);
    const answer = Math.max(number('answer-floor'), answerSize * (question / questionSize));
    laid = layRuling(context, ink, parts, question, answer);
  }
  return laid;
}

function layRuling(
  context: TemplateContext,
  ink: Ink,
  parts: Ruling,
  questionSize: number,
  answerSize: number,
): Sheet {
  const children: NodeDraft[] = [...title(ink, court(context), RULING.kicker, 'left')];

  children.push(...band(ink, 'tema', RULING.band, RULING.bandH, 'side'));
  if (parts.subject !== undefined) {
    const runs = runsOf(parts.subject, {
      font: SANS,
      size: RULING.bandSize,
      weight: SEMIBOLD,
      color: ink('on-accent'),
    });
    children.push(
      richText('tema-texto', runs, {
        family: 'Roboto',
        x: INNER.textX,
        capTop: RULING.band + (RULING.bandH - RULING.bandSize * METRICS.Roboto.cap) / 2,
        size: RULING.bandSize,
        width: INNER.textW,
      }),
    );
  }

  let y = RULING.band + RULING.bandH + RULING.question;
  if (parts.question !== undefined) {
    const runs = runsOf(
      parts.question,
      { font: QUESTION_FACE, size: questionSize, weight: REGULAR, color: ink('ink') },
      { bold: MEDIUM },
    ).map((item) => italic(item, ink('highlight-color')));
    const node = richText('pergunta', runs, {
      family: 'CircularXX',
      x: INNER.textX,
      capTop: y,
      size: questionSize,
      width: INNER.questionW,
      lineHeight: RULING.questionLineHeight,
    });
    children.push(node);
    const count = measuredLines(context, node, [parts.question], questionSize, INNER.questionW);
    y += (count - 1) * questionSize * RULING.questionLineHeight + questionSize * 0.709;
  }

  y += RULING.answerGap;
  const answerTop = y;
  let answerHeight = RULING.answerTop + RULING.answerBottom;
  let answerNode: TextDraft | undefined;
  if (parts.answer.length > 0) {
    const runs = parts.answer.flatMap((paragraph, index) => [
      ...(index === 0 ? [] : [lineBreak()]),
      ...runsOf(
        paragraph,
        { font: SANS, size: answerSize, weight: LIGHT, color: ink('on-accent') },
        { bold: MEDIUM },
      ),
    ]);
    answerNode = richText('resposta', runs, {
      family: 'Roboto',
      x: INNER.textX,
      capTop: answerTop + RULING.answerTop,
      size: answerSize,
      width: INNER.textW,
      lineHeight: RULING.answerLineHeight,
    });
    const count = measuredLines(context, answerNode, parts.answer, answerSize, INNER.textW);
    answerHeight += (count - 1) * answerSize * RULING.answerLineHeight + answerSize * 0.711;
  }
  children.push(...band(ink, 'bloco-resposta', answerTop, answerHeight, 'top'));
  if (answerNode !== undefined) children.push(answerNode);
  y = answerTop + answerHeight;

  if (parts.source !== undefined) {
    y += RULING.source;
    const runs = runsOf(parts.source, {
      font: SANS,
      size: RULING.sourceSize,
      weight: LIGHT,
      color: ink('ink'),
    });
    const node = richText('fonte', runs, {
      family: 'Roboto',
      x: INNER.textX,
      capTop: y,
      size: RULING.sourceSize,
      width: INNER.textW,
      lineHeight: RULING.sourceLineHeight,
    });
    children.push(node);
    const count = measuredLines(context, node, [parts.source], RULING.sourceSize, INNER.textW);
    y += (count - 1) * RULING.sourceSize * RULING.sourceLineHeight + RULING.sourceSize * 0.711;
  }

  return { height: Math.round(y + RULING.bottom), arrow: ARROW_ON, children };
}

/** The question is italic throughout; its highlights take the highlight colour. */
function italic(item: TextRun, highlight: string): TextRun {
  if (item.kind !== 'text') return item;
  const bold = item.weight > REGULAR;
  return { ...item, style: 'italic', ...(bold ? { color: solid(highlight) } : {}) };
}

/* ---------------------------------------------------------------------- the back cover -- */

function backCover(context: TemplateContext, ink: Ink): Sheet {
  const [callLine, closingLine] = slideLines(context);
  const call = callLine === undefined ? DEFAULT_CALL : plain(callLine);
  const closing = closingLine === undefined ? DEFAULT_CLOSING : plain(closingLine);

  const children: NodeDraft[] = [
    ...title(ink, court(context).replace(/\s+\d[\d.]*$/u, ''), BACK.kicker, 'center'),
    ...band(ink, 'chamada', BACK.band, BACK.bandH, 'side'),
    plainText('chamada-texto', call, {
      family: 'Roboto',
      font: SANS,
      x: INNER.bandX + INNER.edge,
      width: INNER.bandW - INNER.edge,
      align: 'center',
      capTop: BACK.band + 23,
      size: BACK.bandSize,
      weight: SEMIBOLD,
      lineHeight: BACK.bandLineHeight,
      color: ink('on-accent'),
    }),
    plainText('fecho', closing, {
      family: 'Newsreader',
      font: SERIF,
      x: CARD.x,
      width: CARD.w,
      align: 'center',
      capTop: BACK.closing,
      size: BACK.closingSize,
      weight: EXTRABOLD,
      color: ink('title-color'),
    }),
    ...heart(ink),
    ...icons(ink),
  ];
  return { height: BACK.sheet, arrow: ARROW_DOWN, children };
}

function heart(ink: Ink): readonly NodeDraft[] {
  const { x, y, d } = BACK.heart;
  const shape =
    'M96 150C96 150 42 112 42 78C42 58 57 46 73 46C84 46 92 52 96 60C100 52 108 46 119 46' +
    'C135 46 150 58 150 78C150 112 96 150 96 150Z';
  return [
    rect({
      name: 'coracao-fundo',
      size: { w: d, h: d },
      radius: d / 2,
      fill: solid(ink('accent')),
      transform: { x, y },
    }),
    vector({
      name: 'coracao',
      geometry: { kind: 'path', d: shape, fillRule: 'nonzero' },
      size: { w: d, h: d },
      fill: solid(ink('card')),
      transform: { x, y },
    }),
  ];
}

/** Comment, share and save, outlined in the ink. */
function icons(ink: Ink): readonly NodeDraft[] {
  const { x, y } = BACK.icons;
  const stroke = { paint: solid(ink('ink')), width: 4, align: 'center' as const };
  return [
    vector({
      name: 'comentar',
      geometry: {
        kind: 'path',
        d:
          'M24 4C12 4 3 12 3 22C3 32 12 40 24 40C27 40 30 39 33 38L44 44L41 34C44 31 45 27 45 22' +
          'C45 12 36 4 24 4Z',
        fillRule: 'nonzero',
      },
      size: { w: 48, h: 48 },
      stroke,
      fill: NO_FILL,
      transform: { x, y },
    }),
    vector({
      name: 'compartilhar',
      geometry: { kind: 'path', d: 'M38 3L3 16L18 22L24 38L38 3ZM18 22L38 3', fillRule: 'nonzero' },
      size: { w: 42, h: 42 },
      stroke,
      fill: NO_FILL,
      transform: { x: x + 66, y: y + 4 },
    }),
    vector({
      name: 'salvar',
      geometry: { kind: 'path', d: 'M3 3H27V37L15 27L3 37Z', fillRule: 'nonzero' },
      size: { w: 30, h: 40 },
      stroke,
      fill: NO_FILL,
      transform: { x: x + 130, y: y + 4 },
    }),
  ];
}

/* -------------------------------------------------------------------------- the shared -- */

/** The brief's `informativo`, the court and the bulletin's number: `TRZ 412`. */
function court(context: TemplateContext): string {
  const value = context.slots['informativo']?.value;
  return value?.kind === 'rich-text' ? plain(value.text).trim() : '';
}

/** This slide's written lines as rich text, the empty ones dropped. */
function slideLines(context: TemplateContext): RichText[] {
  const value = context.slots['lamina']?.value;
  if (value?.kind !== 'rich-text') return [];
  return lines(value.text).filter((line) => plain(line).trim() !== '');
}

interface Box {
  readonly family: Family;
  readonly x: number;
  /** Where the capitals start, in the parent's pixels. */
  readonly capTop: number;
  readonly size: number;
  readonly lineHeight?: number;
  readonly width?: number;
  readonly align?: 'left' | 'center';
  /** Letter spacing in em. */
  readonly tracking?: number;
}

interface Placed extends Box {
  readonly font: typeof SERIF | typeof SANS;
  readonly weight: number;
  readonly color: string;
}

/** A plain text, one run per line, placed by the top of its capitals. */
function plainText(name: string, words: string, placed: Placed): TextDraft {
  const style = {
    font: placed.font,
    size: placed.size,
    weight: placed.weight,
    color: placed.color,
  };
  const [first = '', ...others] = words.split('\n');
  return richText(
    name,
    [run(first, style), ...others.flatMap((line) => [lineBreak(), run(line, style)])],
    placed,
  );
}

function richText(name: string, runs: readonly TextRun[], placed: Box): TextDraft {
  const lineHeight = placed.lineHeight ?? 1.2;
  const [head, ...tail] = runs;
  const empty = run('', { font: SANS, size: placed.size, weight: REGULAR, color: '#000000' });
  return text({
    name,
    runs: [head ?? empty, ...tail],
    ...(placed.width === undefined ? {} : { box: { w: placed.width } }),
    align: placed.align ?? 'left',
    letterSpacing: (placed.tracking ?? 0) * placed.size,
    lineHeight,
    transform: {
      x: placed.x,
      y: placed.capTop - capOffset(placed.family, placed.size, lineHeight),
    },
  });
}

/**
 * How many lines a text wraps to: measured when the context can, estimated otherwise from the
 * characters a line of `width` holds, each line written counted apart.
 */
function measuredLines(
  context: TemplateContext,
  node: TextDraft,
  written: readonly RichText[],
  size: number,
  width: number,
): number {
  const measured = context.measure(node);
  if (measured !== undefined) return Math.max(1, measured.lines);
  const perLine = Math.max(1, Math.floor(width / (size * ESTIMATED_ADVANCE)));
  const count = written.reduce<number>(
    (sum, line) => sum + Math.max(1, Math.ceil([...plain(line)].length / perLine)),
    0,
  );
  return Math.max(1, count);
}
