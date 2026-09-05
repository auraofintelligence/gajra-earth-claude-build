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
        #
        # "Passes" means passes for the READER, not for the machine running this.
        # This repo is scanned in Brisbane, UTC+10, which is the front of the
        # world. A meeting dated D in Oklahoma is still fifteen hours away when
        # the date here has already turned to D+1, and the last timezone on Earth
        # sits 22 hours behind Brisbane. Failing on D+1 tells a run to move an
        # entry to "what already came" for something that has not come, which is
        # a worse error than carrying it one run longer.
        #
        # So the failure needs date D to be over everywhere, which it is by
        # Brisbane D+1 22:00. Rounding to whole days, this fails from D+2. The
        # grace day is reported so a run can see the entry sitting in it and say
        # on the page why it is still there.
        last_on = cl.group(1) if cl else (end.group(1) if end else w.group(1))
        last = parse_date(last_on, "ahead.html last date")
        if last and last < today - datetime.timedelta(days=1):
            fails.append("ahead.html: an entry has already passed (%s) and should have moved to ahead/index.html" % last_on)
        elif last and last < today:
            notes.append(
                "ahead.html: an entry dated %s is in the timezone grace day; it has "
                "passed in Brisbane but not everywhere. Move it next run, and say on "
                "the page why it is still here." % last_on
            )

        # Ordering: the page sorts by the first date a reader could still act on,
        # which is not the retention key. A door whose window opened weeks ago
        # sorts by when it SHUTS; anything whose own start is still ahead sorts by
        # that start. That second half is the point: burying Charlotte's
        # 2 September session under its 29 September closing date would hide four
        # sessions, and Fort Worth's 10 November hearing under a January closing
        # date would hide the hearing people can actually attend.
        # Two refinements on top of that, both added because a run sorted the
        # page correctly and this checker then reported the correct order as
        # wrong.
        #
        # One: a meeting already under way is the most immediate thing on the
        # page and belongs at today, not at the day it started. Sorting the
        # Pacific Islands Forum by its 30 August start put a meeting sitting
        # that morning below a window closing that night.
        #
        # Two: data-days carries the published dates BETWEEN the start and the
        # close, and some of them are real deadlines of their own. Colorado's
        # chatbot rules take comments to 26 October but consider anything sent
        # by 4 September for the revisions put to the hearing, so 4 September is
        # the next date a reader can act on and sorting by October hides it.
        already_open = bool(cl) and start is not None and start < today
        first_on = last_on if already_open else w.group(1)

        running = end and start is not None and start <= today <= (
            parse_date(end.group(1), "ahead.html data-ends") or start
        )
        if running:
            first_on = today.isoformat()
        elif d:
            ahead_days = sorted(
                p for p in d.group(1).split(",")
                if len(p) == 10 and p >= today.isoformat() and p < first_on
            )
            if ahead_days:
                first_on = ahead_days[0]
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
    check_entry_bodies(s)
    check_jsonl("data/ahead.jsonl")


def check_entry_bodies(s):
    """Three things the structural checks above cannot see, each of which has
    slipped past a run before.

    An entry with no working URL should have been dropped, and an entry with no
    place fails the second of the three tests in the routine. Both are easy to
    lose while rewriting a long entry.

    Keywords are supposed to come from data/watch-keywords.json and nowhere
    else, three to eight of them, and the visible chips are supposed to say the
    same thing as data-k. A term invented for one entry makes the archive
    unsearchable in the one way it was built to be searchable, and it is
    invisible on the page, because an invented keyword renders exactly like a
    real one.
    """
    import json

    path = os.path.join(ROOT, "data", "watch-keywords.json")
    try:
        with open(path, encoding="utf-8") as fh:
            vocab = json.load(fh)
    except (IOError, ValueError) as e:
        fails.append("data/watch-keywords.json could not be read: %s" % e)
        return
    allowed = set()
    for group in ("region", "who", "what"):
        allowed |= set(vocab.get(group, []))

    body = s[s.index("<!-- AHEAD:LIST"):]
    for a in re.findall(r'<article class="ev".*?</article>', body, re.S):
        h = re.search(r"<h3>(.*?)</h3>", a, re.S)
        name = " ".join(re.sub(r"<[^>]+>", "", h.group(1)).split())[:50] if h else "(no heading)"
        if 'class="src"' not in a or 'href="http' not in a:
            fails.append("ahead.html: no source URL on %s" % name)
        if 'class="ev-where"' not in a:
            fails.append("ahead.html: no place on %s" % name)

        k = re.search(r'data-k="([^"]*)"', a)
        if not k:
            fails.append("ahead.html: no data-k on %s" % name)
            continue
        keys = k.group(1).split()
        outside = [x for x in keys if x not in allowed]
        if outside:
            fails.append("ahead.html: keywords outside the vocabulary on %s: %s"
                         % (name, ", ".join(outside)))
        if not 3 <= len(keys) <= 8:
            notes.append("ahead.html: %d keywords on %s, the routine says three to eight"
                         % (len(keys), name))
        chips = re.search(r'<p class="keys">(.*?)</p>', a, re.S)
        listed = re.findall(r"<span>([^<]+)</span>", chips.group(1)) if chips else []
        if listed != keys:
            fails.append("ahead.html: the visible keywords do not match data-k on %s" % name)


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
