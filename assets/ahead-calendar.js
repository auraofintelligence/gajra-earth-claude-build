/* Month calendar for the forward page.

   Built at read time from the entries further down the page, so the daily
   routine maintains one list and one list only, and the calendar can never
   drift out of step with it. Every date, span and link here is read from the
   .ev articles' own data-when, data-ends and data-closes attributes.

   Only months that actually carry something get drawn, and the gaps are named
   in a line underneath, because an empty grid for April says less than a
   sentence saying nothing is dated in April.

   Without JavaScript the container keeps the sentence already written into the
   HTML and the list below carries every date, which is the part that matters.
   No network, no storage, no analytics. */
(function () {
  var host = document.getElementById('calendar');
  if (!host) return;

  var evs = [].slice.call(document.querySelectorAll('.ev[data-when]'));
  if (!evs.length) return;

  var DAY = 86400000;
  var now = new Date();
  var today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                'August', 'September', 'October', 'November', 'December'];
  var DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  function parse(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function key(t) {
    var d = new Date(t);
    return d.getUTCFullYear() + '-' + d.getUTCMonth() + '-' + d.getUTCDate();
  }

  var days = {};
  var maxT = null;
  var doors = 0;

  evs.forEach(function (ev, i) {
    if (!ev.id) ev.id = 'ev-' + (i + 1);

    var h3 = ev.querySelector('h3');
    var title = h3 ? (h3.textContent || '') : 'Entry';
    title = title.replace(/\s+/g, ' ').replace(/\s*(Open door|Q9|Q10)\s*/g, ' ')
                 .replace(/\s+/g, ' ').trim();

    var starts = parse(ev.getAttribute('data-when'));
    var ends = parse(ev.getAttribute('data-ends'));
    var closes = parse(ev.getAttribute('data-closes'));
    var marks = [];

    if (closes !== null) {
      // A door. The closing day is the one that matters, so it gets the solid
      // mark and the run up to it is tinted, showing how long is left.
      if (closes >= today) doors++;
      marks.push({ t: closes, kind: 'close' });
      var from = (starts !== null && starts > today) ? starts : today;
      for (var t = from; t < closes; t += DAY) marks.push({ t: t, kind: 'open' });
    } else {
      if (starts === null) return;
      var last = (ends !== null) ? ends : starts;
      for (var u = starts; u <= last; u += DAY) {
        marks.push({ t: u, kind: (u === starts) ? 'start' : 'span' });
      }
    }

    marks.forEach(function (m) {
      if (m.t < today) return;
      var k = key(m.t);
      (days[k] = days[k] || []).push({ id: ev.id, kind: m.kind, title: title });
      if (maxT === null || m.t > maxT) maxT = m.t;
    });
  });

  if (maxT === null) return;

  var RANK = { close: 3, start: 2, span: 1, open: 0 };
  var out = [];
  var skipped = [];
  var cur = new Date(today);
  var y = cur.getUTCFullYear(), mo = cur.getUTCMonth();
  var endD = new Date(maxT);
  var endY = endD.getUTCFullYear(), endM = endD.getUTCMonth();

  while (y < endY || (y === endY && mo <= endM)) {
    var first = Date.UTC(y, mo, 1);
    var dim = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    var has = false;
    for (var d = 1; d <= dim; d++) { if (days[y + '-' + mo + '-' + d]) { has = true; break; } }

    if (has) {
      var lead = (new Date(first).getUTCDay() + 6) % 7;
      var cells = '';
      for (var b = 0; b < lead; b++) cells += '<td class="cal-x"></td>';

      for (var n = 1; n <= dim; n++) {
        var t = Date.UTC(y, mo, n);
        var list = days[y + '-' + mo + '-' + n];
        var cls = [];
        if (t === today) cls.push('cal-today');

        if (list) {
          // Rank once and use the same order for the link and the label, so the
          // name a reader sees on hover is the entry the day actually jumps to.
          var ranked = list.slice().sort(function (a, c) { return RANK[c.kind] - RANK[a.kind]; });
          var best = ranked[0];
          cls.push('cal-' + best.kind);
          var seen = {}, names = [];
          ranked.forEach(function (x) { if (!seen[x.title]) { seen[x.title] = 1; names.push(x.title); } });
          var label = names.join('; ');
          cells += '<td class="' + cls.join(' ') + '">'
                 + '<a href="#' + best.id + '" title="' + label.replace(/"/g, '&quot;') + '">'
                 + '<span class="cal-n">' + n + '</span>'
                 + '<span class="visually-hidden">' + label.replace(/</g, '&lt;') + '</span>'
                 + '</a></td>';
        } else {
          cells += '<td class="' + cls.join(' ') + '"><span class="cal-n">' + n + '</span></td>';
        }

        if ((lead + n) % 7 === 0 && n < dim) cells += '</tr><tr>';
      }

      out.push('<table class="cal-m"><caption>' + MONTHS[mo] + ' ' + y + '</caption>'
             + '<thead><tr>' + DOW.map(function (w) {
                 return '<th scope="col"><span aria-hidden="true">' + w.charAt(0) + '</span>'
                      + '<span class="visually-hidden">' + w + '</span></th>';
               }).join('') + '</tr></thead>'
             + '<tbody><tr>' + cells + '</tr></tbody></table>');
    } else {
      skipped.push(MONTHS[mo] + ' ' + y);
    }

    mo++; if (mo > 11) { mo = 0; y++; }
  }

  var note = '';
  if (skipped.length) {
    var lastS = skipped.pop();
    note = '<p class="cal-note">Nothing is dated in '
         + (skipped.length ? skipped.join(', ') + ' or ' + lastS : lastS)
         + '. That is a gap in what has been announced, and the record keeps it.</p>';
  }

  host.innerHTML =
      '<div class="cal-grid">' + out.join('') + '</div>'
    + '<p class="cal-key">'
    + '<span class="cal-k cal-k-close">Door closes</span>'
    + '<span class="cal-k cal-k-open">Door open</span>'
    + '<span class="cal-k cal-k-start">Meeting</span>'
    + '<span class="cal-k cal-k-today">Today</span>'
    + '</p>'
    + '<p class="cal-note">' + evs.length + ' entries, ' + doors
    + ' of them doors still open. Every marked day links to its entry below.</p>'
    + note;
})();
