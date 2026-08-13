# TODO

Set up as next.js project and deploy to vercel. Set to private (preview).

# The Bridge Up Project — Website Mockup

Status: design and content mockup, not a live production build. Handed off for reference in building the real site.

## What this is

Four static HTML pages plus a logo, showing the intended structure, copy, and visual design for bridgeupproject.org. These are self-contained mockups (no build tools, no framework, inline CSS in each file) meant to communicate design intent, not to be deployed as-is.

## Files

![](example.com/img.jpg)

- `index.html` (served at `/`) — landing page: hero, national stats, mission statement, program teaser
- `programs.html` (served at `/programs`) — full 8-session AI Pathways curriculum
- `about.html` (served at `/about`) — founder bio
- `connect.html` (served at `/connect`) — Partner With Us / Volunteer as a Mentor / Contact Us
- `bridge_up_project_logo.svg` — standalone logo file (icon + wordmark). This is the source of truth for the brand mark. The website's nav icon is coded directly into each page and doesn't depend on this file, but this file is what you need for anything outside the site: Instagram/LinkedIn profile photos, a favicon, letterhead, or any printed material.

Run `npm run serve` and open http://localhost:3000 to start. The pages link to each other by extensionless, root-relative path (e.g. `href="/programs"`), matching production: `cleanUrls` and `trailingSlash: false` in `vercel.json` map `/programs` to `programs.html` and redirect `/programs/` and `/programs.html` to it. `server.js` mirrors that locally, so **opening the HTML files directly from Finder will break the links** — use the server.

## Brand palette

| Name | Hex | Used for |
|---|---|---|
| Cobalt | `#1161A8` | Headings, buttons, primary text (`--ink`) |
| Deep navy | `#1D3F73` | Hero and footer backgrounds (`--paper-dark`) |
| Accent blue | `#2B5291` | Secondary text, mid-tone accents (`--steel`) |
| Gold | `#E9BE3F` | Accent color, CTA buttons, eyebrow labels (`--gold`) |
| Background | `#FAF8F4` | Page background (`--paper`) |

All four HTML files define these as CSS custom properties in `:root`, change them once per file to re-theme.

## Type

- Headings: **Fraunces** (serif, via Google Fonts)
- Body/UI: **Inter** (sans-serif, via Google Fonts)

Both are loaded via `@import` in each file's `<style>` block.

## Navigation pattern

Each page has a nav bar with:
- Logo (links to `/`)
- A direct "Programs" link
- A dropdown menu (native `<details>`/`<summary>`, no JS) containing "About Us" and "Connect With Us"

This is a deliberate structure: Programs is on-page/primary content, About and Connect are treated as secondary pages reached through the menu.

## Responsive behavior

All four pages include a viewport meta tag and a mobile breakpoint at 760px. Below that width: multi-column grids (stats, session cards, Connect path cards) collapse to a single column, the nav bar's link spacing tightens, and section padding is reduced so pages don't feel overly tall on a phone screen. This has been tested on an actual phone browser, not just assumed from the CSS.

## Known open items (not fixed by this mockup)

- Email addresses on the Connect page (`info@`, `volunteer@`, `tyson@bridgeupproject.org`) are not yet live inboxes — need to be set up before launch.
- No blog/CMS — intentionally left out for now, will need confidentiality guidance from JCCA before any real session content is posted.
- No donate button anywhere on the site — intentional, org is not yet a registered 501(c)(3).
- Stats on the homepage are national data (Annie E. Casey Foundation), explicitly disclaimed as not specific to any partner program.
- The bridge icon inside the dark box on the homepage (in the Programs section) is intentionally colored differently from the main logo, gold-dominant with a cream accent dot, built specifically to read clearly against that dark background. It is not a bug and not out of sync with the brand. `bridge_up_project_logo.svg` remains the source of truth for the logo everywhere else.

## Contact

Tyson Youm, Founder — tyson@bridgeupproject.org (pending setup)
