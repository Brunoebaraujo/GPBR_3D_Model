import ts from 'typescript';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

// Compile the pure calculation modules with the project's TypeScript dependency.
const output = mkdtempSync(resolve('.packing-tests-'));
try {
  for (const folder of ['types', 'utils', 'data']) {
    mkdirSync(join(output, folder));
    for (const file of readdirSync(`src/${folder}`).filter(f => f.endsWith('.ts'))) {
      const source = readFileSync(`src/${folder}/${file}`, 'utf8');
      let { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } });
      outputText = outputText.replace(/from '(\.\.?\/[^']+)'/g, (all, path) => path.endsWith('.js') ? all : `from '${path}.js'`);
      writeFileSync(join(output, folder, file.replace(/\.ts$/, '.js')), outputText);
    }
  }
  const load = path => import(pathToFileURL(join(output, path)).href);
  const { calculateGridPacking, calculateBestPacking, findBestOrientation, MAX_PREVIEW_OBJECTS } = await load('utils/packingCalculator.js');
  const { calculateMixedPacking } = await load('utils/mixedPacking.js');
  const { getRotatedBoundingBox } = await load('utils/boundingBox.js');
  const { isTopUp, getObjectVolume, TOP_FACES } = await load('utils/productGeometry.js');
  const { validateFit } = await load('utils/fitValidation.js');
  const { MB5_CONTAINER } = await load('data/skus.js');
  const product = { id: 'test', name: 'Test product', type: 'block', dimensions: { width: 300, depth: 200, height: 100 }, weightKg: 10, position: { x: 0, y: 0, z: 50 }, rotation: { x: 0, y: 0, z: 0 }, color: '#2f80ed' };
  const clones = (p, result) => result.positions.map((position, i) => ({ ...p, id: `test-${i}`, position }));
  let passed = 0;
  const test = (name, fn) => { fn(); passed++; process.stdout.write(`✓ ${name}\n`); };
  test('Grid capacity, payload limit, and generated placement are consistent', () => {
    const result = calculateGridPacking(MB5_CONTAINER, product);
    assert.equal(result.totalQuantity, 210); assert.equal(result.payloadLimitedQuantity, 165);
    assert.equal(result.positions.length, 165); assert.equal(validateFit(clones(product,result), MB5_CONTAINER).fits, true);
  });
  test('Hexagonal cylinder rows improve packing and do not intersect', () => {
    const p = { ...product, type: 'cylinder', dimensions: { width: 300, depth: 300, height: 100 }, weightKg: 1 };
    const grid = calculateGridPacking(MB5_CONTAINER,p), best = calculateBestPacking(MB5_CONTAINER,p);
    assert.ok(best.totalQuantity > grid.totalQuantity); assert.match(best.pattern, /alternados/);
    assert.equal(validateFit(clones(p,best), MB5_CONTAINER).fits,true);
    const spaced = calculateBestPacking(MB5_CONTAINER,p,20);
    for (let i=0; i<spaced.positions.length; i++) for (let j=i+1; j<spaced.positions.length; j++) {
      const a=spaced.positions[i], b=spaced.positions[j];
      if (Math.abs(a.z-b.z)<1) assert.ok(Math.hypot(a.x-b.x,a.y-b.y) >= 320-1e-5);
    }
  });
  test('Every selectable box face can remain up during optimization', () => {
    for (const {value:topFace} of TOP_FACES) {
      const p={...product,topFace,keepTopUp:true}; const result=findBestOrientation(MB5_CONTAINER,p);
      assert.ok(result); assert.ok(result.packingResult.totalQuantity>0); assert.ok(isTopUp(p,result.rotation));
      assert.equal(validateFit(clones({...p,rotation:result.rotation},result.packingResult),MB5_CONTAINER).fits,true);
    }
  });
  test('Top lock rejects tilted fill and allows inverted cylinder cap', () => {
    const p={...product,keepTopUp:true,topFace:'+z',rotation:{x:45,y:0,z:0}};
    assert.equal(calculateBestPacking(MB5_CONTAINER,p).totalQuantity,0);
    const cylinder={...p,type:'cylinder',topFace:'-z',dimensions:{width:300,depth:300,height:100}};
    const best=findBestOrientation(MB5_CONTAINER,cylinder);
    assert.ok(isTopUp(cylinder,best.rotation)); assert.ok(best.packingResult.totalQuantity>0);
  });
  test('Actual product volume does not increase when the object rotates', () => {
    const rotated={...product,rotation:{x:32,y:12,z:44}};
    assert.equal(getObjectVolume(product),getObjectVolume(rotated));
    assert.equal(validateFit([product],MB5_CONTAINER).occupiedVolumeMm3,validateFit([rotated],MB5_CONTAINER).occupiedVolumeMm3);
    const cylinder={...product,type:'cylinder'};
    assert.equal(getObjectVolume(cylinder),Math.PI*150**2*100);
  });
  test('Quarter-turn dimensions keep exact boundary counts despite rounding', () => {
    const p={...product,dimensions:{width:100,depth:200,height:250},rotation:{x:90,y:0,z:90},weightKg:0};
    const container={...MB5_CONTAINER,internalDimensions:{width:1000,depth:1000,height:1000}};
    assert.equal(calculateGridPacking(container,p).totalQuantity,200);
    assert.equal(validateFit(clones(p,calculateGridPacking(container,p)),container).fits,true);
  });
  test('Rotation of a circular cylinder around its axis preserves its bounds', () => {
    const p={...product,type:'cylinder',dimensions:{width:300,depth:300,height:100},rotation:{x:0,y:0,z:37}};
    const b=getRotatedBoundingBox(p);
    assert.ok(Math.abs(b.width-300)<1e-8); assert.ok(Math.abs(b.depth-300)<1e-8);
  });
  test('Invalid dimensions, spacing and overweight pieces cannot generate placements', () => {
    for (const height of [0,-1,NaN,Infinity]) assert.equal(calculateBestPacking(MB5_CONTAINER,{...product,dimensions:{...product.dimensions,height}}).positions.length,0);
    assert.equal(calculateBestPacking(MB5_CONTAINER,product,NaN).positions.length,0);
    assert.equal(calculateBestPacking(MB5_CONTAINER,{...product,weightKg:2000}).positions.length,0);
    assert.equal(calculateBestPacking(MB5_CONTAINER,{...product,dimensions:{width:2000,depth:2000,height:2000}}).positions.length,0);
  });
  test('Huge geometric capacities retain exact counts with a bounded preview', () => {
    const p={...product,dimensions:{width:1,depth:1,height:1},weightKg:0};
    const result=calculateGridPacking(MB5_CONTAINER,p);
    assert.equal(result.totalQuantity,1090*1437*1020); assert.equal(result.positions.length,MAX_PREVIEW_OBJECTS); assert.ok(result.previewTruncated);
  });
  test('Fit validation detects true overlaps and accepts face contact', () => {
    assert.equal(validateFit([product,{...product,id:'overlap'}],MB5_CONTAINER).fits,false);
    assert.equal(validateFit([product,{...product,id:'touch',position:{x:300,y:0,z:50}}],MB5_CONTAINER).fits,true);
  });

  const mixedClones = (p, result) => result.placements.map((placement, i) => ({ ...p, id: `mixed-${i}`, position: placement.position, rotation: placement.rotation }));
  test('Mixed nesting retains the main grid and fills residual slabs with rotated blocks', () => {
    const p = { ...product, dimensions: { width: 400, depth: 300, height: 220 }, weightKg: 1 };
    const uniform = calculateBestPacking(MB5_CONTAINER, p);
    const mixed = calculateMixedPacking(MB5_CONTAINER, p);
    assert.equal(uniform.totalQuantity, 32);
    assert.ok(mixed.totalQuantity > uniform.totalQuantity);
    assert.equal(mixed.orientationBreakdown[0].geometricalQuantity, 32);
    assert.ok(mixed.placements.some(placement => placement.isSecondary));
    assert.equal(mixed.positions.length, mixed.payloadLimitedQuantity);
    assert.equal(mixed.addedQuantity, mixed.payloadLimitedQuantity - uniform.payloadLimitedQuantity);
    assert.equal(validateFit(mixedClones(p, mixed), MB5_CONTAINER).fits, true);
    process.stdout.write(`  MB5 example: ${uniform.totalQuantity} uniform → ${mixed.totalQuantity} combined\n`);
  });
  test('Mixed placement respects spacing both inside and between residual regions', () => {
    const p = { ...product, dimensions: { width: 400, depth: 300, height: 220 }, weightKg: 1 };
    const result = calculateMixedPacking(MB5_CONTAINER, p, 15);
    const pieces = mixedClones(p, result);
    assert.ok(result.placements.some(placement => placement.isSecondary));
    const { width, depth, height } = MB5_CONTAINER.internalDimensions;
    const boxes = pieces.map(piece => {
      const b = getRotatedBoundingBox(piece), pos = piece.position;
      return { min: [pos.x - b.width/2, pos.y - b.depth/2, pos.z - b.height/2], max: [pos.x + b.width/2, pos.y + b.depth/2, pos.z + b.height/2] };
    });
    for (const box of boxes) {
      assert.ok(box.min[0] >= -width/2-1e-5 && box.max[0] <= width/2+1e-5);
      assert.ok(box.min[1] >= -depth/2-1e-5 && box.max[1] <= depth/2+1e-5);
      assert.ok(box.min[2] >= -1e-5 && box.max[2] <= height+1e-5);
    }
    for (let i=0; i<boxes.length; i++) for (let j=i+1; j<boxes.length; j++) {
      assert.ok([0,1,2].some(axis => boxes[j].min[axis]-boxes[i].max[axis] >= 15-1e-5 || boxes[i].min[axis]-boxes[j].max[axis] >= 15-1e-5));
    }
  });
  test('Top restriction applies independently to every mixed piece', () => {
    for (const {value:topFace} of TOP_FACES) {
      const p = { ...product, dimensions: { width: 400, depth: 300, height: 220 }, weightKg: 1, keepTopUp: true, topFace };
      const result = findBestOrientation(MB5_CONTAINER, p, 0, calculateMixedPacking);
      assert.ok(result);
      for (const placement of result.packingResult.placements) assert.ok(isTopUp(p, placement.rotation));
      assert.equal(validateFit(mixedClones(p, result.packingResult), MB5_CONTAINER).fits, true);
    }
    const p = { ...product, dimensions: { width: 400, depth: 300, height: 220 }, weightKg: 1, keepTopUp: true, topFace: '+z' };
    assert.equal(calculateMixedPacking(MB5_CONTAINER, p).totalQuantity, 32);
    assert.ok(calculateMixedPacking(MB5_CONTAINER, { ...p, keepTopUp: false }).totalQuantity > 32);
  });
  test('Payload limits include every orientation and preserve primary pieces first', () => {
    const p = { ...product, dimensions: { width: 400, depth: 300, height: 220 }, weightKg: 50 };
    const result = calculateMixedPacking(MB5_CONTAINER, p);
    assert.equal(result.payloadLimitedQuantity, 33);
    assert.equal(result.orientationBreakdown[0].quantity, 32);
    assert.equal(result.orientationBreakdown.filter(g => g.isSecondary).reduce((sum,g) => sum+g.quantity,0), 1);
    assert.equal(result.placements.length, 33);
    assert.equal(validateFit(mixedClones(p, result), MB5_CONTAINER).fits, true);
    const heavy = calculateMixedPacking(MB5_CONTAINER, { ...p, weightKg: 100 });
    assert.equal(heavy.payloadLimitedQuantity, 16); assert.equal(heavy.addedQuantity, 0);
    assert.ok(heavy.placements.every(placement => !placement.isSecondary));
  });
  test('Truncated mixed preview includes extra orientations with correct complete totals', () => {
    const p = { ...product, dimensions: { width: 100, depth: 70, height: 40 }, weightKg: 0 };
    const result = calculateMixedPacking(MB5_CONTAINER, p);
    assert.ok(result.totalQuantity > 5000);
    assert.equal(result.placements.length, MAX_PREVIEW_OBJECTS); assert.ok(result.previewTruncated);
    assert.ok(result.placements.some(placement => placement.isSecondary));
    assert.equal(result.orientationBreakdown.reduce((sum,group) => sum+group.quantity,0), result.payloadLimitedQuantity);
    assert.equal(validateFit(mixedClones(p, result), MB5_CONTAINER).fits, true);
  });
  test('Cylinders never regress from the existing hexagonal solution', () => {
    const p = { ...product, type: 'cylinder', dimensions: { width: 300, depth: 300, height: 100 }, weightKg: 1 };
    const uniform = calculateBestPacking(MB5_CONTAINER, p), mixed = calculateMixedPacking(MB5_CONTAINER, p);
    assert.ok(mixed.totalQuantity >= uniform.totalQuantity);
    assert.equal(validateFit(mixedClones(p, mixed), MB5_CONTAINER).fits, true);
  });
  test('Mixed search does not mutate the template, and mode switching reproduces uniform results', () => {
    const p = { ...product, dimensions: { width: 400, depth: 300, height: 220 }, weightKg: 1 };
    const original = JSON.stringify(p), before = calculateBestPacking(MB5_CONTAINER, p, 5);
    const best = findBestOrientation(MB5_CONTAINER, p, 5, calculateMixedPacking);
    assert.ok(best.packingResult.payloadLimitedQuantity >= findBestOrientation(MB5_CONTAINER, p, 5).packingResult.payloadLimitedQuantity);
    assert.equal(JSON.stringify(p), original);
    assert.deepEqual(calculateBestPacking(MB5_CONTAINER, p, 5), before);
  });
  test('Varied product dimensions and rotations remain inside the container without collisions', () => {
    let seed = 4271;
    const random = () => { seed = (seed*1664525 + 1013904223) >>> 0; return seed/2**32; };
    for (let i=0; i<30; i++) {
      const p = { ...product, dimensions: { width: 140+Math.floor(random()*430), depth: 140+Math.floor(random()*430), height: 140+Math.floor(random()*430) }, rotation: { x: i%4===0 ? 90 : 0, y: 0, z: i%5===0 ? 27 : 0 }, weightKg: 2 };
      const spacing = Math.floor(random()*20);
      const uniform = calculateBestPacking(MB5_CONTAINER, p, spacing), mixed = calculateMixedPacking(MB5_CONTAINER, p, spacing);
      assert.ok(mixed.totalQuantity >= uniform.totalQuantity);
      assert.equal(validateFit(mixedClones(p, mixed), MB5_CONTAINER).fits, true, `failed varied case ${i}`);
    }
  });
  test('Invalid, oversized and overweight templates return safe empty mixed previews', () => {
    for (const patch of [{ dimensions: { width: 0, depth: 300, height: 220 } }, { dimensions: { width: 2000, depth: 2000, height: 2000 } }, { weightKg: 2000 }, { keepTopUp: true, topFace: '+z', rotation: { x: 40, y: 0, z: 0 } }]) {
      const result = calculateMixedPacking(MB5_CONTAINER, { ...product, ...patch });
      assert.equal(result.placements.length, 0);
    }
  });
  process.stdout.write(`\n${passed} calculation tests passed.\n`);
} finally { rmSync(output,{recursive:true,force:true}); }
