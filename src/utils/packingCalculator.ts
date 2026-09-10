import { Euler, Matrix4 } from 'three';
import type { ContainerSpec, GridPackingResult, OrientationCandidateResult, OrientationOptimizationResult, PackingObject, RotationDeg, Vector3Mm } from '../types';
import { getRotatedBoundingBox } from './boundingBox';
import { getObjectVolume, isTopUp, isUprightCylinder } from './productGeometry';
import { rotationDegreesToRadians } from './unitConversion';

const EPSILON = 1e-6;
export const MAX_PREVIEW_OBJECTS = 1200;
const volume = (container: ContainerSpec) => { const d = container.internalDimensions; return d.width * d.depth * d.height; };
const countAlong = (available: number, size: number, spacing: number) => Math.max(0, Math.floor((available + spacing + EPSILON) / (size + spacing)));
const empty = (container: ContainerSpec, warning: string): GridPackingResult => ({ countX: 0, countY: 0, countZ: 0, totalQuantity: 0, payloadLimitedQuantity: 0, totalWeight: 0, remainingPayload: container.maxPayloadKg, exceedsPayload: false, volumeUtilizationPercent: 0, positions: [], warning });
const invalidReason = (container: ContainerSpec, object: PackingObject, spacing: number): string | null => {
  if (![...Object.values(object.dimensions), ...Object.values(container.internalDimensions)].every(n => Number.isFinite(n) && n > 0) || !Object.values(object.rotation).every(Number.isFinite) || !Number.isFinite(object.weightKg) || object.weightKg < 0 || !Number.isFinite(spacing) || spacing < 0 || !Number.isFinite(container.maxPayloadKg) || container.maxPayloadKg < 0) return 'Dimensões, peso, folga ou rotação inválidos.';
  if (object.keepTopUp && !isTopUp(object)) return 'Topo inclinado: use Buscar melhor orientação ou ajuste a rotação.';
  return null;
};
const summarize = (container: ContainerSpec, object: PackingObject, counts: [number, number, number], totalQuantity: number, pattern: string, makePositions: (limit: number) => Vector3Mm[]): GridPackingResult => {
  const payloadLimitedQuantity = Math.min(totalQuantity, object.weightKg > 0 ? Math.floor((container.maxPayloadKg + EPSILON) / object.weightKg) : totalQuantity);
  const totalWeight = totalQuantity * object.weightKg;
  const previewTruncated = payloadLimitedQuantity > MAX_PREVIEW_OBJECTS;
  const warnings = [
    totalQuantity === 0 ? 'Produto não cabe no volume útil.' : '',
    totalWeight > container.maxPayloadKg + EPSILON ? 'A capacidade geométrica excede o peso permitido. O preenchimento respeita o limite de carga.' : '',
    previewTruncated ? `Prévia limitada a ${MAX_PREVIEW_OBJECTS} peças; capacidade calculada: ${payloadLimitedQuantity}.` : '',
  ].filter(Boolean);
  return { countX: counts[0], countY: counts[1], countZ: counts[2], totalQuantity, payloadLimitedQuantity, totalWeight, remainingPayload: container.maxPayloadKg - totalWeight, exceedsPayload: totalWeight > container.maxPayloadKg + EPSILON, volumeUtilizationPercent: getObjectVolume(object) * payloadLimitedQuantity / volume(container) * 100, positions: makePositions(Math.min(payloadLimitedQuantity, MAX_PREVIEW_OBJECTS)), pattern, previewTruncated, warning: warnings.join(' ') || undefined };
};

export const calculateGridPacking = (container: ContainerSpec, object: PackingObject, spacingMm = 0): GridPackingResult => {
  const invalid = invalidReason(container, object, spacingMm); if (invalid) return empty(container, invalid);
  const d = container.internalDimensions;
  const b = getRotatedBoundingBox(object);
  const nx = countAlong(d.width, b.width, spacingMm), ny = countAlong(d.depth, b.depth, spacingMm), nz = countAlong(d.height, b.height, spacingMm);
  return summarize(container, object, [nx, ny, nz], nx * ny * nz, 'Grade retangular', limit => {
    const positions: Vector3Mm[] = [];
    for (let z = 0; z < nz && positions.length < limit; z++) for (let y = 0; y < ny && positions.length < limit; y++) for (let x = 0; x < nx && positions.length < limit; x++) positions.push({ x: -d.width / 2 + b.width / 2 + x * (b.width + spacingMm), y: -d.depth / 2 + b.depth / 2 + y * (b.depth + spacingMm), z: b.height / 2 + z * (b.height + spacingMm) });
    return positions;
  });
};

