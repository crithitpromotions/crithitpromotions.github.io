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

## Kickstarter (optional third source)

Meta and Analytics never see the real pledge amounts. Kickstarter's referrer report does, so a project's JSON may carry a `kickstarter` object. When present, the dashboard adds a Kickstarter panel (raised, pledges and money through the ad links, ad spend, return per euro and cost per pledge, a table per ad link, and where all pledges came from), a Kickstarter bar in the purchases comparison and chart, and two Kickstarter columns in the day-by-day table.

```json
"kickstarter": {
  "rename": { "bk-ec-85594": "BackerKit" },
  "ad_links": [
    { "ref": "Ads Targeted", "label": "Past backers retargeting", "adsets": ["120248514588610225"], "spend": 69.43 }
  ],
  "days": [ { "d": "2026-10-12", "by": { "Ads Targeted": [3, 92], "Newsletter": [1, 11], "Kickstarter emails": [61, 1258] } } ],
  "exported": "2026-11-09T08:23",
  "through": "2026-11-09",
  "dropped": [0, 0]
}
```

- `ad_links` is set up by hand once per project: each Kickstarter ref tag used in the ads (`ref`), a readable `label`, and the Meta ad set ids it covers (`adsets`). `spend` is that ad sets' Meta spend from the start through `through`.
- `rename` gives readable names to custom ref tags.
- `days` holds pledges and amount per channel per day: custom ref tags by name, Kickstarter's own emails as "Kickstarter emails", every other Kickstarter page as "Kickstarter pages and app", outside sites as "Other websites". The raw CSV is never stored in the repo.

### Importing an export

Export the referrer report from the Kickstarter dashboard (it always covers the whole campaign to date, so each import replaces the last). Then:

```
python3 -I tools/ks_import.py <referrers.csv> <project-folder> --spend "Ads Targeted=69.43" --spend "Ads US=334.00" --spend "Ads EU=70.82"
```

with one `--spend` per ad link: the summed Meta `amount_spent` of its ad sets, date_preset maximum (or through the export's last day). The script checks the CSV header, warns if the "% of Pledged" column does not add up to 1, refuses unknown ref tags in `--spend`, and prints the totals to compare against the Kickstarter dashboard. The daily update keeps the `kickstarter` object untouched unless it imports a newer export.

A replayed day (`?asof=`) leaves the Kickstarter panel out, since the export has no per-day split of ad spend by link.
