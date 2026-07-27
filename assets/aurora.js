/* Sky film controller. The hero footage is real: Aurora Australis photographed
   from the International Space Station on 17 August 2022, ending over Perth.
   NASA Scientific Visualization Studio, public domain. NASA does not endorse
   this site. This script only adds control: pause button (WCAG 2.2.2),
   reduced-motion respect, and a stop when the film is scrolled away. */
(function () {
  var film = document.querySelector("video.skyfilm");
  if (!film) return;

  var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var reduce = mq ? mq.matches : false;
  var paused = false;

  function play() {
    if (reduce || paused) return;
    var p = film.play();
    if (p && p.catch) p.catch(function () {});
  }
  function halt() { film.pause(); }

  if (reduce) {
    film.removeAttribute("autoplay");
    halt();
  }

  /* the pause control */
  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "skypause";
  btn.setAttribute("aria-pressed", "false");
  btn.textContent = "Pause film";
  btn.addEventListener("click", function () {
    paused = !paused;
    btn.setAttribute("aria-pressed", String(paused));
    btn.textContent = paused ? "Play film" : "Pause film";
    if (paused) halt(); else play();
  });
  if (film.parentElement) film.parentElement.appendChild(btn);

  /* stop the film when it leaves the screen */
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) play(); else halt();
    }, { threshold: 0.05 }).observe(film);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) halt(); else play();
  });

  if (mq && mq.addEventListener) {
    mq.addEventListener("change", function (e) {
      reduce = e.matches;
      if (reduce) halt(); else play();
    });
  }
})();
