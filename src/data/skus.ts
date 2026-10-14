import type { ContainerSpec, PackingObject } from '../types';

export const MB5_CONTAINER: ContainerSpec = {
  name: 'Goodpack MB5',
  externalDimensions: {
    width: 1150,
    depth: 1465,
    height: 1098,
  },
  internalDimensions: {
    width: 1090,
    depth: 1437,
    height: 1020,
  },
  maxPayloadKg: 1650,
  emptyWeightKg: 132,
};

export const STARTER_OBJECTS: PackingObject[] = [
  {
    id: 'sample-block',
    type: 'block',
    name: 'Sample block',
    dimensions: {
      width: 400,
      depth: 300,
      height: 220,
    },
    weightKg: 75,
    position: {
      x: 0,
      y: 0,
      z: 110,
    },
    rotation: {
      x: 0,
      y: 0,
      z: 0,
    },
    color: '#2f80ed',
  },
];

export const MB6_CONTAINER: ContainerSpec = {
  name: 'Goodpack MB6',
  externalDimensions: { width: 1120, depth: 1220, height: 1076 },
  internalDimensions: { width: 1069, depth: 1187, height: 981 },
  maxPayloadKg: 1650,
  emptyWeightKg: 115,
};
export const GOODPACK_MODELS = { MB5: MB5_CONTAINER, MB6: MB6_CONTAINER };
export type GoodpackModel = keyof typeof GOODPACK_MODELS;
