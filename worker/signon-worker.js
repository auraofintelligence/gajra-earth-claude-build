/* GAJRA Earth sign-on relay. Cloudflare Worker, no dependencies.
 *
 * Status: written and ready to deploy, NOT deployed. Nothing on the live site
 * points at it yet. See worker/README.md before wiring it up.
 *
 * What it does: receives a sign-on packet, validates its shape, and opens a
 * pull request. It never merges. A person still reads every packet and clicks
 * merge, which is the vetting gate and the audit trail in one.
 *
 * What it deliberately cannot do: write to main, store packets beyond a short
 * dedupe window, run anything a packet contains, or reach any host other than
 * api.github.com.
 */

const LIMITS = { name: 80, operator: 80, place: 90, work: 160, means: 320, url: 200, body: 4000 };
const KINDS = ["person", "system"];
const REPO = { owner: "auraofintelligence", repo: "gajra-earth-claude-build", base: "main" };

/* ---------- parsing ---------- */

/* The packet is the plain text the composer wrote. Parsed line by line, and
   anything unrecognised is dropped rather than passed along. */
function parsePacket(text) {
  if (typeof text !== "string" || text.length > LIMITS.body) return null;
  const fields = {};
  const keys = {
    kind: "kind", name: "name", operator: "operator", place: "place",
    "works on": "work", means: "means", link: "url", map: "map", pledge: "pledge"
  };
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(/^([A-Za-z ]{2,12}):\s*(.*)$/);
    if (!m) continue;
    const key = keys[m[1].trim().toLowerCase()];
    if (key && !(key in fields)) fields[key] = m[2].trim();
  }
  return fields;
}

function clean(s, max) {
  /* Strip control characters and pipes by code point: pipes would break the
     markdown table, control characters would let a packet forge structure. */
  var str = String(s || ""), out = "";
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    out += (c < 32 || c === 127) ? " " : (c === 124 ? "/" : str[i]);
  }
  return out.replace(/\s+/g, " ").trim().slice(0, max);
}

