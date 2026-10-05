# Charlie Smiles — personal site

**Live demo:** https://heysmiles.github.io/charlie-smiles-site/ — built from `main` by the Pages workflow on every push.

A portfolio built as a place you enter rather than a page you scroll. Section
one is the landing and the wave: below the landing a low-poly golden-hour
world scrolls up and fills the frame, a wave crashes left to right with a
surfer on its face, the camera dives through the barrel for a beat, and then
rises and turns onto a low-poly Venice beach — where five landmarks are the
doors to the rest of the site.

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

## How the world works

Section one is a **low-poly game world in plain three.js** — the same
architecture as kairui.dev: vertex-coloured geometry (flat-shaded on land,
smooth on the water), one warm directional sun plus a hemisphere, soft fog, a
camera on one continuous spline.
Nothing in it is an image. It lives in `web/src/world/`:

- `World.ts` owns the scene and takes a scroll progress in [0,1]. Lighting:
  the sun as a directional light that casts soft shadows across Venice (its
  shadow camera covers the town; it sits a little higher than the sun in the
  sky so shadows are long but not endless), a hemisphere, an ambient, a fill
  from the shore side, and the sky baked into `scene.environment` at a low
  `scene.environmentIntensity` — that scene-level intensity is the control
  for the environment in this three.js, and left at 1 the bright sky lights
  everything so evenly that no shadow can show.
- `wave.ts` — **the wave is a solid, and it is the sea.** Each cross-section
  is a closed polygon of water (back, crest, lip outside, lip underside, face,
  trough, bed) run through a closed spline and lofted along the wave line with
  shared vertices, so it shades smoothly. Because the lip has two sides the
  tube has a roof with thickness and a real open mouth. The polygon is keyed
  against the break phase `p` (0 swell → 1 whitewater); the break front sweeps
  `p` along the wave and the mesh is rebuilt on the CPU every frame. Its skirt
  extends into the sea and every vertex rides the same swell function the
  ocean shader uses (`oceanH`), so wave and sea are one body of water. It has
  its own shader, lit the way the reference is: near-black body, the sky only
  in glancing angles, the sun's path as a glint, amber where the low sun
  shines through the thin lip (a per-vertex `aLip`), flow lines down the face,
  and matte foam laid over the top (`aFoam`).
- `foam.ts` — spray and froth as soft sprites, each a closed form of the
  phase at its own x, so scrolling back gathers the spray home.
- `ocean.ts` — summed sines with analytic normals (smooth), sky reflection,
  sun path, foam rolling up the beach.
- `mountains.ts` — the Malibu range down the line in three ridges at different
  depths, the near one running off into a low coast, the far one dissolving
  into haze; ridged noise for crests and gullies. Unlit dark mauve.
