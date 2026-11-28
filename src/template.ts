/**
 * `informativo` — a court bulletin carousel of 1080×1350 slides on a paper card.
 *
 * ## The two kinds of slide
 *
 * | slide      | the brief writes                          | drawn                                   |
 * | ---------- | ----------------------------------------- | --------------------------------------- |
 * | ruling     | `::lamina`, then `::tema`, `::pergunta`…  | the sections written, stacked           |
 * | back cover | `::lamina {contracapa}`, then `::chamada` | the call, the closing line, the icons   |
 *
 * One `::lamina` is one slide in Tyto, and a template cannot add slides of its own, so the brief
 * marks the back cover. Every section is a field of its own and optional.
 *
 * ## The lines
 *
 * The house's own tools, not new ones: every field goes through the kit's `keepTogether`, with
 * one rule added for a short word and the next (no line ends on `a`, `e`, `o`, `é`, `à` or
 * `de`, as the banner keeps `de` and `e`), and the question, the answer and the source go
 * through `settle` (Tyto ADR 0167) as `voce-conhece`'s paragraphs do, so none ends on a word of
 * its own.
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
 * background and a generated paper; the reference's background stays out of it by the
 * maintainer's choice and arrives by configuration or by the brief.
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
} from '@tyto/core/template';
import { drawLogo, oneInk, signatureOf } from '@tyto/house-style';
import {
  KEEP_TOGETHER_RULES,
  ORPHAN_LIMITS,
  anchorOf,
  at,
  barePicture,
  block,
  buttonRow,
  capText,
  capitals,
  icon,
  iconInDisc,
  keepTogether,
  lines,
  plain,
  reportOrphan,
  reportOverflow,
  settle,
  shape,
  signatureLine,
} from '@tyto/template-kit';

import type { FontMetrics, Icon, KeepTogetherRule } from '@tyto/template-kit';

import type { RichText, TemplateBuild, TemplateContext, TextRun } from '@tyto/core';
import type { NodeDraft, TextDraft } from '@tyto/core/template';

/* -------------------------------------------------------------------------- the words -- */

/** The title when the brief writes no `::titulo`: the kicker, then the title (the reference's). */
export const DEFAULT_TITLE = ['Destaques do', 'Informativo'] as const;

/**
 * The kit's pairs and one of this template's: a one-letter word or `de` stays with the word
 * after it, so no line ends on it (Rafael, 2026-11-12, on "…de votos, se a / questão").
 */
export const KEEP_TOGETHER: readonly KeepTogetherRule[] = [
  ...KEEP_TOGETHER_RULES,
  {
    name: 'short word + next word',
    before: String.raw`(?<![\p{L}\p{N}])(?:[aàoeéAÀOEÉ]|[dD]e)`,
    after: String.raw`\S`,
  },
];

/** The back cover's band and closing line when its `::chamada` and `::fecho` are not written. */
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
  /** The most the question may grow into the room its lines leave, never gaining a line. */
  /** The least the question may take to fill its box (`unfilledOf`), so it never gets small. */
  'question-min': 36,
  'question-ceiling': 48,
  /** The least and the most the answer may take to fill its box, the same way. */
  'answer-min': 29,
  'answer-ceiling': 36,
  /** The answer's size and its floor. */
  'answer-size': 32,
  'answer-floor': 22,
  /**
   * The most letter spacing, in em, the question, the answer or the source may take or give so
   * that none ends on a word of its own (Tyto ADR 0167); their size never moves for it.
   */
  'orphan-tracking': ORPHAN_LIMITS.tracking,
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
 * (566 px against 589 px for `INFORMATIVO  TRZ 412`, measured on the render): this closes it.
 */
const TITLE_TRACKING = -0.027;

type Family = 'Newsreader' | 'Roboto' | 'CircularXX';

/**
 * Each family's metrics, as the kit's `capText` places a text by its capitals: in the metrics the
 * browser uses, OS/2 typo where the font sets USE_TYPO_METRICS (CircularXX, Newsreader), hhea
 * where it does not (Roboto), read from the files themselves.
 */
const METRICS: Readonly<Record<Family, FontMetrics>> = {
  Newsreader: { ascent: 0.735, descent: 0.265, capHeight: 0.67 },
  Roboto: { ascent: 0.928, descent: 0.244, capHeight: 0.711 },
  CircularXX: { ascent: 0.75, descent: 0.25, capHeight: 0.709 },
};

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

