import { useMemo, useState } from 'react';
import { ObjectPropertiesPanel } from './components/ObjectPropertiesPanel';
import { Scene3D } from './components/Scene3D';
import { Sidebar } from './components/Sidebar';
import { StatusPanel } from './components/StatusPanel';
import { MB5_CONTAINER, STARTER_OBJECTS } from './data/skus';
import type { PackingObject, PackingObjectType } from './types';
import { validateFit } from './utils/fitValidation';

const COLORS = ['#2f80ed', '#00a878', '#f2994a', '#9b51e0', '#eb5757', '#2d9cdb'];

const createPackingObject = (type: PackingObjectType, index: number): PackingObject => {
  const baseSize = type === 'cube' ? 250 : 320;
  const height = type === 'cylinder' ? 360 : type === 'cube' ? 250 : 220;

  return {
    id: `${type}-${crypto.randomUUID()}`,
    type,
    name: `${type.charAt(0).toUpperCase()}${type.slice(1)} ${index + 1}`,
    dimensions: {
      width: baseSize,
      depth: type === 'cube' || type === 'cylinder' ? baseSize : 260,
      height,
    },
    weightKg: 50,
    position: {
      x: 0,
      y: height / 2,
      z: 0,
    },
    rotation: {
      x: 0,
      y: 0,
      z: 0,
    },
    color: COLORS[index % COLORS.length],
  };
};

export default function App() {
  const [objects, setObjects] = useState<PackingObject[]>(STARTER_OBJECTS);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(STARTER_OBJECTS[0]?.id ?? null);

  const selectedObject = objects.find((object) => object.id === selectedObjectId) ?? null;

  const validation = useMemo(() => validateFit(objects, MB5_CONTAINER), [objects]);

  const addObject = (type: PackingObjectType) => {
    const object = createPackingObject(type, objects.length);
    setObjects((currentObjects) => [...currentObjects, object]);
    setSelectedObjectId(object.id);
  };

  const updateObject = (updatedObject: PackingObject) => {
    setObjects((currentObjects) =>
      currentObjects.map((object) => (object.id === updatedObject.id ? updatedObject : object)),
    );
  };

  const deleteObject = (id: string) => {
    setObjects((currentObjects) => currentObjects.filter((object) => object.id !== id));
    setSelectedObjectId(null);
  };

  return (
    <main className="app-shell">
      <Sidebar onAddObject={addObject} />
      <section className="workspace" aria-label="3D packing workspace">
        <Scene3D
          objects={objects}
          selectedObjectId={selectedObjectId}
          onSelectObject={setSelectedObjectId}
        />
        <StatusPanel validation={validation} />
      </section>
      <ObjectPropertiesPanel
        selectedObject={selectedObject}
        onUpdateObject={updateObject}
        onDeleteObject={deleteObject}
      />
    </main>
  );
}
