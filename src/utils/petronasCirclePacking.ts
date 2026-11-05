import { isPetronasBd, MAX_BD_STACK_LAYERS } from '../data/petronas';
import type { SearchItem, SearchResult, SearchVariant } from './petronasSearch';

/**
 * Circular floor nesting for Petronas BD pails.
 *
 * A cylinder occupies a disk, not its axis-aligned bounding square. We test
 * square and triangular/hexagonal row lattices in both axes, optionally with
 * staggered row starts. Only actual center-to-center distances reject drums.
 * Boxes are then filled conservatively in rectangular regions OUTSIDE every
 * occupied drum's bounding square; this avoids circular/rectangular overlap
 * without claiming an unverified packing.
 *
 * Rows of identical BD pails are stacked at most three high (or fewer when
 * constrained by the container's internal height and gross weight).
 */
export interface CircularPattern {
  primarySkuId: string;
  axis: 'x' | 'y';
  stagger: boolean;
  alternateFirst: boolean;
  fraction: number;
}

interface Rect { x: number; y: number; w: number; d: number }
interface CircleColumn { cx: number; cy: number; radius: number; skuId: string }
const EPS = 1e-6;
const MAX_OBJECTS = 850;
const MAX_RECTS = 220;
const MIN_AREA = 0.0001;

const rectIntersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS &&
  a.y < b.y + b.d - EPS && b.y < a.y + a.d - EPS;
const contains = (a: Rect, b: Rect) =>
  a.x <= b.x + EPS && a.y <= b.y + EPS &&
  a.x + a.w >= b.x + b.w - EPS && a.y + a.d >= b.y + b.d - EPS;

const subtractRect = (regions: Rect[], used: Rect): Rect[] => {
  const candidates: Rect[] = [];
  for (const r of regions) {
    if (!rectIntersects(r, used)) { candidates.push(r); continue; }
    if (used.x > r.x + EPS) candidates.push({ x: r.x, y: r.y, w: used.x - r.x, d: r.d });
    if (used.x + used.w < r.x + r.w - EPS) candidates.push({
      x: used.x + used.w, y: r.y, w: r.x + r.w - used.x - used.w, d: r.d,
    });
    if (used.y > r.y + EPS) candidates.push({ x: r.x, y: r.y, w: r.w, d: used.y - r.y });
    if (used.y + used.d < r.y + r.d - EPS) candidates.push({
      x: r.x, y: used.y + used.d, w: r.w, d: r.y + r.d - used.y - used.d,
    });
  }
  const out = candidates.filter((r, i) =>
    r.w * r.d > MIN_AREA && !candidates.some((other, j) =>
      j !== i && contains(other, r) && (!contains(r, other) || j < i)));
  return out.sort((a, b) => b.w * b.d - a.w * a.d || a.y - b.y || a.x - b.x).slice(0, MAX_RECTS);
};

const lattice = (
  width: number, depth: number, diameter: number, spacing: number,
  axis: 'x' | 'y', stagger: boolean, alternateFirst: boolean,
): { cx: number; cy: number }[] => {
  const pitch = diameter + spacing;
  const rowPitch = stagger ? pitch * Math.sqrt(3) / 2 : pitch;
  const rowSpan = axis === 'y' ? depth : width;
  const colSpan = axis === 'y' ? width : depth;
  const points: { cx: number; cy: number }[] = [];
  // Every drum stays inside its real circular diameter, including near walls.
  for (let row = 0; diameter + row * rowPitch <= rowSpan + EPS; row++) {
    const shift = stagger && (row % 2 === (alternateFirst ? 0 : 1)) ? pitch / 2 : 0;
    for (let col = 0; diameter + shift + col * pitch <= colSpan + EPS; col++) {
      const across = diameter / 2 + shift + col * pitch;
      const along = diameter / 2 + row * rowPitch;
      points.push(axis === 'y' ? { cx: across, cy: along } : { cx: along, cy: across });
    }
  }
  return points;
};

const limitLayers = (
  item: SearchItem, height: number, stack: boolean,
  count: number, currentWeight: number, capacity: number, alreadyPlaced: number,
): number => {
  const byHeight = Math.floor((height + EPS) / item.dimensions.height);
  const byStack = stack ? (isPetronasBd(item.id) ? MAX_BD_STACK_LAYERS : 1) : 1;
  const byQuantity = item.maxQuantity === null ? MAX_OBJECTS : item.maxQuantity - count;
  const byPayload = item.weight > 0 ? Math.floor((capacity - currentWeight + EPS) / item.weight) : MAX_OBJECTS;
  return Math.max(0, Math.min(byHeight, byStack, byQuantity, byPayload, MAX_OBJECTS - alreadyPlaced));
};

