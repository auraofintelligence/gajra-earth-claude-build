# GAJRA Earth house style

Written after the fact, on 28 July 2026, because the site had grown 26 font
sizes and three typefaces competing inside single sections. Everything below is
the state of the code now, not an aspiration. If a rule and the code disagree,
the code is the bug.

## Type

**Five steps. There is no sixth.** They live in `:root` in `assets/styles.css`
and nothing sets a size any other way.

| Token | Size | Job |
|---|---|---|
| `--t-sm` | 0.95rem / 15.2px | source lines, dates, table cells |
| `--t-label` | 1rem / 16px | chips, captions, controls, footer links, small print |
| `--t-body` | 1.125rem / 18px | prose. This is the reading size |
| `--t-md` | 1.3rem / 20.8px | h3, leads, notice headings |
| `--t-lg` | 1.6rem / 25.6px | h2, the trinity words, the tagline |
| `--t-hero` | clamp(2.1rem, 6vw, 3.1rem) | h1, the closing question |

The hero cap is 3.1rem for a specific reason: "Joyful Responsible Abundance" is
the longest heading on the site, and it has to hold one line in the masthead.
Raise the cap and the name breaks in half.

Two `em`-relative exceptions, both proportional to a parent by design:
`.ah-earth` (0.56em of the masthead) and `code` (0.95em of its context).

**No heading is ever smaller than body text.** 18px is the floor. This is not a
preference, it is what tired eyes and older readers need.

**No inline `font-size` in HTML.** The one exception is
`archive/ico-era/index.html`, which is a preserved artefact and must never be
edited.

## Typefaces

Three families, each with one job. The failure mode this replaced was a section
showing all three at once: serif heading, mono kicker, sans paragraph.

- **`--display` (Georgia)**: headings, leads, blockquotes, the masthead, the
  trinity words. Anything editorial and large.
- **`--body` (Segoe UI / system)**: prose, h3, buttons, form fields, kickers,
  footer headings, disclosure toggles, prev/next labels.
- **`--mono` (Cascadia Mono)**: machine output only. Timestamps, source URLs,
  code, the honesty chips, table headers, question numbers, the ticker, the
  film slate caption, readonly packet text, the map controls.

If you are reaching for mono to make something look technical, use the body
face instead. Mono means *this came from a machine or a record*.

## Colour

Single theme, night ground, because the aurora needs the dark. No light mode.

`--jasmine` for text, `--jasmine-dim` for secondary, `--faint` for the quietest
notes. `--marigold-hi` for accents and invitations, `--thread` for the gold
rule. `--aurora`, `--oxygen`, `--violet` belong to the kintsugi seams and the
`.aurtext` gradient.

**One shimmer per screen.** `.aurtext` is the moving gradient. It is on the
association name in the masthead and nowhere else on that page. A second
animated gradient in the same view cancels the first.

## Copy

- Australian English. Programmes, not programs. Organisation, not organization.
- **No em dashes.** Use a colon, a semicolon, a comma or a full stop.
- No ranking language. Nothing is "the most valuable" or "the smallest useful
  thing". Every honest answer counts.
- Front-facing copy never narrates how the site was made. No "an earlier draft
  said", no "the first pass at this".
- Nothing is described in the present tense unless it exists. Proposals wear the
  Proposal chip and say so.
- Plain analogies for any large number. Olympic pools, kettles, ferry trips.

## Honesty chips

Four, never mixed, defined on [licence.html](licence.html):

`Record` checkable outside this project · `Proposal` designed, not real ·
`Invitation` open to you now · `Archive` kept, superseded, unedited.

Every chip is a link to that definition, so no page needs a legend explaining
the system. A legend is the site explaining itself instead of doing itself.

## Structure

- Every page is on the prev/next chain, in the footer, and on
  [site-map.html](site-map.html). The site map walks the chain order.
- No page ships alone. Plan the page map before building.
- Readable with JavaScript off. Every interactive thing has a `<noscript>` or a
  static fallback.
- No CDN, no external fonts, no analytics, no cookies, no accounts.

## Cache

Every `<link rel="stylesheet">` carries `?v=N`. **Bump N in every HTML file
whenever `styles.css` changes.** Three review rounds were spent looking at new
markup rendered against an old stylesheet because this was not in place.

```bash
python -c "import io,re,glob;[io.open(f,'w',encoding='utf-8',newline='\n').write(re.sub(r'(styles\.css)\?v=\d+',r'\1?v=15',io.open(f,encoding='utf-8').read())) for f in glob.glob('*.html')+glob.glob('*/*.html')+glob.glob('*/*/*.html')]"
```

## Before pushing

Serve the site, load the changed pages, and check: no horizontal scroll at
375px, no console errors, every internal link resolves, and the sizes on screen
are all from the table above.
