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
