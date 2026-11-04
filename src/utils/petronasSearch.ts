/**
 * Petronas two-stage packing search.
 *
 * Stage 1: multi-start 2D MaxRects for upright columns (each column contains
 * one SKU in a fixed XY orientation and uniform, fully supported stacking).
 * Stage 2: pack smaller upright columns into the supported top surface of
 * shorter rectangular columns. There is never a tilted product or overhang.
 *
 * The search is a deterministic bounded heuristic, NOT a global optimum
 * certificate or a physical stacking-strength assessment.
 */
export interface SearchVariant {
  width: number;
  depth: number;
  height: number;
  rotationZ: 0 | 90;
}
export interface SearchItem {
  id: string;
  type: 'block' | 'cube' | 'cylinder';
  dimensions: { width: number; depth: number; height: number };
  volume: number;
  weight: number;
  maxQuantity: number | null;
  priority: number;
  variants: SearchVariant[];
}
export type SearchStrategy = 'volume' | 'balanced' | 'priority' | 'count';
export interface SearchPlacement {
  itemId: string;
  rotationZ: 0 | 90;
  x: number;
  y: number;
  z: number;
}
export interface SearchResult {
  placements: SearchPlacement[];
  counts: Record<string, number>;
  volume: number;
  weight: number;
}

interface Rect { x: number; y: number; w: number; d: number }
interface Stack {
  rect: Rect; // Physical footprint, excluding spacing
  top: number;
  supported: boolean;
}
interface Choice {
  item: SearchItem;
  variant: SearchVariant;
  count: number;
  x: number;
  y: number;
  reservedW: number;
  reservedD: number;
  score: number;
}
const EPS = 1e-7;
const MAX_PACKAGES = 850;
const MAX_FLOOR_STACKS = 90;
const MAX_FREE_RECTS = 160;

const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS
  && a.y < b.y + b.d - EPS && b.y < a.y + a.d - EPS;

const contains = (a: Rect, b: Rect) =>
  a.x <= b.x + EPS && a.y <= b.y + EPS
  && a.x + a.w >= b.x + b.w - EPS && a.y + a.d >= b.y + b.d - EPS;

const splitMaxRects = (rects: Rect[], used: Rect): Rect[] => {
  const candidates: Rect[] = [];
  for (const r of rects) {
    if (!intersects(r, used)) {
      candidates.push(r);
      continue;
    }
    if (used.x > r.x + EPS) candidates.push({ x: r.x, y: r.y, w: used.x - r.x, d: r.d });
    if (used.x + used.w < r.x + r.w - EPS) {
      candidates.push({ x: used.x + used.w, y: r.y, w: r.x + r.w - used.x - used.w, d: r.d });
    }
    if (used.y > r.y + EPS) candidates.push({ x: r.x, y: r.y, w: r.w, d: used.y - r.y });
    if (used.y + used.d < r.y + r.d - EPS) {
      candidates.push({ x: r.x, y: used.y + used.d, w: r.w, d: r.y + r.d - used.y - used.d });
    }
  }
  // MaxRects intentionally keeps overlapping *free* rectangles; each
  // placement is subtracted from every rectangle, so no products overlap.
  const pruned = candidates.filter((r, i) => r.w > EPS && r.d > EPS
    && !candidates.some((other, j) => j !== i && contains(other, r)
      && (!contains(r, other) || j < i)));
  pruned.sort((a, b) => b.w * b.d - a.w * a.d || a.y - b.y || a.x - b.x);
  return pruned.slice(0, MAX_FREE_RECTS);
};

const random01 = (seed: number, a: number, b: number, c: number, d: number) => {
  // Hash, not Math.random: reproducible layouts and tests.
  let x = (seed + 1) * 2654435761 ^ a * 1597334677 ^ b * 3812015801 ^ c * 958689731 ^ d * 1103515245;
  x ^= x >>> 16;
  x = Math.imul(x, 2246822507);
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
};

