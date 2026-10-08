/* Crit Hit Promotions — project dashboard renderer.
   Reads the JSON in <script id="data"> on the page and draws everything.
   The daily update only ever touches that JSON block. See README.md for the format. */
(function () {
  'use strict';
  var D = JSON.parse(document.getElementById('data').textContent);
  var cur = D.currency || 'EUR';
  var $ = function (id) { return document.getElementById(id); };
  var el = function (tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

  var nf = new Intl.NumberFormat('en-GB');
  var money = function (v, d) {
    if (v == null || !isFinite(v)) return '–';
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur, minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d }).format(v);
  };
  var num = function (v) { return v == null || !isFinite(v) ? '–' : nf.format(Math.round(v)); };
  var pct = function (v, d) { return v == null || !isFinite(v) ? '–' : (v * 100).toFixed(d == null ? 1 : d) + '%'; };
  var div = function (a, b) { return b ? a / b : null; };
  var parseDay = function (s) { var p = s.split('-'); return new Date(Date.UTC(+p[0], p[1] - 1, +p[2])); };
  var dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  var dayLong = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

  /* ---------- replay (optional): step through a finished campaign one day at a time ----------
     Present only when the data has a "replay" object: { "end": "YYYY-MM-DD", "reach": { "YYYY-MM-DD": n } }.
     ?asof=YYYY-MM-DD shows the page as it stood at the end of that day. */
  if (D.replay && D.days && D.days.length) (function () {
    var all = D.days.map(function (r) { return r.d; }).sort();
    var list = [];
    for (var t = parseDay(all[0]).getTime(), e = parseDay(all[all.length - 1]).getTime(); t <= e; t += 864e5) list.push(new Date(t).toISOString().slice(0, 10));
    var asof = new URLSearchParams(location.search).get('asof');
    var i = list.indexOf(asof), live = i < 0;
    var link = function (d) { return d ? '?asof=' + d : location.pathname; };
    var bar = el('div', 'replay');
    bar.innerHTML =
      '<span class="rl">' + (live ? 'Replay this campaign day by day' : 'Day ' + (i + 1) + ' of ' + list.length + ', ' + dayLong.format(parseDay(asof))) + '</span>' +
      '<input type="range" min="0" max="' + (list.length - 1) + '" value="' + (live ? list.length - 1 : i) + '" aria-label="Day of the campaign">' +
      '<span class="rb">' +
        (live ? '<a href="' + link(list[0]) + '">Start at day 1</a>'
              : (i > 0 ? '<a href="' + link(list[i - 1]) + '">Previous day</a>' : '') +
                (i < list.length - 1 ? '<a href="' + link(list[i + 1]) + '">Next day</a>' : '') +
                '<a href="' + link(null) + '">Final</a>') +
      '</span>';
    bar.querySelector('input').addEventListener('change', function () { location.href = link(list[+this.value]); });
    var title = document.querySelector('.title'); title.parentNode.insertBefore(bar, title);
    if (live) return;
    var today = D.days.filter(function (r) { return r.d === asof; })[0];
    D.days = D.days.filter(function (r) { return r.d <= asof; });
    var reach = null; Object.keys(D.replay.reach || {}).sort().forEach(function (d) { if (d <= asof) reach = D.replay.reach[d]; });
    if (D.meta) D.meta.reach = reach;
    D.status = today && +today.spend > 0 ? 'Running' : (asof > D.replay.end ? 'Ended' : 'Paused');
    D.updated = null;
    $('updated').dataset.replay = 'As it stood at the end of ' + dayFmt.format(parseDay(asof));
  })();

  /* ---------- header ---------- */
  document.title = D.project + ' | Crit Hit Promotions';
  $('project').textContent = D.project;
  var statusKey = (D.status || '').toLowerCase();
  $('status').dataset.s = statusKey.indexOf('running') === 0 ? 'running' : statusKey.indexOf('paused') === 0 ? 'paused' : 'other';
  $('status-text').textContent = D.status || '';
  $('updated').textContent = D.updated ? 'Updated ' + D.updated : ($('updated').dataset.replay || '');

  var days = (D.days || []).slice().sort(function (a, b) { return a.d < b.d ? -1 : 1; });
  var keys = ['spend', 'impr', 'clicks', 'lpv', 'mp', 's', 'gp'];
  days.forEach(function (r) { keys.forEach(function (k) { r[k] = +r[k] || 0; }); });

  if (!days.length) {
    $('period').textContent = '';
    $('content').hidden = true;
    $('empty').hidden = false;
    if (D.empty_note) $('empty-note').textContent = D.empty_note;
    renderFoot();
    return;
  }

  var T = {}; keys.forEach(function (k) { T[k] = days.reduce(function (a, r) { return a + r[k]; }, 0); });
  var first = days[0].d, last = days[days.length - 1].d;
  $('period').textContent = dayFmt.format(parseDay(first)) + ' to ' + dayFmt.format(parseDay(last)) + ' ' + last.slice(0, 4);

  /* ---------- Meta tiles ---------- */
  var tile = function (k, v, n, big) { return '<div class="tile' + (big ? ' big' : '') + '"><div class="k">' + k + '</div><div class="v">' + v + '</div>' + (n ? '<div class="n">' + n + '</div>' : '') + '</div>'; };
  var reach = D.meta && D.meta.reach;
  $('meta-tiles').innerHTML =
    tile('Spend', money(T.spend), null, true) +
    tile('Impressions', num(T.impr)) +
    (reach ? tile('Reach', num(reach), 'accounts') : '') +
    tile('Cost per 1,000 impressions', money(div(T.spend, T.impr) * 1000)) +
    tile('Link clicks', num(T.clicks)) +
    tile('Click rate', pct(div(T.clicks, T.impr), 2), 'link clicks ÷ impressions') +
    tile('Cost per click', money(div(T.spend, T.clicks))) +
    tile('Page loads', num(T.lpv), pct(div(T.lpv, T.clicks), 0) + ' of clicks') +
    tile('Purchases', num(T.mp), 'as counted by Meta') +
    tile('Cost per purchase', money(div(T.spend, T.mp)));
  $('meta-src').textContent = (D.meta && D.meta.campaigns ? D.meta.campaigns.join(', ') : '');

  /* ---------- Analytics column ---------- */
  $('ga-tiles').innerHTML =
    tile('Sessions from the ads', num(T.s), null, true) +
    tile('Clicks that arrived', pct(div(T.s, T.clicks), 0), 'sessions ÷ link clicks') +
    tile('Cost per session', money(div(T.spend, T.s))) +
    tile('Purchases', num(T.gp), 'as counted by Analytics') +
    tile('Cost per purchase', money(div(T.spend, T.gp)));
  $('ga-src').textContent = (D.analytics && D.analytics.property) || '';

  var bars = function (rows) {
    var max = Math.max.apply(null, rows.map(function (r) { return r[1]; })) || 1;
    return rows.map(function (r) {
      return '<div class="bar"><span class="l">' + r[0] + '</span><span class="t"><b style="width:' + (r[1] / max * 100).toFixed(1) + '%;background:var(--' + r[2] + ')"></b></span><span class="x">' + num(r[1]) + '</span></div>';
    }).join('');
  };
  $('cmp-traffic').innerHTML = bars([['Link clicks', T.clicks, 'meta'], ['Page loads', T.lpv, 'meta'], ['Sessions', T.s, 'ga']]);
  $('cmp-purch').innerHTML = bars([['Meta', T.mp, 'meta'], ['Analytics', T.gp, 'ga']]);
  var cA = div(T.spend, T.mp), cB = div(T.spend, T.gp);
  var lo = Math.min(cA == null ? Infinity : cA, cB == null ? Infinity : cB), hi = Math.max(cA || 0, cB || 0);
  $('cpp-range').textContent = !isFinite(lo) ? 'No purchases recorded yet' : (Math.abs(hi - lo) < 0.005 ? money(lo) : money(lo) + ' to ' + money(hi));
  if (D.note) $('note').textContent = D.note;

  /* ---------- charts ---------- */
  // continuous day axis from first to last day, missing days are zero
  var byDay = {}; days.forEach(function (r) { byDay[r.d] = r; });
  var axis = [];
  for (var t = parseDay(first).getTime(), end = parseDay(last).getTime(); t <= end; t += 864e5) {
    var k = new Date(t).toISOString().slice(0, 10);
    axis.push(byDay[k] || { d: k, spend: 0, impr: 0, clicks: 0, lpv: 0, mp: 0, s: 0, gp: 0 });
  }

  function niceMax(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
    var n = m <= 1 ? 1 : m <= 2 ? 2 : m <= 4 ? 4 : m <= 5 ? 5 : m <= 8 ? 8 : 10;
    return n * p;
  }

  function chart(host, opt) {
    var series = opt.series, fmt = opt.fmt || num;
    var legend = host.querySelector('.legend'), plot = host.querySelector('.plot');
    legend.innerHTML = series.length > 1 ? series.map(function (s) { return '<span><i style="background:var(--' + s.color + ')"></i>' + s.label + '</span>'; }).join('') : '';
    var tip = el('div', 'tip');

    function draw() {
      var W = Math.max(280, plot.clientWidth), H = 190, L = 34, R = 6, Tp = 8, B = 22;
      var iw = W - L - R, ih = H - Tp - B, n = axis.length, band = iw / n;
      var max = niceMax(Math.max.apply(null, axis.map(function (r) { return Math.max.apply(null, series.map(function (s) { return r[s.key]; })); })));
      var y = function (v) { return Tp + ih - (v / max) * ih; };
      var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + opt.title + '">';
      [0, 0.5, 1].forEach(function (f) {
        var yy = y(max * f);
        svg += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '"/>' +
               '<text x="' + (L - 6) + '" y="' + (yy + 4) + '" text-anchor="end">' + (opt.axisFmt || num)(max * f) + '</text>';
      });
      var step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 70))));
      axis.forEach(function (r, i) {
        if (i % step === 0 && i <= n - step / 2 || n <= 3) svg += '<text x="' + (L + band * i + band / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + dayFmt.format(parseDay(r.d)) + '</text>';
      });
      if (opt.type === 'line') {
        series.forEach(function (s) {
          var pts = axis.map(function (r, i) { return (L + band * i + band / 2).toFixed(1) + ',' + y(r[s.key]).toFixed(1); });
          svg += '<polyline fill="none" stroke="var(--' + s.color + ')" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="' + pts.join(' ') + '"/>';
        });
      } else {
        var k = series.length, gap = 2, bw = Math.max(2, Math.min(24, (band - 4 - gap * (k - 1)) / k)), group = bw * k + gap * (k - 1);
        axis.forEach(function (r, i) {
          series.forEach(function (s, j) {
            var v = r[s.key]; if (!v) return;
            var x = L + band * i + (band - group) / 2 + j * (bw + gap), yy = y(v), h = Tp + ih - yy, rad = Math.min(4, bw / 2, h);
            svg += '<path fill="var(--' + s.color + ')" d="M' + x + ' ' + (Tp + ih) + 'V' + (yy + rad) + 'q0 ' + (-rad) + ' ' + rad + ' ' + (-rad) + 'h' + (bw - 2 * rad) + 'q' + rad + ' 0 ' + rad + ' ' + rad + 'V' + (Tp + ih) + 'z"/>';
          });
        });
      }
      svg += '<rect class="hover" y="' + Tp + '" width="' + band + '" height="' + ih + '" rx="3"/>';
      svg += '</svg>';
      plot.innerHTML = svg; plot.appendChild(tip);
      var hover = plot.querySelector('.hover'), node = plot.querySelector('svg');

      function move(ev) {
        var box = node.getBoundingClientRect(), px = (ev.clientX - box.left) / box.width * W;
        var i = Math.max(0, Math.min(n - 1, Math.floor((px - L) / band))), r = axis[i];
        hover.setAttribute('x', L + band * i); hover.classList.add('on');
        tip.innerHTML = '<b>' + dayLong.format(parseDay(r.d)) + '</b><br>' + series.map(function (s) { return '<i style="background:var(--' + s.color + ')"></i>' + s.label + ': ' + fmt(r[s.key]); }).join('<br>');
        tip.classList.add('on');
        var cx = (L + band * i + band / 2) / W * box.width, tw = tip.offsetWidth;
        tip.style.left = Math.max(0, Math.min(box.width - tw, cx - tw / 2)) + 'px';
        tip.style.top = (-tip.offsetHeight - 4) + 'px';
      }
      function leave() { hover.classList.remove('on'); tip.classList.remove('on'); }
      node.addEventListener('pointermove', move); node.addEventListener('pointerdown', move); node.addEventListener('pointerleave', leave);
    }
    draw();
    var timer; window.addEventListener('resize', function () { clearTimeout(timer); timer = setTimeout(draw, 120); });
  }

  chart($('c-spend'), { title: 'Spend per day', type: 'bar', fmt: money, axisFmt: function (v) { return money(v, 0); }, series: [{ key: 'spend', label: 'Spend', color: 'meta' }] });
  chart($('c-traffic'), { title: 'Link clicks and sessions per day', type: 'line', series: [{ key: 'clicks', label: 'Link clicks (Meta)', color: 'meta' }, { key: 's', label: 'Sessions (Analytics)', color: 'ga' }] });
  chart($('c-purch'), { title: 'Purchases per day', type: 'bar', series: [{ key: 'mp', label: 'Meta', color: 'meta' }, { key: 'gp', label: 'Analytics', color: 'ga' }] });

  /* ---------- daily table ---------- */
  var cell = function (v, f, cls) { return '<td class="' + (cls || '') + (v ? '' : ' zero') + '">' + (v ? f(v) : (f === money ? '–' : '0')) + '</td>'; };
  var row = function (label, r, cls) {
    return '<tr class="' + (cls || '') + '"><td>' + label + '</td>' + cell(r.spend, money) + cell(r.impr, num) + cell(r.clicks, num) + cell(r.lpv, num) + cell(r.mp, num) + cell(r.s, num, 'sep') + cell(r.gp, num) + '</tr>';
  };
  $('rows').innerHTML = row('Total', T, 'total') + days.slice().reverse().map(function (r) { return row(dayLong.format(parseDay(r.d)), r); }).join('');

  renderFoot();

  function renderFoot() {
    var bits = [];
    if (D.meta && D.meta.account) bits.push('Meta Ads account: ' + D.meta.account);
    if (D.analytics && D.analytics.property) bits.push('Google Analytics property: ' + D.analytics.property + (D.analytics.filter ? ' (' + D.analytics.filter + ')' : ''));
    $('sources').textContent = bits.join('. ') + (bits.length ? '.' : '');
  }
})();
