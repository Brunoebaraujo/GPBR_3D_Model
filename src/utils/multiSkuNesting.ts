import type { ContainerSpec, DimensionsMm, PackingObject, RotationDeg } from '../types';
import { PETRONAS_SKUS, type PetronasSku } from '../data/petronas';
import { getRotatedBoundingBox } from './boundingBox';
import { getAllowedRotations } from './productGeometry';

export interface PetronasSelection {
  skuId: string;
  maxQuantity: number | null;
  grossWeightKg: number | null;
}
export interface MultiSkuOptions {
  spacingMm: number;
  allowTilt: boolean;
  allowStacking: boolean;
}
export interface MultiSkuScenario {
  id: string;
  name: string;
  description: string;
  objects: PackingObject[];
  counts: Record<string, number>;
  totalQuantity: number;
  volumePercent: number;
  knownWeightKg: number;
  weightVerified: boolean;
  warnings: string[];
}
type Strategy = 'volume' | 'balanced' | 'priority' | 'count';
interface Space { x: number; y: number; z: number; w: number; d: number; h: number; supported: boolean }
interface Variant { rotation: RotationDeg; size: DimensionsMm }
interface Entry { sku: PetronasSku; request: PetronasSelection; variants: Variant[]; volume: number; index: number }
interface Candidate { entry: Entry; variant: Variant; score: number }

const MAX_OBJECTS = 850;
const EPS = 0.001;
const STRATEGIES: { id: Strategy; name: string; description: string }[] = [
  { id: 'volume', name: 'Maior ocupação', description: 'Prioriza embalagens de maior volume a cada espaço disponível.' },
  { id: 'balanced', name: 'Mix equilibrado', description: 'Procura distribuir volume igualmente entre os SKUs selecionados.' },
  { id: 'priority', name: 'Priorizar primeiro SKU', description: 'Usa a ordem de seleção para atender primeiro ao SKU mais importante.' },
  { id: 'count', name: 'Mais unidades', description: 'Prioriza embalagens menores; não significa maior ocupação.' },
];

const exactVolume = (sku: PetronasSku) => {
  if (!sku.dimensions) return 0;
  const { width, depth, height } = sku.dimensions;
  return sku.kind === 'cylinder' ? Math.PI * (width / 2) ** 2 * height : width * depth * height;
};