- `venice.ts` — **Venice Beach from the water**, built from what the place is:
  the very wide flat beach with the bike path snaking through it and the blue
  LA County lifeguard towers along the waterline; Ocean Front Walk with its
  dense row of low, loud buildings (murals, awnings, shopfronts, windows),
  the Erwin and the Venice V rising at Windward, and **the Stan building** —
  the office — a couple of lots south of the Erwin (`stanBuilding`, drawn
  from photos: a white modern block, shopfronts under a long white fascia, a
  glass-railed terrace, two floors of gridded floor-to-ceiling glass in four
  bays between white piers with a warm sheen, four rooftop pop-ups with
  glass-railed decks); tall skinny fan palms along the walk; the Rec Center on the sand — skate park bowls, Muscle Beach's
  blue-and-white gym, handball walls, basketball and paddle-tennis courts;
  the Venice Fishing Pier at Washington to the south (long, straight,
  pilings, round end, lamps, bait shack); far off to the north the **Santa
  Monica Pier** built from its real parts (`santaMonicaPier`) — the wide
  Pleasure Pier carrying Pacific Park and the long narrow Municipal Pier
  running on to sea, on timber pilings; the Hippodrome's domed carousel house
  with turrets, the Playland arcade, Bubba Gump's blue-green house, the
  restaurants, kiosks and tents; the Pacific Wheel on its A-frame with twenty
  gondolas, the West Coaster's yellow track on blue steel around it, the
  Pacific Plunge drop tower, the Sea Dragon, the scrambler; lamps along the
  rails; the harbor office and lookout at the end — and the Marina del Rey
  towers to the south, all unlit and fogged; and far inland, low layered hills in the pink of the eastern sky,
  sitting just under the palm line. Lifeguard towers are the Venice tower as
  photographed: pale aqua, flat overhanging roof, a railed deck across the
  seaward front, a long railed ramp down the north side, X-braced legs, the
  big observation window, number, flag and rescue can. Facades are **drawn
  to canvas textures** (`facadeTexture`): windows with frames, mullions and
  sills, belt courses, shopfront glass, sign boards, doors, murals with
  shapes, cornices, the odd lit window — mapped onto each building's seaward
  face, so the detail minifies through mipmaps and holds still at distance
  where thin geometry shimmered on scroll. Awnings stay geometry. Palms have
  compact rounded fan-palm heads in three tiers over a shag of dead fronds.
  The beach slopes under the water (no cliff at the waterline), and the
  ocean shader's shore break rides that slope: water thinning over wet sand,
  successive foam fronts rolling up with a ragged sheet behind each, and a
  solid white rim at the waterline — keyed to water depth, so it rides the
  swell and is always at the visible edge, thicker than the fronts — with a
  ragged lace fraying back from it into the shallows. Here and there a crest
  stands up and breaks as it reaches the shallows — a thicker white lip, a
  darker steepening face just shoreward of it, a spit of spray — with the
  breaking stretches drifting along the beach over time, never everywhere at
  once. Above the waterline, `swash.ts` is a ribbon over the sand: each front
  sends a thin translucent sheet running up the slope (an analytic run-up,
  different per wave and along the beach) which stalls and drains back. Just
  the sheet, with a little foam riding on it: no wet stain left behind and no
  drawn edge, so the only hard white line on the beach is the sea's own rim.
  It is a small detail, strongest at the waterline and fading to nothing up
  the sand, so the sand shows through and it never reads as a band laid on top.
  The bay curves: north of Venice the shore bends seaward (`shoreAt`) and
  the town runs on through Santa Monica — taller, paler hotels on the bluff,
  the pier — thinning and fogging toward the foot of the range, so the coast
  recedes in perspective instead of stopping. Distances along the beach are
  compressed so it all fits one frame from the water; Windward is `L.veniceX`.
- `doors.ts` — the five door labels. Their placement is on hold until
  Charlie picks which buildings each one belongs to (the cloud version is on
  the `today-sep-8` history if wanted).
- `camera.ts` — one Catmull-Rom path over the whole section (velocity never
  stops at a key): side-on at the water closing in, straight in under the lip
  with the look turning once to face down the line, a beat inside the tube
  with the exit ahead (the reference clip in
  `assets/reference/barrel-reference.mov`), then up out of the mouth and over
  the shoulder to rest off the beach, facing Venice with Windward straight
  ahead (`L.endCam`).
  The break front never stops (`frontAt`), and until the exit the camera's x
  is relative to it, so the wave keeps crashing while the camera keeps
  moving; the frame then eases onto fixed keys facing the sea. There is no
  surfer: the viewer is the one in the tube.
- `sky.ts` — gradient dome with the sun. A real sunset:
  away from the sun (the east, over Venice) a red horizon, the pink belt,
  lavender above it, then cream; toward the sun (the west, over the sea)
  yellow, orange, peach, cream — blended by azimuth. The dome is also
  baked into the scene's environment map. It hazes
  the top of the frame to the landing's cream (screen-space, sky only) so the
  page above and the sky are one surface; the haze lifts once the camera is
  in the tube.

The landing (`ui/Landing.tsx`) is the star, the signature and "surf the
internet" with an arrow. The star is the original clip — three grainy
six-point stars, orange, blue and green, sliding from a row into one burst
and back — but played from a sprite sheet on a canvas (`ui/star.ts`), not
from a `<video>`: phones in low-power mode refuse to autoplay video and show
a play button, and a video's poster showed black behind the star; a sheet of
frames has neither problem, starts when the page does, and is transparent.
Two sheets of 75 frames at 15 fps (`public/brand/star-480.webp` for larger
screens, `star-256.webp` for phones; built from the clip in the browser via
the dev frame sink with `ext=webp&to=brand`; the source clips live in
`public/ref/`, gitignored). The loop lingers in the row before each
gathering: for 3.6 s the three stars turn slowly in place, each a whole
sixth of a turn, easing to rest exactly on the clip's first frame; then the
clip runs through and its last frame hands back to the row. The turning
stars are cut from the clip's first frame itself — each star's top arm is
clear of its neighbours, and a six-point star repeats every sixth, so every
pixel is read from that one clean wedge by symmetry, then trimmed to the
star's silhouette — so they are the clip's own pixels and the seams are no
more than the grain changing. It only runs while on screen and the tab is
visible, and holds its first frame under reduced-motion.