export const searchCircularPailLayout = (
  container: { width: number; depth: number; height: number; maxWeight: number },
  items: SearchItem[],
  options: { spacingMm: number; allowStacking: boolean },
  pattern: CircularPattern,
): SearchResult => {
  const spacing = Math.max(0, Math.min(100, options.spacingMm));
  const primary = items.find(item => item.id === pattern.primarySkuId && item.type === 'cylinder');
  const counts = Object.fromEntries(items.map(item => [item.id, 0])) as Record<string, number>;
  if (!primary) return { placements: [], counts, volume: 0, weight: 0 };
  const placements: SearchResult['placements'] = [];
  const circles: CircleColumn[] = [];
  let weight = 0, volume = 0;

  const add = (item: SearchItem, variant: SearchVariant, x: number, y: number, count: number) => {
    for (let layer = 0; layer < count; layer++) {
      placements.push({ itemId: item.id, x, y, z: layer * variant.height, rotationZ: variant.rotationZ });
    }
    counts[item.id] += count;
    weight += item.weight * count;
    volume += item.volume * count;
  };

  const placeDrums = (item: SearchItem, maxFraction: number, phase: number) => {
    const diameter = item.dimensions.width;
    const variant = item.variants[0];
    if (!variant || diameter > container.width || diameter > container.depth) return;
    const points = lattice(container.width, container.depth, diameter, spacing,
      pattern.axis, pattern.stagger, phase === 0 ? pattern.alternateFirst : !pattern.alternateFirst);
    const quota = Math.ceil(points.length * maxFraction);
    let addedColumns = 0;
    for (const { cx, cy } of points) {
      if (addedColumns >= quota) break;
      const r = diameter / 2;
      // Disk / disk check using true radii, NOT overlapping AABBs.
      if (circles.some(circle => Math.hypot(cx - circle.cx, cy - circle.cy)
        + EPS < circle.radius + r + spacing)) continue;
      const layers = limitLayers(item, container.height, options.allowStacking,
        counts[item.id], weight, container.maxWeight, placements.length);
      if (layers <= 0) break;
      add(item, variant, cx - r, cy - r, layers);
      circles.push({ cx, cy, radius: r, skuId: item.id });
      addedColumns++;
    }
  };

  placeDrums(primary, pattern.fraction, 0);
  // In multi-SKU requests, the second type of BD may occupy holes between
  // the first SKU's round footprints. Fractions generate alternative mixes.
  for (const item of items) {
    if (item.id !== primary.id && item.type === 'cylinder') placeDrums(item, 1, 1);
  }

  // Generate safe rectangular leftover regions. Subtracting cylinder *AABBs*
  // here is conservative for boxes only; it does NOT constrain round-to-round
  // placement performed above.
  let free: Rect[] = [{ x: 0, y: 0, w: container.width, d: container.depth }];
  for (const circle of circles) {
    const r = circle.radius + spacing / 2;
    free = subtractRect(free, { x: circle.cx - r, y: circle.cy - r, w: 2 * r, d: 2 * r });
  }

  // Fill unused floor bands with upright CX / rectangular BD20L. The
  // remaining rectangles are updated globally after each placement, preventing
  // double occupancy even when two maximal free rectangles overlap.
  for (let step = 0; step < 130 && free.length && placements.length < MAX_OBJECTS; step++) {
    let best: { item: SearchItem; variant: SearchVariant; x: number; y: number; count: number; value: number } | null = null;
    for (const region of free) {
      for (const item of items) {
        if (item.type === 'cylinder') continue;
        for (const variant of item.variants) {
          const neededW = variant.width + spacing, neededD = variant.depth + spacing;
          if (neededW > region.w + EPS || neededD > region.d + EPS) continue;
          let count = options.allowStacking
            ? Math.floor((container.height + EPS) / variant.height) : 1;
          if (isPetronasBd(item.id)) count = Math.min(count, MAX_BD_STACK_LAYERS);
          if (item.maxQuantity !== null) count = Math.min(count, item.maxQuantity - counts[item.id]);
          if (item.weight > 0) count = Math.min(count, Math.floor((container.maxWeight - weight + EPS) / item.weight));
          count = Math.min(count, MAX_OBJECTS - placements.length);
          if (count < 1) continue;
          const score = item.volume * count / Math.max(1, neededW * neededD) +
            0.0001 / Math.max(1, region.w * region.d);
          if (!best || score > best.value) {
            best = { item, variant, x: region.x, y: region.y, count, value: score };
          }
        }
      }
    }
    if (!best) break;
    const b = best;
    add(b.item, b.variant, b.x + spacing / 2, b.y + spacing / 2, b.count);
    free = subtractRect(free, { x: b.x, y: b.y, w: b.variant.width + spacing, d: b.variant.depth + spacing });
  }
  return { placements, counts, volume, weight };
};

/** Grid and hexagonal patterns in both directions, with alternative starting
 * row and partial primary-SKU fills. Bounded, repeatable search.
 */
export const circularPatterns = (items: SearchItem[]): CircularPattern[] =>
  items.filter(item => item.type === 'cylinder').flatMap(item =>
    (['x', 'y'] as const).flatMap(axis =>
      [false, true].flatMap(stagger =>
        [false, true].flatMap(alternateFirst =>
          [1, 0.75, 0.5].map(fraction => ({
            primarySkuId: item.id, axis, stagger, alternateFirst, fraction,
          }))))));
