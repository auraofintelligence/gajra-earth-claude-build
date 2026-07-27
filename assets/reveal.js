/* Progressive enhancement only. The site is fully readable without this file. */
(function () {
  function arrive(el) {
    el.classList.add(el.classList.contains("kintsugi-seam") ? "is-drawn" : "in");
  }
  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll(".reveal, .kintsugi-seam").forEach(arrive);
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { arrive(e.target); io.unobserve(e.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".reveal, .kintsugi-seam").forEach(function (el) { io.observe(el); });
})();
