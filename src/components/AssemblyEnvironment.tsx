import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, ShaderMaterial, SRGBColorSpace, TextureLoader } from 'three';

const HEIGHT = 6.75;
const WIDTH = 12;
const vertexShader = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const fragmentShader = `
uniform sampler2D picture;
uniform float loaded;
uniform float reveal;
varying vec2 vUv;
void main() {
  if (vUv.y > reveal) discard;
  vec3 color = mix(vec3(0.78, 0.80, 0.81), texture2D(picture, vUv).rgb, loaded);
  float edge = 1.0 - smoothstep(0.0, 0.018, abs(vUv.y - reveal));
  float grid = step(0.97, fract(vUv.x * 48.0));
  color += vec3(0.02, 0.6, 0.85) * edge * (0.7 + grid);
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function PhotoWall({ file, position, rotation, progress, settled }: {
  file: string; position: [number, number, number]; rotation: [number, number, number];
  progress: React.MutableRefObject<number>;
  settled: React.MutableRefObject<Set<string>>;
}) {
  const material = useMemo(() => new ShaderMaterial({
    vertexShader, fragmentShader,
    uniforms: { picture: { value: null }, loaded: { value: 0 }, reveal: { value: 0 } },
  }), []);
  useEffect(() => {
    let alive = true;
    const loadedFiles = settled.current;
    const texture = new TextureLoader().load(`${import.meta.env.BASE_URL}vr-environment/${file}`,
      loaded => { if (alive) { loaded.colorSpace = SRGBColorSpace; material.uniforms.picture.value = loaded; material.uniforms.loaded.value = 1; loadedFiles.add(file); } },
      undefined, () => { if (alive) { loadedFiles.add(file); console.warn(`Ambiente MB6: não foi possível carregar ${file}`); } });
    return () => { alive = false; texture.dispose(); material.uniforms.loaded.value = 0; loadedFiles.delete(file); };
  }, [file, material, settled]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => { material.uniforms.reveal.value = progress.current; });
  return <mesh position={position} rotation={rotation} material={material} raycast={() => undefined}>
    <planeGeometry args={[WIDTH, HEIGHT]} />
  </mesh>;
}

/** Architectural shell around the existing, interactive MB6 assembly area. */
export function AssemblyEnvironment({ presenting }: { presenting: boolean }) {
  const settled = useRef(new Set<string>());
  const progress = useRef(1.1);
  const elapsed = useRef(10);
  const roof = useRef<Group>(null);
  const scan = useRef<Group>(null);
  const reducedMotion = useRef(false);
  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    elapsed.current = presenting && !reducedMotion.current ? 0 : 10;
    progress.current = elapsed.current === 0 ? 0 : 1.1;
  }, [presenting]);
  useFrame((_, delta) => {
    if (settled.current.size === 3) elapsed.current += Math.min(delta, 0.05);
    progress.current = Math.min(1.1, elapsed.current / 3.5);
    if (scan.current) {
      scan.current.visible = progress.current < 1;
      scan.current.position.y = Math.min(HEIGHT, progress.current * HEIGHT);
    }
    if (roof.current) {
      const phase = Math.min(1, Math.max(0, (elapsed.current - 3.3) / 0.9));
      roof.current.visible = phase > 0;
      roof.current.scale.set(phase, 1, phase);
    }
  });
  return <group>
    <PhotoWall file="Visao_Frontal_Goodpack.png" position={[0, HEIGHT / 2, -6]} rotation={[0, 0, 0]} progress={progress} settled={settled} />
    <PhotoWall file="Visao_Esquerda_Goodpack.png" position={[-6, HEIGHT / 2, 0]} rotation={[0, Math.PI / 2, 0]} progress={progress} settled={settled} />
    <PhotoWall file="Visao_Direita_Goodpack.png" position={[6, HEIGHT / 2, 0]} rotation={[0, -Math.PI / 2, 0]} progress={progress} settled={settled} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]} raycast={() => undefined}>
      <planeGeometry args={[12, 12]} /><meshStandardMaterial color="#a5a6a1" roughness={0.55} />
    </mesh>
    <group ref={scan}>
      {[-1, 1].map(side => <mesh key={side} position={[side * 5.98, 0, 0]} raycast={() => undefined}>
        <boxGeometry args={[0.025, 0.025, 12]} /><meshBasicMaterial color="#35dfff" toneMapped={false} />
      </mesh>)}
      <mesh position={[0, 0, -5.98]} raycast={() => undefined}><boxGeometry args={[12, 0.025, 0.025]} /><meshBasicMaterial color="#35dfff" toneMapped={false} /></mesh>
    </group>
    <group ref={roof} position={[0, HEIGHT, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} raycast={() => undefined}><planeGeometry args={[12, 12]} /><meshStandardMaterial color="#e6e8e8" roughness={0.9} /></mesh>
      {[-4, -2, 0, 2, 4].map(z => <group key={z}>
        <mesh position={[0, -0.12, z]} raycast={() => undefined}><boxGeometry args={[12, 0.22, 0.1]} /><meshStandardMaterial color="#cbd0d3" /></mesh>
        {[-3, 3].map(x => <mesh key={x} position={[x, -0.25, z]} raycast={() => undefined}><boxGeometry args={[1.1, 0.035, 0.16]} /><meshStandardMaterial color="white" emissive="white" emissiveIntensity={1.2} /></mesh>)}
      </group>)}
      {[-4, 0, 4].map(x => <mesh key={x} position={[x, -0.06, 0]} raycast={() => undefined}><boxGeometry args={[0.09, 0.12, 12]} /><meshStandardMaterial color="#d9dddf" /></mesh>)}
    </group>
  </group>;
}
