import { Edges } from '@react-three/drei';
import { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import sliderUrl from '../assets/mb6/MB6_Ferrolho_Deslizante.stl?url';
import supportUrl from '../assets/mb6/MB6_Ferrolho_Suporte.stl?url';

export function LatchSupport({ direction, slider = false }: { direction: number; slider?: boolean }) {
  const [support, bar] = useLoader(STLLoader, [supportUrl, sliderUrl]);
  const source = slider ? bar : support;
  const geometry = useMemo(() => {
    const g = source.clone();
    support.computeBoundingBox();
    const bounds = support.boundingBox!;
    // This SketchUp export uses XY for the mounting face and Z for depth.
    // Preserve its 150 x 50 x 28 mm envelope; register the rear face at -7 mm
    // in the existing latch frame, exactly where the old support began.
    g.translate(-(bounds.min.x + bounds.max.x) / 2, -(bounds.min.y + bounds.max.y) / 2, -bounds.min.z);
    g.scale(.001, .001, .001);
    g.translate(slider ? -.038 : 0, 0, -.007);
    g.computeVertexNormals();
    return g;
  }, [source, support, slider]);
  return <mesh geometry={geometry} scale={[direction, 1, 1]}>
    <meshStandardMaterial color="#b8c5cd" metalness={.55} roughness={.38} />
    <Edges threshold={20} color="#465564" />
  </mesh>;
}

