import { MB6_CONTAINER } from '../data/skus';

// Envelope and collapsed height checked against GP TDS MB6, Feb 27 2023.
// Joint/lever dimensions remain visual estimates: the TDS does not dimension them.
export const MB6 = { w: MB6_CONTAINER.externalDimensions.width / 1000, d: MB6_CONTAINER.externalDimensions.depth / 1000, h: MB6_CONTAINER.externalDimensions.height / 1000, collapsed: 0.224, lidWeightKg: 10.6, foot: 0.07, inset: 0.055, pin: 0.025, tolerance: 0.035 };
export const WALL_NUMBERS = [4, 1, 3, 2] as const;
export const wallGrabPoint = (index: number) => {
  const height = MB6.h - .035 - WALL_PIVOT_Y[index];
  return { x: 0, y: index === 0 ? height / 2 + .01 : height, z: index === 0 ? .023 : .025 };
};
export const WALL_NAMES = ['Frente', 'Direita', 'Fundo', 'Esquerda'];
// Indices remain clockwise for corner/bolt adjacency. Assembly is a separate order.
export const ASSEMBLY_ORDER = [0, 2, 3, 1] as const;
export const FOLD_ORDER = [1, 3, 2, 0] as const;
export const WALL_PIVOT_Y = [0.152, 0.080, 0.128, 0.104] as const;
// Visual sliding hinge clearance: wall 1 must clear wall 3's folded latch.
// Hardware/hinge travel is illustrative, not a measured manufacturer dimension.
export const WALL_SEATING_TRAVEL = 0.05;
export const LEVER_FOLDED_PROJECTION = 0.032 + 0.012 + 0.035 / 2;
export const MB6_VISUAL_COLLAPSED = Math.max(MB6.collapsed, WALL_PIVOT_Y[0] + WALL_SEATING_TRAVEL + LEVER_FOLDED_PROJECTION + 0.016);
export function wallMotion(index: number, angle: number, lift: number, velocity: number, raised: boolean, held: boolean, dt: number) {
  const step = Math.max(0, Math.min(dt, .04));
  const travel = index === 0 ? WALL_SEATING_TRAVEL : 0;
  const approach = (value: number, target: number, speed: number) => value + Math.sign(target-value)*Math.min(Math.abs(target-value), speed*step);
  if (held) return { angle, lift:approach(lift,travel,.16), velocity:0 };
  if (raised) {
    angle = approach(angle,0,2.2);
    // Seat vertically only after the panel has reached its upright orientation.
    return { angle, lift:approach(lift, angle === 0 ? 0 : travel,.16), velocity:0 };
  }
  lift = approach(lift,travel,.16);
  if (lift < travel) return { angle, lift, velocity:0 };
  velocity += Math.max(.8,9.81*Math.sin(-angle))*step;
  angle = Math.max(-Math.PI/2,angle-velocity*step);
  return { angle, lift, velocity:angle <= -Math.PI/2 ? 0 : velocity };
}
export const nextWall = (walls: boolean[], raising: boolean) => (raising ? ASSEMBLY_ORDER : FOLD_ORDER).find(i => walls[i] !== raising);
export type Pose = { x: number; y: number; z: number; yaw: number };
export type LeverStep = 'lift' | 'slide' | 'lower';
export type Assembly = { id: number; walls: boolean[]; locks: boolean[]; leverRaised: boolean[]; bolts: boolean[]; lid: boolean; pose: Pose; support: number | null; restingOn?: number | null };
export type Lab = { boxes: Assembly[]; selected: number; message: string };
export type Action = { type: 'select'; id: number } | { type: 'wall'; index: number } | { type: 'lever'; index: number; step: LeverStep } | { type: 'lid' | 'add' | 'reset' | 'stack' | 'unstack' } | { type: 'move' | 'drop'; pose: Pose };
export const createBox = (id: number): Assembly => ({ id, walls: [false, false, false, false], locks: [false, false, false, false], leverRaised: [false, false, false, false], bolts: [false, false, false, false], lid: true, pose: { x: id === 1 ? -0.8 : -0.8 + MB6.w + 1, y: 0, z: 0, yaw: 0 }, support: null });
export const boxHeight = (box: Assembly) => box.walls.some(Boolean) ? MB6.h : MB6_VISUAL_COLLAPSED;
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
// Assisted capture: all four feet must enter the same base's capture zone.
export function captureStackPose(top: Assembly, base: Assembly): Pose | null {
  if (top.id === base.id || !ready(top) || !ready(base) || top.support !== null || base.support !== null || base.pose.y !== 0 || !Object.values(top.pose).every(Number.isFinite)) return null;
  if (top.pose.y < MB6.h - .04 || top.pose.y > MB6.h + .12) return null;
  if (Math.abs(Math.sin(top.pose.yaw - base.pose.yaw)) > Math.sin(Math.PI / 36)) return null;
  const used = new Set<number>(), sockets = cornerPoints(base.pose);
  if (!cornerPoints(top.pose).every(foot => {
    const i = sockets.findIndex((socket,index) => !used.has(index) && Math.hypot(foot.x-socket.x,foot.z-socket.z) <= .075);
    if (i < 0) return false; used.add(i); return true;
  })) return null;
  return { ...base.pose, y: MB6.h, yaw: base.pose.yaw + (Math.cos(top.pose.yaw-base.pose.yaw)<0 ? Math.PI : 0) };
}
// Exact rectangle intersection in the base's horizontal coordinate system.
export function overlapFraction(top: Pose, base: Pose): number {
  const a=top.yaw-base.yaw, c=Math.cos(base.yaw), s=Math.sin(base.yaw);
  const dx=top.x-base.x, dz=top.z-base.z;
  let polygon=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z])=>({x:dx*c-dz*s+x*MB6.w/2*Math.cos(a)+z*MB6.d/2*Math.sin(a),z:dx*s+dz*c-x*MB6.w/2*Math.sin(a)+z*MB6.d/2*Math.cos(a)}));
  for (const [axis,sign,limit] of [['x',1,MB6.w/2],['x',-1,MB6.w/2],['z',1,MB6.d/2],['z',-1,MB6.d/2]] as const) {
    const input=polygon; polygon=[];
    input.forEach((b,i)=>{ const a=input[(i+input.length-1)%input.length], da=sign*a[axis]-limit, db=sign*b[axis]-limit;
      if ((da<=0)!==(db<=0)) { const t=da/(da-db); polygon.push({x:a.x+t*(b.x-a.x),z:a.z+t*(b.z-a.z)}); }
      if(db<=0) polygon.push(b);
    });
  }
  return Math.abs(polygon.reduce((sum,p,i)=>{const q=polygon[(i+1)%polygon.length];return sum+p.x*q.z-q.x*p.z;},0))/2/(MB6.w*MB6.d);
}
export function restingBase(top: Assembly, boxes: Assembly[]): Assembly | undefined {
  return boxes.find(base=>base.id!==top.id && ready(top) && ready(base) && base.support===null && !base.restingOn && base.pose.y===0 && top.pose.y>=MB6.h-.04 && top.pose.y<=2.5 && overlapFraction(top.pose,base.pose)>.5+1e-8);
}
// A provisional support behaves as a contact plane while sliding; hand jitter
// must not push the crate through the supporting lid.
export function supportedPose(box: Assembly, pose: Pose, boxes: Assembly[]): Pose {
  const base=boxes.find(b=>b.id===box.restingOn);
  if (!base || !Object.values(pose).every(Number.isFinite)) return pose;
  if(overlapFraction(pose,base.pose)>.5+1e-8 && pose.y<MB6.h+.06) return {...pose,y:MB6.h};
  return pose;
}
export function reduceLab(state: Lab, action: Action): Lab {
  if (action.type === 'reset') return initialLab();
  if (action.type === 'select') return state.boxes.some(b => b.id === action.id) ? { ...state, selected: action.id } : state;
  const fail = (message: string) => ({ ...state, message });
  if (action.type === 'add') {
    if (state.boxes.length >= 2) return fail('O laboratório permite duas caixas.');
    const first = state.boxes[0];
    const x = first.pose.x + Math.abs(Math.cos(first.pose.yaw))*MB6.w/2 + Math.abs(Math.sin(first.pose.yaw))*MB6.d/2 + MB6.w/2 + 1;
    if (x === undefined) return fail('Libere espaço no piso antes de criar outra caixa.');
    const box = createBox(2); box.pose.x = x; box.pose.z = first.pose.z;
    return { boxes: [...state.boxes, box], selected: 2, message: 'Caixa 2 criada fechada e dobrada. Retire a tampa.' };
  }
  const b = state.boxes.find(box => box.id === state.selected)!;
  const update = (next: Assembly, message: string): Lab => {
    const result = { ...state, boxes: state.boxes.map(box => box.id === b.id ? next : box), message };
    return next.id === 1 && ready(next) && state.boxes.length === 1 ? reduceLab(result, { type: 'add' }) : result;
  };
  if (state.boxes.some(box => (box.support === b.id || box.restingOn === b.id))) return fail('Desempilhe a caixa superior antes de alterar a base.');
  if (action.type === 'unstack') {
    if (b.support === null && !b.restingOn) return fail('Esta caixa já está no piso.');
    const x = floorSlot(state.boxes.filter(other => other.id !== b.id), createBox(b.id).pose.x);
    if (x !== undefined) return update({ ...b, support: null, restingOn: null, pose: { x, y: 0, z: 0, yaw: 0 } }, 'Caixa devolvida ao piso.');
    return fail('Libere espaço no piso antes de desempilhar.');
  }
  if (b.support !== null) return fail('Desempilhe antes de alterar a caixa.');
  if (b.restingOn && !['move','drop','stack'].includes(action.type)) return fail('Leve a caixa ao piso antes de desmontá-la.');
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
    return update({ ...b, support: base.id, restingOn: null, pose: { ...base.pose, y: base.pose.y + MB6.h - MB6.pin, yaw: base.pose.yaw + (Math.cos(b.pose.yaw - base.pose.yaw) < 0 ? Math.PI : 0) } }, 'Encaixe confirmado: quatro pés alinhados aos quatro vértices.');
  }
  if (action.type === 'drop') {
    if (!ready(b)) return fail('Monte, trave e tampe a caixa antes de segurá-la com as duas mãos.');
    const p = supportedPose(b, action.pose, state.boxes);
    if (!Object.values(p).every(Number.isFinite)) return fail('Posição inválida. A caixa voltou ao ponto de partida.');
    const snapped = state.boxes.map(other => captureStackPose({ ...b, pose: p }, other)).find(Boolean);
    if (snapped) return reduceLab({ ...state, boxes: state.boxes.map(box => box.id === b.id ? { ...box, pose: snapped } : box) }, { type: 'stack' });
    const base = restingBase({ ...b, pose:p },state.boxes);
    if(base) return update({...b, restingOn:base.id, pose:{...p,y:MB6.h}},'Apoio provisório: segure novamente e ajuste até ouvir o encaixe.');
    if (Math.abs(p.y) <= 0.08) return reduceLab(state, { type: 'move', pose: { ...p, y: 0 } });
    return fail('Sem apoio válido: alinhe os quatro pés à outra caixa ou solte perto do piso. Caixa devolvida à origem.');
  }
  if (action.type === 'move') {
    const p = supportedPose(b, action.pose, state.boxes);
    if (!Object.values(p).every(Number.isFinite) || Math.abs(p.x) > 3 || Math.abs(p.z) > 3 || p.y < 0 || p.y > 2.5) return fail('Mantenha a caixa dentro da área de trabalho.');
    if (state.boxes.some(other => captureStackPose({ ...b, pose: p }, other))) return reduceLab(state, { type: 'drop', pose: p });
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
    return update({ ...b, restingOn: p.y === MB6.h ? restingBase({...b,pose:p},state.boxes)?.id ?? null : null, pose: { ...p } }, p.y > 0 ? 'Posição de teste suspensa. Alinhe e confirme o encaixe.' : 'Caixa posicionada no piso.');
  }
  return state;
}
