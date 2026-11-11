# BasketWise AI — Visual Style Guide (all assets follow this)

Image generation was not available on this plan, so every asset is hand-built SVG (by a generator script)
following one strict style so everything composes into a single coherent supermarket.

## Camera
**High-angle top-down** (~78° looking down) for every asset — one camera, no exceptions. Objects are seen mainly from
above, with a *hint* of their front/side face visible on the **bottom** edge (a thin darker lip), so boxes, cans and
bottles read as 3D objects but all "up" directions agree. Never mix isometric, front-on or flat-icon looks.

## Light
Soft key light from the **top-left**. Highlights on the top-left edges/surfaces; shading on the bottom-right.
Cast shadow: soft blurred ellipse/shape offset **(+5, +6)** units (in a 128-unit box), colour `#2b2118`, opacity ≈ 0.26–0.30.
Add subtle ambient occlusion (a darker inner edge on the bottom/right sides) and one small glossy specular highlight on shiny
materials (plastic, glass, metal, foil).

## Palette
Warm, natural, saturated-but-not-neon. Neutrals: cream `#F6EEDD`, kraft `#C9A06B`, warm gray `#8D8478`, charcoal `#3A342E`.
Brand-like accents per category (use these as the dominant label colour):
bakery `#E0A458`, dairy `#5DA9E9`, meat `#D9534F`, frozen `#6FCBE6`, drinks `#2FB5A6`, produce `#6BBF59`,
grocery `#C98B4A`, snacks `#F26CA7`, household `#7C6FD6`.
No pure black outlines. Edges are drawn with a 1.2–1.8 unit stroke in a darker tone of the fill (≈ 35% darker).

## Detail level
Medium-high: gradients on every surface (linear, top-left light → bottom-right darker), tiny pictograms instead of text
(a wheat ear, a drop, a leaf, a snowflake, a bone...), seams, caps, foil crimps, rims. Recognisable at 40 px, nice at 128 px.
**No readable text, no real brand names/logos.**

## Technical
* Each product icon: `viewBox="0 0 128 128"`, transparent background, object ≈ 86–92% of the box, centered, shadow inside the box.
* Props / fixtures: `viewBox` = (tiles × 72) so that 1 tile = 72 units; e.g. a 4×2-tile pallet is `viewBox="0 0 288 144"`.
* Self-contained SVG 1.1 (inline `<defs>` gradients/filters only, no external refs, no scripts, no `<text>` unless a pictogram needs it).
  Unique ids per file are not required (each file is loaded as its own image).
* Blur filters (`feGaussianBlur`) are allowed for shadows only.
