import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, BufferGeometry, CanvasTexture, Group, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STORAGE_STACKS, WAREHOUSE } from '../utils/assemblyWarehouse';

type Vec = [number, number, number];
const ignoreRay = () => undefined;
const palette = { wall: '#d9deda', metal: '#7e929b', panel: '#bac4c4', dark: '#233c4b', blue: '#08449e', white: '#eef1ec', concrete: '#9b9c94', yellow: '#e0b847', light: '#ffffff', wood: '#b98c54', shadow: '#626d6a' };
type Surface = keyof typeof palette;

// Merge decorative boxes by material: dozens of stacks, few draw calls.
function warehouseGeometry() {
  const parts = Object.fromEntries(Object.keys(palette).map(k => [k, [] as BufferGeometry[]])) as Record<Surface, BufferGeometry[]>;
  const box = (surface: Surface, size: Vec, at: Vec) => parts[surface].push(new BoxGeometry(...size).translate(...at));
  const { halfWidth: w, halfDepth: d, height: h } = WAREHOUSE;
  box('concrete', [w * 2, .12, d * 2], [0, -.07, 0]);
  for (const side of [-1, 1]) {
    box('wall', [.2, h, d * 2 + .4], [side * (w + .1), h / 2, 0]);
    box('wall', [w * 2, h, .2], [0, h / 2, side * (d + .1)]);
    box('dark', [.06, .32, d * 2], [side * (w - .03), .16, 0]);
    box('dark', [w * 2, .32, .06], [0, .16, side * (d - .03)]);
    box('white', [.07, .008, 19], [side * 5.8, .002, 0]);
    box('white', [.055, .008, 8], [side * 3.2, .002, .8]);
    box('white', [6.45, .008, .055], [0, .002, .8 + side * 4]);
  }
  // Sparse slab joints, replacing the graph-paper grid.
  for (const x of [-6, -3, 0, 3, 6]) box('shadow', [.009, .003, 22], [x, -.003, 0]);
  for (const z of [-8, -4, 0, 4, 8]) box('shadow', [18, .003, .009], [0, -.003, z]);
  box('white', [18.4, .15, 22.4], [0, h + .075, 0]);
  for (const z of [-9, -5.4, -1.8, 1.8, 5.4, 9]) {
    box('metal', [18, .32, .18], [0, h - .28, z]);
    for (const side of [-1, 1]) {
      box('white', [.25, h, .25], [side * 8.8, h / 2, z]);
      box('yellow', [.32, .8, .32], [side * 8.8, .4, z]);
    }
    for (const x of [-4.5, 0, 4.5]) {
      box('metal', [.025, .55, .025], [x, h - .65, z]);
      box('dark', [1.7, .10, .28], [x, h - .95, z]);
      box('light', [1.6, .018, .24], [x, h - 1.01, z]);
    }
  }
  for (const x of [-6, -3, 0, 3, 6]) box('white', [.09, .14, 22], [x, h - .08, 0]);
  for (const x of [-2.2, 2.2]) {
    box('panel', [.42, .35, 21.5], [x, h - .58, 0]);
    for (const z of [-8, -4, 0, 4, 8]) box('metal', [.46, .39, .04], [x, h - .58, z]);
  }
  for (const stack of STORAGE_STACKS) {
    box('shadow', [1.23, .008, 1.33], [stack.x, -.001, stack.z]);
    for (let level = 0; level < stack.levels; level++) {
      const x = stack.x, y = level * 1.076, z = stack.z;
      box('dark', [1.1, .10, 1.2], [x, y + .12, z]);
      box('panel', [1.04, .88, 1.14], [x, y + .61, z]);
      box('metal', [1.12, .055, 1.22], [x, y + 1.048, z]);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        box('metal', [.065, 1.04, .065], [x + sx * .527, y + .55, z + sz * .577]);
        box('dark', [.14, .09, .16], [x + sx * .49, y + .045, z + sz * .54]);
        box('blue', [.16, .045, .018], [x + sx * .40, y + 1.02, z + sz * .619]);
      }
      for (const side of [-1, 1]) {
        for (const yy of [.23, .65, .94]) {
          box('metal', [1.11, .025, .025], [x, y + yy, z + side * .59]);
          box('metal', [.025, .025, 1.21], [x + side * .54, y + yy, z]);
        }
        for (const xx of [-.3, 0, .3]) box('metal', [.025, .83, .025], [x + xx, y + .61, z + side * .59]);
        for (const zz of [-.34, 0, .34]) box('metal', [.025, .83, .025], [x + side * .54, y + .61, z + zz]);
      }
    }
  }
  // Loading shutter and a personnel door on the fourth wall.
  box('dark', [4.3, 4.4, .16], [1.8, 2.2, 10.86]);
  box('metal', [4, 4.1, .06], [1.8, 2.06, 10.75]);
  for (let y = .25; y < 4.1; y += .19) box('dark', [4, .018, .015], [1.8, y, 10.71]);
  for (const x of [-.5, 4.1]) box('yellow', [.16, .95, .16], [x, .475, 10.3]);
  box('dark', [1.15, 2.35, .1], [-5.4, 1.175, 10.85]);
  box('light', [.06, .32, .04], [-5.05, 1.1, 10.77]);
  box('wood', [2.4, .12, .65], [-4.7, .48, 7.6]);
  for (const x of [-5.6, -3.8]) box('dark', [.12, .42, .5], [x, .21, 7.6]);
  return Object.entries(parts).map(([key, geometries]) => {
    const geometry = mergeGeometries(geometries);
    geometries.forEach(g => g.dispose());
    return { key: key as Surface, geometry };
  });
}

