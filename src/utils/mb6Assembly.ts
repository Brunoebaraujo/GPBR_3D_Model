import { MB6_CONTAINER } from '../data/skus';

// Metres. Envelope from the existing catalogue; joint dimensions are provisional.
export const MB6 = { w: MB6_CONTAINER.externalDimensions.width / 1000, d: MB6_CONTAINER.externalDimensions.depth / 1000, h: MB6_CONTAINER.externalDimensions.height / 1000, foot: 0.07, inset: 0.055, pin: 0.025, tolerance: 0.035 };
export const WALL_NAMES = ['Frente', 'Direita', 'Fundo', 'Esquerda'];
export type Pose = { x: number; y: number; z: number; yaw: number };
export type Assembly = { id: number; walls: boolean[]; locks: boolean[]; lid: boolean; pose: Pose; support: number | null };
export type Lab = { boxes: Assembly[]; selected: number; message: string };
export type Action = { type: 'select'; id: number } | { type: 'wall' | 'lock'; index: number } | { type: 'lid' | 'add' | 'reset' | 'stack' | 'unstack' } | { type: 'move'; pose: Pose };
export const createBox = (id: number): Assembly => ({ id, walls: [false, false, false, false], locks: [false, false, false, false], lid: true, pose: { x: id === 1 ? -0.8 : 0.8, y: 0, z: 0, yaw: 0 }, support: null });
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
  if (action.type === 'add') return state.boxes.length >= 2 ? fail('O laboratório permite duas caixas.') : { boxes: [...state.boxes, createBox(2)], selected: 2, message: 'Caixa 2 criada fechada e dobrada. Retire a tampa.' };
  const b = state.boxes.find(box => box.id === state.selected)!;
  const update = (next: Assembly, message: string) => ({ ...state, boxes: state.boxes.map(box => box.id === b.id ? next : box), message });
  if (state.boxes.some(box => box.support === b.id)) return fail('Desempilhe a caixa superior antes de alterar a base.');
  if (action.type === 'unstack') {
    if (b.support === null) return fail('Esta caixa já está no piso.');
    for (const x of [createBox(b.id).pose.x, -2.4, 2.4]) {
      const pose = { x, y: 0, z: 0, yaw: 0 };
      const free = state.boxes.every(other => other.id === b.id || Math.abs(other.pose.x - x) > MB6.w + 0.1 || Math.abs(other.pose.z) > MB6.d + 0.1);
      if (free) return update({ ...b, support: null, pose }, 'Caixa devolvida ao piso.');
    }
    return fail('Libere espaço no piso antes de desempilhar.');
  }
  if (b.support !== null) return fail('Desempilhe antes de alterar a caixa.');
  if (action.type === 'lid') {
    if (!b.lid && !(b.walls.every(Boolean) && b.locks.every(Boolean)) && !b.walls.every(w => !w)) return fail('Monte as quatro paredes e trave os quatro vértices antes de fechar.');
    return update({ ...b, lid: !b.lid }, b.lid ? 'Tampa retirada. Clique em cada parede para levantá-la.' : 'Tampa colocada.');
  }
  if (action.type === 'wall') {
    const i = action.index;
    if (!Number.isInteger(i) || i < 0 || i > 3) return state;
    if (b.lid) return fail('Retire a tampa primeiro.');
    if (b.locks[i] || b.locks[(i + 3) % 4]) return fail('Destrave os dois vértices adjacentes primeiro.');
    return update({ ...b, walls: b.walls.map((w, j) => j === i ? !w : w) }, `${WALL_NAMES[i]}: ${b.walls[i] ? 'dobrada' : 'montada'}.`);
  }
  if (action.type === 'lock') {
    const i = action.index;
    if (!Number.isInteger(i) || i < 0 || i > 3) return state;
    if (b.lid) return fail('Retire a tampa antes de operar as travas.');
    if (!b.walls[i] || !b.walls[(i + 1) % 4]) return fail('Levante as duas paredes adjacentes a este vértice.');
    return update({ ...b, locks: b.locks.map((v, j) => j === i ? !v : v) }, `Vértice ${i + 1}: ${b.locks[i] ? 'destravado' : 'travado'}.`);
  }
  if (action.type === 'stack') {
    const base = state.boxes.find(other => fitsStack(b, other));
    if (!base) return fail('Encaixe recusado: complete ambas as caixas e alinhe os quatro pés aos vértices (35 mm).');
    return update({ ...b, support: base.id, pose: { ...base.pose, y: base.pose.y + MB6.h, yaw: base.pose.yaw + (Math.cos(b.pose.yaw - base.pose.yaw) < 0 ? Math.PI : 0) } }, 'Encaixe confirmado: quatro pés alinhados aos quatro vértices.');
  }
  if (action.type === 'move') {
    const p = action.pose;
    if (!Object.values(p).every(Number.isFinite) || Math.abs(p.x) > 3 || Math.abs(p.z) > 3 || p.y < 0 || p.y > 2.5) return fail('Mantenha a caixa dentro da área de trabalho.');
    // Conservative swept-free endpoint envelope. Raised placement is a preview, never a supported stack.
    const ex = Math.abs(Math.cos(p.yaw)) * MB6.w / 2 + Math.abs(Math.sin(p.yaw)) * MB6.d / 2;
    const ez = Math.abs(Math.sin(p.yaw)) * MB6.w / 2 + Math.abs(Math.cos(p.yaw)) * MB6.d / 2;
    const collision = state.boxes.some(other => other.id !== b.id && Math.abs(p.x - other.pose.x) < ex + MB6.w / 2 - 0.001 && Math.abs(p.z - other.pose.z) < ez + MB6.d / 2 - 0.001 && Math.abs(p.y - other.pose.y) < MB6.h - 0.001);
    if (collision) return fail('Movimento recusado: caixas se sobrepõem. Eleve antes de aproximar.');
    return update({ ...b, pose: { ...p } }, p.y > 0 ? 'Posição de teste suspensa. Alinhe e confirme o encaixe.' : 'Caixa posicionada no piso.');
  }
  return state;
}
