/* The listening station intake tool. Progressive enhancement: the page reads
   as a complete field kit with this file deleted.

   Built for someone standing at a table with a phone, possibly with no signal.
   Lines are held on this device only, in localStorage, so a phone going to
   sleep does not lose an afternoon's listening. Nothing is sent anywhere until
   the volunteer taps send, and the Clear button really does clear it. */
(function () {
  "use strict";

  var KEY = "gajra.station.v1";
  var MAX = { name: 80, place: 90, means: 320 };

  function $(s, r) { return (r || document).querySelector(s); }
  function tidy(s, n) {
    s = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n - 1).trim() + "…" : s;
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  }
  function save(rows) {
    try { localStorage.setItem(KEY, JSON.stringify(rows)); return true; }
    catch (e) { return false; }
  }

  function packet(rows, station) {
    var out = ["GAJRA EARTH LISTENING STATION"];
    if (station) out.push("Station: " + tidy(station, MAX.place));
    out.push("Lines heard: " + rows.length);
    out.push("");
    rows.forEach(function (r, i) {
      out.push((i + 1) + ". " + r.name + (r.place ? " (" + r.place + ")" : ""));
      out.push("   Means: " + r.means);
      out.push("   Consent: " + (r.consent === "named" ? "happy to be named on the record"
        : "anonymous, do not publish the name"));
      out.push("");
    });
    out.push("Each person was told: this becomes one public line, and it can be");
    out.push("removed whenever they ask, without process.");
    return out.join("\n");
  }

  function init() {
    var wrap = $("#station");
    if (!wrap) return;

    var rows = load();
    var list = $("#station-list");
    var count = $("#station-count");
    var out = $("#station-packet");
    var status = $("#station-status");
    var stationName = $("#st-station");

    function say(msg, warn) {
      status.textContent = msg;
      status.className = warn ? "so-status warn" : "so-status";
    }

    function render() {
      list.innerHTML = "";
      rows.forEach(function (r, i) {
        var li = document.createElement("li");
        li.className = "st-row";
        var who = document.createElement("div");
        who.innerHTML = "<strong>" + r.name + "</strong>" +
          (r.place ? ' <span class="so-opt">' + r.place + "</span>" : "") +
          (r.consent === "anon" ? ' <span class="chip archived">anonymous</span>' : "");
        var line = document.createElement("p");
        line.className = "muted";
        line.style.margin = "0.3rem 0 0";
        line.textContent = r.means;
        var del = document.createElement("button");
        del.type = "button";
        del.className = "st-del";
        del.textContent = "Remove";
        del.setAttribute("aria-label", "Remove the line from " + r.name);
        del.addEventListener("click", function () {
          rows.splice(i, 1);
          save(rows); render();
          say("Removed. Removal is always one action, here and everywhere else.");
        });
        li.appendChild(who); li.appendChild(line); li.appendChild(del);
        list.appendChild(li);
      });
      count.textContent = rows.length === 0 ? "No lines yet."
        : rows.length === 1 ? "One line held on this device."
        : rows.length + " lines held on this device.";
      out.value = rows.length ? packet(rows, stationName.value) : "";
      $("#station-send").hidden = rows.length === 0;
      $("#station-clear").hidden = rows.length === 0;
    }

    $("#station-add").addEventListener("click", function () {
      var name = tidy($("#st-name").value, MAX.name);
      var means = tidy($("#st-means").value, MAX.means);
      var consent = $("#st-consent").value;
      if (!means) { say("The line is the point. Write down what they said, in their words.", true); $("#st-means").focus(); return; }
      if (consent === "named" && !name) { say("If they are happy to be named, write the name. If not, switch the consent to anonymous.", true); $("#st-name").focus(); return; }
      rows.push({
        name: consent === "anon" ? "Anonymous" : name,
        place: tidy($("#st-place").value, MAX.place),
        means: means,
        consent: consent
      });
      if (!save(rows)) say("Added, but this device would not save it. Send the packet before you close the page.", true);
      else say("Added. Held on this device only.");
      $("#st-name").value = ""; $("#st-means").value = "";
      render();
      $("#st-name").focus();
    });

    $("#station-clear").addEventListener("click", function () {
      if (!window.confirm("Clear every line held on this device? This cannot be undone.")) return;
      rows = [];
      try { localStorage.removeItem(KEY); } catch (e) { /* nothing to do */ }
      render();
      say("Cleared. Nothing is left on this device.");
    });

    $("#station-send").addEventListener("click", function () {
      var body = out.value;
      var href = "mailto:auraofintelligence@gmail.com?subject=" +
        encodeURIComponent("Listening station: " + (tidy(stationName.value, 60) || "unnamed")) +
        "&body=" + encodeURIComponent(body);
      if (navigator.share) {
        navigator.share({ title: "GAJRA Earth listening station", text: body })
          .catch(function () { window.location.href = href; });
      } else {
        window.location.href = href;
      }
    });

    $("#station-copy").addEventListener("click", function () {
      if (!out.value) { say("Nothing to copy yet.", true); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(out.value).then(
          function () { say("Copied."); },
          function () { out.select(); say("Select the text and copy it by hand.", true); });
      } else { out.select(); say("Select the text and copy it by hand.", true); }
    });

    stationName.addEventListener("input", render);
    render();
    say(rows.length ? "Picked up where you left off." : "Ready. Nothing here is sent until you send it.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
