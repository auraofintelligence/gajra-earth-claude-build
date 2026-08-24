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

    # A bare "2026-09" means a day in September that nobody has published yet, so
    # it may honestly sit anywhere inside September and no position within that
    # month is an error. Two things went wrong before this: padding with ljust
    # gave "2026-0900", and "0" sorts after "-", so a month-only entry landed
    # after every dated one in its month and got reported as an ordering error
    # every run. Sort it to the start of the month, then forgive any placement
    # inside that month.
    def sort_key(v):
        return v + "-00" if len(v) == 7 else v

    def out_of_order(prev, cur):
        if prev[0][:7] == cur[0][:7] and (len(prev[1]) == 7 or len(cur[1]) == 7):
            return False
        return prev[0] > cur[0]

    # Headings, in page order, so an ordering complaint can name the two entries
    # involved instead of only counting them.
    titles = [
        re.sub(r"<[^>]+>", "", h).strip()[:60]
        for h in re.findall(r'<article class="ev"[^>]*>.*?<h3>(.*?)</h3>', s, re.S)
    ]

    today = datetime.date.today()
    order = []
    for idx, a in enumerate(arts):
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

        # Retention: an entry stays until its LAST relevant date passes.
        last_on = cl.group(1) if cl else (end.group(1) if end else w.group(1))
        last = parse_date(last_on, "ahead.html last date")
        if last and last < today:
            fails.append("ahead.html: an entry has already passed (%s) and should have moved to ahead/index.html" % last_on)

        # Ordering: the page sorts by the first date a reader could still act on,
        # which is not the retention key. A door whose window opened weeks ago
        # sorts by when it SHUTS; anything whose own start is still ahead sorts by
        # that start. That second half is the point: burying Charlotte's
        # 2 September session under its 29 September closing date would hide four
        # sessions, and Fort Worth's 10 November hearing under a January closing
        # date would hide the hearing people can actually attend.
        already_open = bool(cl) and start is not None and start < today
        first_on = last_on if already_open else w.group(1)
        title = titles[idx] if idx < len(titles) else "(heading not found)"
        order.append((sort_key(first_on), first_on, title))

    # Reported, not failed: adjacent pairs only. Counting every entry that sits
    # below a running maximum cascades, and a single late entry near the top then
    # reports most of the page as out of order, which hides a real slip in noise.
    inversions = [
        (order[i - 1], order[i])
        for i in range(1, len(order))
        if out_of_order(order[i - 1], order[i])
    ]
    for prev, cur in inversions:
        notes.append(
            "ahead.html: out of order, %s (%s) sits above %s (%s)"
            % (prev[2], prev[1], cur[2], cur[1])
        )
    if not inversions and len(order) > 1:
        notes.append("ahead.html: entries are in soonest-first order")

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
