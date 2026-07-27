# GAJRA Earth

This repository preserves the separate Claude-built July 2026 concept site. It is not the primary `GAJRA-earth` repository.

> 🤝🔷 **A Luke × Claude build.** Created by Luke Nathan Hayes (`auraofintelligence`) and Claude, Fable 5, July 2026. This replaces the ICO-era one-pager, which is preserved unedited at `archive/ico-era/`.

**Live site:** https://auraofintelligence.github.io/gajra-earth-claude-build/

GAJRA Earth is the Global Association for Joyful Responsible Abundance on Earth: an open invitation to everyone building or working with intelligent systems to help define what AI alignment is *for*. A destination, not only brakes. Co-defined in public, one signature at a time, the way a garland is strung: one flower at a time. At planetary scale the garland is the aurora, which is why the association wears the name.

## The site

Eleven static pages, no build step, no framework, no analytics, no accounts. Fully readable with JavaScript off. Committed single-theme night design, because the aurora needs the dark.

- `index.html` : the invitation, the record correction, the trinity, the ask
- `trinity.html` : joyful, responsible, abundant, held together on purpose
- `scales.html` : the garland from one flower to the aurora
- `past.html` / `present.html` / `future.html` : the temporal axis
- `questions.html` : eight open problems, numbered for pull requests
- `sign-on.html` : the pledge and the mechanism
- `archive.html` : what was planned, what did not launch, what was learned
- `licence.html` : terms, honesty labels, contact
- `site-map.html` : everything, no JS required
- `SIGNATORIES.md` : the garland itself. Sign by pull request; merged means signed
- `CONTRIBUTING.md` : signing rules and content house style
- `archive/ico-era/` : the previous site, byte-for-byte, with its licence as shipped

## Run locally

```powershell
npx serve . -l 4201
```

Then open http://localhost:4201/

## Deploy

The repo is GitHub Pages ready and includes `.nojekyll`.

1. **Review the two seed signatures** in `SIGNATORIES.md` before pushing; they are written in your name and the site's.
2. Commit and push to `main`.
3. In the repository settings, ensure Pages serves from `main` at root.
4. The site will be available at `https://auraofintelligence.github.io/gajra-earth-claude-build/`.

## Imagery

The sky is real: `assets/aurora-iss-1080.mp4` and its poster are Aurora Australis photographed from the International Space Station on 17 August 2022, ending over the lights of Perth. NASA Scientific Visualization Studio ([SVS 31281](https://svs.gsfc.nasa.gov/31281/)), public domain. NASA does not endorse this project. The Aura Heart mark (`assets/aura-heart-*.png`) is GAJRA Earth's own.

## Licence

[Public Source Licence](LICENSE): read, learn from and adapt non-commercially with credit. Commercial rights reserved to Luke Nathan Hayes. Signatory lines belong to their authors, always.

---

Strung on Minjerribah, Quandamooka Country. What type of world do you wish for?
