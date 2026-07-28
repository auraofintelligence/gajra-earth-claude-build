# GAJRA Earth house style

Written after the fact, on 28 July 2026, because the site had grown 26 font
sizes and three typefaces competing inside single sections. Everything below is
the state of the code now, not an aspiration. These are defaults with reasons
attached, not commandments: if a rule and the code disagree, work out which one
is wrong before assuming it is the code.

## Type

**Five steps**, in `:root` in `assets/styles.css`. Sizes are set from these
rather than picked by hand. A sixth would want a reason worth writing down
here, which is a higher bar than it sounds.

| Token | Size | Job |
|---|---|---|
| `--t-sm` | 0.95rem / 15.2px | source lines, dates, table cells |
| `--t-label` | 1rem / 16px | chips, captions, controls, footer links, small print |
| `--t-body` | 1.125rem / 18px | prose. This is the reading size |
| `--t-md` | 1.3rem / 20.8px | h3, leads, notice headings |
| `--t-lg` | 1.6rem / 25.6px | h2, the trinity words, the tagline |
| `--t-hero` | clamp(2.1rem, 6vw, 3.1rem) | h1, the closing question |

The hero cap is 3.1rem for a specific reason: "Joyful Responsible Abundance" is
the longest heading on the site and holds one line in the masthead. Raise the
cap and the name breaks in half.

Two `em`-relative exceptions, both proportional to a parent by design:
`.ah-earth` (0.56em of the masthead) and `code` (0.95em of its context).

**Headings sit at or above body text.** 18px is the floor, because tired eyes
and older readers need it to be.

**Sizes live in the stylesheet, not in inline styles**, so the scale stays one
place. `archive/ico-era/index.html` keeps its own, because it is preserved as
shipped and is not edited.

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

**One shimmer per screen.** `.aurtext` is the moving gradient, and a second one
in the same view cancels the first. It currently sits on the association name
in the masthead. If a page wants it somewhere else, that is the trade: one of
them gives it up.

## Copy

- Australian English. Programmes, not programs. Organisation, not organization.
- **No em dashes.** Use a colon, a semicolon, a comma or a full stop.
- Watch the absolutes. Never, always, nobody, only. Most of them are reflexes
  rather than claims, and an absolute in the copy quietly writes a rule the
  site then has to keep. "The word never stands here alone" banned the site
  from discussing joy on its own, which nobody had decided and nobody wanted.
  Some absolutes earn their place: a promise, a rule the project is binding
  itself to, a checkable fact. Those stay.
- Skip the ranking language. "The most valuable" and "the smallest useful
  thing" both rank answers that are not competing.
- Front-facing copy stays out of how the site was made. No "an earlier draft
  said", no "the first pass at this".
- Present tense is for things that exist. Proposals wear the Proposal chip and
  say so in words as well.
- Plain analogies for any large number. Olympic pools, kettles, ferry trips.

## Honesty chips

Four, defined on [licence.html](licence.html). A claim wears one of them, not
two:

`Record` checkable outside this project · `Proposal` designed, not real ·
`Invitation` open to you now · `Archive` kept, superseded, unedited.

Every chip is a link to that definition, so no page needs a legend explaining
the system. A legend is the site explaining itself instead of doing itself.

## Structure

- Every page is on the prev/next chain, in the footer, and on
  [site-map.html](site-map.html). The site map walks the chain order.
- Pages do not ship alone. Plan the page map before building.
- Readable with JavaScript off. Every interactive thing has a `<noscript>` or a
  static fallback.
- No CDN, no external fonts, no analytics, no cookies, no accounts.

## Cache

Every `<link rel="stylesheet">` carries `?v=N`. **Bump N in every HTML file
whenever `styles.css` changes.** Three review rounds went into looking at new
markup rendered against an old stylesheet before this was in place.

```bash
python -c "import io,re,glob;[io.open(f,'w',encoding='utf-8',newline='\n').write(re.sub(r'(styles\.css)\?v=\d+',r'\1?v=15',io.open(f,encoding='utf-8').read())) for f in glob.glob('*.html')+glob.glob('*/*.html')+glob.glob('*/*/*.html')]"
```

## Before pushing

Serve the site, load the changed pages, and check: no horizontal scroll at
375px, no console errors, every internal link resolves, and the sizes on screen
are all from the table above.
