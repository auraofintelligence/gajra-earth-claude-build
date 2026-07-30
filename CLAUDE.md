# GAJRA Earth build rules

This repo is the public site for GAJRA Earth: the Global Association for
Joyful Responsible Abundance on Earth, at gajra.earth. Static HTML/CSS/JS,
no framework, no CDN, readable with JavaScript off.

Read [STYLE-GUIDE.md](STYLE-GUIDE.md) before touching copy or CSS, and
[AGENT-HANDOVER.md](AGENT-HANDOVER.md) before touching the map, sign-on flow,
watch routine or worker.

## Voice

The founder spent years training exaggeration out of his own speech. Copy
that overstates is somebody else's register wearing his name, and this
project's archive exists because an earlier era of it overstated what was
happening. So:

- The smaller true claim beats the bigger vague one.
- Watch absolutes (never, always, nobody, only). Most are reflexes. An
  absolute in copy quietly writes a rule the site then has to keep. Keep the
  ones that are promises or checkable facts.
- Watch the antithesis reflex ("X, not Y" / "X rather than Y"). A few earn
  their place as titles and commitments. As a default sentence shape it is a
  tell.
- No em dashes. No ranking language. Australian English. Present tense only
  for things that exist.
- Plain enough to translate: physical images travel, cultural idioms do not.
  If a phrase would confuse a careful translator, replace it.

## Scope

This site stays in its own lane: the trinity, the sign-on, the map, the
asking kit, the watch, the archive. Vocabulary from the founder's other
repositories (Sensorium, digital twins, music-universe lore, speculative
atlases, co-op hubs) does not belong in this site's copy unless he puts it
there himself. Run `python tools/lint.py` to check; it greps for the
cross-project terms alongside the register rules.

## Before pushing

1. `python tools/lint.py` and fix what it reports.
2. Serve locally, load changed pages: no horizontal scroll at 375px, no
   console errors, internal links resolve.
3. If `assets/styles.css` changed, bump `?v=N` in every HTML file (the lint
   checks they all match).
4. Verify claimed changes are in the served page, not just the file.

## Conduct

- Work is committed and pushed to main; the user watches the live Pages site.
- The interview answers on archive.html are the founder's words. Do not edit
  them.
- `archive/ico-era/` is preserved as shipped. Do not edit it.
- MOVE, never delete: watch data rolls to month pages, nothing rolls off
  into nothing.
