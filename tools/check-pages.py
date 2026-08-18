"""Structural check for watch.html and ahead.html, run at the end of a routine.

This exists so the daily routines stop composing ad-hoc inline python to verify
their own work. That improvisation is what broke the runs on 17 and 18 August
2026: an inline script grew long enough to need a # comment, and the harness
refuses to auto-approve a command where a newline is followed by a #, because
that shape can hide arguments from path validation. The run died after all the
real work was done, twice.

A file has none of those problems. Comment it freely; the command that runs it
stays short and identical every day:

    python C:/Users/sbt41/githublocal/gajra-earth-claude-build/tools/check-pages.py ahead

Usage: check-pages.py [watch|ahead|both]
Exit 0 if everything passes, 1 if any check fails.
"""
import datetime
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fails = []
notes = []


def read(name):
    with open(os.path.join(ROOT, name), encoding="utf-8") as fh:
        return fh.read()


def check_balanced(tag, s, label):
    o, c = s.count("<" + tag), s.count("</" + tag + ">")
    if o != c:
        fails.append("%s: %d <%s> vs %d </%s>" % (label, o, tag, c, tag))


def parse_date(v, where):
    """YYYY-MM-DD is required by ahead-calendar.js. The brief also permits a
    month with no day in the prose, but the calendar's parser is strict, so
    such an entry silently never appears on it. Allowed, and reported."""
    v = v.strip()
    if re.match(r"^\d{4}-\d{2}$", v):
        notes.append("%s: %s has no day, so it will NOT appear on the calendar" % (where, v))
        return datetime.date.fromisoformat(v + "-28")
    try:
        return datetime.date.fromisoformat(v)
    except ValueError:
        fails.append("%s: not a real date: %r" % (where, v))
        return None


def check_jsonl(name):
    import json
    path = os.path.join(ROOT, name)
    if not os.path.exists(path):
        fails.append("%s: missing" % name)
        return
    n = 0
    with open(path, encoding="utf-8") as fh:
        for i, line in enumerate(fh, 1):
            if not line.strip():
                continue
            try:
                json.loads(line)
                n += 1
            except ValueError as e:
                fails.append("%s line %d is not valid JSON: %s" % (name, i, e))
    notes.append("%s: %d valid records" % (name, n))


def check_ahead():
    s = read("ahead.html")
    check_balanced("article", s, "ahead.html")
    check_balanced("section", s, "ahead.html")
    if 'id="calendar"' not in s:
        fails.append("ahead.html: the calendar section is gone")
    if "<!-- AHEAD:LIST" not in s:
        fails.append("ahead.html: the AHEAD:LIST marker is gone")
    if s.index('id="calendar"') > s.index("<!-- AHEAD:LIST"):
        fails.append("ahead.html: calendar must sit ABOVE the AHEAD:LIST marker")

    arts = re.findall(r'<article class="ev"([^>]*)>', s)
    notes.append("ahead.html: %d entries" % len(arts))
    if not arts:
        fails.append("ahead.html: no entries at all")

    today = datetime.date.today()
    keyed = []
    for a in arts:
        w = re.search(r'data-when="([^"]+)"', a)
        if not w:
            fails.append("ahead.html: an entry has no data-when")
            continue
        start = parse_date(w.group(1), "ahead.html data-when")
        for attr in ("data-ends", "data-closes"):
            m = re.search(attr + r'="([^"]+)"', a)
            if m:
                parse_date(m.group(1), "ahead.html " + attr)
        d = re.search(r'data-days="([^"]+)"', a)
        if d:
            for part in d.group(1).split(","):
                parse_date(part, "ahead.html data-days")
        cl = re.search(r'data-closes="([^"]+)"', a)
        end = re.search(r'data-ends="([^"]+)"', a)
        sort_on = cl.group(1) if cl else (end.group(1) if end else w.group(1))
        last = parse_date(sort_on, "ahead.html sort key")
        keyed.append(last or datetime.date.max)
        if last and last < today:
            fails.append("ahead.html: an entry has already passed (%s) and should have moved to ahead/index.html" % sort_on)

    # Reported, not failed. "The date that matters" is genuinely ambiguous for a
    # door that runs several sessions: Charlotte opens 2 September and shuts on
    # the 29th, so sorting it by its closing date buries the first four sessions.
    # Flag it for a human and let the routine place it.
    if keyed != sorted(keyed):
        n_out = sum(1 for i in range(1, len(keyed)) if keyed[i] < max(keyed[:i]))
        notes.append("ahead.html: %d entries sit outside strict soonest-first order, worth an eye" % n_out)

    heads = re.findall(r"<h3>(.*?)</h3>", s, re.S)
    plain = [re.sub(r"<[^>]+>", "", h).strip() for h in heads]
    dupes = set(h for h in plain if plain.count(h) > 1)
    if dupes:
        fails.append("ahead.html: duplicate entry headings: %s" % ", ".join(sorted(dupes)))

    doors = s.count("chip door") - 1
    notes.append("ahead.html: %d open doors" % max(doors, 0))
    check_jsonl("data/ahead.jsonl")


def check_watch():
    s = read("watch.html")
    check_balanced("article", s, "watch.html")
    check_balanced("section", s, "watch.html")
    if "WATCH:INSERT" not in s:
        fails.append("watch.html: the WATCH:INSERT marker is gone")

    entries = s.count('<article class="entry"')
    notes.append("watch.html: %d entries" % entries)
    heads = re.findall(r"<h2>(.*?)</h2>", s, re.S)
    dated = [h.strip() for h in heads if re.search(r"\d{4}", h)]
    notes.append("watch.html: %d dated sections, newest %s" % (len(dated), dated[0] if dated else "none"))
    if len(dated) > 30:
        fails.append("watch.html: %d dated sections, over the ~30 cap, roll the oldest to a month page" % len(dated))

    for a in re.findall(r'<article class="entry" data-k="([^"]*)"', s):
        if not a.strip():
            fails.append("watch.html: an entry has an empty data-k")
    check_jsonl("data/watch.jsonl")


def main():
    which = (sys.argv[1] if len(sys.argv) > 1 else "both").lower()
    if which in ("ahead", "both"):
        check_ahead()
    if which in ("watch", "both"):
        check_watch()

    for n in notes:
        print("  " + n)
    if fails:
        print("")
        for f in fails:
            print("FAIL  " + f)
        print("\n%d check(s) failed." % len(fails))
        return 1
    print("\nAll structural checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
