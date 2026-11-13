# tyto-template-informativo

`informativo`, a [Tyto](https://github.com/rafaelsilvalor/tyto) code template in its own
repository: a court bulletin carousel at 1080×1350, one ruling per slide on a paper card that
grows with its words, and a back cover.

Its defaults are the house's ocre: its logo over the background and its signature on the card's
front tab. **This repository holds the composition only.** The logo and the signature are not
here: Tyto hands them to the template from the brand kit installed on the machine, and without one
it draws placeholders (Tyto ADR 0063, ADR 0065). The example brief is invented copy.

The background and the paper in `templates/informativo/assets/` were generated for this
repository (a grey gradient and a noise grain); the reference art's are stock pictures and stay
out of it. A configuration points `background` at the real one (below).

## Install into Tyto

```
tyto plugin install git+https://github.com/rafaelsilvalor/tyto-template-informativo.git
```

Tyto clones the default branch and never builds it, so `dist/index.js` is committed on `main`
and every release is a tag of it. To take a change pushed here, run the same command again:
installing a name that is already installed replaces it.

A pack brings templates and no formats. Copy `templates/formats.yaml` into the project that
renders `informativo`, or merge its `grid` line into the project's own. Then a brief reads:

```
---
template: informativo
formats: [grid]
---

::titulo
  Destaques do
  Informativo TRZ 412

::lamina
::tema
  Direito Previdenciário
::pergunta
  The question, in italic, with a **highlight**?
::resposta
  **No.** The answer, one line per paragraph.
::fonte
  The source: the case, the judge, the date.

::lamina {contracapa}
```

**Every section is a field of its own, and every field is optional.** A slide's fields are
written under its `::lamina`, each with any number of lines; a field not written is not drawn,
and the sections under it close up, each keeping the gap the reference sets above it.

- `::titulo`, once for the whole carousel. With two lines or more the first is the kicker,
  smaller; one line is the title alone; it is set in capitals. Not written, it is
  `Destaques do` / `Informativo`; written with no lines, no title is drawn. The back cover drops
  a trailing number from its last line (`INFORMATIVO TRZ`).
- A ruling: `::tema` (the band), `::pergunta` (italic, `**x**` in the highlight colour),
  `::resposta` (the block, one line per paragraph, `**x**` bold) and `::fonte`.
- `::lamina {contracapa}` is the back cover. `::chamada` and `::fecho` replace the call to like
  the post and "Bons estudos!"; not written, they say the reference's words; written with no
  lines, they are not drawn. The heart and the icons are always drawn.
- `fundo: ./arte.png` in the frontmatter draws that picture under the card instead of the
  configured background.

**The lines** break with the house's tools, not new ones. Every field goes through the kit's
`keepTogether` with one rule of this template's: a one-letter word or `de` stays with the word
after it, so no line ends on `a`, `e`, `o`, `é`, `à` or `de` (the banner keeps `de` and `e` the
same way). The question, the answer and the source go through the kit's `settle` (Tyto ADR
0167), as `voce-conhece`'s paragraphs do: none ends on a word of its own, cleared by a word
moved down or by letter spacing within `orphan-tracking`, never by a smaller size; a word
nothing clears is reported as `W_TEMPLATE_ORPHAN`. The question also grows to fill its box (up to x =
913 px): to the largest size up to `question-ceiling` (48 px against its 40) at which it
takes no more lines, its lines kept the normal size's 60 px apart, so the card never grows
for it.

**The card** is as tall as what it holds, tabs included, and centred on the slide. It never grows
past `card-max-height` (1080 px, 135 px from each edge); past that the question and the answer
shrink together down to `question-floor` and `answer-floor`, and below those the overflow is
reported as `W_TEMPLATE_OVERFLOW`.

## Fonts

| Family     | Where it comes from                                                            |
| ---------- | ------------------------------------------------------------------------------ |
| Newsreader | Google Fonts, fetched once when the machine lacks it (Tyto ADR 0120)           |
| Roboto     | Google Fonts, the same way                                                     |
| CircularXX | The machine; licensed, so elsewhere Tyto draws a substitute and says which one |

With Google Fonts turned off (`--no-google-fonts`, `TYTO_GOOGLE_FONTS=off`) a missing Newsreader
or Roboto is drawn in a bundled substitute, with `W_FONT_SUBSTITUTED`.

## What it may reach

| Permission        | Why                                                                 |
| ----------------- | ------------------------------------------------------------------- |
| `font:CircularXX` | The question is measured in CircularXX, a licensed face (ADR 0048). |
| `font:Newsreader` | The title, when the machine has Newsreader installed.               |
| `font:Roboto`     | The bands, the answer and the source, when the machine has Roboto.  |

**The install asks for them once.** Faces Tyto ships cross to a plugin freely; a face installed
on the machine crosses only under its permission. Without it the render warns
`W_PLUGIN_FONT_WITHHELD` and the card is sized from an estimate.

## What a configuration may change

`templates/informativo/manifest.yaml` declares its `values` (Tyto ADR 0153): the `background`
and the `paper-texture` pictures, the card's, tabs', bands', title's, ink's and highlight's
colours, the card's maximum height, the question's and answer's sizes and floors, the
question's `question-ceiling`, and `orphan-tracking`. Changing
one never changes which pieces appear or their order (Tyto ADR 0151). The real background is a
configuration's `background: { value: <path> }`.

## Development

`pnpm check` runs Prettier, the type checker, ESLint and the tests; `pnpm build` writes
`dist/index.js`, one ES module with every `@tyto` import inlined, which is committed and which
CI rebuilds and compares.

The template depends on Tyto's published contract, held by GitHub Packages under the owner's
scope (Tyto ADR 0149) and aliased in `package.json`: `@tyto/house-style` draws the logo and the
signature, `@tyto/template-kit` and `@tyto/core` are what the slides are drawn with, and
`@tyto/plugin-api` is what loads it. The committed `.npmrc` names the scope only. GitHub asks for
a token with `read:packages` even for public packages, and it goes in your user-level
`~/.npmrc`:

```sh
gh auth refresh -s read:packages
echo '//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}' >> ~/.npmrc
NODE_AUTH_TOKEN=$(gh auth token) pnpm install
```

The tests, all without Tyto:

- `src/template.test.ts`: the composition's rules on the scene — the card centred, growing with
  its words and never past its maximum, the question and the answer shrinking together, the
  overflow reported at the floors, the background first and the paper last in multiply, the
  back cover's defaults and replacements.
- `tests/examples.test.ts`: the example brief compiled as Tyto compiles it, through
  `@tyto/template-kit/testing` (Tyto ADR 0152), against the HTML in `tests/__snapshots__/`.
- `tests/values.test.ts`: each declared default pinned to the one the code falls back to, and a
  colour set in a test found in the HTML.
- `tests/lines.test.ts`: where the question breaks, against a face whose every character is
  half an em wide (CI has no CircularXX): no line ends on a short word, and the last line holds
  two words or more. Each test fails when its rule is taken out.
- `tests/faces.test.ts`: the faces the manifest declares are the faces the example sets, style
  included. A face left out is measured as nothing in the plugin's process, and the card is
  laid out from an estimate: the question's upright faces opened a 104 px gap under a
  three-line question where a two-line one had 44.
- `tests/plugin.test.ts`: the built `dist/index.js`, loaded through `@tyto/plugin-api/testing`
  (Tyto ADR 0150), drawing `informativo` across the isolation protocol.

The `contract` workflow runs daily against the newest published contract, past the ranges
`package.json` asks for, and opens a pull request when this template passes on it.
