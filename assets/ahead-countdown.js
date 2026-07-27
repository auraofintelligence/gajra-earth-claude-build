/* Live countdown for the forward calendar.
   The routine writes fixed dates into the HTML and never writes "in 12 days",
   because that sentence is wrong the morning after it is written. This computes
   the distance at read time instead. Without JavaScript the dates still show,
   which is the part that matters.
   No network, no storage, no analytics. */
(function () {
  var evs = [].slice.call(document.querySelectorAll('.ev[data-when]'));
  if (!evs.length) return;

  var now = new Date();
  var today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  var DAY = 86400000;

  function parse(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
  }

  function phrase(days) {
    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    if (days < 0) return null;
    if (days < 14) return 'in ' + days + ' days';
    if (days < 60) return 'in ' + Math.round(days / 7) + ' weeks';
    return 'in about ' + Math.round(days / 30) + ' months';
  }

  evs.forEach(function (ev) {
    var slot = ev.querySelector('.ev-in');
    if (!slot) return;

    var starts = parse(ev.getAttribute('data-when'));
    var ends = parse(ev.getAttribute('data-ends')) || starts;
    var closes = parse(ev.getAttribute('data-closes'));

    // A door that has shut is the one thing worth saying loudly, because the
    // page would otherwise invite someone to act on something already gone.
    if (closes !== null) {
      var d = Math.round((closes - today) / DAY);
      if (d < 0) {
        slot.textContent = 'closed';
        ev.classList.add('past');
      } else {
        slot.textContent = 'closes ' + (phrase(d) || 'today');
      }
      return;
    }

    if (ends !== null && ends < today) {
      slot.textContent = 'passed';
      ev.classList.add('past');
      return;
    }
    if (starts !== null && starts <= today && ends >= today) {
      slot.textContent = 'happening now';
      return;
    }
    if (starts !== null) {
      var p = phrase(Math.round((starts - today) / DAY));
      if (p) slot.textContent = p;
    }
  });
})();
