#!/usr/bin/env python3
"""Import a Kickstarter referrer export into a project dashboard.

Usage:
  python3 -I tools/ks_import.py <referrers.csv> <project-folder> [--spend "Ads US=334.00" ...]

Reads the CSV that Kickstarter's dashboard exports ("Referrer,Date,Type,# of Pledges,
% of Pledged,Pledged,# Dropped,Dropped"), groups it by channel per day and writes the result
into the "kickstarter" object of the project's data block. The export always holds the whole
campaign to date, so each import replaces the previous one. The raw CSV is not stored.

The "kickstarter" object must already exist with its "ad_links" (which ref tags are ads, and
which Meta ad sets each covers). --spend sets each ad link's Meta spend from the first day
through the export's last day; pass one per ad link on every import.
"""
import csv, json, re, sys, os, argparse, collections

HEADER = ['Referrer', 'Date', 'Type', '# of Pledges', '% of Pledged', 'Pledged', '# Dropped', 'Dropped']

def channel(ref, typ, rename):
    if typ == 'Custom':
        return rename.get(ref, ref)
    if typ == 'Kickstarter':
        return 'Kickstarter emails' if ref.startswith('Email') else 'Kickstarter pages and app'
    if typ == 'External':
        return 'Other websites'
    return 'Other'

def dump(obj, ind=0):
    """JSON with 2-space indent, but each item of a "days" list on one line."""
    pad, pad2 = '  ' * ind, '  ' * (ind + 1)
    if isinstance(obj, dict):
        if not obj: return '{}'
        parts = []
        for k, v in obj.items():
            if k == 'days' and isinstance(v, list):
                inner = ',\n'.join(pad2 + '  ' + json.dumps(x, ensure_ascii=False, separators=(', ', ': ')) for x in v)
                parts.append(pad2 + json.dumps(k) + ': [' + ('\n' + inner + '\n' + pad2 if v else '') + ']')
            else:
                parts.append(pad2 + json.dumps(k) + ': ' + dump(v, ind + 1))
        return '{\n' + ',\n'.join(parts) + '\n' + pad + '}'
    if isinstance(obj, list) and obj and all(isinstance(x, (dict, list)) for x in obj):
        return '[\n' + ',\n'.join(pad2 + dump(x, ind + 1) for x in obj) + '\n' + pad + ']'
    return json.dumps(obj, ensure_ascii=False, separators=(', ', ': '))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('csv'); ap.add_argument('project')
    ap.add_argument('--spend', action='append', default=[], help='"<ref tag>=<amount>"')
    a = ap.parse_args()

    page = os.path.join(a.project, 'index.html')
    html = open(page, encoding='utf-8').read()
    m = re.search(r'(<script id="data" type="application/json">\n)(.*?)(\n</script>)', html, re.S)
    if not m: sys.exit('data block not found in ' + page)
    data = json.loads(m.group(2))
    ks = data.get('kickstarter')
    if not ks or not ks.get('ad_links'):
        sys.exit('the project has no "kickstarter" object with "ad_links"; add it first (see README)')

    with open(a.csv, newline='', encoding='utf-8-sig') as f:
        rows = list(csv.reader(f))
    if rows[0] != HEADER:
        sys.exit('unexpected header: %r' % rows[0])
    rows = [dict(zip(HEADER, r)) for r in rows[1:] if r]

    rename = ks.get('rename', {})
    by = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0.0]))
    share = 0.0; dropped = [0, 0.0]
    for r in rows:
        c = by[r['Date']][channel(r['Referrer'], r['Type'], rename)]
        c[0] += int(r['# of Pledges']); c[1] += float(r['Pledged'])
        share += float(r['% of Pledged'])
        dropped[0] += int(r['# Dropped']); dropped[1] += float(r['Dropped'])
    if abs(share - 1) > 0.02:
        print('WARNING: the "% of Pledged" column adds up to %.3f, not 1; the export may be incomplete' % share)

    days = [{'d': d, 'by': {k: [v[0], round(v[1], 2)] for k, v in sorted(ch.items())}} for d, ch in sorted(by.items())]
    m2 = re.search(r'(\d{4}-\d{2}-\d{2})T(\d{2})_(\d{2})', os.path.basename(a.csv))
    ks['exported'] = (m2.group(1) + 'T' + m2.group(2) + ':' + m2.group(3)) if m2 else days[-1]['d']
    ks['through'] = days[-1]['d']
    ks['dropped'] = [dropped[0], round(dropped[1], 2)]
    refs = {l['ref'] for l in ks['ad_links']}
    for s in a.spend:
        ref, _, amt = s.rpartition('=')
        if ref not in refs: sys.exit('--spend names an unknown ad link: ' + ref)
        for l in ks['ad_links']:
            if l['ref'] == ref: l['spend'] = round(float(amt), 2)
    missing = [l['ref'] for l in ks['ad_links'] if l.get('spend') is None]
    if missing: sys.exit('no spend for ad links: ' + ', '.join(missing))
    ks['days'] = days

    # keep "days" (Meta and Analytics) last in the block
    data = {k: v for k, v in data.items() if k != 'days'} | {'days': data.get('days', [])}
    body = dump(data)
    json.loads(body)
    open(page, 'w', encoding='utf-8').write(html[:m.start(2)] + body + html[m.end(2):])

    tot = [sum(v[0] for d in days for v in d['by'].values()), sum(v[1] for d in days for v in d['by'].values())]
    ad = [sum(d['by'].get(r, [0, 0])[i] for d in days for r in refs) for i in (0, 1)]
    sp = sum(l['spend'] for l in ks['ad_links'])
    print('imported %d rows, %s to %s: %d pledges, %.2f pledged; ad links %d pledges, %.2f pledged on %.2f spend'
          % (len(rows), days[0]['d'], days[-1]['d'], tot[0], tot[1], ad[0], ad[1], sp))
    unknown = sorted({r['Referrer'] for r in rows if r['Type'] == 'Custom' and r['Referrer'] not in refs
                      and r['Referrer'] not in rename and r['Referrer'] not in ('Newsletter', 'Cross Promo', 'Posts')})
    if unknown: print('NOTE: custom ref tags not listed as ad links: ' + ', '.join(unknown))

if __name__ == '__main__':
    main()
