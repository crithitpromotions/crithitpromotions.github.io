# crithitpromotions.github.io

Static site for Crit Hit Promotions, served by GitHub Pages from the `main` branch root. Plain HTML, CSS and JS, no build step.

- `index.html` is the landing page.
- `assets/` holds the shared styles, the dashboard renderer and the logo.
- Each project has a folder with one `index.html`: its dashboard. Folder names end in a random suffix so the link is hard to guess, and the pages ask search engines not to index them. Do not link them from the landing page.

| Project | Folder |
|---|---|
| Halfling Culinary Traditions | `halflingct-e12030c2/` |
| Elvish Culinary Traditions | `elvishct-420e3e4d/` |

## Daily update

The dashboard page never changes shape. All numbers live in one JSON block near the bottom of each project's `index.html`, between `<!-- DATA:START -->` and `<!-- DATA:END -->`. The update replaces that JSON and nothing else; `assets/dashboard.js` works out every total, rate and chart from it.

```json
{
  "project": "Halfling Culinary Traditions",
  "status": "Running",                      // Running, Paused, Ended or Not started
  "updated": "9 Oct 2026, 08:50 Athens time",
  "currency": "EUR",
  "meta": { "account": "Crit Hit Promotions", "campaigns": ["Halfling CT"], "reach": 24599 },
  "analytics": { "property": "Culinary Traditions", "filter": "sessions with medium \"paid\"" },
  "note": "Shown under the comparison.",
  "empty_note": "Shown while days is empty.",
  "days": [
    { "d": "2026-10-20", "spend": 39.26, "impr": 1899, "clicks": 22, "lpv": 11, "mp": 3, "s": 9, "gp": 1 }
  ]
}
```

(The comment above is for this README only; the block in the page must be strict JSON.)

One object per day that has any activity in either source:

| Key | Source | Meaning |
|---|---|---|
| `spend` | Meta | amount spent |
| `impr` | Meta | impressions |
| `clicks` | Meta | link clicks |
| `lpv` | Meta | landing page views |
| `mp` | Meta | purchases |
| `s` | Analytics | sessions where session medium is `paid` |
| `gp` | Analytics | ecommerce purchases in those sessions |

`meta.reach` is the campaign total for the whole period, fetched on its own, because daily reach cannot be added up.

Rewrite the full `days` list on every run rather than appending, since both sources revise recent days. Check that the day sums match the totals each source reports before saving.

## New project

Copy an existing project folder to `<shortname>-<8 random hex characters>/`, replace the JSON block, and add a row to the table above.

## Replay (finished campaigns)

A project's JSON may carry an optional `replay` object: `{ "end": "YYYY-MM-DD", "reach": { "YYYY-MM-DD": 1601 } }`. The dashboard then shows a day stepper, and `?asof=YYYY-MM-DD` renders the page as it stood at the end of that day. `end` is the campaign's last day; `reach` holds Meta's cumulative reach from the first day through each day that had spend. The daily update does not need to write it.
