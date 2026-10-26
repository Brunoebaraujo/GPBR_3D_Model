export type HandMode = 'free' | 'wall' | 'box';
type Button = { value: number; pressed: boolean; touched?: boolean };
export type HandPad = { mapping: string; buttons: readonly Button[] };
export type HandPose = { index: number; fingers: number; thumb: number; roll: number };
const clamp = (n: number) => Number.isFinite(n) ? Math.max(0,Math.min(1,n)) : 0;
// xr-standard: trigger 0, squeeze 1, thumbstick 3. Oculus Touch face buttons 4/5.
// Capacitive contact is a pose hint, not an optical measurement of finger angles.
export function handPose(pad: HandPad | null | undefined, profiles: readonly string[], left: boolean, mode: HandMode = 'free', fallback = 0): HandPose {
  const sign=left?1:-1;
  if(mode==='wall') return {index:.86,fingers:.92,thumb:.65,roll:0};
  if(mode==='box') return {index:.9,fingers:.95,thumb:.8,roll:0};
  const standard=pad?.mapping==='xr-standard';
  const trigger=standard?pad.buttons[0]:undefined, grip=standard?pad.buttons[1]:undefined;
  const index=clamp(Math.max(trigger?.value ?? fallback,trigger?.pressed?1:0,trigger?.touched? .18:0));
  const fingers=clamp(Math.max(grip?.value ?? 0,grip?.pressed?1:0,index*.8));
  const touchProfile=profiles.some(p=>p.startsWith('oculus-touch') || p.startsWith('meta-quest-touch'));
  const thumbIndices=touchProfile?[3,4,5]:[3];
  const touched=standard && thumbIndices.some(i=>{const b=pad.buttons[i];return b && (b.touched || b.pressed || b.value>.1);});
  return {index,fingers,thumb:touched? .8:0,roll:sign*Math.PI/2};
}

export function doorGripHeld(pad: HandPad | null | undefined): boolean {
  if(pad?.mapping!=='xr-standard')return false;
  const pressed=(i:number)=>!!pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value>=.7);
  return pressed(0) && pressed(1) && [4,5].some(i=>!!pad.buttons[i] && (pad.buttons[i].touched || pad.buttons[i].pressed));
}
export const clipboardHeld = (pad: HandPad | null | undefined) => pad?.mapping==='xr-standard' && !!pad.buttons[4]?.pressed;