function validate(f) {
  const errors = [];
  const kind = KINDS.includes(f.kind) ? f.kind : null;
  if (!kind) errors.push("kind must be person or system");
  const name = clean(f.name, LIMITS.name);
  if (!name) errors.push("name is required");
  const means = clean(f.means, LIMITS.means);
  if (!means) errors.push("definition line is required");
  const operator = clean(f.operator, LIMITS.operator);
  if (kind === "system" && !operator) errors.push("a system must name its operator");

  let url = clean(f.url, LIMITS.url);
  if (url && !/^https:\/\/[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(url)) {
    url = "";                                   /* drop it rather than reject the signature */
  }
  const onMap = /^yes/i.test(String(f.map || ""));
  const place = clean(f.place, LIMITS.place);
  if (onMap && !place) errors.push("asking to be on the map needs a general place");

  return {
    ok: errors.length === 0,
    errors,
    record: { kind, name, operator, place, work: clean(f.work, LIMITS.work), means, url, onMap }
  };
}

/* ---------- GitHub ---------- */

async function gh(env, path, init = {}) {
  const res = await fetch("https://api.github.com" + path, {
    ...init,
    headers: {
      "Authorization": "Bearer " + env.GITHUB_TOKEN,
      "Accept": "application/vnd.github+json",
      "User-Agent": "gajra-earth-signon",
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
  if (!res.ok) throw new Error("GitHub " + res.status + " on " + path);
  return res.json();
}

function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function b64decode(b64) {
  const bin = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function getFile(env, path, ref) {
  const data = await gh(env, `/repos/${REPO.owner}/${REPO.repo}/contents/${path}?ref=${ref}`);
  return { text: b64decode(data.content), sha: data.sha };
}

async function putFile(env, path, text, sha, branch, message) {
  return gh(env, `/repos/${REPO.owner}/${REPO.repo}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({ message, content: b64encode(text), sha, branch })
  });
}

/* Insert a row at the end of the named table, leaving every other line alone.
   Nobody edits anyone else's line, including this Worker. */
function appendRow(md, heading, row) {
  const lines = md.split("\n");
  const start = lines.findIndex(l => l.trim().toLowerCase() === "## " + heading.toLowerCase());
  if (start === -1) throw new Error("section not found: " + heading);
  let last = start;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) break;
    if (lines[i].trim().startsWith("|")) last = i;
  }
  lines.splice(last + 1, 0, row);
  return lines.join("\n");
}

function buildRow(r, today) {
  const cells = [today, r.name];
  if (r.kind === "system") cells.push(r.operator);
  cells.push(r.work || "not stated");
  cells.push('"' + r.means.replace(/"/g, "'") + '"');
  return "| " + cells.join(" | ") + " |";
}

/* ---------- the request ---------- */

async function handle(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(env) });
  }
  if (request.method !== "POST") {
    return json({ error: "post a packet" }, 405, env);
  }

  /* Shared-secret header, so only the site's own form can reach this. Not a
     security boundary on its own: the real gate is that a person merges. */
  if (env.RELAY_SECRET && request.headers.get("x-gajra-key") !== env.RELAY_SECRET) {
    return json({ error: "not for you" }, 403, env);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400, env); }

  const fields = parsePacket(body.packet);
  if (!fields) return json({ error: "bad packet" }, 400, env);
  const { ok, errors, record } = validate(fields);
  if (!ok) return json({ error: "packet incomplete", details: errors }, 422, env);

  /* Rate limit and dedupe on a hash of the name, not on anything identifying.
     KV is a short-lived queue, never a database of people. */
  if (env.SIGNON_KV) {
    const key = "seen:" + await sha256(record.name.toLowerCase());
    if (await env.SIGNON_KV.get(key)) {
      return json({ error: "that name was submitted recently, check your email" }, 429, env);
    }
    await env.SIGNON_KV.put(key, "1", { expirationTtl: 86400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const branch = "signon/" + today + "-" + (await sha256(record.name)).slice(0, 8);

  const baseRef = await gh(env, `/repos/${REPO.owner}/${REPO.repo}/git/ref/heads/${REPO.base}`);
  await gh(env, `/repos/${REPO.owner}/${REPO.repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: "refs/heads/" + branch, sha: baseRef.object.sha })
  });

  const sig = await getFile(env, "SIGNATORIES.md", REPO.base);
  const heading = record.kind === "system" ? "Systems" : "People";
  const updated = appendRow(sig.text, heading, buildRow(record, today));
  await putFile(env, "SIGNATORIES.md", updated, sig.sha, branch,
    "Sign on: " + record.name);

  if (record.onMap) {
    const groups = await getFile(env, "data/groups.json", REPO.base);
    const data = JSON.parse(groups.text);
    data.groups.push({
      name: record.name,
      kind: record.kind === "system" ? "system" : "signatory",
      label: "record",
      lat: null, lon: null,          /* a person places the pin, not a geocoder */
      place: record.place,
      note: record.means,
      url: record.url || ""
    });
    data.updated = today;
    await putFile(env, "data/groups.json", JSON.stringify(data, null, 2) + "\n",
      groups.sha, branch, "Map: " + record.name);
  }

  const pr = await gh(env, `/repos/${REPO.owner}/${REPO.repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title: "Sign on: " + record.name,
      head: branch,
      base: REPO.base,
      body: [
        "Packet received by the sign-on relay. Nothing here is merged automatically.",
        "",
        "- Kind: " + record.kind,
        record.operator ? "- Operator: " + record.operator : "",
        record.place ? "- Place: " + record.place : "",
        record.onMap
          ? "- Map: yes. **Coordinates are null and must be set by hand** before merging, town or island scale only."
          : "- Map: no",
        body.contact ? "- Reply to: " + clean(body.contact, 120) : "- Reply to: not supplied",
        "",
        "Removal on request, without process."
      ].filter(Boolean).join("\n")
    })
  });

  return json({ ok: true, pr: pr.html_url }, 200, env);
}

async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function cors(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "https://gajra.earth",
    "Access-Control-Allow-Headers": "Content-Type, x-gajra-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}

function json(obj, status, env) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors(env) }
  });
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (err) {
      /* Never echo an internal error back to the sender. */
      console.error(err);
      return json({ error: "could not open the pull request, try email instead" }, 500, env);
    }
  }
};
