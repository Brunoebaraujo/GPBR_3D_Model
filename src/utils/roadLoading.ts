import { GOODPACK_MODELS, type GoodpackModel } from "../data/skus";

export type VehicleKind =
  | "vuc"
  | "three-quarter"
  | "toco"
  | "truck"
  | "bitruck"
  | "ls"
  | "sider"
  | "bitrem"
  | "rodotrem";
export interface CargoBody {
  length: number;
  width: number;
  height: number;
}
export interface RoadVehicle {
  kind: VehicleKind;
  secondBody?: CargoBody;
  loading?: "rear" | "side-rear";
  name: string;
  length: number;
  width: number;
  height: number;
  capacityKg: number | null;
  rearHeight: number | null;
  rearWidth: number | null;
  sideHeight: number | null;
  confirmed: boolean;
}
export interface RoadUnit {
  id: string;
  compartment?: number;
  entryLevels?: 1 | 2;
  model: GoodpackModel;
  cargoKg: number;
  x: number;
  y: number;
  z: number; // Bottom elevation, unlike the product editor's center elevation.
  turned: boolean;
  locked: boolean;
}
export interface RoadState {
  vehicle: RoadVehicle;
  units: RoadUnit[];
  gap: number;
}
// Approximate commercial ranges transcribed from the user's supplied table.
// They are informational; neither legal limits nor confirmed equipment dimensions.
export const ROAD_REFERENCES: Record<
  VehicleKind,
  { name: string; payload: string; width: string; loading: string }
> = {
  vuc: {
    name: "VUC",
    payload: "1,5–3 t",
    width: "1,80–2,10 m",
    loading: "Traseiro",
  },
  "three-quarter": {
    name: "Caminhão 3/4",
    payload: "3–4 t",
    width: "2,00–2,30 m",
    loading: "Traseiro",
  },
  toco: {
    name: "Toco",
    payload: "6–8 t",
    width: "2,30–2,48 m",
    loading: "Traseiro ou sider",
  },
  truck: {
    name: "Truck (truque)",
    payload: "12–14 t",
    width: "2,40–2,50 m",
    loading: "Traseiro ou sider",
  },
  bitruck: {
    name: "Bitruck",
    payload: "14–18 t",
    width: "2,40–2,50 m",
    loading: "Traseiro ou sider",
  },
  ls: {
    name: "Carreta LS (3 eixos)",
    payload: "25–28 t",
    width: "2,45–2,50 m",
    loading: "Traseiro ou sider",
  },
  sider: {
    name: "Carreta sider (3 eixos)",
    payload: "28–32 t",
    width: "2,45–2,50 m",
    loading: "Lateral e traseiro",
  },
  bitrem: {
    name: "Bitrem",
    payload: "35–38 t",
    width: "2,45–2,50 m",
    loading: "Traseiro ou sider",
  },
  rodotrem: {
    name: "Rodotrem",
    payload: "45–50 t",
    width: "2,45–2,50 m",
    loading: "Traseiro ou sider",
  },
};
const emptyProfile = (kind: VehicleKind): RoadVehicle => ({
  kind,
  name: ROAD_REFERENCES[kind].name,
  length: 0,
  width: 0,
  height: 0,
  capacityKg: null,
  rearHeight: null,
  rearWidth: null,
  sideHeight: null,
  confirmed: false,
  loading: kind === "sider" ? "side-rear" : "rear",
  ...(kind === "bitrem" || kind === "rodotrem"
    ? { secondBody: { length: 0, width: 0, height: 0 } }
    : {}),
});
export const ROAD_PRESETS = Object.fromEntries(
  (Object.keys(ROAD_REFERENCES) as VehicleKind[]).map((kind) => [
    kind,
    emptyProfile(kind),
  ]),
) as Record<VehicleKind, RoadVehicle>;
// Previously verified equipment examples remain available, with editable values.
Object.assign(ROAD_PRESETS.truck, { length: 8280, width: 2500, height: 2600 });
Object.assign(ROAD_PRESETS.sider, {
  length: 14700,
  width: 2480,
  height: 2760,
  rearHeight: 2690,
  sideHeight: 2700,
});
export const cargoBodies = (v: RoadVehicle): CargoBody[] =>
  v.secondBody ? [v, v.secondBody] : [v];
export const dimensionsReady = (v: RoadVehicle) =>
  cargoBodies(v).every((b) =>
    [b.length, b.width, b.height].every((n) => Number.isFinite(n) && n > 0),
  );
