/** Metric layout shared by scenery and headset collision bounds. */
export const WAREHOUSE = { halfWidth: 9, halfDepth: 11, height: 7.2 };
export const STORAGE_STACKS = [
  ...[-1, 1].flatMap(side => [-7.5, -5.9, -4.3, -2.7, -1.1, .5, 2.1, 3.7, 5.3].map((z, i) => ({ x: side * 7.5, z, levels: i < 5 ? 3 : 2 }))),
  ...[-4.2, -2.8, -1.4, 0, 1.4, 2.8, 4.2].map(x => ({ x, z: -9.5, levels: 3 })),
];
export function warehousePosition(x: number, z: number) {
  const margin = .28;
  x = Math.max(-WAREHOUSE.halfWidth + margin, Math.min(WAREHOUSE.halfWidth - margin, x));
  z = Math.max(-WAREHOUSE.halfDepth + margin, Math.min(WAREHOUSE.halfDepth - margin, z));
  // Treat each row as one solid footprint so narrow gaps cannot trap the viewer.
  const obstacles = [
    { x: -7.5, z: -1.1, w: .56, d: 7.01 }, { x: 7.5, z: -1.1, w: .56, d: 7.01 },
    { x: 0, z: -9.5, w: 4.76, d: .61 }, { x: -4.7, z: 7.6, w: 1.2, d: .325 },
  ];
  for (const stack of obstacles) {
    const dx = x - stack.x, dz = z - stack.z, wx = stack.w + margin, wz = stack.d + margin;
    if (Math.abs(dx) >= wx || Math.abs(dz) >= wz) continue;
    if (wx - Math.abs(dx) < wz - Math.abs(dz)) x = stack.x + (dx < 0 ? -wx : wx);
    else z = stack.z + (dz < 0 ? -wz : wz);
  }
  return { x, z };
}
