# Agent handover: GAJRA Earth build notes

Workshop document for whichever model or person works on this repo next. Not site copy.
House rules that bind everything here: Australian English, no em dashes anywhere, honesty
chips (Record / Proposal / Invitation / Archive) never mixed, all assets self-hosted, no
CDNs or external fonts, real imagery only (NASA public domain is the vault), the site must
stay readable with JavaScript off.

## Repo situation

- This repo (`gajra-earth-claude-build`) is the Claude-built concept site.
- `GAJRA-earth-infinity` is the ChatGPT/Sol-built rival. Borrowing code either way is
  encouraged, with attribution in the commit message. It is compete-to-combine, not
  compete-to-win. The end site for gajra.earth is not yet decided.
- The original `GAJRA-earth` repo is a separate entity. Never build in it.

## The Earth map engine (assets/earth-map.js)

The hard part is done and verified. Zero dependencies, two views, one texture.

- `assets/earth-4096.jpg` is NASA Blue Marble (December 2004, topo + bathymetry),
  public domain, resized to 4096x2048 (power of two, required for WebGL mipmaps).
  `assets/earth-1600.jpg` is the small poster for noscript fallbacks.
- Globe view: raw WebGL sphere (48 stacks x 96 slices), drag with inertia, wheel and
  pinch zoom, slow idle auto-rotation, auroral fresnel rim in the fragment shader.
  All of it honours `prefers-reduced-motion` (no autorotate, no inertia).
- Flat view: the same texture drawn cover-fit on a 2D canvas with pan and zoom.
- Pins are DOM `<button>` elements positioned each frame, so they are keyboard
  focusable and screen-reader labelled for free. Far-side pins get class `away`.
- No WebGL, lost context, or old browser: it silently becomes flat-only.
- Embed recipe, any page:

      <div data-earth-map data-src="data/whatever.json" data-view="globe">
        <noscript><div class="em-fallback"><img src="assets/earth-1600.jpg" alt="..."></div></noscript>
      </div>
      <script defer src="assets/earth-map.js"></script>

- Data file shape (see `data/groups.json`): `{ "groups": [ { name, kind, label,
  lat, lon, place, note, url } ] }`. `label` is one of the four honesty chips,
  lowercase. Coordinates are town or island scale, never addresses.
- Per-page rollout the plan calls for: festivals that sign on, working group general
  locations, AI labs signed on, data centres, grant and tender labs. Each gets its own
  small JSON file in `data/`, same schema, one embed line. Do not invent entries:
  every pin must trace to a signature or a public record.
- `window.__earthMaps` exposes instances for testing. Verify a change with:
  `__earthMaps[0].renderGlobe()` then `gl.readPixels` in the same task (the drawing
  buffer is not preserved across tasks, a zero read outside the frame is normal).
- Known deliberate limits (fine to extend, in order of value): flat view does not
  wrap at the antimeridian; no pin clustering (irrelevant until there are dozens of
  pins); globe-to-flat toggle does not carry the exact camera across.

### Map neutrality rules (non-negotiable)

Aerial photography only. No political borders, ever, in any view or any future layer.
No OpenStreetMap default tiles or any styled basemap. If higher resolution is ever
needed, NASA GIBS WMTS serves borderless satellite layers, public domain, no API key;
self-host whatever is used. "Every border a bridge."

## Sign-on packet flow (designed, not yet built)

Goal: groups join with no database and no accounts. Pattern proven in
`minjerribah-wildlife-rescue` (Cloudflare Worker at workers.dev).

1. The sign-on page offers three prefilled channels: a `mailto:` link, an SMS body,
   and a WhatsApp `wa.me` link. Each contains the same compact packet, one line of
   JSON the page composes from a small form (name, kind, general place, optional URL,
   consent sentence). The person sends it themselves, so consent is the act of sending.
2. A Cloudflare Worker receives it (email via Email Routing, SMS/WhatsApp via a
   webhook from the chosen provider). The Worker validates shape only: field
   allowlist, length caps, lat/lon sanity, no URLs in free text. Nothing executes.
3. The Worker holds packets in KV as an ephemeral queue and, on approval, opens a
   pull request against `data/groups.json` and `SIGNATORIES.md` via the GitHub API
   (a fine-grained token scoped to this repo only, stored as a Worker secret).
4. Luke merges. Merged means signed, merged means on the map. The PR is the audit
   trail and the vetting gate; nothing lands without a human.
5. Rate limiting: KV counter per sender hash per day. Removal: same channels, the
   word REMOVE plus the name; removal PRs are honoured without process, as the
   licence page already promises.

Privacy lines that must survive any implementation: general locations only, the
packet is exactly what the person typed, no analytics, sender contact details go in
the PR body (private to maintainers) and never into the public JSON.

## Remaining backlog (in Luke's words, reshaped)

- Cherry-pick from `global-founder-atlas` and `straddie-digital-twin-explainer`
  (check local vs GitHub state first, they are new Claude repos) into GAJRA-focused
  pages. No UN backing exists; AI for Good is a likely audience to write toward.
- Starter field kits in the `p4a-xyz-cinema/pages/starter-field-kit.html` mould:
  tech help, public listening stations, no hard sell, meeting people where they are
  and asking what joyful responsible abundance means to them.
- Model economics: routine passes (copy, embeds, new data files, nav edits) belong
  on Sonnet. Save the heavy model for genuinely hard engine or architecture work.

## Verification habit before any push

Statics: every page 200 on `npx serve`, zero em dashes outside `archive/`
(`grep -rn $'—' --include='*.html' --include='*.md' --include='*.js' . | grep -v archive/`),
heading order valid. Dynamics: console clean on index and map, `__earthMaps` pixel
checks, ticker animating, film playing. The launch config is `gajra`, port 4201.