function signTexture(title: string, subtitle: string, dark: boolean) {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = dark ? '#073a69' : '#edf0e9'; ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = dark ? '#ffffff' : '#07398f'; ctx.font = 'bold 106px Arial'; ctx.textAlign = 'center';
  ctx.fillText(title, 480, 130, 870);
  ctx.fillStyle = dark ? '#bdd4de' : '#365d79'; ctx.font = '27px Arial'; ctx.fillText(subtitle, 490, 196, 880);
  ctx.fillStyle = '#72bb24'; ctx.beginPath();ctx.moveTo(943,65);ctx.lineTo(991,128);ctx.lineTo(943,191);ctx.lineTo(920,191);ctx.lineTo(968,128);ctx.lineTo(920,65);ctx.fill();
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; return texture;
}

function concreteTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!, pixels = ctx.createImageData(256, 256);
  let seed = 47;
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const value = 185 + (seed >>> 27);
    pixels.data.set([value, value, value - 4, 255], i);
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping; texture.repeat.set(8, 8); return texture;
}

/** Continuous metric warehouse; decorative geometry never intercepts crate rays. */
export function AssemblyEnvironment({ presenting, revision = 0 }: { presenting: boolean; revision?: number }) {
  const elapsed = useRef(10), scan = useRef<Group>(null);
  const reveal = useMemo(() => ({ value: 8 }), []);
  const resources = useMemo(() => {
    const floor = concreteTexture();
    const logo = signTexture('GOODPACK', 'N E T W O R K  @  W O R K', false);
    const system = signTexture('REUSE. RETURN.', 'THE GLOBAL REUSABLE IBC NETWORK', true);
    const exit = signTexture('SAÍDA', 'EXPEDIÇÃO  /  DISPATCH', true);
    const prepare = (material: MeshStandardMaterial) => {
      material.onBeforeCompile = shader => {
        shader.uniforms.uBuildHeight = reveal;
        shader.vertexShader = 'varying float vBuildY;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBuildY = (modelMatrix * vec4(transformed, 1.0)).y;');
        shader.fragmentShader = 'uniform float uBuildHeight; varying float vBuildY;\n' + shader.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vBuildY > uBuildHeight) discard;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.02, 0.7, 1.0) * (1.0 - smoothstep(0.0, 0.10, abs(vBuildY - uBuildHeight)));');
      };
      material.customProgramCacheKey = () => 'warehouse-rise-v1'; return material;
    };
    const meshes = warehouseGeometry().map(({ key, geometry }) => ({ key, geometry, material: prepare(new MeshStandardMaterial({
      color: palette[key], roughness: key === 'metal' ? .43 : key === 'concrete' ? .8 : .68,
      metalness: key === 'metal' ? .55 : key === 'panel' ? .25 : 0,
      map: key === 'concrete' ? floor : null,
      emissive: key === 'light' ? '#ffffff' : '#000000', emissiveIntensity: key === 'light' ? 1.4 : 0,
    })) }));
    const signs = [logo, system, exit].map(map => prepare(new MeshStandardMaterial({ map, roughness: .9 })));
    return { meshes, signs, textures: [floor, logo, system, exit] };
  }, [reveal]);
  useEffect(() => () => {
    resources.meshes.forEach(({ geometry, material }) => { geometry?.dispose(); material.dispose(); });
    resources.signs.forEach(m => m.dispose()); resources.textures.forEach(t => t.dispose());
  }, [resources]);
  useEffect(() => {
    elapsed.current = (presenting || revision > 0) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 10;
    reveal.value = elapsed.current === 0 ? 0 : 8;
  }, [presenting, revision, reveal]);
  useFrame((_, delta) => {
    elapsed.current += Math.min(delta, .05);
    reveal.value = Math.min(8, elapsed.current * 1.8);
    if (scan.current) { scan.current.visible = reveal.value < 7.3; scan.current.position.y = reveal.value; }
  });
  return <group name="continuous-warehouse" dispose={null}>
    {resources.meshes.map(({ key, geometry, material }) => geometry && <mesh key={key} geometry={geometry} material={material} raycast={ignoreRay} />)}
    <mesh position={[0, 4.8, -10.87]} material={resources.signs[0]} raycast={ignoreRay}><planeGeometry args={[5.2, 1.3]} /></mesh>
    <mesh position={[-8.87, 4.5, 0]} rotation={[0, Math.PI / 2, 0]} material={resources.signs[1]} raycast={ignoreRay}><planeGeometry args={[4.8, 1.2]} /></mesh>
    <mesh position={[1.8, 4.85, 10.87]} rotation={[0, Math.PI, 0]} material={resources.signs[2]} raycast={ignoreRay}><planeGeometry args={[3.2, .8]} /></mesh>
    <group ref={scan}>
      {[-1, 1].map(side => <group key={side}>
        <mesh position={[side * 8.97, 0, 0]} raycast={ignoreRay}><boxGeometry args={[.025, .025, 22]} /><meshBasicMaterial color="#37dfff" toneMapped={false} /></mesh>
        <mesh position={[0, 0, side * 10.97]} raycast={ignoreRay}><boxGeometry args={[18, .025, .025]} /><meshBasicMaterial color="#37dfff" toneMapped={false} /></mesh>
      </group>)}
    </group>
  </group>;
}
