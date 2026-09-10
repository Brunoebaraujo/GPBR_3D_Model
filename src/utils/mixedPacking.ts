import type { ContainerSpec, GridPackingResult, PackingObject, PackingOrientationSummary, PackingPlacement, RotationDeg } from '../types';
import { getRotatedBoundingBox } from './boundingBox';
import { calculateBestPacking, invalidReason, MAX_PREVIEW_OBJECTS } from './packingCalculator';
import { getAllowedRotations, getObjectVolume } from './productGeometry';

type Triple = [number, number, number]; // packing coordinates: X, Y, Z
interface Region { min: Triple; size: Triple }
interface Orientation { rotation: RotationDeg; size: Triple; isSecondary: boolean }
interface Batch { region: Region; orientation: Orientation; counts: Triple; quantity: number }
const EPSILON = 1e-6;
const MAX_BATCHES = 32;
const ORDERS: Triple[] = [[0,1,2], [1,0,2], [0,2,1], [1,2,0], [2,0,1], [2,1,0]];
const product = (v: Triple) => v[0] * v[1] * v[2];
const boundsSize = (object: PackingObject): Triple => {
  const b = getRotatedBoundingBox(object);
  return [b.width, b.depth, b.height];
};
const batchIn = (region: Region, orientation: Orientation, spacing: number): Batch => {
  const counts = region.size.map((length, axis) => Math.max(0, Math.floor((length + spacing + EPSILON) / (orientation.size[axis] + spacing)))) as Triple;
  return { region, orientation, counts, quantity: product(counts) };
};

// Disjoint guillotine residuals. Each cut reserves clearance outside the occupied envelope;
// previously cut axes are restricted to that envelope, so subsequent slabs never overlap.
const residuals = (batch: Batch, spacing: number, order: Triple): Region[] => {
  const used = batch.counts.map((count, axis) => count * batch.orientation.size[axis] + (count - 1) * spacing) as Triple;
  const remainingSize = [...batch.region.size] as Triple;
  const result: Region[] = [];
  for (const axis of order) {
    const offset = used[axis] + spacing;
    const leftover = remainingSize[axis] - offset;
    if (leftover > EPSILON) {
      const min = [...batch.region.min] as Triple;
      const size = [...remainingSize] as Triple;
      min[axis] += offset; size[axis] = leftover;
      result.push({ min, size });
    }
    remainingSize[axis] = used[axis];
  }
  return result;
};

const packResiduals = (main: Batch, orientations: Orientation[], spacing: number, order: Triple): Batch[] => {
  const batches = [main];
  const free = residuals(main, spacing, order);
  while (free.length && batches.length < MAX_BATCHES) {
    // Prefer lower regions. This is a geometric layout, not a load-bearing simulation.
    free.sort((a,b) => a.min[2] - b.min[2] || product(b.size) - product(a.size));
    const region = free.shift()!;
    let best: Batch | null = null;
    for (const orientation of orientations) {
      const candidate = batchIn(region, orientation, spacing);
      if (candidate.quantity && (!best || candidate.quantity > best.quantity)) best = candidate;
    }
    if (!best) continue;
    batches.push(best);
    free.push(...residuals(best, spacing, order));
  }
  return batches;
};