/**
 * A shape of the reference's, held as data: its outline in a box, and where that box stands on
 * the card, in the slide's x and in y from the tabs' top.
 *
 * The tabs and the arrows are still outlined in the slide's x, in a box as wide as the slide:
 * the card's shadow is cast from a layer as large as the boxes it holds, and Chrome sets every
 * edge in that layer a fraction of a pixel differently when the boxes change (measured,
 * TYTO-894). Giving each its own box is a change to the art, made apart.
 */
interface Piece {
  readonly x: number;
  readonly y: number;
  readonly shape: Icon;
}

/** The tabs (the reference's shapes); each runs 34.7 px under the sheet, so no seam shows. */
const TAB_BOX = { w: SLIDE.w, h: CARD.tabs + 35 } as const;
const FRONT_TAB: Piece = {
  x: 0,
  y: 0,
  shape: {
    box: TAB_BOX,
    d:
      'M661.1 69.6V104.3H119V69.6H153.4C166.6 69.6 177.4 58.9 177.4 45.6V24C177.4 10.8 188.1 0 201.4 0' +
      'H578.7C591.9 0 602.7 10.8 602.7 24V45.6C602.7 58.9 613.4 69.6 626.6 69.6Z',
    paint: { kind: 'fill' },
  },
};
const BACK_TAB: Piece = {
  x: 0,
  y: 0,
  shape: {
    box: TAB_BOX,
    d:
      'M871 69.6V104.3H553.9V69.6H588.3C601.6 69.6 612.3 58.9 612.3 45.6V24C612.3 10.8 623 0 636.3 0' +
      'H788.6C801.8 0 812.6 10.8 812.6 24V45.6C812.6 58.9 823.3 69.6 836.5 69.6Z',
    paint: { kind: 'fill' },
  },
};

/**
 * The ruling's arrow on the back tab: on to the next slide. The reference's own outline, not
 * the kit's `arrowShape`: its head is centred 0.05 px under its shaft (37.95 against 37.9), and
 * a symmetric arrow would move it.
 */
const ARROW_BOX = { w: SLIDE.w, h: CARD.tabs } as const;
const ARROW_ON: Piece = {
  x: 0,
  y: 0,
  shape: {
    box: ARROW_BOX,
    d: 'M780.2 37.9L764.5 25.1V34.2H644V41.6H764.5V50.8Z',
    paint: { kind: 'fill' },
  },
};
/** The back cover's arrow: down, to the comments. */
const ARROW_DOWN: Piece = {
  x: 0,
  y: 0,
  shape: {
    box: ARROW_BOX,
    d: 'M690 20H718V40H727L712 57L697 40H706V28H690Z',
    paint: { kind: 'fill' },
  },
};

/** The back cover's heart, filled, in its disc's own box. */
const HEART: Icon = {
  box: { w: 192, h: 192 },
  d:
    'M96 150C96 150 42 112 42 78C42 58 57 46 73 46C84 46 92 52 96 60C100 52 108 46 119 46' +
    'C135 46 150 58 150 78C150 112 96 150 96 150Z',
  paint: { kind: 'fill' },
};

/** Inside the sheet, every left edge and width the reference uses. */
const INNER = {
  bandX: 109,
  bandW: 862,
  edge: 10,
  textX: 151,
  textW: 790,
  /**
   * The question's box: from its left edge to 913 px, where Rafael's reference of 2026-11-12
   * keeps the same margin on the right as the bands keep on the left.
   */
  questionW: 762,
} as const;

/** The signature on the front tab: Light 30 px, its capitals 22 px under the tabs' top. */
const SIGNATURE = { x: 215, capTop: 22, size: 30 } as const;

/** The group shadow: multiply, 20 %, 90° at 7 px, size 142 (Photoshop) → blur 71. */
const SHADOW = { y: 7, blur: 71, alpha: 0.2, grey: 49 } as const;

/**
 * The title, on both slides. Its kicker's capitals' foot to the title's capitals: the reference
 * sets them at 52 and 102, and the kicker's capitals are 36 × 0.67 tall.
 */
const TITLE = {
  kickerSize: 36,
  size: 48,
  lineHeight: 1.2,
  kickerToTitle: 26,
} as const;

/**
 * A ruling's vertical rhythm, each the reference's (a gap runs from the foot of what is above
 * to the top of what comes next: a text's capitals, a band's edge).
 */
