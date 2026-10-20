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
