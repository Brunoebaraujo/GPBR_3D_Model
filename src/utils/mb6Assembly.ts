import { MB6_CONTAINER } from '../data/skus';

// Envelope and collapsed height checked against GP TDS MB6, Feb 27 2023.
// Joint/lever dimensions remain visual estimates: the TDS does not dimension them.
export const MB6 = { w: MB6_CONTAINER.externalDimensions.width / 1000, d: MB6_CONTAINER.externalDimensions.depth / 1000, h: MB6_CONTAINER.externalDimensions.height / 1000, collapsed: 0.224, lidWeightKg: 10.6, foot: 0.07, inset: 0.055, pin: 0.025, tolerance: 0.035 };
export const WALL_NAMES = ['Frente', 'Direita', 'Fundo', 'Esquerda'];
// Indices remain clockwise for corner/bolt adjacency. Assembly is a separate order.
export const ASSEMBLY_ORDER = [0, 2, 3, 1] as const;
export const FOLD_ORDER = [1, 3, 2, 0] as const;
export const WALL_PIVOT_Y = [0.152, 0.080, 0.128, 0.104] as const;
export const nextWall = (walls: boolean[], raising: boolean) => (raising ? ASSEMBLY_ORDER : FOLD_ORDER).find(i => walls[i] !== raising);
export type Pose = { x: number; y: number; z: number; yaw: number };
export type LeverStep = 'lift' | 'slide' | 'lower';
export type Assembly = { id: number; walls: boolean[]; locks: boolean[]; leverRaised: boolean[]; bolts: boolean[]; lid: boolean; pose: Pose; support: number | null };
export type Lab = { boxes: Assembly[]; selected: number; message: string };
export type Action = { type: 'select'; id: number } | { type: 'wall'; index: number } | { type: 'lever'; index: number; step: LeverStep } | { type: 'lid' | 'add' | 'reset' | 'stack' | 'unstack' } | { type: 'move'; pose: Pose };
export const createBox = (id: number): Assembly => ({ id, walls: [false, false, false, false], locks: [false, false, false, false], leverRaised: [false, false, false, false], bolts: [false, false, false, false], lid: true, pose: { x: id === 1 ? -0.8 : 0.8, y: 0, z: 0, yaw: 0 }, support: null });
export const boxHeight = (box: Assembly) => box.walls.some(Boolean) ? MB6.h : MB6.collapsed;
export const leverGesture = (dx: number, dy: number): LeverStep => Math.abs(dx) > Math.abs(dy) ? 'slide' : dy < 0 ? 'lift' : 'lower';
const floorSlot = (boxes: Assembly[], preferredX: number) => [preferredX, -0.8, -2.4, 2.4].find(x => boxes.every(other => {
  const halfX = Math.abs(Math.cos(other.pose.yaw)) * MB6.w / 2 + Math.abs(Math.sin(other.pose.yaw)) * MB6.d / 2;
  const halfZ = Math.abs(Math.sin(other.pose.yaw)) * MB6.w / 2 + Math.abs(Math.cos(other.pose.yaw)) * MB6.d / 2;
  return Math.abs(other.pose.x - x) > halfX + MB6.w / 2 + 0.04 || Math.abs(other.pose.z) > halfZ + MB6.d / 2 + 0.04;
}));
export const initialLab = (): Lab => ({ boxes: [createBox(1)], selected: 1, message: 'Retire a tampa para começar a montagem.' });
export const ready = (b: Assembly) => b.lid && b.walls.every(Boolean) && b.locks.every(Boolean);
export const cornerPoints = (p: Pose, height = 0) => [-1, 1].flatMap(x => [-1, 1].map(z => {
  const dx = x * (MB6.w / 2 - MB6.inset), dz = z * (MB6.d / 2 - MB6.inset);
  return { x: p.x + dx * Math.cos(p.yaw) + dz * Math.sin(p.yaw), y: p.y + height, z: p.z - dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw) };
}));
export function fitsStack(top: Assembly, base: Assembly): boolean {
  if (top.id === base.id || !ready(top) || !ready(base) || base.support !== null || base.pose.y !== 0) return false;
  const feet = cornerPoints(top.pose), sockets = cornerPoints(base.pose, MB6.h);
  const used = new Set<number>();
  return feet.every(foot => {
    const i = sockets.findIndex((socket, index) => !used.has(index) && Math.hypot(foot.x - socket.x, foot.y - socket.y, foot.z - socket.z) <= MB6.tolerance);
    if (i < 0) return false;
    used.add(i); return true;
  });
}
export function reduceLab(state: Lab, action: Action): Lab {
  if (action.type === 'reset') return initialLab();
  if (action.type === 'select') return state.boxes.some(b => b.id === action.id) ? { ...state, selected: action.id } : state;
  const fail = (message: string) => ({ ...state, message });
  if (action.type === 'add') {
    if (state.boxes.length >= 2) return fail('O laboratório permite duas caixas.');
    const x = floorSlot(state.boxes, 0.8);
    if (x === undefined) return fail('Libere espaço no piso antes de criar outra caixa.');
    const box = createBox(2); box.pose.x = x;
    return { boxes: [...state.boxes, box], selected: 2, message: 'Caixa 2 criada fechada e dobrada. Retire a tampa.' };
  }
  const b = state.boxes.find(box => box.id === state.selected)!;
  const update = (next: Assembly, message: string) => ({ ...state, boxes: state.boxes.map(box => box.id === b.id ? next : box), message });
  if (state.boxes.some(box => box.support === b.id)) return fail('Desempilhe a caixa superior antes de alterar a base.');
  if (action.type === 'unstack') {
    if (b.support === null) return fail('Esta caixa já está no piso.');
    const x = floorSlot(state.boxes.filter(other => other.id !== b.id), createBox(b.id).pose.x);
    if (x !== undefined) return update({ ...b, support: null, pose: { x, y: 0, z: 0, yaw: 0 } }, 'Caixa devolvida ao piso.');
    return fail('Libere espaço no piso antes de desempilhar.');
  }
  if (b.support !== null) return fail('Desempilhe antes de alterar a caixa.');
  if (action.type === 'lid') {
    if (!b.lid && b.leverRaised.some(Boolean)) return fail('Rebata todas as alavancas antes de colocar a tampa.');
    if (!b.lid && !(b.walls.every(Boolean) && b.locks.every(Boolean)) && !b.walls.every(w => !w)) return fail('Monte as quatro paredes e trave os quatro vértices antes de fechar.');
    return update({ ...b, lid: !b.lid }, b.lid ? 'Tampa retirada. Clique em cada parede para levantá-la.' : 'Tampa colocada.');
  }
  if (action.type === 'wall') {
    const i = action.index;
    if (!Number.isInteger(i) || i < 0 || i > 3) return state;
    if (b.lid) return fail('Retire a tampa primeiro.');
    const expected = nextWall(b.walls, !b.walls[i]);
    if (expected !== i) return fail(`${b.walls[i] ? 'Dobre' : 'Monte'} primeiro a parede ${WALL_NAMES[expected!]}. Ordem de montagem: Frente → Fundo → Esquerda → Direita.`);
    if (b.bolts[i] || b.bolts[(i + 3) % 4] || b.leverRaised[i] || b.leverRaised[(i + 3) % 4]) return fail('Recolha os ferrolhos e rebata as duas alavancas adjacentes primeiro.');
    const walls = b.walls.map((w, j) => j === i ? !w : w);
    const next = nextWall(walls, !b.walls[i]);
    return update({ ...b, walls }, `${WALL_NAMES[i]}: ${b.walls[i] ? 'dobrada' : 'montada'}.${next === undefined ? '' : ` Próxima: ${WALL_NAMES[next]}.`}`);
  }
  if (action.type === 'lever') {
    const i = action.index;
    if (!Number.isInteger(i) || i < 0 || i > 3) return state;
    if (b.lid) return fail('Retire a tampa antes de operar as alavancas.');
    if (!b.walls[i] || !b.walls[(i + 1) % 4]) return fail('Levante as duas paredes adjacentes a este vértice.');
    if (action.step === 'slide' && !b.leverRaised[i]) return fail('Levante a alça antes de deslizar o ferrolho.');
    const leverRaised = b.leverRaised.map((v, j) => j === i && action.step !== 'slide' ? action.step === 'lift' : v);
    const bolts = b.bolts.map((v, j) => j === i && action.step === 'slide' ? !v : v);
    const locks = bolts.map((v, j) => v && !leverRaised[j]);
    const status = locks[i] ? 'travado — alça rebatida e ferrolho avançado' : leverRaised[i] ? (bolts[i] ? 'ferrolho avançado; rebata a alça para concluir' : 'alça levantada; deslize o ferrolho') : 'destravado — ferrolho recolhido';
    return update({ ...b, leverRaised, bolts, locks }, `Vértice ${i + 1}: ${status}.`);
  }
  if (action.type === 'stack') {
    const base = state.boxes.find(other => fitsStack(b, other));
    if (!base) return fail('Encaixe recusado: complete ambas as caixas e alinhe os quatro pés aos vértices (35 mm).');
    return update({ ...b, support: base.id, pose: { ...base.pose, y: base.pose.y + MB6.h - MB6.pin, yaw: base.pose.yaw + (Math.cos(b.pose.yaw - base.pose.yaw) < 0 ? Math.PI : 0) } }, 'Encaixe confirmado: quatro pés alinhados aos quatro vértices.');
  }
  if (action.type === 'move') {
    const p = action.pose;
    if (!Object.values(p).every(Number.isFinite) || Math.abs(p.x) > 3 || Math.abs(p.z) > 3 || p.y < 0 || p.y > 2.5) return fail('Mantenha a caixa dentro da área de trabalho.');
    // Conservative swept-free endpoint envelope. Raised placement is a preview, never a supported stack.
    const ex = Math.abs(Math.cos(p.yaw)) * MB6.w / 2 + Math.abs(Math.sin(p.yaw)) * MB6.d / 2;
    const ez = Math.abs(Math.sin(p.yaw)) * MB6.w / 2 + Math.abs(Math.cos(p.yaw)) * MB6.d / 2;
    const collision = state.boxes.some(other => {
      if (other.id === b.id) return false;
      const ox = Math.abs(Math.cos(other.pose.yaw)) * MB6.w / 2 + Math.abs(Math.sin(other.pose.yaw)) * MB6.d / 2;
      const oz = Math.abs(Math.sin(other.pose.yaw)) * MB6.w / 2 + Math.abs(Math.cos(other.pose.yaw)) * MB6.d / 2;
      return Math.abs(p.x - other.pose.x) < ex + ox - 0.001 && Math.abs(p.z - other.pose.z) < ez + oz - 0.001 && p.y < other.pose.y + boxHeight(other) - 0.001 && p.y + boxHeight(b) > other.pose.y + 0.001;
    });
    if (collision) return fail('Movimento recusado: caixas se sobrepõem. Eleve antes de aproximar.');
    return update({ ...b, pose: { ...p } }, p.y > 0 ? 'Posição de teste suspensa. Alinhe e confirme o encaixe.' : 'Caixa posicionada no piso.');
  }
  return state;
}