const makeVariants = (sku: PetronasSku, allowTilt: boolean): Variant[] => {
  if (!sku.dimensions) return [];
  const object: PackingObject = {
    id: sku.id, name: sku.label, type: sku.kind, dimensions: sku.dimensions, color: sku.color,
    weightKg: 0, rotation: { x: 0, y: 0, z: 0 }, position: { x: 0, y: 0, z: 0 },
    topFace: '+z', keepTopUp: !allowTilt,
  };
  // Tambores sempre na vertical. Embalagens só tombam com autorização explícita.
  const rotations = sku.kind === 'cylinder' ? [object.rotation] : getAllowedRotations(object);
  const seen = new Set<string>();
  return rotations.map(rotation => {
    const b = getRotatedBoundingBox({ ...object, rotation });
    return { rotation, size: { width: Math.round(b.width), depth: Math.round(b.depth), height: Math.round(b.height) } };
  }).filter(v => {
    const key = [v.size.width, v.size.depth, v.size.height].join(':');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const fits = (space: Space, size: DimensionsMm) =>
  size.width <= space.w + EPS && size.depth <= space.d + EPS && size.height <= space.h + EPS;

const place = (space: Space, size: DimensionsMm, spacingMm: number, canStack: boolean): Space[] => {
  // Três espaços disjuntos: lateral, fundo e acima da peça. A região superior
  // não avança sobre a folga lateral e não existe sobre tambores.
  const reservedW = Math.min(space.w, size.width + spacingMm);
  const reservedD = Math.min(space.d, size.depth + spacingMm);
  const remaining: Space[] = [
    { x: space.x + reservedW, y: space.y, z: space.z, w: space.w - reservedW, d: space.d, h: space.h, supported: space.supported },
    { x: space.x, y: space.y + reservedD, z: space.z, w: reservedW, d: space.d - reservedD, h: space.h, supported: space.supported },
  ];
  if (canStack) remaining.push({
    x: space.x, y: space.y, z: space.z + size.height,
    w: size.width, d: size.depth, h: space.h - size.height, supported: true,
  });
  return remaining.filter(region => region.w > EPS && region.d > EPS && region.h > EPS);
};

const runStrategy = (
  strategy: Strategy, container: ContainerSpec, entries: Entry[], options: MultiSkuOptions,
): MultiSkuScenario => {
  const { width, depth, height } = container.internalDimensions;
  const free: Space[] = [{ x: 0, y: 0, z: 0, w: width, d: depth, h: height, supported: true }];
  const counts = Object.fromEntries(entries.map(entry => [entry.sku.id, 0])) as Record<string, number>;
  const allocatedVolumes = Object.fromEntries(entries.map(entry => [entry.sku.id, 0])) as Record<string, number>;
  const objects: PackingObject[] = [];
  let occupiedVolume = 0;
  let knownWeightKg = 0;
  const knownAllWeights = entries.every(entry => entry.request.grossWeightKg != null && entry.request.grossWeightKg > 0);
  const spacing = Math.max(0, Math.min(100, options.spacingMm));
  while (free.length && objects.length < MAX_OBJECTS) {
    // Base antes do topo: não cria peças suspensas em cima de espaço vazio.
    free.sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);
    const space = free.shift()!;
    const choices: Candidate[] = [];
    for (const entry of entries) {
      if (entry.request.maxQuantity !== null && counts[entry.sku.id] >= entry.request.maxQuantity) continue;
      const weight = entry.request.grossWeightKg ?? 0;
      if (knownWeightKg + weight > container.maxPayloadKg + EPS) continue;
      for (const variant of entry.variants) {
        if (!fits(space, variant.size)) continue;
        let score: number;
        if (strategy === 'balanced') {
          // Comparar espaço consumido POR SKU, não quantidade de unidades distintas.
          score = -allocatedVolumes[entry.sku.id] / (width * depth * height);
        } else if (strategy === 'priority') {
          score = -entry.index * 100;
        } else if (strategy === 'count') {
          score = -entry.volume;
        } else {
          score = entry.volume;
        }
        choices.push({ entry, variant, score });
      }
    }
    if (!choices.length) continue;
    choices.sort((a, b) => b.score - a.score
      || b.entry.volume - a.entry.volume
      || (space.w - a.variant.size.width) * (space.d - a.variant.size.depth)
        - (space.w - b.variant.size.width) * (space.d - b.variant.size.depth));
    const { entry, variant } = choices[0];
    const { sku } = entry;
    const { size } = variant;
    const obj: PackingObject = {
      id: `petronas-${strategy}-${objects.length}`,
      type: sku.kind,
      name: sku.label,
      dimensions: sku.dimensions!,
      weightKg: entry.request.grossWeightKg ?? 0,
      color: sku.color,
      rotation: variant.rotation,
      position: {
        x: space.x + size.width / 2 - width / 2,
        y: space.y + size.depth / 2 - depth / 2,
        z: space.z + size.height / 2,
      },
      topFace: '+z',
      keepTopUp: !options.allowTilt,
      isAutoGenerated: true,
      sourceObjectId: sku.id,
    };
    objects.push(obj);
    counts[sku.id] += 1;
    occupiedVolume += entry.volume;
    allocatedVolumes[sku.id] += entry.volume;
    knownWeightKg += entry.request.grossWeightKg ?? 0;
    free.push(...place(space, size, spacing, options.allowStacking && sku.kind !== 'cylinder'));
  }
  const warnings: string[] = [];
  if (!knownAllWeights) warnings.push('Carga útil NÃO validada: informe o peso bruto de cada SKU.');
  if (entries.some(entry => entry.sku.kind === 'cylinder')) warnings.push('Os tambores usam envelope circular com o diâmetro superior informado; confirmar diâmetro externo máximo.');
  if (options.allowStacking) warnings.push('Empilhamento simulado geometricamente; resistência, apoio e estabilidade exigem validação física.');
  if (options.allowTilt) warnings.push('Caixas tombadas experimentalmente: confirmar orientação permitida e vazamentos.');
  if (objects.length === MAX_OBJECTS) warnings.push('Limite de renderização alcançado; refine limites por SKU.');
  const reference = STRATEGIES.find(s => s.id === strategy)!;
  return {
    id: strategy, name: reference.name, description: reference.description,
    objects, counts, totalQuantity: objects.length,
    volumePercent: width * depth * height ? occupiedVolume / (width * depth * height) * 100 : 0,
    knownWeightKg, weightVerified: knownAllWeights,
    warnings,
  };
};

export const createMultiSkuScenarios = (
  container: ContainerSpec,
  selected: PetronasSelection[],
  options: MultiSkuOptions,
): MultiSkuScenario[] => {
  const entries: Entry[] = selected.flatMap((request, index) => {
    const sku = PETRONAS_SKUS.find(item => item.id === request.skuId);
    if (!sku?.dimensions || request.maxQuantity !== null && request.maxQuantity <= 0) return [];
    return [{ sku, request, variants: makeVariants(sku, options.allowTilt), volume: exactVolume(sku), index }];
  });
  if (!entries.length) return [];
  const ranked = STRATEGIES.map(s => runStrategy(s.id, container, entries, options))
    .sort((a, b) => b.volumePercent - a.volumePercent || b.totalQuantity - a.totalQuantity);
  return ranked.map((scenario, index) => index === 0
    ? { ...scenario, name: `Melhor encontrado · ${scenario.name}`, description: `${scenario.description} Melhor ocupação entre os quatro métodos testados; ótimo global não garantido.` }
    : scenario);
};