const RULING = {
  /** Sheet top → the first section's top. */
  top: 52,
  /** → the subject band; the band pads its text 22.6 px above and below, 68 px for one line. */
  band: 44,
  bandPadding: { top: 22.6, bottom: 22.6 },
  bandSize: 32,
  bandLineHeight: 1.5,
  /** → the question's capitals. */
  question: 56,
  questionLineHeight: 1.5,
  /** → the answer block's top; the block pads its text 46 px above and 26 below. */
  answer: 51,
  answerPadding: { top: 46, bottom: 26 },
  answerLineHeight: 1.5,
  answerEdge: 13,
  /** → the source's capitals. */
  source: 27,
  sourceSize: 24,
  sourceLineHeight: 1.2,
  /** The last section's foot → sheet bottom. */
  bottom: 24,
} as const;

/** The back cover's rhythm, the reference's, read the same way. */
const BACK = {
  /** Sheet top → the first section's top. */
  top: 91,
  /** → the call's band; the band pads its two lines 23 px above and 31 below, 130 px. */
  band: 22,
  bandPadding: { top: 23, bottom: 31 },
  bandSize: 40,
  bandLineHeight: 1.2,
  /** → "Bons estudos!"'s capitals. */
  closing: 37,
  closingSize: 72,
  /** → the heart, then → the icons, then → sheet bottom. */
  heartGap: 43,
  heart: { x: 444, d: 192 },
  iconsGap: 39,
  icons: { x: 461 },
  iconsHeight: 48,
  bottom: 80,
} as const;

/**
 * How much a size's drift from `question-size` weighs against the room its lines leave: a
 * size 10 % off costs a tenth as much as lines each 10 % empty, so the fill decides and the
 * normal size only breaks near-ties.
 */
const SIZE_DRIFT_WEIGHT = 0.1;

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
        : [
            barePicture(
              background,
              { width: context.size.w, height: context.size.h },
              // Held to the slide's own shape, so the picture is the slide's size whatever
              // the file's.
              {
                fit: 'cover',
                widest: context.size.w / context.size.h,
                tallest: context.size.w / context.size.h,
              },
              { name: 'fundo' },
            ).draft,
          ]),
      at(LOGO.x, LOGO.y, drawLogo(context.brand, LOGO.height, oneInk(ink('logo')))),
      card(context, ink, top, sheet),
      ...(paper === undefined
        ? []
        : [
            // The kit's `barePicture` takes no blend mode (TYTO-910); until it does, the paper
            // is the one image this template draws with the core's node.
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
  readonly arrow: Piece;
  /** Everything on the sheet, in y from the sheet's top. */
  readonly children: readonly NodeDraft[];
  /** The texts `settle` reads for an orphan, by field name. */
  readonly texts?: ReadonlyMap<string, TextDraft>;
}

/** How a text is set once `settle` has looked at it: its letter spacing, and its runs rebroken. */
interface Tuning {
  /** In px, as `settle` hands it. */
  readonly letterSpacing: number;
  readonly runs?: readonly TextRun[];
}

type Tunings = ReadonlyMap<string, Tuning>;

type Ink = (name: ColorName) => string;

function card(context: TemplateContext, ink: Ink, top: number, sheet: Sheet): NodeDraft {
  const drawn = (name: string, piece: Piece, color: string): NodeDraft =>
    at(piece.x, piece.y, icon(piece.shape, piece.shape.box.h, color, name));
  // The shadow is the whole card's, tabs and sheet as one outline, and no kit piece casts one
  // from a group: `paddedCard` casts it from its own surface alone. Until the card is that
  // piece, this group is the one the template makes with the core's node.
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
      drawn('aba-tras', BACK_TAB, ink('back-tab')),
      drawn('seta', sheet.arrow, ink('ink')),
      drawn('aba-frente', FRONT_TAB, ink('card')),
      signature(context, ink),
      at(
        CARD.x,
        CARD.tabs,
        shape(
          { w: CARD.w, h: sheet.height },
          solid(ink('card')),
          { kind: 'rounded', radius: CARD.radius },
          { name: 'folha' },
        ),
      ),
      group({ name: 'conteudo', transform: { y: CARD.tabs }, children: sheet.children }),
    ],
  });
}

/** The brand kit's signature on the front tab, its capitals at `SIGNATURE.capTop`. */
function signature(context: TemplateContext, ink: Ink): NodeDraft {
  const line = signatureLine(
    signatureOf(context.brand),
    { width: Infinity, height: Infinity },
    { font: SANS, weight: LIGHT, color: ink('ink') },
    { size: SIGNATURE.size, lineHeight: 1.2, align: 'left' },
    { name: 'assinatura', metrics: METRICS.Roboto },
  );
  return at(SIGNATURE.x, SIGNATURE.capTop - anchorOf(line).capTop, line);
}

/* --------------------------------------------------------------------------- the stack -- */

