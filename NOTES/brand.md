# Charlie Smiles — brand kit

Source: `assets/brand/charlie smiles branding 3.pdf` (received 2026-08-30)

## Color

| Role | Hex | Notes |
| --- | --- | --- |
| Background | `#fff9f5` | warm off-white / cream — the site's ground |
| Foreground (text) | `#66564A` | warm brown-taupe, low contrast, soft |
| Accent (star) | orange stipple gradient | pulled from the star artwork, ~`#E86A17` core → `#F2A93B` outer |
| Secondary stars | blue, green | the trio version (`star-stipple-trio-row.png`) |

Contrast note: `#66564A` on `#fff9f5` is roughly 6.4:1 — passes AA for body text.
Any lighter tint of the foreground needs checking before it's used for real text.

## Type

| Role | Face | Notes |
| --- | --- | --- |
| Wordmark | **Revive 80 Signature** | the "Charlie Smiles" signature lockup |
| Heading | **Fira Code** | monospace as a display face — the unusual, defining choice |
| Body | **Fira Code** | same face, smaller |
| Accent | **Biro Script Plus** | handwritten, for annotations / margin notes / labels |

Licensing to sort before launch: Fira Code is open (SIL OFL), fine to self-host.
**Revive 80 Signature and Biro Script Plus are commercial** — need webfont
licenses, or the wordmark gets rendered once as SVG (which sidesteps it for the
lockup but not for live accent text).

## The mark

A stippled / pointillist six-point star. Exists as:

- `star-stipple-logo-6point-512.png` — single orange star, static
- `star-stipple-trio-row.png` — orange + blue + green trio in a row
- `star animation.webm`, `star-trio-loop-transparent.webm` — transparent-background loops
- `star-trio-join-loop.mp4` — the trio joining, opaque

**Hero treatment:** the animated star sits large in the middle of the opening
screen, name below it in the signature, then a scroll cue with a bouncing arrow.
Scrolling past it starts the wave.

## Texture / imagery

The brand doc's illustration strip (dog on books, cowboy in Monument Valley,
spiral over a farmhouse, red monkeys, fire hydrant in waves) is **placeholder
mood, not final art** — but it does set a register: flat, painterly, editorial,
slightly Japanese-woodblock, saturated against the cream ground.

Bottom of the doc has a soft blurred gradient wash (orange / yellow / cool blue).
That aurora-wash is a usable transition device between sections.

## The world's light (decided 2026-09-01)

The ocean world is **golden hour**: cream at the zenith down through peach and
amber to a deep-orange horizon, a low sun, dark navy water with a sun path.
Reference: `assets/reference/game-reference.mov` (a surf game; graphics target)
and `assets/reference/wave-reference.mov` (real; the wave's motion and the
surfer inside). The zenith is the brand cream on purpose — the ocean can sit
on the landing page with no seam.

## Feel, in one line

Warm paper, monospace precision, a handwritten hand in the margins, and one
glowing star made of dust.
