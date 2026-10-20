import { useSyncExternalStore, type ReactNode } from 'react';
import type { RoadVehicle } from '../utils/roadLoading';
export type StudioModule = 'product' | 'road' | 'vr';
export type VRCommand = { label: string; run: () => void };
export type VRModuleData = { scene: ReactNode; actions: VRCommand[]; status: string; vehicle?: RoadVehicle };
const snapshots: Partial<Record<StudioModule, VRModuleData>> = {};
const listeners = new Set<() => void>();
export function publishVR(module: StudioModule, data: VRModuleData) {
  snapshots[module] = data;
  listeners.forEach(listener => listener());
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useVRModule(module: StudioModule) {
  return useSyncExternalStore(subscribe, () => snapshots[module]);
}
