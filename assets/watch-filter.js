/* Keyword filter for the watch archive pages.
   Progressive enhancement: without this script the input is hidden by CSS and
   every entry stays visible, which is the behaviour that matters for a record.
   No network, no storage, no analytics. */
(function () {
  var box = document.getElementById('kf');
  if (!box) return;

  var count = document.getElementById('kf-count');
  var entries = [].slice.call(document.querySelectorAll('.entry'));
  var sections = [].slice.call(document.querySelectorAll('main section.pad-s'));

  var haystacks = entries.map(function (el) {
    return (
      (el.getAttribute('data-k') || '') + ' ' + el.textContent
    ).toLowerCase();
  });

  function apply() {
    var terms = box.value.toLowerCase().split(/\s+/).filter(Boolean);
    var shown = 0;

    entries.forEach(function (el, i) {
      var hit = terms.every(function (t) { return haystacks[i].indexOf(t) > -1; });
      el.hidden = !hit;
      if (hit) shown++;
    });

    // Hide a whole dated section when nothing in it survives the filter, so the
    // page does not leave orphan date headings behind.
    sections.forEach(function (sec) {
      var inSec = sec.querySelectorAll('.entry');
      if (!inSec.length) return;
      var any = [].slice.call(inSec).some(function (el) { return !el.hidden; });
      sec.hidden = !any;
    });

    if (!terms.length) {
      count.textContent = '';
    } else if (shown === 0) {
      count.textContent = 'No entries match. Nothing has been removed; clear the box to see all ' + entries.length + '.';
    } else {
      count.textContent = shown + ' of ' + entries.length + ' entries shown.';
    }
  }

  box.addEventListener('input', apply);
  box.addEventListener('search', apply);
  apply();
})();