/**
 * One section of the sheet: drawn only when the brief writes it, and stacked under the one
 * before it. `gap` is the space above it, from the bottom of what is above (a text's last
 * capitals, a band's edge) to its own top (its first capitals, its edge). A section the brief
 * leaves out takes its gap with it, so the next one stands where the reference stands it.
 */
interface Section {
  readonly gap: number;
  readonly height: number;
  readonly draw: (top: number) => readonly NodeDraft[];
  /** The section's text, for `settle` to read its lines: where it stands does not matter. */
  readonly text?: TextDraft;
}

/** The sections one under another, from `top`, and the y of the last one's bottom. */
function stack(sections: readonly Section[], top: number): { nodes: NodeDraft[]; bottom: number } {
  const nodes: NodeDraft[] = [];
  let y = top;
  for (const [index, section] of sections.entries()) {
    if (index > 0) y += section.gap;
    nodes.push(...section.draw(y));
    y += section.height;
  }
  return { nodes, bottom: y };
}

interface TextStyle {
  readonly family: Family;
  readonly size: number;
  readonly lineHeight: number;
  readonly x: number;
  readonly width: number;
  readonly align?: 'left' | 'center';
  readonly tracking?: number;
}

/**
 * A text as tall as its lines: from its first capitals to its last line's capitals' foot.
 * The line count is measured when the context can measure the face, and estimated otherwise.
 */
function textSection(
  context: TemplateContext,
  name: string,
  runs: readonly TextRun[],
  written: readonly RichText[],
  style: TextStyle,
  gap: number,
  tuning?: Tuning,
): Section {
  const set = capText(
    nonEmpty(tuning?.runs ?? runs, style.size),
    { width: style.width, height: Infinity },
    {
      size: style.size,
      lineHeight: style.lineHeight,
      letterSpacing: tuning?.letterSpacing ?? (style.tracking ?? 0) * style.size,
      align: style.align ?? 'left',
    },
    {
      name,
      metrics: METRICS[style.family],
      measure: measuredOr(context, written, style.size, style.width),
    },
  );
  const { capTop, baseline } = anchorOf(set);
  return {
    gap,
    height: baseline - capTop,
    draw: (top) => [at(style.x, top - capTop, set)],
    ...(set.draft.kind === 'text' ? { text: set.draft } : {}),
  };
}

/** The runs, or one empty run when there are none, as a text node takes them. */
function nonEmpty(runs: readonly TextRun[], size: number): [TextRun, ...TextRun[]] {
  const [head, ...tail] = runs;
  return [head ?? run('', { font: SANS, size, weight: REGULAR, color: '#000000' }), ...tail];
}

/** A text inside a band: the band's padding around the text section's own height. */
function bandSection(
  ink: Ink,
  name: string,
  inner: Section,
  padding: { readonly top: number; readonly bottom: number },
  edge: 'side' | 'top',
  gap: number,
): Section {
  const height = padding.top + inner.height + padding.bottom;
  return {
    gap,
    height,
    draw: (top) => [...band(ink, name, top, height, edge), ...inner.draw(top + padding.top)],
  };
}

/** Rich-text lines as runs, each line its own line in the text. */
function runsOfLines(
  written: readonly RichText[],
  style: Parameters<typeof runsOf>[1],
  options?: Parameters<typeof runsOf>[2],
): TextRun[] {
  return written.flatMap((line, index) => [
    ...(index === 0 ? [] : [lineBreak()]),
    ...runsOf(line, style, options),
  ]);
}

/* --------------------------------------------------------------------------- the title -- */

/**
 * The title, the brief's `::titulo` or the reference's two lines. With two lines or more the
 * first is the kicker, smaller; one line is the title alone. `::titulo` written empty draws none.
 */
function titleSections(
  context: TemplateContext,
  ink: Ink,
  written: readonly RichText[],
  align: 'left' | 'center',
): Section[] {
  if (written.length === 0) return [];
  const x = align === 'left' ? INNER.textX : CARD.x;
  const width = align === 'left' ? INNER.textW : CARD.w;
  const runStyle = (size: number) => ({
    font: SERIF,
    size,
    weight: EXTRABOLD,
    color: ink('title-color'),
  });
  const textStyle = (size: number): TextStyle => ({
    family: 'Newsreader',
    size,
    lineHeight: TITLE.lineHeight,
    x,
    width,
    align,
    tracking: TITLE_TRACKING,
  });
  const [first, ...rest] = written;
  const kicker = rest.length > 0 && first !== undefined ? [first] : [];
  const main = rest.length > 0 ? rest : [...written];
  const sections: Section[] = [];
  if (kicker.length > 0) {
    // In capitals, as the reference sets its title.
    const runs = runsOfLines(kicker.map(capitals), runStyle(TITLE.kickerSize));
    sections.push(textSection(context, 'chapeu', runs, kicker, textStyle(TITLE.kickerSize), 0));
  }
  const runs = runsOfLines(main.map(capitals), runStyle(TITLE.size));
  sections.push(
    textSection(context, 'titulo', runs, main, textStyle(TITLE.size), TITLE.kickerToTitle),
  );
  return sections;
}

