# The Bridge Up Project

Marketing site for [bridgeupproject.org](https://bridgeupproject.org) — a youth-led
nonprofit teaching foster youth independence skills through AI literacy.

Four hand-written HTML pages, one stylesheet, self-hosted fonts and animation
libraries. No build step, no framework, no bundler. Deployed to Vercel as static
files.

## Running it

```
npm install
npm run serve
```

Then open <http://localhost:3000>.

**Use the server, not Finder.** Pages link to each other by extensionless,
root-relative path (`href="/programs"`), matching production: `cleanUrls` and
`trailingSlash: false` in `vercel.json` map `/programs` to `programs.html`.
`server.js` mirrors that locally. Opening the HTML files directly will break
every internal link.

## Layout

| Path | File | What it is |
|---|---|---|
| `/` | `index.html` | Hero, national statistics, mission, program teaser |
| `/programs` | `programs.html` | The full eight-session AI Pathways curriculum |
| `/about` | `about.html` | Founder statement, routes onward |
| `/connect` | `connect.html` | Partner / mentor / general contact |

| File | Role |
|---|---|
| `site.css` | The entire stylesheet. Tokens are in one `:root` at the top |
| `motion.js` | GSAP motion engine. Owns the page when it initialises |
| `site.js` | Legacy fallback engine, plus nav and copy-to-clipboard |
| `vendor/` | Self-hosted animation libraries. No CDN at runtime |
| `fonts/` | Self-hosted Fraunces and Inter, SIL OFL 1.1 |
| `bridge_up_project_logo.svg` | Standalone brand mark for anything off-site |

## Brand

| Token | Hex | Used for |
|---|---|---|
| `--ink` | `#1161A8` | Cobalt. Headings, primary text |
| `--paper-dark` | `#1D3F73` | Deep navy. Hero and footer |
| `--steel` | `#2B5291` | Accent blue. Figures, mid-tones |
| `--gold` | `#E9BE3F` | Accent. CTAs, eyebrows, keystone |
| `--paper` | `#FAF8F4` | Page background |
| `--line` | `#DCD5C8` | Hairline |

Headings are **Fraunces**, body and UI are **Inter**, both self-hosted variable
woff2 (latin and latin-ext). Every other token — type scale, leading, spacing,
radii, shadows, z-index — lives in the same `:root` block at the top of
`site.css`. Change them once to re-theme.

The bridge mark appears twice: inlined in the nav on every page, and as the
large illustration on the homepage. Both use the same colour logic — mismatched
pillars, gold keystone — with the illustration inverted for its navy plate. If
you change one, change both.

## How the motion works

Three layers, in order of preference, each a fallback for the one above:

1. **`motion.js`** — GSAP, ScrollTrigger, SplitText, DrawSVG, ScrambleText, plus
   Lenis, anime.js and Motion for the CTA choreography. Claims the page by setting
   `window.__BU_MOTION_OK__`, but only *after* its init chain resolves.
2. **`site.js`** — a dependency-free engine using IntersectionObserver and one rAF
   loop. Runs when a vendor script fails to load.
3. **Plain HTML** — an inline `<head>` script strips the `js` and `gsap` classes
   after 4s if neither engine reported in.

The hidden-until-revealed states are gated behind `.js` on `<html>`, so with
scripting off the page is fully readable. **This contract matters**: if you add a
CSS rule that hides something for animation purposes, gate it behind `.js` and
make sure something un-hides it, or add it to the reduced-motion block.

### Reduced motion

**`prefers-reduced-motion: reduce` is not honoured.** Every visitor gets the full
animated site regardless of their system setting. This is deliberate and
requested, and the cost is worth stating plainly: Reduce Motion is switched on
for vestibular disorders, migraine and seizure triggers, where motion produces
physical symptoms rather than mild annoyance.

To restore it, set `honoursReduce` back to `reduceQuery.matches` in `motion.js`
**and** put back the `@media (prefers-reduced-motion: reduce)` block in
`site.css` — TIER 7 there carries the full block, ready to paste.

**The two layers must always agree.** CSS that suppresses motion while the engine
is still driving it leaves elements frozen part-way through a tween, which is
worse than either choice alone. If you restore it, restore both in one commit.

## Checks

```
npm run check
```

Runs both guards, and the pre-commit hook runs them too (`--no-verify` to bypass):

- **`check:encoding`** — byte-level scan for invisible character corruption. This
  exists because `site.css` once shipped a U+0082 control character where a bullet
  belonged, and it was invisible in both an editor and a diff.
- **`check:chrome`** — the nav and footer must be identical across all four pages.
  This exists because they weren't: every footer had quietly dropped the link to
  its own page, and none of them linked home. `aria-current="page"` is the one
  attribute allowed to differ.

## Known open items

- The three contact addresses (`info@`, `volunteer@`, `tyson@bridgeupproject.org`)
  need live inboxes. Every call to action on the site routes to one of them.
- There is no form anywhere and no backend. Contact is `mailto:` by design, with
  the address printed and a copy button beside it for visitors whose device has no
  mail client.
