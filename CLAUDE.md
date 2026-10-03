# CLAUDE.md

Guidance for Claude Code when working in this repository. See `README.md` for the full project overview.

## Project

One-page static website for **Jumper Jim**, a mobile 12V jump-start service in Tracy, California.
Plain HTML, CSS and one JavaScript file: no build step, no framework, no dependencies.

- `index.html` – the whole homepage; `404.html` – not-found page
- `css/styles.css` – all styles (brand colors and spacing are CSS variables at the top)
- `js/main.js` – mobile menu, sticky call bar, launch countdown, request form
- `images/`, favicons and share image are generated from `assets/` by `scripts/optimize-images.py`
  (`pip install pillow`, then `python scripts/optimize-images.py`). Never edit or delete `assets/`.

## Preview

```bash
python -m http.server 8321
```

Open http://localhost:8321 (serve over HTTP, not `file://`). Add `?preview=live` or
`?preview=prelaunch` to see either launch state. The launch moment is `data-launch` on `<html>`.

## Publishing

- GitHub repo: `e8013585/jumper-jim-website`, branch `main`. GitHub Pages publishes every push to `main`.
- After finishing an edit, commit and push to `origin main` so the live site updates, then confirm the
  Pages build finished.
- Never delete the `CNAME` file (it holds the custom domain `www.jumperjim.com`).
- `.gitignore` excludes `Task.txt` and `.claude/`; keep it that way, since the repo is public.

## Conventions

- **Domain:** `www.jumperjim.com` is the only canonical domain (canonical link, Open Graph, structured
  data, `robots.txt`, `sitemap.xml`). `calljumperjim.com` is only a 301 redirect and must never appear
  in the site's code.
- **Paths:** keep asset links relative (no leading `/`) so the site also works from a subfolder.
- **Opening date:** written as "November 1st, 2026" in full text (short labels use "Nov 1st").
- **Prices:** shown as whole dollars with no cents. A 20% discount is running: regular prices
  ($59–$109) are shown crossed out next to discounted prices ($47–$87, rounded down). If prices change
  or the discount ends, update the Pricing table, every "from $47" / "20% off" mention, the hero price
  star and its "20% off" sticker, and `minPrice` in the JSON-LD structured data.
- **Pre-launch content:** elements marked `data-when="prelaunch"` / `data-when="live"` are toggled by
  `js/main.js`; update both variants when changing shared copy.
- **Line endings:** `css/styles.css` and `js/main.js` are stored with CRLF; `*.vcf` must keep CRLF.
  Avoid tools that silently rewrite line endings.
