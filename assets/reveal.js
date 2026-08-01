/* Progressive enhancement only. The site is fully readable without this file.

   Deliberately NOT IntersectionObserver. Content visibility must never
   depend on an observer callback arriving: browsers throttle or delay IO
   in background tabs, prerendered pages and low-power modes, and a
   fractional threshold is unreachable for any block taller than the
   viewport, which leaves whole sections at opacity 0 forever on a phone.
   A plain geometry sweep on scroll and resize gives the same staggered
   effect with nothing that can strand content. */
(function () {
  function arrive(el) {
    el.classList.add(el.classList.contains("kintsugi-seam") ? "is-drawn" : "in");
  }
  var pending = [].slice.call(document.querySelectorAll(".reveal, .kintsugi-seam"));
  var reduced = window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    pending.forEach(arrive);
    pending = [];
  }
  function sweep() {
    if (!pending.length) { return; }
    /* Only the top edge is tested, so anything scrolled past stays revealed:
       an anchor jump or a restored scroll position cannot skip a block. */
    var line = window.innerHeight * 0.92;
    pending = pending.filter(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < line) { arrive(el); return false; }
      return true;
    });
  }
  sweep();
  window.addEventListener("scroll", sweep, { passive: true });
  window.addEventListener("resize", sweep, { passive: true });
  window.addEventListener("load", sweep);
  /* Late-layout safety net (fonts and images shifting geometry after first paint). */
  setTimeout(sweep, 400);
  setTimeout(sweep, 1500);
})();
