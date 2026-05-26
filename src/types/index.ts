export type PackingObjectType = 'block' | 'cube' | 'cylinder';

export interface DimensionsMm {
  width: number;
  depth: number;
  height: number;
}

export interface Vector3Mm {
  x: number;
  y: number;
  z: number;
}

export interface RotationDeg {
  x: number;
  y: number;
  z: number;
}

export interface PackingObject {
  id: string;
  type: PackingObjectType;
  name: string;
  dimensions: DimensionsMm;
  weightKg: number;
  position: Vector3Mm;
  rotation: RotationDeg;
  color: string;
}

export interface ContainerSpec {
  name: string;
  externalDimensions: DimensionsMm;
  internalDimensions: DimensionsMm;
  maxPayloadKg: number;
  emptyWeightKg: number;
}

export interface ObjectValidationResult {
  objectId: string;
  fits: boolean;
  warnings: string[];
}

export interface FitValidationResult {
  fits: boolean;
  volumeUtilizationPercent: number;
  occupiedVolumeMm3: number;
  internalVolumeMm3: number;
  totalObjectWeightKg: number;
  remainingPayloadKg: number;
  objectCount: number;
  warnings: string[];
  objectResults: ObjectValidationResult[];
}