export const calculateMixedPacking = (container: ContainerSpec, object: PackingObject, spacingMm = 0): GridPackingResult => {
  const uniform = calculateBestPacking(container, object, spacingMm);
  const uniformResult = (note: string): GridPackingResult => ({
    ...uniform,
    uniformQuantity: uniform.payloadLimitedQuantity,
    uniformGeometricalQuantity: uniform.totalQuantity,
    addedQuantity: 0,
    placements: uniform.positions.map(position => ({ position, rotation: object.rotation, isSecondary: false })),
    orientationBreakdown: [{ rotation: object.rotation, quantity: uniform.payloadLimitedQuantity, geometricalQuantity: uniform.totalQuantity, isSecondary: false }],
    mixedNote: note,
  });
  if (invalidReason(container, object, spacingMm)) return uniformResult('Corrija os dados ou a orientação principal para combinar posições.');
  const d = container.internalDimensions;
  const region: Region = { min: [0,0,0], size: [d.width, d.depth, d.height] };
  const primary: Orientation = { rotation: object.rotation, size: boundsSize(object), isSecondary: false };
  const main = batchIn(region, primary, spacingMm);
  if (!main.quantity) return uniformResult('A orientação principal não cabe. Use Buscar melhor combinação para escolher outra.');

  // Equivalent envelopes cannot improve a residual. Keep their first allowed orientation.
  const seen = new Set<string>();
  const orientations = getAllowedRotations(object).flatMap(rotation => {
    const size = boundsSize({ ...object, rotation });
    const key = size.map(n => Math.round(n * 1e6)).join(',');
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ rotation, size, isSecondary: size.some((n, i) => Math.abs(n - primary.size[i]) > EPSILON) }];
  });
  let batches = [main], totalQuantity = main.quantity;
  for (const order of ORDERS) {
    const candidate = packResiduals(main, orientations, spacingMm, order);
    const count = candidate.reduce((sum, batch) => sum + batch.quantity, 0);
    if (count > totalQuantity) { batches = candidate; totalQuantity = count; }
  }
  // Never regress from the single-orientation solution (including its hexagonal cylinders).
  if (totalQuantity <= uniform.totalQuantity) return uniformResult('Não foi encontrado ganho nas sobras com os giros permitidos. Mantida a solução de orientação única.');

  const payloadLimitedQuantity = Math.min(totalQuantity, object.weightKg > 0 ? Math.floor((container.maxPayloadKg + EPSILON) / object.weightKg) : totalQuantity);
  let remaining = payloadLimitedQuantity;
  const allowed = batches.map(batch => { const count = Math.min(batch.quantity, remaining); remaining -= count; return count; });
  const orientationBreakdown: PackingOrientationSummary[] = [];
  batches.forEach((batch, index) => {
    const summary = orientationBreakdown.find(item => item.rotation.x === batch.orientation.rotation.x && item.rotation.y === batch.orientation.rotation.y && item.rotation.z === batch.orientation.rotation.z);
    if (summary) { summary.quantity += allowed[index]; summary.geometricalQuantity += batch.quantity; }
    else orientationBreakdown.push({ rotation: batch.orientation.rotation, quantity: allowed[index], geometricalQuantity: batch.quantity, isSecondary: batch.orientation.isSecondary });
  });

  const previewTruncated = payloadLimitedQuantity > MAX_PREVIEW_OBJECTS;
  // Reserve representation for every allowed region in a truncated preview, including rotated extras.
  const budgets: number[] = allowed.map(count => count ? 1 : 0);
  let budgetLeft = Math.min(payloadLimitedQuantity, MAX_PREVIEW_OBJECTS) - budgets.reduce((sum,n) => sum+n,0);
  for (let i = 0; i < budgets.length && budgetLeft > 0; i++) {
    const extra = Math.min(allowed[i] - budgets[i], budgetLeft);
    budgets[i] += extra; budgetLeft -= extra;
  }
  const placements: PackingPlacement[] = [];
  batches.forEach((batch, index) => {
    const { size, rotation, isSecondary } = batch.orientation;
    const limit = budgets[index];
    for (let n = 0; n < limit; n++) {
      const x = n % batch.counts[0];
      const y = Math.floor(n / batch.counts[0]) % batch.counts[1];
      const z = Math.floor(n / (batch.counts[0] * batch.counts[1]));
      placements.push({
        position: {
          x: batch.region.min[0] - d.width / 2 + size[0] / 2 + x * (size[0] + spacingMm),
          y: batch.region.min[1] - d.depth / 2 + size[1] / 2 + y * (size[1] + spacingMm),
          z: batch.region.min[2] + size[2] / 2 + z * (size[2] + spacingMm),
        }, rotation, isSecondary,
      });
    }
  });
  const totalWeight = totalQuantity * object.weightKg;
  const addedQuantity = payloadLimitedQuantity - uniform.payloadLimitedQuantity;
  const warnings = [
    totalWeight > container.maxPayloadKg + EPSILON ? 'A capacidade geométrica excede o peso permitido. A carga prioriza as peças na orientação principal.' : '',
    previewTruncated ? `Prévia parcial de ${placements.length} peças, incluindo as orientações adicionais; capacidade calculada: ${payloadLimitedQuantity}.` : '',
  ].filter(Boolean);
  return {
    countX: main.counts[0], countY: main.counts[1], countZ: main.counts[2],
    totalQuantity, payloadLimitedQuantity, totalWeight, remainingPayload: container.maxPayloadKg - totalWeight,
    exceedsPayload: totalWeight > container.maxPayloadKg + EPSILON,
    volumeUtilizationPercent: getObjectVolume(object) * payloadLimitedQuantity / (d.width * d.depth * d.height) * 100,
    positions: placements.map(placement => placement.position), placements, orientationBreakdown,
    pattern: 'Orientações combinadas', previewTruncated,
    uniformQuantity: uniform.payloadLimitedQuantity, uniformGeometricalQuantity: uniform.totalQuantity, addedQuantity,
    mixedNote: addedQuantity > 0 ? `+${addedQuantity} peças em relação à orientação única com a mesma rotação principal e folga.` : 'Há ganho geométrico, mas o limite de peso impede aumentar a quantidade carregada.',
    warning: warnings.join(' ') || undefined,
  };
};
