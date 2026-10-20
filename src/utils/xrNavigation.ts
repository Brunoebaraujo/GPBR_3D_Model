import { MB6, type Assembly } from './mb6Assembly';
import type { Pose } from './mb6Assembly';
import type { Point3 } from './xrInteraction';
import { cargoBodies, sceneLength, type RoadVehicle } from './roadLoading';
export type Exploration = { key: string; mode: 'walk' | 'fly'; vehicle?: RoadVehicle; view: 'entry' | 'inside' | 'outside' | 'overview'; revision: number };
export function explorationStart(config: Exploration): Pose {
  const v = config.vehicle, length = v ? sceneLength(v) / 1000 : 3;
  const width = v ? Math.max(...cargoBodies(v).map(b => b.width)) / 1000 : 2;
  if (config.view === 'overview') return { x: width / 2 + 1.5, y: 4, z: length / 2 + 1.5, yaw: Math.PI / 4 };
  if (config.view === 'inside') return { x: 0, y: 0, z: Math.max(0, length / 2 - .7), yaw: 0 };
  if (config.view === 'outside') return { x: width / 2 + 1.5, y: 0, z: 0, yaw: Math.PI / 2 };
  return { x: 0, y: 0, z: v ? length / 2 + 1.5 : 3, yaw: 0 };
}
// Bound the actual headset location, including physical room-scale displacement.
// Ground is the cargo-floor datum. Flight changes the rig, never the user's eye height.
export function constrainExploration(pose: Pose, viewer: Point3, config: Exploration): Pose {
  const v = config.vehicle;
  if (!v) return pose;
  const xOffset = viewer.x * Math.cos(pose.yaw) + viewer.z * Math.sin(pose.yaw);
  const zOffset = -viewer.x * Math.sin(pose.yaw) + viewer.z * Math.cos(pose.yaw);
  const halfWidth = Math.max(...cargoBodies(v).map(b => b.width)) / 2000 + 2;
  const halfLength = sceneLength(v) / 2000 + 2;
  const clamp = (n: number, limit: number) => Math.max(-limit, Math.min(limit, n));
  return { ...pose, x: clamp(pose.x + xOffset, halfWidth) - xOffset,
    z: clamp(pose.z + zOffset, halfLength) - zOffset,
    y: config.mode === 'walk' ? 0 : Math.max(0, Math.min(10, pose.y)) };
}

export function constrainCrates(pose: Pose, viewer: Point3, boxes: Assembly[]): Pose {
  const offsetX=viewer.x*Math.cos(pose.yaw)+viewer.z*Math.sin(pose.yaw);
  const offsetZ=-viewer.x*Math.sin(pose.yaw)+viewer.z*Math.cos(pose.yaw);
  let x=pose.x+offsetX,z=pose.z+offsetZ;
  for (const box of boxes) {
    if (box.pose.y>1.8) continue;
    const c=Math.cos(box.pose.yaw),s=Math.sin(box.pose.yaw);
    let lx=(x-box.pose.x)*c-(z-box.pose.z)*s,lz=(x-box.pose.x)*s+(z-box.pose.z)*c;
    const wx=MB6.w/2+.22,wz=MB6.d/2+.22;
    if(Math.abs(lx)>=wx || Math.abs(lz)>=wz) continue;
    if(wx-Math.abs(lx)<wz-Math.abs(lz)) lx=(lx<0?-1:1)*wx;
    else lz=(lz<0?-1:1)*wz;
    x=box.pose.x+lx*c+lz*s;z=box.pose.z-lx*s+lz*c;
  }
  return {...pose,x:x-offsetX,z:z-offsetZ};
}
