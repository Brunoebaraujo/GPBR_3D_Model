import handleUrl from '../assets/mb6/MB6_Ferrolho_Alavanca.stl?url';
import { EdgesGeometry } from 'three';
import { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import sliderUrl from '../assets/mb6/MB6_Ferrolho_Deslizante.stl?url';
import supportUrl from '../assets/mb6/MB6_Ferrolho_Suporte.stl?url';

export function LatchSupport({ direction, slider = false, handle = false }: { direction: number; slider?: boolean; handle?: boolean }) {
  const [support, bar, lever] = useLoader(STLLoader, [supportUrl, sliderUrl, handleUrl]);
  const source = handle ? lever : slider ? bar : support;
  const geometry = useMemo(() => {
    const g = source.clone();
    support.computeBoundingBox();
    const bounds = support.boundingBox!;
    // This SketchUp export uses XY for the mounting face and Z for depth.
    // Preserve its 150 x 50 x 28 mm envelope; register the rear face at -7 mm
    // in the existing latch frame, exactly where the old support began.
    g.translate(-(bounds.min.x + bounds.max.x) / 2, -(bounds.min.y + bounds.max.y) / 2, -bounds.min.z);
    g.scale(.001, .001, .001);
    g.translate(0, 0, -.007);
    // Handle-local coordinates around the center of its upper stem edge.
    if (handle) g.translate(.056, -.008609009, -.014);
    g.computeVertexNormals();
    return g;
  }, [source, support, handle]);
  const edges = useMemo(() => new EdgesGeometry(geometry, 20), [geometry]);
  return <mesh geometry={geometry} scale={[direction, 1, 1]}>
    <meshStandardMaterial color="#b8c5cd" metalness={.55} roughness={.38} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
    <lineSegments geometry={edges} raycast={() => {}}>
      <lineBasicMaterial color="#465564" toneMapped={false} />
    </lineSegments>
  </mesh>;
}

