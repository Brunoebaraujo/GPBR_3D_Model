import type { RotationDeg } from '../types';

export const MM_PER_THREE_UNIT = 1000;

export const mmToThreeUnits = (valueMm: number): number => valueMm / MM_PER_THREE_UNIT;

export const threeUnitsToMm = (value: number): number => value * MM_PER_THREE_UNIT;

export const degreesToRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const rotationDegreesToRadians = (rotation: RotationDeg): [number, number, number] => [
  degreesToRadians(rotation.x),
  degreesToRadians(rotation.y),
  degreesToRadians(rotation.z),
];

export const formatNumber = (value: number, fractionDigits = 1): string =>
  new Intl.NumberFormat('en-US', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value);
