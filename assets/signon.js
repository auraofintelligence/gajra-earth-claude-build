/* The sign-on packet composer. Progressive enhancement only: the pull request
   path above it works with this file deleted, and the form degrades to plain
   text you can copy by hand.

   Nothing is sent from this page. The packet is composed in your browser and
   you send it yourself, from your own mail or messaging app, which is what
   makes sending it the act of consent. There is no endpoint here, no fetch,
   no analytics, no storage. */
(function () {
  "use strict";

  var EMAIL = "auraofintelligence@gmail.com";
  var MAXLEN = { name: 80, place: 90, work: 160, means: 320, url: 200 };

  function $(sel, root) { return (root || document).querySelector(sel); }

  function clip(s, n) {
    s = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n - 1).trim() + "…" : s;
  }

  /* The packet is deliberately plain text, not JSON: a human reads it first,
     and a person on a slow phone can retype it if their app mangles it. */
  function compose(f) {
    var lines = [];
    lines.push("GAJRA EARTH SIGN-ON");
    lines.push("Kind: " + f.kind);
    lines.push("Name: " + clip(f.name, MAXLEN.name));
    if (f.operator) lines.push("Operator: " + clip(f.operator, MAXLEN.name));
    if (f.place) lines.push("Place: " + clip(f.place, MAXLEN.place));
    if (f.work) lines.push("Works on: " + clip(f.work, MAXLEN.work));
    lines.push("Means: " + clip(f.means, MAXLEN.means));
    if (f.url) lines.push("Link: " + clip(f.url, MAXLEN.url));
    lines.push("Map: " + (f.onMap ? "yes, show this place" : "no, keep me off the map"));
    lines.push("Pledge: agreed, and I accept the three words are unfinished.");
    lines.push("");
    lines.push("Add this as one line in SIGNATORIES.md. Remove it whenever I ask.");
    return lines.join("\n");
  }

  /* The row exactly as it will appear in the file, so a person taking the
     pull request path can paste it straight in. */
  function composeRow(f, today) {
    var cells = [today, clip(f.name, MAXLEN.name)];
    if (f.kind === "system") cells.push("operated by " + clip(f.operator || "not stated", MAXLEN.name));
    cells.push(clip(f.work, MAXLEN.work) || "not stated");
    cells.push(clip(f.means, MAXLEN.means));
    return "| " + cells.join(" | ") + " |";
  }

  function smsHref(body) {
    /* iPhones want &body=, everything else wants ?body=. Number left blank on
       purpose: the person picks the recipient from their own contacts. */
    var apple = /iPhone|iPad|iPod/.test(navigator.userAgent);
    return "sms:" + (apple ? "&" : "?") + "body=" + encodeURIComponent(body);
  }

  function mailHref(body) {
    return "mailto:" + EMAIL +
      "?subject=" + encodeURIComponent("GAJRA Earth sign-on") +
      "&body=" + encodeURIComponent(body);
  }

  function waHref(body) {
    return "https://wa.me/?text=" + encodeURIComponent(body);
  }

  function init() {
    var form = $("#signon-form");
    if (!form) return;
    var out = $("#signon-packet");
    var rowOut = $("#signon-row");
    var status = $("#signon-status");
    var kindSel = $("#so-kind");
    var opWrap = $("#so-operator-wrap");
    var today = new Date().toISOString().slice(0, 10);

    function read() {
      return {
        kind: kindSel.value,
        name: $("#so-name").value,
        operator: $("#so-operator").value,
        place: $("#so-place").value,
        work: $("#so-work").value,
        means: $("#so-means").value,
        url: $("#so-url").value,
        onMap: $("#so-map").checked
      };
    }

    function valid(f) {
      if (!f.name.trim()) return "Add a name, the one you want on the record.";
      if (!f.means.trim()) return "Add your line: what joyful responsible abundance means in your work.";
      if (f.kind === "system" && !f.operator.trim()) return "A system signs with its operator named. That rule is the whole point.";
      return null;
    }

    function refresh() {
      var f = read();
      opWrap.hidden = f.kind !== "system";
      var problem = valid(f);
      var packet = compose(f);
      out.value = packet;
      rowOut.value = composeRow(f, today);
      form.querySelectorAll("[data-send]").forEach(function (a) {
        if (problem) {
          a.setAttribute("aria-disabled", "true");
          a.removeAttribute("href");
        } else {
          a.removeAttribute("aria-disabled");
          var mode = a.getAttribute("data-send");
          a.href = mode === "mail" ? mailHref(packet)
            : mode === "sms" ? smsHref(packet)
            : waHref(packet);
        }
      });
      status.textContent = problem || "Ready to send. Nothing leaves this page until you send it yourself.";
      status.className = problem ? "so-status warn" : "so-status";
    }

    form.addEventListener("input", refresh);
    form.addEventListener("change", refresh);
    form.addEventListener("submit", function (e) { e.preventDefault(); });

    form.querySelectorAll("[data-copy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = $(btn.getAttribute("data-copy"));
        var text = target.value;
        function done(ok) {
          status.textContent = ok ? "Copied. Paste it wherever you like."
            : "Could not copy automatically. Select the text and copy it by hand.";
          status.className = ok ? "so-status" : "so-status warn";
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
        } else {
          target.select();
          done(document.execCommand && document.execCommand("copy"));
        }
      });
    });

    var shareBtn = $("#so-share");
    if (shareBtn) {
      if (!navigator.share) { shareBtn.hidden = true; }
      else {
        shareBtn.addEventListener("click", function () {
          navigator.share({ title: "GAJRA Earth sign-on", text: out.value })
            .catch(function () { /* a cancelled share sheet is not an error */ });
        });
      }
    }

    refresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
