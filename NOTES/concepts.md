# Concepts — the site as a place

Captured 2026-08-30. These are Charlie's ideas as given, plus flagged questions.

---

## 0. The opening screen

Straight off the brand doc:

1. The **animated star** large in the middle (replaces the static star in the PDF)
2. **"Charlie Smiles"** below it in the signature wordmark
3. A **scroll cue** with a bouncing arrow
4. Scroll → the wave takes over

Cream `#fff9f5` ground, `#66564A` type. Quiet, warm, still. The calm before the
entire site turns into an ocean.

---

## 1. "How much time do you have?" — the time-slider bio

**Reference:** [getcoleman.com](https://getcoleman.com/) — slider that runs from
*less hard sell* → *more hard sell*.

Same mechanic, different axis. Prompt above the slider reads **"How much time do
you have?"** and the slider runs **one second → one minute**.

- 1 second → `Charlie`
- 60 seconds → a full, verbose, genuinely revealing paragraph about who he is

Everything in between is a real step, not an interpolation — each stop is its own
piece of writing that stands alone. Roughly: 1s, 3s, 5s, 10s, 20s, 30s, 60s.

Open: does the slider position map to *reading time* honestly? (If it says 20
seconds, the text should take ~20 seconds to read. That constraint is good — it
makes the whole thing feel true rather than cute.)

---

## 2. Brooks — the apartment as a room you can walk

An area of the site called **Brooks** (Brooks Ave, Venice).

- Charlie has an **Insta360** and has already made 3D home tours with it
- The apartment is **275 sq ft**, packed deliberately with things that say who he is
- The page **opens with an SD/low-fi rendering of the building from Google Street
  View photos** — you're outside, on the street
- **Click in** → the 360 tour of the room
- Inside, **hotspots** on objects: some open a story, some **link out to another
  part of the site** (a painting hotspot → the art page)

Why it works: the smallness is the point. 275 sq ft of curated objects *is* the
About page, told through stuff instead of adjectives.

Open questions:
- Viewer tech: self-hosted (Pannellum / Marzipano / Three.js) vs. hosted (Kuula,
  Matterport). Self-hosted keeps the brand intact and costs nothing but effort.
- Does the street-view exterior need to be a real 3D reconstruction, or is a
  stylized/painted still with a parallax push-in enough? (Almost certainly the
  latter — cheaper and prettier.)
- Privacy: it's his actual address. Decide how identifiable the exterior gets.

---

## 3. Art — pixels that move, photo that resolves

**Reference:** [syedadam.com/music](https://syedadam.com/music) — the way that
page displays its videos.

- Each physical piece (paintings, sculpture) is **"3Dified" and pixelated** —
  rendered as a moving field of pixels/points rather than a flat thumbnail
- Those pixel fields **move the way the music videos move** on the reference page
- **Click one** → the top of the page populates with a **real photograph** of the
  piece plus its description; the moving pixel gallery is **pushed down**
- Selecting a different piece **swaps the top region** without a page change

Technically this is a photo + a depth map driving a particle displacement — the
depth map can be generated from the photo. Charlie supplies the source photos.

Open: how many pieces are there, and do good photographs of them exist yet? That
number quietly decides the whole layout.

---

## 4. The wave — the homepage

**Reference:** [kairui.dev](https://kairui.dev/) — scrolling into an adventure,
and the hyper-zoom when you reach the bottom.

The sequence:

1. A wave **about to barrel**, held static. Heading over it.
2. Scroll → **heading falls away**. Below the wave is open sea, as if the whole
   site is about to be inside this environment.
3. Keep scrolling → the wave **crashes and barrels**, scrubbed to scroll
   position. Camera **zooms in dynamically** as it goes.
4. Near the bottom → a **surfer pops out** of the barrel.
5. Keep scrolling → instead of scrolling further down, the camera **hyper-zooms**
   through — and you are now looking at the **Venice coastline from the point of
   view of the ocean.**

**Scroll is a scrubber, not a trigger.** Scroll up and the wave runs backwards.
The whole thing is bidirectional and reversible, like the opening of kairui.dev.

**Realism target:** somewhat realistic — *GTA level*, not photoreal. Stylized
enough to be a world, real enough to feel like water.

Fallback: Higgsfield (or similar generative video) may be used to produce parts of
the scroll animation if hand-built 3D can't get there.

### The coastline — where you land

From the water, looking at Venice, these are the destinations:

| Landmark | Leads to |
| --- | --- |
| Santa Monica Pier | **unassigned — needs a home** |
| Venice Skate Park | photography |
| Brooks (his house) | the apartment tour → physical art |
| Stan (where he works) | professional work / experience |
| Breakwater (surf spot) | photography |

You can either **scroll into** each one or **select** it, and each hyper-zooms
into its own page — the same move as the wave's hyper-zoom, reused as the site's
universal transition verb.

**Provisional mapping now in the build** (Charlie has not signed off on this —
it was chosen so the scene had five working doors):
Pier → the time-slider bio · Breakwater → photography · Skate Park →
videography · Brooks → the apartment · Stan → work.

⚠️ **Conflicts to resolve:**
- **Photography is assigned twice** — Breakwater in the first list, Venice Skate
  Park in the second. One of them should take something else.
- **Santa Monica Pier has no destination.** Candidates that currently have no
  door on the coastline: music, videography, AI art, the newsletter, dev
  projects, and the "how much time do you have?" bio.
- That's the real gap: **five landmarks, and more than five things to show.**
  Either the coastline gets more landmarks, or some sections live one level
  deeper (e.g. dev projects inside Stan; music inside Brooks).

---

## Reference sites

| Site | What to take |
| --- | --- |
| [getcoleman.com](https://getcoleman.com/) | the sliding self-description; adapt to a time axis |
| [kairui.dev](https://kairui.dev/) | scroll-as-camera, and the hyper-zoom transition |
| [syedadam.com/music](https://syedadam.com/music) | the moving-tile gallery → detail-panel interaction |


---

## Status — 2026-09-08 — back to Saturday's build, plus the Malibu range

Charlie rolled the day back: `main` is Saturday evening's build (0315f1c) plus
only the Malibu range from today (`web/src/world/mountains.ts`, the mauve,
unfogged version). Everything else tried today — deep long tube, world-space
camera, glassy lip, no-surfer/manual-scroll variants — is parked on the
`today-sep-8` branch for parts.

## Status — 2026-09-04, night — no surfer, no fade, the ride

Charlie: take the surfer out completely; no fade-in reveal — the wave is a
scene *below* the landing that you scroll down to, and once you see it, it
starts breaking; once you're inside the barrel the page auto-scrolls through
it and out to the beach in one or two seconds. Done: surfer deleted; back to
the sticky stage under the landing (the stage's top rows are the landing's
cream via the shared haze, so still no edge; the water haze lifts once the
stage is pinned so the tube's roof stays dark); a locked Lenis ride from 0.6
to the end (and back to the mouth if you scroll up from the beach). Not yet
seen live: the ride, because the preview pane pauses when hidden.

## Status — 2026-09-04, evening — reveal in the shaders, the tube like the clip

Charlie: the seam is gone but the transition is opaque — the wave should be
revealed by scrolling, fading in, with the top of the sunset the same off-white
as the landing; the camera should not look back at the wave — pan from the
side-on straight to inside the barrel, hold there a couple of seconds of
scroll with the surfer, and pan to the beach as he rides out; the camera's
final rest farther back. He attached the inside-the-barrel clip (saved as
`assets/reference/barrel-reference.mov`): camera behind the surfer looking at
the sunlit exit, roof streaked and misted, the surfer rides out at the end.
Done: cream haze moved into every shader (bottom-up reveal, crest last, sky
band kept throughout), camera goes straight in under the lip and turns once,
a long inside-the-tube beat with mouth light and roof mist, the surfer outruns
the break to the mouth, and the rest position is 120 units off the beach.
Watch for: the brief bright wedge as the camera passes under the lip (~0.54).

## Status — 2026-09-04, later — one page, one motion

Charlie: still a seam (the stage's top edge against the landing, spray
clipped); the camera stalls while the wave crashes and vice versa; the beach
is too close; the water is too geometric, wants glistening. Done: the world
is now the fixed backdrop of the whole page with the landing on top and a
cream veil that fades as it scrolls away (nothing to see an edge of); the
break front runs the whole section and the camera path is relative to it
until the exit; shore moved out to z=-200; animated wind ripples on sea and
wave so the sun path breaks into glitter; tube roof reflection kept dark.

## Status — 2026-09-04 — starts on the first scroll, one camera move, a person

Charlie: wave looks good; now (1) the wave should start breaking the second
you scroll past the landing, sit higher with less sky, and fade naturally from
the landing's cream into the sky; (2) one smooth continuous camera move from
the first scroll to the beach — the pivots into the tube and to the shore
were too fast; (3) a real human surfer, not blocks (still from the clip).
Done: progress runs from the section's top edge entering the viewport; crest
in the top fifth of the frame; cream haze in the sky shader; camera on a
single Catmull-Rom spline that swings round to the mouth, in past the surfer,
looks down the line, and exits down the line over the unbroken crest; surfer
built from posed capsules with a shaped board. Also found and fixed why the
roof of the tube read as a cream mass (the lip-glow and lip-foam masks
covered the whole outer lip). Next: beach details / dynamic elements.

## Status — 2026-09-03, later — smoother, and lit like the clip

Charlie, on the low-poly build: better start; now match the game clip's
graphics — smoother, the lip above the horizon at the top of the frame, the
wave part of the ocean not sitting on it, and mid-break from the first scroll.
Done: smooth lofted wave riding the ocean's swell function, own water shader
(near-black body, amber through the lip, sun path, flow lines, matte foam),
sprite spray and clouds, sea with analytic normals and sky reflection, camera
at water level, break front starting mid-frame. Next: the whitewater's surface.

## Status — 2026-09-03 — rebuilt from zero as a game world

Charlie: the sheet architecture was "the wrong base"; build it like
kairui.dev — an actual rendered game world, no generated images. Wireframe:
landing ends → wave section below, taking the frame → crashes left to right
with the surfer → camera pans to shore → beach with houses and palms.
Decisions (asked): low-poly flat-shaded (not voxel), golden hour, try the dive.

Done: plain three.js world in `web/src/world/`, wave as a lofted closed
polygon (a solid with a roofed tube), faceted foam/spray, box surfer, low-poly
beach town, three-chapter camera. The dive came out clean — the mouth frames
the pier and the town — so it stays. Old sheet-wave code deleted.

## Status — 2026-09-02 (superseded)

Charlie's second round of references (four images): a rendered surf-game wave
seen side-on with a *curtain* of falling white water for a lip; the tube
interior at sunset; a rendered beach with houses and palms above the sand; and
a real Venice Beach panorama. Verdict on the previous build: structure good,
render not there. Direction now:

- Side-on shot first (curtain left, surfer right, wave filling the frame),
  barreling left to right; the camera dollies in toward the surfer as the lip
  closes over, turns down the line, rides the tube, then pulls out to the beach.
- Image 2's sunset palette everywhere.
- The beach is a **generated painted plate** (`assets/coast/venice-sunset-plate.png`,
  Nano Banana Pro, 21:9) standing at the end of the tube's mouth, with our sky
  faded through above the rooftops. That replaced the canvas silhouettes.
- New in the wave: a curtain mesh hanging from the cut lip (vertical strands,
  frayed spray top that fades into the sky), lace foam along the crest,
  vertical flow lines on the face, a wake trail behind the board.

## Status — 2026-09-01 (superseded)

Rebuilt the wave after Charlie's verdict ("completely unrealistic") and two new
references. The shot is now **from inside the tube**: the wave stands up beside
you on the left, the lip throws over, and you ride the barrel looking out of
its mouth at the sun and the Venice coastline — then out through the mouth into
the world. Short scroll (330vh). The landing no longer lifts; the ocean rises
over it and the sunset paints in, cream-on-cream.

What made the mouth possible (three things, all needed):
1. The wave ahead of the tube is a **low shoulder** below eye level — it only
   stands up in the last stretch before it throws.
2. The wave line **angles away offshore** ahead of the camera (the peel angle).
3. Through the standing-face phase the sheet is **cut short past the crest** —
   the lip hangs in the air and what falls is spray, not a solid wall.

## Status — 2026-08-30 (superseded)

Section one is built and running (`README.md` at the repo root explains how).
Landing, wave, and coastline reveal all work off a single scroll position.

Reference for the wave motion: `assets/reference/wave-reference.mov` — Charlie's
slow-motion clip of a left-to-right barrel, camera near water level, offshore
wind blowing spray back over the lip. The scene's palette is sampled from it,
which is why the ocean is cold slate against the warm cream landing. That
temperature break is doing real work: the site goes warm paper → cold water →
warm shore across the scroll.

Still open, in rough priority:
1. Which landmark leads where (see above).
2. Real coastline art to replace the canvas stand-ins.
3. The collapse — currently the softest part of the sequence.
4. Mobile choreography.
