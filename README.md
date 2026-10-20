# Peak Haven · 3D Packaging Mockup Generator

Interactive 3D packaging mockups in the browser: pick a box, bottle/jar, glass vial, vial + box set or label preset, upload artwork per face, choose a finish, and export a transparent high-resolution PNG.

Built with React 18 + Vite + TypeScript, Tailwind CSS, Lucide icons, Three.js, @react-three/fiber and @react-three/drei.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
```

## Structure

| File | Purpose |
| --- | --- |
| `src/constants/presets.ts` | Preset catalogue (mm), face order, finishes |
| `src/components/PackagingModel.tsx` | Geometry, multi-material mapping, texture loading and disposal |
| `src/components/SceneViewport.tsx` | R3F canvas, studio lights, HDR environment, contact shadows, orbit controls, PNG capture |
| `src/App.tsx` | State, inspector sidebar, upload handlers, export/download |

## Notes

- Scale: 1 world unit = 50 mm, then a fit factor keeps the largest dimension between 1.6 and 3 units so tiny labels and big mailers both frame well. The camera re-frames on every preset switch.
- Box faces use Three.js `BoxGeometry` material order `[+X Right, -X Left, +Y Top, -Y Bottom, +Z Front, -Z Back]`.
- Vials are clear glass with an aluminium crimp cap and always show a label band. Vial + box sets place the carton left of its vial; upload the vial label and each box face separately.
- Background: export with a transparent background or flattened onto a solid color.
- Bottle/jar artwork is wrapped on a band centered on the front; its arc follows the image's aspect ratio, so wide artwork wraps further around.
- Textures use `THREE.SRGBColorSpace` and max anisotropy. Retired textures, geometries and materials are disposed explicitly; uploaded object URLs are revoked when replaced or removed.
- Export renders the current view at a 3840 px long edge (capped by the GPU's max texture size) with a transparent background and downloads `{preset-id}-mockup.png`.
- The "city" HDR is fetched from drei's asset CDN. If it can't load (offline), the scene falls back to its direct lights instead of crashing.