export const bodyOf = (
  v: RoadVehicle,
  compartment = 0,
): CargoBody | undefined => cargoBodies(v)[compartment];
export const sameBody = (a: RoadUnit, b: RoadUnit) =>
  (a.compartment ?? 0) === (b.compartment ?? 0);
export const hasSideAccess = (v: RoadVehicle) =>
  v.loading ? v.loading === "side-rear" : v.kind === "sider";
// Visual coupling spacing only; never counted as usable cargo floor.
export const couplingGap = (v: RoadVehicle) =>
  v.secondBody ? (v.kind === "rodotrem" ? 3000 : 1800) : 0;
export const sceneLength = (v: RoadVehicle) =>
  v.length + (v.secondBody?.length ?? 0) + couplingGap(v);
export const bodyOffset = (v: RoadVehicle, compartment = 0) =>
  !v.secondBody
    ? 0
    : compartment === 0
      ? -(v.secondBody.length + couplingGap(v)) / 2
      : (v.length + couplingGap(v)) / 2;

export const MAX_ROAD_UNITS = 200;
const EPS = 0.1;
export function footprint(unit: RoadUnit) {
  const d = GOODPACK_MODELS[unit.model].externalDimensions;
  return {
    width: unit.turned ? d.depth : d.width,
    length: unit.turned ? d.width : d.depth,
    height: d.height,
  };
}
export const grossWeight = (unit: RoadUnit) =>
  unit.cargoKg + GOODPACK_MODELS[unit.model].emptyWeightKg;
