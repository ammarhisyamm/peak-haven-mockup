# MOQZUNO · Make it look unreal.

MOQZUNO is a creative mockup & 3D product visualization studio. The UI follows the brand guidelines: Midnight Ink surfaces, Electric Lime accents, Hyper Violet highlights, Space Grotesk headlines and DM Sans body text (theme in `tailwind.config.js`).

Interactive 3D packaging mockups in the browser: pick a box, bottle/jar, glass vial, vial + box set or label preset, upload artwork per face, choose a finish, and export a transparent high-resolution PNG.

Built with React 18 + Vite + TypeScript, Tailwind CSS 4, [ReUI](https://reui.io) / shadcn components (Radix, Nova style), Lucide icons, Three.js, @react-three/fiber and @react-three/drei.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

## Editor

- **Edit**: upload one full dieline design (split onto every face automatically) or per-face artwork, pick a material (Matte, Glossy, Kraft, Corrugated, Metallic), base color, custom size, and download the dieline template as SVG.
- **Models**: 100 models in groups like Pacdora: Boxes (tuck end, mailer, gift, window, handle, hanging, hexagon, clear, sleeve & tray, display), Bottles (water, wine, beer, perfume, shampoo, spray, pump, dropper, jerry can...), Food Packaging (pouch, chip bag, can, tin, takeout, paper bag), Containers & Cups & Bowls, Apparel (T-shirt, hoodie, polo, cap, pants, apron, tote), Devices (phone, laptop, tablet, watch, phone case), Prints (book, magazine, brochure, notebook, calendar, poster, paper, card, envelope, folder), Others (lanyard, banner, flag, frame, bucket, barrel, billboard, sign, insert, candle), plus vial sets and labels. Search, group and sub-type filters, saved projects, custom size in mm or inches.
- **Scene**: transparent or solid color, gradients, patterns (dots, blueprint, stripes, checker, waves, confetti, terrazzo, sunburst, memphis) and realistic scenes (wooden table, marble, concrete, linen, beach, terrazzo floor, podiums, studio sweep, dark studio). All procedural, included in exports and videos.
- **Layout**: single, duo, trio, front & back, standing + lying, stack, fan and flat lay arrangements.
- **Video**: record a 360° spin or open/close animation (MP4 or WebM, 4 to 12 s).
- **More**: background color or transparent, lighting environment, brightness, shadows, auto-rotate, export size (1080 to 6K), PNG/JPG, units.
- **Layout of the editor**: top bar (model, undo/redo, export), canvas tools on the left (rotate, pan, zoom, fit, dieline), views and lid slider at the bottom, inspector with tabs docked on the right.
- AI Background / AI Design are not included yet.

## Structure

| File | Purpose |
| --- | --- |
| `src/constants/presets.ts` | Preset catalogue (mm), face order, finishes, units |
| `src/constants/layouts.ts` | Multi-instance layouts and their placement solver |
| `src/lib/objectSpecs.ts`, `src/components/ObjectModels.tsx` | Shape data and builders for the generic models |
| `src/lib/backdrops.ts`, `src/components/SceneBackdrop.tsx` | Gradients, patterns, floors, podiums and studio sweep |
| `src/lib/dieline.ts` | Dieline nets, SVG output, slicing a full design onto faces |
| `src/lib/projects.ts` | Saved projects in IndexedDB |
| `src/state/editor.ts` | Document state with undo/redo history |
| `src/components/PackagingModel.tsx` | Geometry (opening boxes, bottles, vials, sets), materials, textures and disposal |
| `src/components/SceneViewport.tsx` | R3F canvas, lighting, shadows, camera views, PNG capture, video recording |
| `src/components/panels/*` | Edit, Models, Layout, Video and More panels |
| `src/App.tsx` | Editor shell, toolbars, export, dieline modal |
| `src/components/ui/*`, `src/components/reui/*` | ReUI / shadcn components (button, tabs, select, slider, switch, toggle group, tooltip, dialog, badge, icon tile) |
| `src/index.css`, `src/styles/*` | MOQZUNO tokens for the shadcn variables, plus the Nova component style |

## Adding ReUI components

`components.json` points the shadcn CLI at the ReUI registry, so `npx shadcn@latest add @reui/<name>` installs into `src/components`. With the ReUI MCP (`claude mcp add --transport http reui https://mcp.reui.io`) Claude Code can look components up and add them the same way. Colors come from the CSS variables in `src/index.css`, so new components pick up the MOQZUNO palette.

## Notes

- Scale: 1 world unit = 50 mm, then a fit factor keeps the largest dimension between 1.6 and 3 units so tiny labels and big mailers both frame well. The camera re-frames on every preset switch.
- Box faces use Three.js `BoxGeometry` material order `[+X Right, -X Left, +Y Top, -Y Bottom, +Z Front, -Z Back]`.
- Vials are clear glass with an aluminium crimp cap and always show a label band. Vial + box sets place the carton left of its vial; upload the vial label and each box face separately.
- Background: export with a transparent background or flattened onto a solid color.
- Bottle/jar artwork is wrapped on a band centered on the front; its arc follows the image's aspect ratio, so wide artwork wraps further around.
- Textures use `THREE.SRGBColorSpace` and max anisotropy. Retired textures, geometries and materials are disposed explicitly; uploaded object URLs are revoked when replaced or removed.
- Export renders the current view at a 3840 px long edge (capped by the GPU's max texture size) with a transparent background and downloads `{preset-id}-mockup.png`.
- The "city" HDR is fetched from drei's asset CDN. If it can't load (offline), the scene falls back to its direct lights instead of crashing.
