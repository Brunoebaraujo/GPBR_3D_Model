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
      y: 110,
      z: 0,
    },
    rotation: {
      x: 0,
      y: 0,
      z: 0,
    },
    color: '#2f80ed',
  },
];
