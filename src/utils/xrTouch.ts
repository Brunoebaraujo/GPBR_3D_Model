import type { Point3 } from './xrInteraction';
export type TouchState = { armed: boolean; pressed: boolean };
// Local +Z is the front of a button. Release margin prevents repeated presses from jitter.
export function touchButton(state: TouchState, points: Point3[], width: number, height: number) {
  const inside=(p:Point3,margin:number)=>Math.abs(p.x)<=width/2+margin && Math.abs(p.y)<=height/2+margin && p.z>=-.04-margin && p.z<=.055+margin;
  const contact=points.some(p=>inside(p,.012));
  const clear=points.every(p=>!inside(p,.045));
  const fire=state.armed && contact && !state.pressed;
  return {armed:clear || (state.armed && !contact),pressed:contact || (state.pressed && !clear),fire};
}
