# Charlie Smiles — personal site

A portfolio built as a place you enter rather than a page you scroll. Section
one is the landing and the wave: a golden-hour ocean rises over the cream page,
a wave stands up beside you and throws over, you ride inside the barrel looking
out of its mouth at the sun and the Venice coastline, and then you're out
through the mouth and onto the coast — where five landmarks are the doors to
the rest of the site.

```bash
npm run dev --prefix web
```

Then scroll. `?debug` adds a timeline scrubber; in dev, `window.__p(0.55)` jumps
the timeline from the console and `window.__p(null)` hands it back to the scroll.
`window.__eye = [x, y, z, yaw, pitch]` parks the camera anywhere to inspect the
geometry; `window.__eye = null` releases it.

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
surfer sits, where spray is born — is derived from `front`. The camera is keyed
*relative to the barrel*, so it rides the break like a surfer.

Three things make the view out of the mouth possible, and all three are needed
(see `web/src/three/waveProfile.ts`, `constants.ts` and the `cutAt` function in
`Wave.tsx`): the wave ahead is a low shoulder below eye level; the wave line
angles away offshore ahead of the camera; and in the standing-face phase the
sheet is cut short past the crest so the lip hangs in the air instead of
sealing the tube into a hump.

## What is real and what is standing in

Real: the wave (sheet, falling-lip curtain, crest lace, wake trail), the ocean, the spray, the camera choreography, the brand
(colours and type are from Charlie's brand doc, and the signature wordmark is
vector-extracted from that PDF so no licensed webfont has to ship).

The coastline is a **generated painted plate** — `assets/coast/venice-sunset-plate.png`,
made with Nano Banana Pro to match the rendered-game look of Charlie's beach
reference, served as `web/public/coast/venice.jpg`. It stands at the end of the
tube's mouth (`web/src/three/Coastline.tsx`); our sky is faded through above
the rooftops and its water sits under our ocean so the sand meets the sea.
Landmarks are placed in the plate's own coordinates.

Also provisional: which landmark leads where. Santa Monica Pier is currently
pointed at the "how much time do you have?" bio, and the Skate Park at
videography, but that mapping is Charlie's call — see `NOTES/concepts.md`.

## Known rough edges

- Fonts: Fira Code is open and self-hosted. **Revive 80 Signature and Biro
  Script Plus are commercial** and still need webfont licences before launch.
  The wordmark sidesteps this by being an SVG path; live accent text does not.
- The whitewater behind the tube and the spray off the hanging lip are the
  softest parts of the picture.
- Mobile runs at reduced mesh and particle counts (`web/src/three/constants.ts`)
  but the choreography has not been tuned for a phone's field of view yet.
- The JS bundle is ~310 kB gzipped, nearly all three.js.