const availableCount = (
  item: SearchItem,
  variant: SearchVariant,
  freeHeight: number,
  counts: Record<string, number>,
  usedWeight: number,
  maxWeight: number,
  usedObjects: number,
  stacking: boolean,
) => {
  if (variant.height > freeHeight + EPS) return 0;
  let count = stacking && item.type !== 'cylinder' ? Math.floor((freeHeight + EPS) / variant.height) : 1;
  count = Math.min(count, MAX_PACKAGES - usedObjects);
  if (item.maxQuantity !== null) count = Math.min(count, item.maxQuantity - counts[item.id]);
  if (item.weight > 0) count = Math.min(count, Math.floor((maxWeight - usedWeight + EPS) / item.weight));
  return Math.max(0, count);
};

const choose = (
  free: Rect[],
  items: SearchItem[],
  countOf: (item: SearchItem, variant: SearchVariant) => number,
  counts: Record<string, number>,
  occupiedBySku: Record<string, number>,
  strategy: SearchStrategy,
  seed: number,
  spacing: number,
  containerVolume: number,
  W: number,
  D: number,
): Choice | null => {
  let best: Choice | null = null;
  for (let ri = 0; ri < free.length; ri++) {
    const region = free[ri];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      for (let vi = 0; vi < item.variants.length; vi++) {
        const variant = item.variants[vi];
        const reservedW = variant.width + spacing, reservedD = variant.depth + spacing;
        if (reservedW > region.w + EPS || reservedD > region.d + EPS) continue;
        const count = countOf(item, variant);
        if (count <= 0) continue;

        const heightRatio = count * variant.height;
        const density = heightRatio / Math.max(1, containerVolume / (W * D));
        const totalVolume = count * item.volume;
        const areaFit = reservedW * reservedD / (region.w * region.d);
        const xGap = (region.w - reservedW) / Math.max(1, W);
        const yGap = (region.d - reservedD) / Math.max(1, D);
        const shortFit = 1 - Math.min(xGap, yGap);
        const minRemaining = Math.min(region.w - reservedW, region.d - reservedD);
        const distinct = Object.values(counts).filter(n => n > 0).length;
        const pref = (item.priority + seed * 3) % Math.max(1, items.length);

        let score: number;
        if (strategy === 'balanced') {
          score = 3.0 * density - 2.1 * occupiedBySku[item.id] / Math.max(1, containerVolume / items.length)
            + 0.14 * distinct + totalVolume / containerVolume;
        } else if (strategy === 'priority') {
          score = 3 * (items.length - item.priority) + density + totalVolume / containerVolume;
        } else if (strategy === 'count') {
          score = 4 * count / Math.max(1, reservedW * reservedD / 100000) + density * 0.2;
        } else {
          score = 4.2 * density + 4.0 * totalVolume / containerVolume;
        }
        const pattern = seed % 6;
        if (pattern === 0) score += 1.7 * areaFit;
        if (pattern === 1) score += 1.5 * shortFit;
        if (pattern === 2) score += 1.2 * (1 - Math.max(xGap, yGap));
        if (pattern === 3) score += 1.3 * totalVolume / containerVolume * 10;
        if (pattern === 4) score -= 0.0002 * minRemaining;
        if (pattern === 5) score += 0.4 * areaFit + 0.2 * density;
        score += 0.055 * (random01(seed, ri, i, vi, count) - 0.5);
        score += 0.00001 * (items.length - pref);

        // Four free-rectangle corner anchors. This explores compact layouts
        // even when a naive left-bottom-only greedy produces long empty strips.
        const xs = [region.x, region.x + region.w - reservedW];
        const ys = [region.y, region.y + region.d - reservedD];
        for (const x of xs) for (const y of ys) {
          const loc = (seed % 3 === 0 ? (1 - y / Math.max(1, D)) : seed % 3 === 1
            ? (1 - x / Math.max(1, W)) : (1 - (x / Math.max(1, W) + y / Math.max(1, D)) / 2));
          const candidateScore = score + 0.03 * loc;
          if (!best || candidateScore > best.score + EPS) {
            best = { item, variant, count, x, y, reservedW, reservedD, score: candidateScore };
          }
        }
      }
    }
  }
  return best;
};