// Hexagonal rows apply only to vertical circular cylinders. Layers remain vertically aligned.
const calculateHexPacking = (container: ContainerSpec, object: PackingObject, spacing: number, transpose: boolean, phase: number): GridPackingResult => {
  const d = container.internalDimensions, diameter = object.dimensions.width, height = object.dimensions.height;
  const across = transpose ? d.depth : d.width, along = transpose ? d.width : d.depth;
  const pitch = diameter + spacing, rowPitch = pitch * Math.sqrt(3) / 2;
  const rowCount = Math.max(0, Math.floor((along - diameter + EPSILON) / rowPitch) + 1);
  const layers = countAlong(d.height, height, spacing);
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const offset = (index + phase) % 2 * pitch / 2;
    return { offset, count: countAlong(across - offset, diameter, spacing) };
  });
  const perLayer = rows.reduce((sum, row) => sum + row.count, 0);
  return summarize(container, object, [rows.reduce((n,r) => Math.max(n,r.count),0), rowCount, layers], perLayer * layers, `Cilindros alternados · ${transpose ? 'Y' : 'X'}`, limit => {
    const positions: Vector3Mm[] = [];
    for (let z = 0; z < layers && positions.length < limit; z++) for (let row = 0; row < rowCount && positions.length < limit; row++) for (let col = 0; col < rows[row].count && positions.length < limit; col++) {
      const a = -across / 2 + diameter / 2 + rows[row].offset + col * pitch;
      const b = -along / 2 + diameter / 2 + row * rowPitch;
      positions.push({ x: transpose ? b : a, y: transpose ? a : b, z: height / 2 + z * (height + spacing) });
    }
    return positions;
  });
};
const compare = (a: GridPackingResult, b: GridPackingResult) => a.payloadLimitedQuantity - b.payloadLimitedQuantity || a.totalQuantity - b.totalQuantity;
export const calculateBestPacking = (container: ContainerSpec, object: PackingObject, spacingMm = 0): GridPackingResult => {
  let best = calculateGridPacking(container, object, spacingMm);
  if (invalidReason(container, object, spacingMm) || !isUprightCylinder(object)) return best;
  for (const transpose of [false, true]) for (const phase of [0, 1]) {
    const candidate = calculateHexPacking(container, object, spacingMm, transpose, phase);
    if (compare(candidate, best) > 0) best = candidate;
  }
  return best;
};

export const findBestOrientation = (container: ContainerSpec, object: PackingObject, spacingMm = 0): OrientationOptimizationResult | null => {
  const rotations: RotationDeg[] = [object.rotation];
  for (const x of [0,90,180,270]) for (const y of [0,90,180,270]) for (const z of [0,90,180,270]) rotations.push({x,y,z});
  const seen = new Set<string>();
  let best: OrientationCandidateResult | null = null, testedCount = 0;
  for (const rotation of rotations) {
    if (object.keepTopUp && !isTopUp(object, rotation)) continue;
    const key = new Matrix4().makeRotationFromEuler(new Euler(...rotationDegreesToRadians(rotation), 'XYZ')).elements.map(n => Math.round(n * 1e6)).join(',');
    if (seen.has(key)) continue;
    seen.add(key); testedCount++;
    const packingResult = calculateBestPacking(container, { ...object, rotation }, spacingMm);
    const candidate = { rotation, packingResult, unusedVolumeMm3: Math.max(0, volume(container) - getObjectVolume(object) * packingResult.payloadLimitedQuantity) };
    if (!best || compare(candidate.packingResult, best.packingResult) > 0) best = candidate;
  }
  return best ? { ...best, testedCount, reason: 'Maior quantidade dentro do limite de carga, depois capacidade geométrica. Compara rotação atual e orientações de 90°, respeitando o topo. Não garante ótimo global.' } : null;
};
