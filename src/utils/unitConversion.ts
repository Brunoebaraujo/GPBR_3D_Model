import type { RotationDeg, Vector3Mm } from '../types';

export const MM_PER_THREE_UNIT = 1000;

export const mmToThreeUnits = (valueMm: number): number => valueMm / MM_PER_THREE_UNIT;

export const threeUnitsToMm = (value: number): number => value * MM_PER_THREE_UNIT;

export const degreesToRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const radiansToDegrees = (radians: number): number => (radians * 180) / Math.PI;

export const packingPositionToThree = (position: Vector3Mm): [number, number, number] => [
  mmToThreeUnits(position.x),
  mmToThreeUnits(position.z),
  mmToThreeUnits(position.y),
];

export const threePositionToPacking = (position: { x: number; y: number; z: number }): Vector3Mm => ({
  x: Math.round(threeUnitsToMm(position.x)),
  y: Math.round(threeUnitsToMm(position.z)),
  z: Math.round(threeUnitsToMm(position.y)),
});

export const rotationDegreesToRadians = (rotation: RotationDeg): [number, number, number] => [
  degreesToRadians(rotation.x),
  degreesToRadians(rotation.z),
  degreesToRadians(rotation.y),
];

export const threeRotationToPackingDegrees = (rotation: { x: number; y: number; z: number }): RotationDeg => ({
  x: Math.round(radiansToDegrees(rotation.x)),
  y: Math.round(radiansToDegrees(rotation.z)),
  z: Math.round(radiansToDegrees(rotation.y)),
});

export const formatNumber = (value: number, fractionDigits = 1): string =>
  new Intl.NumberFormat('en-US', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value);
