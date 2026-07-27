# The sign-on relay

**Status: written, tested, not deployed.** Nothing on the live site points at
this. The site's sign-on composer works today without it, by handing you a
packet that you send yourself from your own email app. This Worker exists for
the day that becomes too much handling by hand.

## What it is

A Cloudflare Worker that receives a sign-on packet, checks its shape, and opens
a pull request against `SIGNATORIES.md` (and `data/groups.json` if the person
asked to be on the map). It never merges. A person reads every packet and clicks
merge, which is both the vetting gate and the audit trail.

## What it deliberately will not do

- Write to `main`. Every change arrives as a branch and a pull request.
- Geocode anybody. Map entries land with `lat` and `lon` set to `null` and a
  note in the pull request saying they must be placed by hand, town or island
  scale. A geocoder would happily turn a street address into a pin, and that is
  exactly the failure this design refuses.
- Keep a database of people. KV holds a hashed name for 24 hours to stop
  duplicate submissions, and nothing else.
- Reach any host except `api.github.com`.
- Echo internal errors back to the sender.

## Shape checks

Packets are plain text, parsed line by line, unknown lines dropped. Every field
is length-capped, control characters and pipe characters are stripped by code
point (a pipe would let a packet forge extra markdown table cells), URLs must be
plain `https://` or they are dropped rather than the signature rejected, and a
system that does not name its operator is refused outright, because that rule is
the point of having a Systems table at all.

## Deploying it, when the time comes

1. `npm install -g wrangler`, then `wrangler login`.
2. Create a KV namespace and bind it as `SIGNON_KV`.
3. Create a **fine-grained** GitHub token scoped to this repository only, with
   Contents: read and write, and Pull requests: read and write. Nothing else.
   `wrangler secret put GITHUB_TOKEN`.
4. `wrangler secret put RELAY_SECRET` and put the same value in the site's fetch
   header. This is not a security boundary on its own; it only keeps casual
   traffic out. The merge step is the real gate.
5. Set `ALLOW_ORIGIN` to the live origin.
6. `wrangler deploy`.

A minimal `wrangler.toml`:

    name = "gajra-signon"
    main = "signon-worker.js"
    compatibility_date = "2026-01-01"

    [vars]
    ALLOW_ORIGIN = "https://gajra.earth"

    [[kv_namespaces]]
    binding = "SIGNON_KV"
    id = "your-namespace-id"

## Wiring the channels

- **Email** works today with no Worker at all: the composer opens the person's
  mail app with the packet written. If you later want it automatic, Cloudflare
  Email Routing can forward a dedicated address to this Worker.
- **SMS and WhatsApp** need a published number, which does not exist yet. The
  composer already writes the packet into an `sms:` or `wa.me` link with the
  recipient left blank. Once a number exists, fill it in and the same packet
  flows to the same place.

## Testing the logic without deploying

The pure helpers (`clean`, `parsePacket`, `buildRow`, `appendRow`) have no
Cloudflare dependencies and can be pulled out of the source and exercised in
plain Node. Worth checking after any edit: a packet containing `|` characters
must not be able to add table cells, and `appendRow` must leave the empty chair
section untouched.
