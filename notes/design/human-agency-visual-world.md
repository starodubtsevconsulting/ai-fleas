# SC and AI Fleas visual world: informed human agency

Search terms: UX design, visual identity, artwork, footer gallery, image carousel, geometric architectural surrealism, human–AI agency, Who’s in Control.

## Concept

A shared visual world for Starodubtsev Consulting and AI Fleas. Monumental human-shaped architecture represents the human context within which small AI helpers operate. Humans retain understanding, direction, ownership and the ability to change course. Robots support purposeful human work; they do not replace human judgment or depict surveillance, domination or passive humans.

Origin: AI Fleas' `notes/articles/2026-10-08-manifesto-for-informed-human-agency.md` (Who’s in Control?), and `notes/articles/assets/2026-10-11-travel-skill-geometric-header-candidate-v2.provenance.md`. The airport illustration extends the same world to a practical journey and reusable assistance.

## Visual direction

Geometric architectural surrealism; monumental abstract heads integrated into useful spaces; tiny camera-like walking robot helpers; human-scale activities; warm cream paper, charcoal structures, pale blue planes and restrained orange/vermillion accents. Matte grain, crisp architectural shadows and thoughtful editorial compositions. Landscape 16:9, no labels, slogans, logos or watermarks. Vary viewpoint, activity and composition; recoloring or cropping is not a new scene.

## Website UX

The SC website footer contains a reusable manually browsed image gallery above the legal footer. Scrolling down reveals a substantial artwork scene. Visitors can swipe horizontally, use arrow keys, or choose arrows/dots to browse. No autoplay, forced scrolling or text overlay. Preserve image proportions and respect reduced motion. This artwork belongs to the SC site; it is not shop branding. Keep production release separate from local design review.

Implementation in the sibling `sc-services` product repository: `libs/angular/src/components/image-gallery/image-gallery.component.ts`; composition: `apps/sc-website/sc-website-frontend/src/app/app.component.html`; images: frontend `public/sc-footer-art*.png`.

## Planned extension: eight city scenes

Use only the human-selected personal / Starodubtsev Consulting ChatGPT account. Never use SXM or another corporate account. Verify the visible account before submitting generation work.

Eight variations of the same city world: civic square, elevated walkways, tram avenue, apartment courtyard, urban library plaza, street-level creative studios, crossroads, and rooftop skyline. Keep the architectural surrealism, tiny supporting robots and informed human agency. Do not introduce harbor, rural or unrelated themed scenes.

Status: two supplied source images integrated locally. Additional images generated through an incorrectly selected account are excluded from the gallery and are not approved deliverables. Eight city images subsequently generated through the verified personal account in the original reference conversation, saved and visually inspected. All ten are integrated locally as WebP assets; production release remains pending. Source prompts and file inventory are recorded in `sc-services/docs/design/footer-artwork-provenance.json`.
