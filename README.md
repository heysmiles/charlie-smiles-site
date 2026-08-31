# Charlie Smiles — personal site

A portfolio built as a place you enter rather than a page you scroll. Section
one is the landing and the wave: the cream page lifts away, an ocean is already
running underneath it, a wave barrels past, and the camera comes over the back
of it to find the Venice coastline — where five landmarks are the doors to the
rest of the site.

```bash
npm run dev --prefix web
```

Then scroll. `?debug` adds a timeline scrubber; in dev, `window.__p(0.55)` jumps
the timeline from the console and `window.__p(null)` hands it back to the scroll.

## Layout

```
NOTES/          the braindump, the brand kit, the concept write-ups
assets/         source material — brand PDF, star animation, the surf reference clip
web/            the site
```

## How the wave works

The wave is **real-time 3D, driven entirely by scroll position** — not a
pre-rendered frame sequence. The single rule everything obeys:

> Every part of the wave is a pure function of scroll. No simulation, no stored
> velocities, no particle state.

That is what lets you scroll back up and watch the wave un-break exactly, spray
included. It is worth protecting; the moment something integrates over time, it
stops scrubbing backwards.

The shape comes from `web/src/three/waveProfile.ts`. One cross-section of a wave
is a curve whose surface angle turns twice — once tightly over the crest, then
again as the lip throws forward over the trough. Feed it a single parameter `p`
(0 = unbroken swell, 1 = collapsed whitewater) and you get every stage of a
wave's life from one formula. Those curves are baked into a float texture once,
so the vertex shader gets a position for a lookup instead of a simulation.

A wave *breaks along its length* rather than all at once, so `p` varies across
the wave: `p = (u - front) / breakWidth`. Sliding `front` from one end to the
other is the whole animation. Everything else — where the barrel is, where the
surfer sits, where spray is born — is derived from `front`.

## What is real and what is standing in

Real: the wave, the ocean, the spray, the camera choreography, the brand
(colours and type are from Charlie's brand doc, and the signature wordmark is
vector-extracted from that PDF so no licensed webfont has to ship).

Standing in: **the entire coastline**. The mountains, pier, buildings, palms and
skate bowl in `web/src/three/coastArt.ts` are drawn to canvas at runtime. They
have the right silhouette and the right parallax, and that is all they are for.
They are meant to be replaced with real art.

Also provisional: which landmark leads where. Santa Monica Pier is currently
pointed at the "how much time do you have?" bio, and the Skate Park at
videography, but that mapping is Charlie's call — see `NOTES/concepts.md`.

## Known rough edges

- Fonts: Fira Code is open and self-hosted. **Revive 80 Signature and Biro
  Script Plus are commercial** and still need webfont licences before launch.
  The wordmark sidesteps this by being an SVG path; live accent text does not.
- The collapse into whitewater is the weakest stretch of the sequence — it goes
  soft where it should be violent.
- Mobile runs at reduced mesh and particle counts (`web/src/three/constants.ts`)
  but the choreography has not been tuned for a phone's field of view yet.
- The JS bundle is ~310 kB gzipped, nearly all three.js.
