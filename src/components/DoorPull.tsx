import { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import pullUrl from '../assets/mb6/MB6_Ferrolho_Puxador_Porta_4.stl?url';

export function DoorPull({ height }: { height: number }) {
  const source = useLoader(STLLoader, pullUrl);
  const geometry = useMemo(() => {
    const g=source.clone();g.computeBoundingBox();const b=g.boundingBox!;
    // The channel is open at +Y in the export: keep +Y upward on the wall.
    g.translate(-(b.min.x+b.max.x)/2,-(b.min.y+b.max.y)/2,-b.min.z);
    g.scale(.001,.001,.001);g.computeVertexNormals();return g;
  },[source]);
  return <mesh geometry={geometry} position={[0,height/2,.02]}>
    <meshStandardMaterial color="#b8c5cd" metalness={.55} roughness={.38} />
    <Edges threshold={20} color="#465564" />
  </mesh>;
}
