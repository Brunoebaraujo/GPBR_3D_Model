import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls, PerspectiveCamera, TransformControls } from '@react-three/drei';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Group } from 'three';
import type { PackingObject, TransformMode } from '../types';
import { MB5Container } from './MB5Container';
import { PackingObject as PackingObjectMesh } from './PackingObject';
import { threePositionToPacking, threeRotationToPackingDegrees } from '../utils/unitConversion';

interface Scene3DProps {
  objects: PackingObject[];
  selectedObjectId: string | null;
  transformMode: TransformMode;
  onSelectObject: (id: string | null) => void;
  onUpdateObject: (object: PackingObject) => void;
}

export function Scene3D({
  objects,
  selectedObjectId,
  transformMode,
  onSelectObject,
  onUpdateObject,
}: Scene3DProps) {
  const objectRefs = useRef<Record<string, Group | null>>({});
  const objectRefCallbacks = useRef<Record<string, (group: Group | null) => void>>({});
  const transformControlsRef = useRef<any>(null);
  const selectedObjectRef = useRef<PackingObject | null>(null);
  const [isTransformDragging, setIsTransformDragging] = useState(false);
  const [refsVersion, setRefsVersion] = useState(0);

  const selectedObject = objects.find((object) => object.id === selectedObjectId) ?? null;
  const selectedGroup = selectedObjectId ? objectRefs.current[selectedObjectId] ?? null : null;
  selectedObjectRef.current = selectedObject;

  const commitSelectedTransform = useCallback(() => {
    const object = selectedObjectRef.current;
    const group = object ? objectRefs.current[object.id] : null;

    if (!object || !group) {
      return;
    }

    group.updateMatrixWorld(true);
    onUpdateObject({
      ...object,
      position: threePositionToPacking(group.position),
      rotation: threeRotationToPackingDegrees(group.rotation),
    });
  }, [onUpdateObject]);

  useEffect(() => {
    const controls = transformControlsRef.current;

    if (!controls) {
      return;
    }

    const handleDraggingChanged = (event: { value: boolean }) => {
      if (!event.value) {
        commitSelectedTransform();
      }

      setIsTransformDragging(event.value);
    };

    controls.addEventListener('dragging-changed', handleDraggingChanged);

    return () => {
      controls.removeEventListener('dragging-changed', handleDraggingChanged);
    };
  }, [commitSelectedTransform, selectedGroup]);

  const getObjectRef = useCallback((id: string) => {
    if (!objectRefCallbacks.current[id]) {
      objectRefCallbacks.current[id] = (group: Group | null) => {
        if (objectRefs.current[id] === group) {
          return;
        }

        objectRefs.current[id] = group;
        setRefsVersion((version) => version + 1);
      };
    }

    return objectRefCallbacks.current[id];
  }, []);

  return (
    <div className="scene-shell">
      <Canvas shadows onPointerMissed={() => onSelectObject(null)}>
        <PerspectiveCamera makeDefault position={[1.9, 1.7, 2.4]} fov={48} />
        <color attach="background" args={['#eef2f5']} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[3, 5, 4]} intensity={1.3} castShadow />
        <MB5Container />
        {objects.map((object) => (
          <PackingObjectMesh
            key={object.id}
            ref={getObjectRef(object.id)}
            object={object}
            isSelected={object.id === selectedObjectId}
            onSelect={onSelectObject}
          />
        ))}
        {selectedGroup ? (
          <TransformControls
            key={`${selectedObjectId ?? 'none'}-${refsVersion}`}
            ref={transformControlsRef}
            object={selectedGroup}
            mode={transformMode}
          />
        ) : null}
        <Grid
          args={[5, 5]}
          cellSize={0.25}
          cellThickness={0.5}
          sectionSize={1}
          sectionThickness={1}
          fadeDistance={8}
          fadeStrength={1}
          infiniteGrid
        />
        <OrbitControls enablePan enableZoom enabled={!isTransformDragging} makeDefault />
      </Canvas>
    </div>
  );
}