Phones: the landing is `100svh` and the stage `100dvh`, so nothing jumps as
the browser bars come and go; the renderer runs at a pixel ratio of at most
1.5 and a 2048 shadow map on small or touch screens; the camera widens its
field of view in portrait (`World.update`); taps are pointer events with a
move/hold threshold so a scroll never counts as a tap.

The page (`ui/WaveSection.tsx`) is the landing block, then a tall scroll
track with a sticky, viewport-sized stage: the world scrolls up under the
landing like any block and pins when it fills the frame. Progress runs from
the moment the section's top edge enters the viewport, so the wave is already
breaking as it arrives. There is no fade: the stage's top rows *are* the
landing's cream, because every shader (`glsl.ts` `hazeTop`, shared by sky,
sea, wave and sprites) hazes the top of the frame to cream — the sky from
mid-frame up for the whole section, the water only while the stage is
arriving — so the edge between landing and world is invisible and the sunset
reads as the same page.

All of the scroll is yours; nothing auto-scrolls.

**Touching Venice** (`world/interact.ts`, `ui/Overlay.ts`). Once the camera
rests off the beach, a tap reaches into the world. Every mesh carries a
`userData.kind`; the raycaster finds what was hit and each kind answers:
a lifeguard tower's light comes on (fluorescent warm-up flicker, a glow from
the glass) and off again; a building's windows light up (each facade has an
emissive map drawn alongside its texture, every window its own shade, a few
left dark); water throws a crown of droplets and spreading rings; a palm
takes a gust (crown sways, fronds ruffle, a couple of dead fronds drift
down); sand puffs and a **miniature sandcastle** goes up where you tapped
(`world/sandcastle.ts`: packed-sand mound, walled platform, four corner
towers with pointed tops, a keep with crenellations and a gate, a pennant, a
moat scratched round it; the pieces pop up one after another in under a
second, and tapping the castle topples them, sinking and shrinking into the
sand with a puff); the Venice Pier's lamps come on; the Santa Monica Pier
lights up and the Pacific Wheel turns; the hills and the range send up a
flock of white gulls (each its own sprite with a six-frame wingbeat — a
quick downstroke, a slower upstroke, a glide every few beats); the sky grows a **pixel-art cloud** where you tapped
(`world/pixelcloud.ts`: a union of round bumps over a flat base on a cell
grid, drawn to a canvas and shown nearest-neighbour, shaded in bands from the
top surface down — white, cream, peach underside with darker dots, dithered
where the bands meet — on a grid fine enough to read as a drawing rather than
blocks; five puffy formations, no thin ones). A cloud appears whole with a
small settling jiggle; there is no timer, and tapping a cloud removes it, drifting and bouncing
off the sides of the frame, never leaving. Every tap sets off a very small white firework of
pixels at the cursor. All of it runs on the world's clock, so scrolling away
and back finds things as you left them. The sky has no other clouds.

**The sun** sets down the line (`L.sunDir`), over the seaward end of the
range as seen through the mouth of the tube; in the final view it is behind
the camera, lighting Venice gold against the eastern sky.

**One sea.** The ocean shader evaluates its swell in world coordinates, the
same function the wave's skirt rides (`oceanH`), and the skirt sits a little
under the sea surface, so the water you see around the wave is the ocean and
the two meet in one clean line at the wave's foot.

**Everything that moves is a pure function of scroll** — no simulation state —
so scrubbing back runs the wave backwards exactly.

Dev: `window.__p(0.55)` jumps the timeline; `window.__world` is the World.
`POST /__frame?name=x` with a data-URL writes a frame to `web/.frames/` (a
dev-only Vite middleware) for inspecting the world when the preview pane
cannot be screenshotted.

## Known rough edges

- Fonts: Fira Code is open and self-hosted. **Revive 80 Signature and Biro
  Script Plus are commercial** and still need webfont licences before launch.
- The whitewater is still too smooth a mass; it wants a churned surface and
  more froth on top.
- Houses are one box each; the town wants more variety (balconies, stairs,
  signs) and the pier wants its arcade.
- Mobile has not been tuned.
