"""Number every sentence on a page so corrections cost three characters.

    python tools/lines.py trinity
    python tools/lines.py trinity 12 40      # just that range

Then say "kill 14, reword 31, 32" and the sentence numbers are unambiguous.
Numbers are positional, so re-run after any edit before quoting them again.
"""
import io
import re
import sys

SKIP = re.compile(r'<(script|style|svg|noscript)\b.*?</\1>', re.S | re.I)


def sentences(path):
    s = io.open(path, encoding='utf-8').read()
    body = s[s.index('<main'):s.index('</main>')]
    body = SKIP.sub(' ', body)
    out = []
    for block in re.findall(r'<(h1|h2|h3|p|li|blockquote|figcaption)[^>]*>(.*?)</\1>', body, re.S):
        tag, inner = block
        text = re.sub(r'\s+', ' ', re.sub('<[^>]*>', '', inner)).strip()
        if not text:
            continue
        if tag in ('h1', 'h2', 'h3'):
            out.append((tag.upper(), text))
            continue
        for sent in re.split(r'(?<=[.!?]) +(?=[A-Z"“])', text):
            sent = sent.strip()
            if sent:
                out.append((tag, sent))
    return out


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    name = sys.argv[1]
    path = name if name.endswith('.html') else name + '.html'
    rows = sentences(path)
    lo = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    hi = int(sys.argv[3]) if len(sys.argv) > 3 else len(rows)
    print('%s  (%d sentences)\n' % (path, len(rows)))
    for i, (tag, text) in enumerate(rows, 1):
        if lo <= i <= hi:
            mark = '  ##' if tag.startswith('H') else '    '
            print('%3d%s %s' % (i, mark, text))


if __name__ == '__main__':
    main()
