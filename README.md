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

::informativo
  TRZ 412

::lamina
  Direito Previdenciário
  The question, in italic, with a **highlight**?
  **No.** The answer, one line per paragraph.
  The source: the case, the judge, the date.

::lamina {contracapa}
```

- `::informativo` is the court and the bulletin's number. The title reads `INFORMATIVO TRZ 412`;
  the back cover drops the number.
- A ruling's lines are the subject (the band), the question, then the answer, one line per
  paragraph; with four lines or more the last is the source.
- `::lamina {contracapa}` is the back cover. Empty, it says the reference's words; a first line
  replaces the call to like the post, a second replaces "Bons estudos!".
- `fundo: ./arte.png` in the frontmatter draws that picture under the card instead of the
  configured background.

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
colours, the card's maximum height, and the question's and answer's sizes and floors. Changing
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
- `tests/plugin.test.ts`: the built `dist/index.js`, loaded through `@tyto/plugin-api/testing`
  (Tyto ADR 0150), drawing `informativo` across the isolation protocol.

The `contract` workflow runs daily against the newest published contract, past the ranges
`package.json` asks for, and opens a pull request when this template passes on it.
