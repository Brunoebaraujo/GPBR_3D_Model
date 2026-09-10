# GPBR 3D Model

Main repository: [Brunoebaraujo/GPBR_3D_Model](https://github.com/Brunoebaraujo/GPBR_3D_Model)

Web-based 3D packing simulator MVP for validating simplified product mock-ups inside a Goodpack MB5 container.

## Stack

- React
- TypeScript
- Vite
- React Three Fiber
- Drei
- Three.js
- npm

## Run Locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL shown by Vite, usually:

```text
http://localhost:5173
```

Create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Open From GitHub Pages

After GitHub Pages is enabled with GitHub Actions as the source, the app will be available at:

```text
https://brunoebaraujo.github.io/GPBR_3D_Model/
```

To enable it:

1. Open the GitHub repository settings.
2. Go to **Pages**.
3. Set **Build and deployment** source to **GitHub Actions**.
4. Run the **Deploy to GitHub Pages** workflow from the **Actions** tab, or push to `main`.

## MVP Features

- Transparent MB5 external and internal usable 3D volumes
- Orbit, zoom, pan, floor grid, and basic lighting
- Add rectangular blocks, cubes, and cylinders
- Select objects directly in the 3D scene
- Edit name, dimensions, weight, position, and rotation
- Validate fitment against MB5 usable dimensions
- Track volume utilization, total payload, remaining payload, and warnings

## Unit System

All UI inputs and displayed values use millimeters and kilograms.

For rendering only:

```text
1000 mm = 1 Three.js unit
```

Unit conversion lives in `src/utils/unitConversion.ts`.

## Project Structure

```text
src/
├── components/
│   ├── Scene3D.tsx
│   ├── MB5Container.tsx
│   ├── PackingObject.tsx
│   ├── Sidebar.tsx
│   ├── ObjectPropertiesPanel.tsx
│   └── StatusPanel.tsx
├── data/
│   └── skus.ts
├── utils/
│   ├── unitConversion.ts
│   └── fitValidation.ts
├── types/
│   └── index.ts
├── styles/
│   └── global.css
├── App.tsx
├── main.tsx
└── vite-env.d.ts
```

## Where To Add Future Features

- New 3D visuals or interactions: `src/components/Scene3D.tsx` and related scene components
- New object types: `src/types/index.ts`, `src/components/PackingObject.tsx`, and object creation logic in `src/App.tsx`
- Fitment and business rules: `src/utils/fitValidation.ts`
- SKU presets and reusable product data: `src/data/skus.ts`
- App-level layout and state orchestration: `src/App.tsx`
- Global styling and layout tokens: `src/styles/global.css`

## Current Scope Limits

This MVP intentionally does not include login, authentication, database storage, CAD upload, physics, drag-and-drop, PDF export, or automatic packing optimization.


## Product studio

Use **Criar produto** to open the dedicated editor. Draw one square, rectangle or circle on the XY plane by dragging, or enter exact millimeter dimensions. Set extrusion height along Z, then choose **Extrudar perfil**. A square extrusion can have an independent height; it is a square-based prism, not necessarily a cube.

In the 3D view, rotate the solid using the transform rings or X/Y/Z degree fields. Camera orbit and object rotation remain separate. Choose a top face from the selector or click a face after enabling **Definir topo**. Green identifies the chosen top and orange its opposite. Cylinders support either flat cap as top. The optional **Manter topo para cima** constraint filters nesting orientations; manual rotation can violate it, but fill is blocked until corrected or optimized.

**Usar no nesting** adds or updates the product and selects it. **Buscar melhor orientação** compares the current rotation plus unique orthogonal orientations; **Preencher Goodpack** previews one selected product with the requested clearance. Product definitions are retained when clearing a fill. Definitions and drafts currently live in the active browser session; refreshing the page resets them.

### Calculation behavior and limits

- Preserves the repository's MB5 specification: usable 1090 × 1437 × 1020 mm, payload 1650 kg. No additional Goodpack SKUs are inferred.
- Rectangular solids use a uniform grid with analytical rotated bounds. Vertical circular cylinders also compare staggered rows in both planar directions and row phases.
- Rank by payload-limited quantity, then geometric capacity. These are heuristic candidates, not a proof of global optimality. Mixed orientations in the same fill, mixed SKUs, irregular profiles, holes and Boolean composition are not supported.
- Actual material volume determines utilization, independent of rotation; cylinder volume uses πr²h. Search utilization uses the payload-limited count. The footer describes only objects currently rendered.
- Fill never exceeds payload. At most 1200 pieces are rendered; the exact computed capacity and truncation warning remain visible.
- Validates container bounds, required top orientation, payload, box collisions and upright cylinder collisions. Tilted cylinders and cylinder/block pairs use conservative oriented envelopes and are labeled as possible overlaps.
- Does not model compression, deformation, load bearing, stability, dunnage or handling restrictions beyond the explicit top constraint and spacing.

### Verification

Run `npm test` for calculation regression coverage and `npm run build` for TypeScript and production compilation. Tests cover top constraints on every face, rotated bounds, payload, cylinder spacing, overlaps, geometric capacity and bounded preview generation.
