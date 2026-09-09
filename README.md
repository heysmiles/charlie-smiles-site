# Charlie Smiles — personal site

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

- `World.ts` owns the scene and takes a scroll progress in [0,1].
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
  the Erwin and the Venice V rising at Windward, tall skinny fan palms along
  the walk; the Rec Center on the sand — skate park bowls, Muscle Beach's
  blue-and-white gym, handball walls, basketball and paddle-tennis courts;
  the Venice Fishing Pier at Washington to the south (long, straight,
  pilings, round end, lamps, bait shack); far off, the Santa Monica Pier with
  its wheel to the north and the Marina del Rey towers to the south, unlit and
  fogged; and far inland, low layered hills in the pink of the eastern sky,
  sitting just under the palm line. Lifeguard towers are the LA County tower
  proper (stilts, deck and railing, cabin with a wraparound window band, hip
  roof, ramp with rails, number board, flag); facades carry cornices, belt
  courses, sills, sign boards, doors, balconies and rooftop clutter; palms
  have fan crowns of a dozen-plus fronds, some drooping, a few dead.
  Distances along the beach are compressed so it all fits one frame from the
  water; Windward is `L.veniceX`.
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
- `sky.ts` — gradient dome with the sun, soft sprite clouds. A real sunset:
  away from the sun (the east, over Venice) a red horizon, the pink belt,
  lavender above it, then cream; toward the sun (the west, over the sea)
  yellow, orange, peach, cream — blended by azimuth. The dome is also
  baked into the scene's environment map. It hazes
  the top of the frame to the landing's cream (screen-space, sky only) so the
  page above and the sky are one surface; the haze lifts once the camera is
  in the tube.

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
