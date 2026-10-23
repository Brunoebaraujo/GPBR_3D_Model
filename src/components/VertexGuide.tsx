import { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { EdgesGeometry } from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import guideUrl from '../assets/mb6/MB6_Guia_Porta_1.stl?url';

export function VertexGuide() {
  const source = useLoader(STLLoader, guideUrl);
  const geometry = useMemo(() => {
    const g = source.clone();
    g.computeBoundingBox();
    const b = g.boundingBox!;
    g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -b.min.z);
    // SketchUp Z is up; 45 mm runs along the wall, 28 mm across it.
    g.rotateZ(-Math.PI / 2);
    g.rotateX(-Math.PI / 2);
    g.scale(.001, .001, .001);
    g.computeVertexNormals();
    return g;
  }, [source]);
  const edges = useMemo(() => new EdgesGeometry(geometry, 20), [geometry]);
  return <mesh geometry={geometry}>
    <meshStandardMaterial color="#b8c5cd" metalness={.55} roughness={.38} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
    <lineSegments geometry={edges} raycast={() => {}}><lineBasicMaterial color="#465564" toneMapped={false} /></lineSegments>
  </mesh>;
}