export function roadBounds(unit: RoadUnit) {
  const d = footprint(unit);
  return {
    left: unit.x - d.width / 2,
    right: unit.x + d.width / 2,
    front: unit.y - d.length / 2,
    back: unit.y + d.length / 2,
    bottom: unit.z,
    top: unit.z + d.height,
  };
}
export function validateRoad(state: RoadState) {
  const { vehicle: v, units, gap } = state;
  const errors: string[] = [],
    notices: string[] = [],
    invalidIds = new Set<string>();
  const fail = (message: string, ...ids: string[]) => {
    errors.push(message);
    ids.forEach((id) => invalidIds.add(id));
  };
  if (!dimensionsReady(v) || !Number.isFinite(gap) || gap < 0)
    fail(
      "Informe comprimento, largura e altura de todos os compartimentos; a folga deve ser válida.",
    );
  for (const n of [v.capacityKg, v.rearHeight, v.rearWidth, v.sideHeight])
    if (n !== null && (!Number.isFinite(n) || n <= 0))
      fail("Capacidade e aberturas devem ser positivas quando informadas.");
  if (units.length > MAX_ROAD_UNITS)
    fail(`Limite de ${MAX_ROAD_UNITS} unidades por cenário.`);
  if (new Set(units.map((u) => u.id)).size !== units.length)
    fail("Identificadores de unidades duplicados.");
  units.forEach((unit, i) => {
    const b = roadBounds(unit),
      d = footprint(unit);
    const label = `${unit.model} #${i + 1}`;
    const body = bodyOf(v, unit.compartment ?? 0);
    if (!body) {
      fail(`${label}: compartimento inexistente.`, unit.id);
      return;
    }
    if (
      ![unit.x, unit.y, unit.z, unit.cargoKg].every(Number.isFinite) ||
      unit.cargoKg < 0 ||
      unit.cargoKg > GOODPACK_MODELS[unit.model].maxPayloadKg
    )
      fail(
        `${label}: carga deve estar entre 0 e 1.650 kg e posição deve ser válida.`,
        unit.id,
      );
    if (
      b.left < -body.width / 2 + gap - EPS ||
      b.right > body.width / 2 - gap + EPS ||
      b.front < -body.length / 2 + gap - EPS ||
      b.back > body.length / 2 - gap + EPS ||
      b.bottom < -EPS ||
      b.top > body.height + EPS
    )
      fail(`${label}: fora do espaço útil ou da folga das paredes.`, unit.id);
    if (unit.z > EPS) {
      const support = units.find(
        (other) =>
          other.id !== unit.id &&
          sameBody(other, unit) &&
          other.model === unit.model &&
          other.turned === unit.turned &&
          Math.abs(other.z) < EPS &&
          Math.abs(other.x - unit.x) < EPS &&
          Math.abs(other.y - unit.y) < EPS &&
          Math.abs(roadBounds(other).top - unit.z) < EPS,
      );
      if (!support)
        fail(
          `${label}: empilhe alinhado sobre o mesmo modelo no piso (máximo 2 níveis).`,
          unit.id,
        );
    }
    const entryHeight = d.height * (unit.entryLevels ?? 1);
    const rearPossible =
      (v.rearHeight === null || entryHeight <= v.rearHeight) &&
      (v.rearWidth === null || Math.min(d.width, d.length) <= v.rearWidth);
    const sidePossible =
      hasSideAccess(v) &&
      (v.sideHeight === null || entryHeight <= v.sideHeight);
    if (!rearPossible && !sidePossible)
      fail(
        `${label}: unidade ou pilha de entrada não passa pelas aberturas informadas.`,
        unit.id,
      );
    for (let j = i + 1; j < units.length; j++) {
      const other = units[j],
        c = roadBounds(other);
      if (!sameBody(unit, other)) continue;
      if (b.top <= c.bottom + EPS || c.top <= b.bottom + EPS) continue;
      if (
        b.left < c.right + gap - EPS &&
        b.right > c.left - gap + EPS &&
        b.front < c.back + gap - EPS &&
        b.back > c.front - gap + EPS
      )
        fail(
          `${label} e ${other.model} #${j + 1}: colisão ou folga insuficiente.`,
          unit.id,
          other.id,
        );
    }
  });
  const cargo = units.reduce((s, u) => s + u.cargoKg, 0),
    tare = units.reduce(
      (s, u) => s + GOODPACK_MODELS[u.model].emptyWeightKg,
      0,
    ),
    total = cargo + tare;
  if (v.capacityKg !== null && total > v.capacityKg + EPS)
    fail("Peso embarcado excede a capacidade útil informada.");
  if (!v.confirmed)
    notices.push("Medidas de referência: confirmar com a transportadora.");
  if (v.capacityKg === null)
    notices.push(
      "Capacidade útil não informada: peso do veículo não validado.",
    );
  if (
    v.rearHeight === null ||
    v.rearWidth === null ||
    (hasSideAccess(v) && v.sideHeight === null)
  )
    notices.push(
      "Aberturas incompletas: entrada da carga não totalmente verificada.",
    );
  notices.push(
    "Entrada avaliada conforme inclusão: unidade ou pilha de 2. Percurso, pilares, amarração e cargas por eixo não são simulados.",
  );
  if (v.secondBody)
    notices.push(
      "Capacidade informada é do conjunto; limites individuais dos implementos não foram verificados. Vão de articulação é apenas ilustrativo.",
    );
  const availableFloor = cargoBodies(v).reduce(
    (sum, b) => sum + b.width * b.length,
    0,
  );
  const availableVolume = cargoBodies(v).reduce(
    (sum, b) => sum + b.width * b.length * b.height,
    0,
  );
  const floorArea = units
    .filter((u) => u.z < EPS)
    .reduce((s, u) => {
      const d = footprint(u);
      return s + d.width * d.length;
    }, 0);
  const volume = units.reduce((s, u) => {
    const d = footprint(u);
    return s + d.width * d.length * d.height;
  }, 0);
  // Split the envelope at the longitudinal midpoint, assuming uniform mass within each unit.
  const frontWeight = units.reduce((s, u) => {
    const local = roadBounds(u),
      offset = bodyOffset(v, u.compartment ?? 0);
    const b = { front: local.front + offset, back: local.back + offset };
    return (
      s +
      (grossWeight(u) * Math.max(0, Math.min(b.back, 0) - b.front)) /
        (b.back - b.front)
    );
  }, 0);
  return {
    errors: [...new Set(errors)],
    notices,
    invalidIds,
    cargo,
    tare,
    total,
    frontWeight,
    rearWeight: total - frontWeight,
    floorPercent: availableFloor > 0 ? (floorArea / availableFloor) * 100 : 0,
    volumePercent: availableVolume > 0 ? (volume / availableVolume) * 100 : 0,
    valid: errors.length === 0,
  };
}
export function makeRoadUnit(
  model: GoodpackModel,
  cargoKg: number,
  id: string,
): RoadUnit {
  return { id, model, cargoKg, x: 0, y: 0, z: 0, turned: false, locked: false };
}
// Atomic insertion: a pair must fit in full, with both tares and payloads accounted for.
export function findRoadBatch(
  state: RoadState,
  template: RoadUnit,
  size: 1 | 2,
): RoadUnit[] | null {
  if (
    !dimensionsReady(state.vehicle) ||
    state.units.length + size > MAX_ROAD_UNITS
  )
    return null;
  const v = bodyOf(state.vehicle, template.compartment ?? 0);
  if (!v) return null;
  const gap = state.gap;
  const batch = (base: RoadUnit) =>
    size === 1
      ? [base]
      : [base, { ...base, id: `${base.id}-top`, z: footprint(base).height }];
  for (const turned of [template.turned, !template.turned]) {
    const candidate = { ...template, turned, z: 0, entryLevels: size },
      d = footprint(candidate);
    const xs = new Set([
      -v.width / 2 + gap + d.width / 2,
      v.width / 2 - gap - d.width / 2,
    ]);
    const ys = new Set([-v.length / 2 + gap + d.length / 2]);
    for (const u of state.units.filter((u) => sameBody(u, template))) {
      const b = roadBounds(u);
      xs.add(b.right + gap + d.width / 2);
      xs.add(b.left - gap - d.width / 2);
      ys.add(b.back + gap + d.length / 2);
    }
    for (const y of [...ys].sort((a, b) => a - b))
      for (const x of [...xs].sort((a, b) => a - b)) {
        const next = batch({ ...candidate, x, y });
        if (validateRoad({ ...state, units: [...state.units, ...next] }).valid)
          return next;
      }
  }
  if (size === 1)
    for (const base of state.units.filter(
      (u) => sameBody(u, template) && u.model === template.model && u.z === 0,
    )) {
      const next = {
        ...template,
        x: base.x,
        y: base.y,
        z: footprint(base).height,
        turned: base.turned,
      };
      if (validateRoad({ ...state, units: [...state.units, next] }).valid)
        return [next];
    }
  return null;
}
export function findRoadPosition(
  state: RoadState,
  template: RoadUnit,
): RoadUnit | null {
  return findRoadBatch(state, template, 1)?.[0] ?? null;
}
export function stackIds(units: RoadUnit[], unit: RoadUnit): string[] {
  return units
    .filter(
      (u) =>
        sameBody(u, unit) &&
        u.model === unit.model &&
        u.turned === unit.turned &&
        Math.abs(u.x - unit.x) < EPS &&
        Math.abs(u.y - unit.y) < EPS,
    )
    .map((u) => u.id);
}
export function moveRoadUnits(
  state: RoadState,
  ids: string[],
  delta: { x: number; y: number; z: number },
  snap: boolean,
): RoadUnit[] {
  const moving = state.units.filter((u) => ids.includes(u.id) && !u.locked);
  if (!moving.length) return state.units;
  let dx = delta.x,
    dy = delta.y,
    dz = delta.z;
  if (snap) {
    const anchor = moving[0],
      b = roadBounds(anchor),
      g = state.gap,
      v = bodyOf(state.vehicle, anchor.compartment ?? 0);
    if (!v) return state.units;
    const closest = (value: number, candidates: number[]) =>
      candidates.reduce(
        (best, n) => (Math.abs(n - value) < Math.abs(best - value) ? n : best),
        Math.round(value / 10) * 10,
      );
    const xs = [-v.width / 2 + g - b.left, v.width / 2 - g - b.right];
    const ys = [-v.length / 2 + g - b.front, v.length / 2 - g - b.back];
    const zs = [-anchor.z];
    for (const u of state.units.filter(
      (u) => !ids.includes(u.id) && sameBody(u, anchor),
    )) {
      const c = roadBounds(u);
      xs.push(c.right + g - b.left, c.left - g - b.right, c.left - b.left);
      ys.push(c.back + g - b.front, c.front - g - b.back, c.front - b.front);
      if (u.model === anchor.model && u.z === 0) zs.push(c.top - anchor.z);
    }
    const near = (value: number, targets: number[]) => {
      const nearby = targets.filter((n) => Math.abs(n - value) < 80);
      return nearby.length
        ? nearby.reduce((best, n) =>
            Math.abs(n - value) < Math.abs(best - value) ? n : best,
          )
        : closest(value, []);
    };
    dx = near(dx, xs);
    dy = near(dy, ys);
    dz = near(dz, zs);
  }
  return state.units.map((u) =>
    ids.includes(u.id) && !u.locked
      ? {
          ...u,
          x: Math.round(u.x + dx),
          y: Math.round(u.y + dy),
          z: Math.round(u.z + dz),
        }
      : u,
  );
}