export const searchUprightLayout = (
  container: { width: number; depth: number; height: number; maxWeight: number },
  items: SearchItem[],
  options: { spacingMm: number; allowStacking: boolean; strategy: SearchStrategy; seed: number },
): SearchResult => {
  const { width: W, depth: D, height: H, maxWeight } = container;
  const spacing = Math.max(0, Math.min(100, options.spacingMm));
  const counts = Object.fromEntries(items.map(item => [item.id, 0])) as Record<string, number>;
  const occupiedBySku = Object.fromEntries(items.map(item => [item.id, 0])) as Record<string, number>;
  const result: SearchPlacement[] = [];
  const stacks: Stack[] = [];
  const containerVolume = W * D * H;
  let volume = 0, weight = 0;
  let free: Rect[] = [{ x: 0, y: 0, w: W, d: D }];

  const add = (item: SearchItem, variant: SearchVariant, x: number, y: number, z: number, count: number) => {
    for (let k = 0; k < count; k++) {
      result.push({ itemId: item.id, rotationZ: variant.rotationZ, x, y, z: z + variant.height * k });
    }
    counts[item.id] += count;
    volume += item.volume * count;
    weight += item.weight * count;
    occupiedBySku[item.id] += item.volume * count;
  };

  // Stage 1: full floor, mixed upright columns, MaxRects remaining floor.
  for (let step = 0; step < MAX_FLOOR_STACKS && free.length && result.length < MAX_PACKAGES; step++) {
    const choice = choose(
      free, items,
      (item, variant) => availableCount(item, variant, H, counts, weight, maxWeight, result.length, options.allowStacking),
      counts, occupiedBySku, options.strategy, options.seed, spacing, containerVolume, W, D,
    );
    if (!choice) break;
    const { item, variant, count, x, y, reservedW, reservedD } = choice;
    const px = x + spacing / 2, py = y + spacing / 2;
    add(item, variant, px, py, 0, count);
    stacks.push({
      rect: { x: px, y: py, w: variant.width, d: variant.depth },
      top: count * variant.height,
      supported: item.type !== 'cylinder' && options.allowStacking,
    });
    free = splitMaxRects(free, { x, y, w: reservedW, d: reservedD });
  }

  // Stage 2: reclaim headroom above SHORTER columns, but never over drums.
  // Each topper lies fully inside ONE supported rectangular column footprint.
  if (options.allowStacking && result.length < MAX_PACKAGES) {
    stacks.sort((a, b) => (H - b.top) * b.rect.w * b.rect.d - (H - a.top) * a.rect.w * a.rect.d);
    for (const stack of stacks) {
      const freeHeight = H - stack.top;
      if (!stack.supported || freeHeight <= EPS) continue;
      let topFree: Rect[] = [{ ...stack.rect }];
      for (let step = 0; step < 24 && topFree.length && result.length < MAX_PACKAGES; step++) {
        const choice = choose(
          topFree, items,
          (item, variant) => availableCount(item, variant, freeHeight, counts, weight, maxWeight, result.length, true),
          counts, occupiedBySku, options.strategy, options.seed + 13, spacing, containerVolume, W, D,
        );
        if (!choice) break;
        const { item, variant, count, x, y, reservedW, reservedD } = choice;
        add(item, variant, x + spacing / 2, y + spacing / 2, stack.top, count);
        topFree = splitMaxRects(topFree, { x, y, w: reservedW, d: reservedD });
      }
    }
  }
  return { placements: result, counts, volume, weight };
};