/** The brief's `::titulo` lines, or the reference's two when the brief writes none. */
function titleLines(context: TemplateContext): RichText[] {
  return fieldOf(context, 'titulo') ?? DEFAULT_TITLE.map(richLine);
}

/** The title without its last line's trailing number: the back cover's `INFORMATIVO TRZ`. */
function withoutNumber(written: readonly RichText[]): RichText[] {
  const last = written[written.length - 1];
  if (last === undefined) return [];
  return [...written.slice(0, -1), richLine(plain(last).replace(/\s+\d[\d.]*$/u, ''))];
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
    at(
      INNER.bandX,
      y,
      shape(
        { w: INNER.bandW, h: height },
        solid(ink('accent-edge')),
        { kind: 'rounded', radius },
        { name },
      ),
    ),
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

/** A ruling's parts, each the lines the brief wrote under it, or absent. */
export interface Ruling {
  readonly subject: readonly RichText[] | undefined;
  readonly question: readonly RichText[] | undefined;
  readonly answer: readonly RichText[] | undefined;
  readonly source: readonly RichText[] | undefined;
}

export function rulingOf(context: TemplateContext): Ruling {
  return {
    subject: fieldOf(context, 'tema'),
    question: fieldOf(context, 'pergunta'),
    answer: fieldOf(context, 'resposta'),
    source: fieldOf(context, 'fonte'),
  };
}

function ruling(context: TemplateContext, ink: Ink, number: (name: NumberName) => number): Sheet {
  const parts = rulingOf(context);
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
  // The question fills the right of its box as far as it can (Rafael, 2026-11-12: "the right side
  // as full as possible, even with a smaller letter and fewer lines, but with a limit"). Every
  // size from `question-min` to `question-ceiling`, half a pixel apart, is laid out with its
  // pitch, and scored by the room its lines leave (`unfilledOf`) plus a little for drifting from
  // `question-size`, which only settles near-ties; the card must still fit. Measured only: with
  // nothing to measure the question keeps its size.
  const smallest = Math.min(questionSize, number('question-min'));
  const largest = Math.max(questionSize, number('question-ceiling'));
  const candidates: number[] = [];
  for (let size = smallest; size <= largest + 1e-9; size += 0.5) candidates.push(size);
  // Nearest the normal size first, so a tie keeps it.
  candidates.sort((a, b) => Math.abs(a - questionSize) - Math.abs(b - questionSize));
  let grown = questionSize;
  let bestScore = Infinity;
  for (const size of candidates) {
    const sheet = layRuling(context, ink, parts, { question: size, answer: answerSize }, new Map());
    const node = sheet.texts?.get('pergunta');
    const unfilled = node === undefined ? undefined : unfilledOf(context, node);
    if (unfilled === undefined) break;
    if (sheet.height > limit) continue;
    const drift = (size - questionSize) / questionSize;
    const score = unfilled + SIZE_DRIFT_WEIGHT * drift * drift;
    if (score < bestScore - 1e-9) {
      bestScore = score;
      grown = size;
    }
  }

  // The answer the same way, with the question's size now fixed (Rafael, 2026-11-12: "the
  // answer may have the same problem"): from `answer-min` to `answer-ceiling`.
  const answerSmallest = Math.min(answerSize, number('answer-min'));
  const answerLargest = Math.max(answerSize, number('answer-ceiling'));
  const answerCandidates: number[] = [];
  for (let size = answerSmallest; size <= answerLargest + 1e-9; size += 0.5) {
    answerCandidates.push(size);
  }
  answerCandidates.sort((a, b) => Math.abs(a - answerSize) - Math.abs(b - answerSize));
  let answerGrown = answerSize;
  let answerBest = Infinity;
  for (const size of answerCandidates) {
    const sheet = layRuling(context, ink, parts, { question: grown, answer: size }, new Map());
    const node = sheet.texts?.get('resposta');
    const unfilled = node === undefined ? undefined : unfilledOf(context, node);
    if (unfilled === undefined) break;
    if (sheet.height > limit) continue;
    const drift = (size - answerSize) / answerSize;
    const score = unfilled + SIZE_DRIFT_WEIGHT * drift * drift;
    if (score < answerBest - 1e-9) {
      answerBest = score;
      answerGrown = size;
    }
  }

  let sizes = { question: grown, answer: answerGrown };
  let laid = layRuling(context, ink, parts, sizes, new Map());
  for (
    let step = 1;
    laid.height > limit && step <= floorStep + Math.max(0, grown - questionSize);
    step += 1
  ) {
    const question = Math.max(number('question-floor'), grown - step);
    const answer = Math.max(number('answer-floor'), answerGrown * Math.min(1, question / grown));
    sizes = { question, answer };
    laid = layRuling(context, ink, parts, sizes, new Map());
  }

  // No text ends on a word of its own (Tyto ADR 0167), as voce-conhece's paragraphs: each by a
  // word moved down or its letter spacing, at the size it was fitted at, as long as the card
  // still fits; a word nothing within the limits clears is reported.
  const fitsAtSize = laid.height <= limit;
  const tracking = number('orphan-tracking');
  let tunings: Tunings = new Map();
  for (const [name, size] of [
    ['pergunta', sizes.question],
    ['resposta', sizes.answer],
    ['fonte', RULING.sourceSize],
  ] as const) {
    if (laid.texts?.get(name) === undefined) continue;
    const settled = settle({
      size,
      measure: context.measure,
      limits: { shrink: 0, tracking },
      layout: (setting) => {
        const tried = new Map(tunings);
        tried.set(name, {
          letterSpacing: setting.letterSpacing,
          ...(setting.runs === undefined ? {} : { runs: setting.runs }),
        });
        const sheet = layRuling(context, ink, parts, sizes, tried);
        const text = sheet.texts?.get(name) ?? laid.texts!.get(name)!;
        return { text, fits: !fitsAtSize || sheet.height <= limit, laid: tried as Tunings };
      },
    });
    tunings = settled.laid;
    reportOrphan(context.report, settled.orphan);
  }
  return tunings.size === 0 ? laid : layRuling(context, ink, parts, sizes, tunings);
}

function present(written: readonly RichText[] | undefined): written is readonly RichText[] {
  return written !== undefined && written.length > 0;
}

function layRuling(
  context: TemplateContext,
  ink: Ink,
  parts: Ruling,
  sizes: { readonly question: number; readonly answer: number },
  tunings: Tunings,
): Sheet {
  const questionSize = sizes.question;
  const answerSize = sizes.answer;
  const texts = new Map<string, TextDraft>();
  const sections: Section[] = [...titleSections(context, ink, titleLines(context), 'left')];

  if (present(parts.subject)) {
    const runs = runsOfLines(parts.subject, {
      font: SANS,
      size: RULING.bandSize,
      weight: SEMIBOLD,
      color: ink('on-accent'),
    });
    const inner = textSection(
      context,
      'tema-texto',
      runs,
      parts.subject,
      {
        family: 'Roboto',
        size: RULING.bandSize,
        lineHeight: RULING.bandLineHeight,
        x: INNER.textX,
        width: INNER.textW,
      },
      0,
    );
    sections.push(bandSection(ink, 'tema', inner, RULING.bandPadding, 'side', RULING.band));
  }

  if (present(parts.question)) {
    const runs = runsOfLines(
      parts.question,
      { font: QUESTION_FACE, size: questionSize, weight: REGULAR, color: ink('ink') },
      { bold: MEDIUM },
    ).map((item) => italic(item, ink('highlight-color')));
    const section = textSection(
      context,
      'pergunta',
      runs,
      parts.question,
      {
        family: 'CircularXX',
        size: questionSize,
        lineHeight: RULING.questionLineHeight,
        x: INNER.textX,
        width: INNER.questionW,
      },
      RULING.question,
      tunings.get('pergunta'),
    );
    if (section.text !== undefined) texts.set('pergunta', section.text);
    sections.push(section);
  }

  if (present(parts.answer)) {
    const runs = runsOfLines(
      parts.answer,
      { font: SANS, size: answerSize, weight: LIGHT, color: ink('on-accent') },
      { bold: MEDIUM },
    );
    const inner = textSection(
      context,
      'resposta',
      runs,
      parts.answer,
      {
        family: 'Roboto',
        size: answerSize,
        lineHeight: RULING.answerLineHeight,
        x: INNER.textX,
        width: INNER.textW,
      },
      0,
      tunings.get('resposta'),
    );
    if (inner.text !== undefined) texts.set('resposta', inner.text);
    sections.push(
      bandSection(ink, 'bloco-resposta', inner, RULING.answerPadding, 'top', RULING.answer),
    );
  }

  if (present(parts.source)) {
    const runs = runsOfLines(parts.source, {
      font: SANS,
      size: RULING.sourceSize,
      weight: LIGHT,
      color: ink('ink'),
    });
    const section = textSection(
      context,
      'fonte',
      runs,
      parts.source,
      {
        family: 'Roboto',
        size: RULING.sourceSize,
        lineHeight: RULING.sourceLineHeight,
        x: INNER.textX,
        width: INNER.textW,
      },
      RULING.source,
      tunings.get('fonte'),
    );
    if (section.text !== undefined) texts.set('fonte', section.text);
    sections.push(section);
  }

  const { nodes, bottom } = stack(sections, RULING.top);
  return { height: Math.round(bottom + RULING.bottom), arrow: ARROW_ON, children: nodes, texts };
}

/** The question is italic throughout; its highlights take the highlight colour. */
function italic(item: TextRun, highlight: string): TextRun {
  if (item.kind !== 'text') return item;
  const bold = item.weight > REGULAR;
  return { ...item, style: 'italic', ...(bold ? { color: solid(highlight) } : {}) };
}

/* ---------------------------------------------------------------------- the back cover -- */

function backCover(context: TemplateContext, ink: Ink): Sheet {
  const call = fieldOf(context, 'chamada') ?? [richLine(DEFAULT_CALL)];
  const closing = fieldOf(context, 'fecho') ?? [richLine(DEFAULT_CLOSING)];
  const sections: Section[] = [
    ...titleSections(context, ink, withoutNumber(titleLines(context)), 'center'),
  ];

  if (call.length > 0) {
    const runs = runsOfLines(call, {
      font: SANS,
      size: BACK.bandSize,
      weight: SEMIBOLD,
      color: ink('on-accent'),
    });
    const inner = textSection(
      context,
      'chamada-texto',
      runs,
      call,
      {
        family: 'Roboto',
        size: BACK.bandSize,
        lineHeight: BACK.bandLineHeight,
        x: INNER.bandX + INNER.edge,
        width: INNER.bandW - INNER.edge,
        align: 'center',
      },
      0,
    );
    sections.push(bandSection(ink, 'chamada', inner, BACK.bandPadding, 'side', BACK.band));
  }

  if (closing.length > 0) {
    const runs = runsOfLines(closing, {
      font: SERIF,
      size: BACK.closingSize,
      weight: EXTRABOLD,
      color: ink('title-color'),
    });
    sections.push(
      textSection(
        context,
        'fecho',
        runs,
        closing,
        {
          family: 'Newsreader',
          size: BACK.closingSize,
          lineHeight: TITLE.lineHeight,
          x: CARD.x,
          width: CARD.w,
          align: 'center',
          tracking: TITLE_TRACKING,
        },
        BACK.closing,
      ),
    );
  }

  sections.push({ gap: BACK.heartGap, height: BACK.heart.d, draw: (top) => heart(ink, top) });
  sections.push({ gap: BACK.iconsGap, height: BACK.iconsHeight, draw: (top) => icons(ink, top) });

  const { nodes, bottom } = stack(sections, BACK.top);
  return { height: Math.round(bottom + BACK.bottom), arrow: ARROW_DOWN, children: nodes };
}

function heart(ink: Ink, y: number): readonly NodeDraft[] {
  const { x, d } = BACK.heart;
  return [
    at(
      x,
      y,
      iconInDisc(
        HEART,
        d,
        { disc: ink('accent'), icon: ink('card') },
        { iconRatio: 1 },
        { name: 'coracao-disco', discName: 'coracao-fundo', iconName: 'coracao' },
      ),
    ),
  ];
}

/** Comment, share and save, outlined in the ink. */
function icons(ink: Ink, y: number): readonly NodeDraft[] {
  const { x } = BACK.icons;
  const outlined = { kind: 'stroke', width: 4 } as const;
  // Three buttons of the kit's `buttonRow`, each an icon alone (TYTO-884). The reference sets
  // them 66 and 130 px apart from the first and the two smaller ones 4 px down; a block as wide
  // as the step to the next icon, less the gap, and as tall as the row, holds each icon at its
  // own offset, so the spacing and the nudge stay the reference's.
  const ROW = 48;
  const GAP = 18;
  const glyph = (
    name: string,
    d: string,
    size: number | { readonly w: number; readonly h: number },
    width: number,
    down: number,
  ) => {
    const box = typeof size === 'number' ? { w: size, h: size } : size;
    const outline: Icon = { box, d, paint: outlined };
    return {
      name: `${name}-botao`,
      style: { height: ROW, radius: 0, padding: { left: 0, right: 0 }, gap: 0 },
      leading: block(width, ROW, at(0, down, icon(outline, box.h, ink('ink'), name))),
    };
  };
  const row = buttonRow(
    [
      glyph(
        'comentar',
        'M24 4C12 4 3 12 3 22C3 32 12 40 24 40C27 40 30 39 33 38L44 44L41 34C44 31 45 27 45 22' +
          'C45 12 36 4 24 4Z',
        48,
        66 - GAP,
        0,
      ),
      glyph('compartilhar', 'M38 3L3 16L18 22L24 38L38 3ZM18 22L38 3', 42, 130 - 66 - GAP, 4),
      glyph('salvar', 'M3 3H27V37L15 27L3 37Z', { w: 30, h: 40 }, 30, 4),
    ],
    { gap: GAP, name: 'icones' },
  );
  return [at(x, y, row)];
}

/* -------------------------------------------------------------------------- the shared -- */

/**
 * How much of its box a text leaves empty on the right: the mean, over every line but a
 * paragraph's last, of the line's empty share of the box, squared, so one very short line costs
 * more than two slightly short ones. A paragraph of one line counts that line at a quarter: it
 * is its own last line, and a short question should still prefer to fill. `undefined` when
 * nothing can be measured.
 */
function unfilledOf(context: TemplateContext, node: TextDraft): number | undefined {
  const box = node.box?.w;
  const measured = context.measure(node);
  if (box === undefined || measured === undefined) return undefined;
  const paragraphs: TextRun[][][] = [[[]]];
  for (const run of measured.runs) {
    const lines = paragraphs.at(-1)!;
    if (run.kind === 'break') lines.push([]);
    else lines.at(-1)!.push(run);
  }
  // A break the brief wrote ends a paragraph; the layout's own breaks only end lines. The
  // measured runs do not tell them apart, so every line but the text's last is scored.
  const lines = paragraphs[0]!.filter((line) => line.length > 0);
  const widthOf = (line: readonly TextRun[]): number => {
    const [head, ...tail] = line;
    return context.measure({ ...node, box: {}, runs: [head!, ...tail] } as TextDraft)?.width ?? box;
  };
  const shares = lines.map((line) => Math.max(0, box - widthOf(line)) / box);
  if (shares.length === 1) return (shares[0]! * shares[0]!) / 4;
  const body = shares.slice(0, -1);
  return body.reduce((sum, share) => sum + share * share, 0) / body.length;
}

/**
 * A field's lines, blank ones dropped: `undefined` when the brief does not write it, and an
 * empty list when it writes it with no lines, which hides a section that has a default.
 */
function fieldOf(context: TemplateContext, name: string): RichText[] | undefined {
  const value = context.slots[name]?.value;
  if (value?.kind !== 'rich-text') return undefined;
  return lines(value.text)
    .filter((line) => plain(line).trim() !== '')
    .map((line) => keepTogether(line, KEEP_TOGETHER));
}

/** Plain words as one line of rich text. */
function richLine(words: string): RichText {
  return [{ kind: 'text', value: words, range: { start: 0, end: words.length } }];
}

/**
 * `context.measure`, with its lines never fewer than one; when nothing can measure (a test, CI
 * without the face), the estimate's lines, so the estimate is only worked out without a face.
 */
function measuredOr(
  context: TemplateContext,
  written: readonly RichText[],
  size: number,
  width: number,
): TemplateContext['measure'] {
  return (node) => {
    const measured = context.measure(node);
    if (measured !== undefined) return { ...measured, lines: Math.max(1, measured.lines) };
    const lines = estimated(written, size, width);
    return { runs: node.runs, lines, width, height: 0, scale: 1, overflow: 0 };
  };
}

/**
 * How many lines a text wraps to with nothing to measure it by: the characters a line of
 * `width` holds, each line written counted apart. The kit's `capText` counts only the lines the
 * runs break into themselves when nothing measures; until it takes an estimate (TYTO-905), this
 * one stays here.
 */
function estimated(written: readonly RichText[], size: number, width: number): number {
  const perLine = Math.max(1, Math.floor(width / (size * ESTIMATED_ADVANCE)));
  const count = written.reduce<number>(
    (sum, line) => sum + Math.max(1, Math.ceil([...plain(line)].length / perLine)),
    0,
  );
  return Math.max(1, count);
}
