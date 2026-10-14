import { GOODPACK_MODELS, type GoodpackModel } from "../data/skus";

export interface RoadVehicle {
  kind: "truck" | "sider";
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
export const ROAD_PRESETS: Record<RoadVehicle["kind"], RoadVehicle> = {
  truck: {
    kind: "truck",
    name: "Truck baú",
    length: 8280,
    width: 2500,
    height: 2600,
    capacityKg: null,
    rearHeight: null,
    rearWidth: null,
    sideHeight: null,
    confirmed: false,
  },
  sider: {
    kind: "sider",
    name: "Carreta sider",
    length: 14700,
    width: 2480,
    height: 2760,
    capacityKg: null,
    rearHeight: 2690,
    rearWidth: null,
    sideHeight: 2700,
    confirmed: false,
  },
};
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
  if (
    ![v.length, v.width, v.height].every((n) => Number.isFinite(n) && n > 0) ||
    !Number.isFinite(gap) ||
    gap < 0
  )
    fail("Dimensões e folgas devem ser válidas e positivas.");
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
      b.left < -v.width / 2 + gap - EPS ||
      b.right > v.width / 2 - gap + EPS ||
      b.front < -v.length / 2 + gap - EPS ||
      b.back > v.length / 2 - gap + EPS ||
      b.bottom < -EPS ||
      b.top > v.height + EPS
    )
      fail(`${label}: fora do espaço útil ou da folga das paredes.`, unit.id);
    if (unit.z > EPS) {
      const support = units.find(
        (other) =>
          other.id !== unit.id &&
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
    const rearPossible =
      (v.rearHeight === null || d.height <= v.rearHeight) &&
      (v.rearWidth === null || Math.min(d.width, d.length) <= v.rearWidth);
    const sidePossible =
      v.kind === "sider" && (v.sideHeight === null || d.height <= v.sideHeight);
    if (!rearPossible && !sidePossible)
      fail(`${label}: unidade não passa pelas aberturas informadas.`, unit.id);
    for (let j = i + 1; j < units.length; j++) {
      const other = units[j],
        c = roadBounds(other);
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
    (v.kind === "sider" && v.sideHeight === null)
  )
    notices.push(
      "Aberturas incompletas: entrada da carga não totalmente verificada.",
    );
  notices.push(
    "Entrada verificada por unidade; percurso, pilares, amarração e cargas por eixo não são simulados.",
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
    const b = roadBounds(u);
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
    floorPercent: (floorArea / (v.width * v.length)) * 100,
    volumePercent: (volume / (v.width * v.length * v.height)) * 100,
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
// Search floor corners and existing edges, then aligned upper positions. No global-optimum claim.
export function findRoadPosition(
  state: RoadState,
  template: RoadUnit,
): RoadUnit | null {
  if (state.units.length >= MAX_ROAD_UNITS) return null;
  for (const turned of [template.turned, !template.turned]) {
    const candidate = { ...template, turned, z: 0 },
      d = footprint(candidate),
      { vehicle: v, gap } = state;
    const xs = new Set([
      -v.width / 2 + gap + d.width / 2,
      v.width / 2 - gap - d.width / 2,
    ]);
    const ys = new Set([-v.length / 2 + gap + d.length / 2]);
    for (const u of state.units) {
      const b = roadBounds(u);
      xs.add(b.right + gap + d.width / 2);
      xs.add(b.left - gap - d.width / 2);
      ys.add(b.back + gap + d.length / 2);
    }
    for (const y of [...ys].sort((a, b) => a - b))
      for (const x of [...xs].sort((a, b) => a - b)) {
        const next = { ...candidate, x, y };
        if (validateRoad({ ...state, units: [...state.units, next] }).valid)
          return next;
      }
  }
  for (const base of state.units.filter(
    (u) => u.model === template.model && u.z === 0,
  )) {
    const next = {
      ...template,
      x: base.x,
      y: base.y,
      z: footprint(base).height,
      turned: base.turned,
    };
    if (validateRoad({ ...state, units: [...state.units, next] }).valid)
      return next;
  }
  return null;
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
      v = state.vehicle;
    const closest = (value: number, candidates: number[]) =>
      candidates.reduce(
        (best, n) => (Math.abs(n - value) < Math.abs(best - value) ? n : best),
        Math.round(value / 10) * 10,
      );
    const xs = [-v.width / 2 + g - b.left, v.width / 2 - g - b.right];
    const ys = [-v.length / 2 + g - b.front, v.length / 2 - g - b.back];
    const zs = [-anchor.z];
    for (const u of state.units.filter((u) => !ids.includes(u.id))) {
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
