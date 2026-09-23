# Jumper Jim website

The one-page website for **Jumper Jim**, a mobile 12V jump-start service based in Tracy, California.
Live domain: https://www.jumperjim.com/

It's a plain static site: HTML, CSS and a small JavaScript file. There's no build step, no framework and
no dependencies, so any static host can serve it (Netlify, Cloudflare Pages, GitHub Pages, Vercel,
or ordinary shared hosting).

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The homepage: hero, how it works, vehicles, services, service area, why us, request form, footer |
| `404.html` | "Page not found" page (most static hosts pick this up automatically) |
| `css/styles.css` | All styles. Brand colors and spacing are CSS variables at the top of the file |
| `js/main.js` | Mobile menu, sticky call bar behavior, and the Request a Jump Start form |
| `images/` | Web-optimized logo and mascot images (WebP plus PNG fallbacks) and the social share image |
| `fonts/` | Self-hosted Archivo and Permanent Marker fonts (SIL Open Font License) |
| `assets/` | The **original** brand artwork. Keep these; the optimized images are generated from them |
| `scripts/optimize-images.py` | Regenerates `images/`, the favicons and the share image from `assets/` |
| `favicon.ico`, `favicon-32x32.png`, `apple-touch-icon.png`, `icon-*.png`, `site.webmanifest` | Browser and home-screen icons |
| `robots.txt`, `sitemap.xml` | Search engine files |

`Task.txt` and `.claude/` are project notes and local tooling. You don't need to upload them.

## Preview locally

```bash
python -m http.server 8321
```

Then open http://localhost:8321. Serve it over HTTP rather than opening the file directly, so the icons and
the "Use my current location" button work.

## Connecting the Request a Jump Start form

The form works today without a backend. When a customer submits it, the site checks the fields, then
hands the finished request to their **text messaging or email app**, addressed to Jumper Jim
((209) 221-9788 / communications@jumperjim.com). The customer taps send in that app. The page tells them
clearly that the request isn't sent until they do.

To have submissions delivered straight to you instead, set the form's `data-endpoint` attribute in
`index.html` to any URL that accepts a POST:

```html
<form class="request-form" id="request-form" ... data-endpoint="https://formspree.io/f/your-form-id">
```

The form posts as `multipart/form-data` with these fields:

| Field | Example |
| --- | --- |
| `name` | Alex Rivera |
| `phone` | (209) 555-0142 |
| `location` | 123 Main St, Tracy (may include a GPS map link if the customer used "Use my current location") |
| `vehicle_year` | 2016 (optional) |
| `vehicle_make` | Toyota |
| `vehicle_model` | Tacoma |
| `fuel_type` | Gas, Diesel or Hybrid |
| `message` | Optional note |
| `summary` | All of the above as one ready-to-read text block |

Any 2xx response shows the "Request sent!" confirmation. Anything else (or no connection) falls back to
the text/email hand-off, so a customer is never left with nothing. Good options for the endpoint include
Formspree, Basin, Netlify Forms, or a small serverless function that forwards to email or SMS (for example
through Twilio).

A hidden "company" field catches basic spam bots. Submissions that fill it are silently dropped.

## Updating images

Edit or replace the originals in `assets/`, then run:

```bash
pip install pillow
python scripts/optimize-images.py
```

## Things to confirm before launch

- **Service area.** The site only says "Based in Tracy" and asks customers for their location, because
  no service radius was provided. Add confirmed cities or a radius in the Service Area section when ready.
- **Hours / availability.** The site deliberately makes no claims about hours or response times.
  Add real hours if you want to publish them.
- **Privacy note.** The form collects name, phone and location. Consider adding a short privacy line or
  page that describes how you use that information.
- **Search listing.** Claim the Google Business Profile for Jumper Jim so the business appears in local
  "jump start near me" results.
