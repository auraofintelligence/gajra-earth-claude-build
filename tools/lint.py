"""The style guide, executable. Run before pushing:

    python tools/lint.py

Exit 1 on hard failures (register, scope, structure). Warnings are printed
but do not fail, because some absolutes earn their place and a human decides
which.
"""
import glob
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRESERVED = ('archive' + os.sep + 'ico-era')

# Hard failures ------------------------------------------------------------
EM_DASH = '—'
CROSS_PROJECT = re.compile(
    r'\b(sensorium|starseed|xeno-?diplomacy|place mesh|abyss protocol|'
    r'cosmic nexus|uap\b|digital twin)', re.I)
INTENSIFIERS = re.compile(
    r'\b(enormous|massive|vast|profound|revolutionary|unprecedented|'
    r'incredibl\w+|utterly|extremely|truly|genuinely|literally|'
    r'every single|nothing but|by far|game.chang\w+)\b', re.I)
RANKING = re.compile(r'\bthe (most|best|greatest) \w+ (you|anyone|anybody)\b', re.I)
INLINE_SIZE = re.compile(r'style="[^"]*font-size', re.I)
US_SPELLING = re.compile(r'\b(program|organization|center|color|license)s?\b(?![-\w])')
# 'color' and 'license' are legitimate inside CSS/attributes; only prose is
# checked, and licence.html's LICENSE filename reference is allowed via link
# text check below.

# Warnings -----------------------------------------------------------------
ABSOLUTES = re.compile(r'\b(never|always|nobody|no one|everyone|the only)\b', re.I)
ANTITHESIS = re.compile(
    r"\b\w[\w\s']{2,30}?, (?:not|never) [\w\s']{2,30}?(?=[.,;:])"
    r"|\b\w[\w\s']{2,26}? rather than [\w\s']{2,26}?(?=[.,;:])", re.I)


def prose(html):
    body = html[html.index('<main'):html.index('</main>')] if '<main' in html else html
    body = re.sub(r'<(script|style|svg|noscript)\b.*?</\1>', ' ', body, flags=re.S | re.I)
    return re.sub(r'\s+', ' ', re.sub('<[^>]*>', ' ', body))


def main():
    os.chdir(ROOT)
    pages = [f for f in glob.glob('*.html') + glob.glob('*/*.html') + glob.glob('*/*/*.html')
             if PRESERVED not in f]
    fails, warns = [], []

    versions = set()
    for f in pages:
        raw = io.open(f, encoding='utf-8').read()
        text = prose(raw)

        if EM_DASH in raw:
            fails.append('%s: em dash' % f)
        for m in CROSS_PROJECT.finditer(text):
            fails.append('%s: cross-project term "%s"' % (f, m.group(0)))
        for m in INTENSIFIERS.finditer(text):
            fails.append('%s: intensifier "%s"' % (f, m.group(0)))
        for m in RANKING.finditer(text):
            fails.append('%s: ranking language "%s"' % (f, m.group(0)))
        if INLINE_SIZE.search(raw):
            fails.append('%s: inline font-size' % f)
        for m in US_SPELLING.finditer(text):
            fails.append('%s: US spelling "%s"' % (f, m.group(0)))
        for m in re.finditer(r'styles\.css\?v=(\d+)', raw):
            versions.add(m.group(1))

        # broken internal links
        d = os.path.dirname(f)
        for h in set(re.findall(r'href="([^"#][^"]*)"', raw)):
            if h.startswith(('http', 'mailto:')):
                continue
            target = h.split('#')[0].split('?')[0]
            if not os.path.exists(os.path.normpath(os.path.join(d, target))):
                fails.append('%s: broken link %s' % (f, h))

        # structure
        if '<main' in raw:
            b = raw[raw.index('<main'):raw.index('</main>')]
            if b.count('<section') != b.count('</section>'):
                fails.append('%s: unbalanced <section>' % f)
            if sum(l.count('<div') - l.count('</div>') for l in b.split('\n')) != 0:
                fails.append('%s: unbalanced <div>' % f)

        for m in ABSOLUTES.finditer(text):
            i = m.start()
            warns.append('%s: absolute "%s" ...%s...' % (f, m.group(0), text[max(0, i - 30):i + 40]))
        n = len(ANTITHESIS.findall(text))
        if n > 3:
            warns.append('%s: %d antithesis pairs on one page' % (f, n))

    if len(versions) > 1:
        fails.append('styles.css version mismatch across pages: %s' % sorted(versions))

    for w in warns:
        print('warn  ' + w)
    for e in fails:
        print('FAIL  ' + e)
    print('\n%d pages, %d failures, %d warnings' % (len(pages), len(fails), len(warns)))
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
