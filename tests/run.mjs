import process from 'node:process';
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
      outputText = outputText.replace(/from (['"])(\.\.?\/[^'"]+)\1/g, (all, quote, path) => path.endsWith('.js') ? all : `from ${quote}${path}.js${quote}`);
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
  const { MB6_CONTAINER } = await load('data/skus.js');
  const { validateRoad, makeRoadUnit, findRoadPosition, moveRoadUnits, ROAD_PRESETS, footprint } = await load('utils/roadLoading.js');
  const truck = { vehicle: {...ROAD_PRESETS.truck}, units: [], gap: 10 };
  const base = makeRoadUnit('MB6',1000,'base');
  test('MB6 uses the supplied internal dimensions and payload', () => {
    assert.deepEqual(MB6_CONTAINER.internalDimensions,{width:1069,depth:1187,height:981});
    assert.deepEqual(MB6_CONTAINER.externalDimensions,{width:1120,depth:1220,height:1076});
    const result=calculateGridPacking(MB6_CONTAINER,product);
    assert.equal(validateFit(clones(product,result),MB6_CONTAINER).fits,true);
    assert.equal(MB6_CONTAINER.emptyWeightKg,115);
  });
  test('Road weight includes tare and missing capacity is explicitly unverified', () => {
    const r=validateRoad({...truck,units:[base]});
    assert.equal(r.total,1115);assert.equal(r.cargo,1000);assert.equal(r.tare,115);
    assert.equal(r.valid,true);assert.ok(r.notices.some(n=>n.includes('peso do veículo não validado')));
    assert.equal(validateRoad({...truck,vehicle:{...truck.vehicle,capacityKg:1114},units:[base]}).valid,false);
    assert.equal(validateRoad({...truck,units:[{...base,cargoKg:1651}]}).valid,false);
  });
  test('Road envelopes enforce walls, gaps and contact without overlap', () => {
    assert.equal(validateRoad({...truck,units:[{...base,x:1000}]}).valid,false);
    assert.equal(validateRoad({...truck,units:[base,{...base,id:'overlap',x:1100}]}).valid,false);
    const pair=[{...base,x:-565},{...base,id:'other',x:565}];
    assert.equal(validateRoad({...truck,units:pair}).valid,true);
    assert.equal(validateRoad({...truck,units:pair,gap:11}).valid,false);
  });
  test('Transit stacks require same model, alignment and a floor-supported base', () => {
    const top={...base,id:'top',z:1076};
    assert.equal(validateRoad({...truck,units:[base,top]}).valid,true);
    for(const u of [{...top,x:1},{...top,z:1077},{...top,model:'MB5'},{...top,turned:true}]) assert.equal(validateRoad({...truck,units:[base,u]}).valid,false);
    assert.equal(validateRoad({...truck,units:[top]}).valid,false);
    assert.equal(validateRoad({...truck,vehicle:{...truck.vehicle,height:4000},units:[base,top,{...top,id:'third',z:2152}]}).valid,false);
  });
  test('Moving a complete stack preserves support and moving only its base is invalid', () => {
    const state={...truck,units:[base,{...base,id:'top',z:1076}]};
    const moved=moveRoadUnits(state,['base','top'],{x:100,y:200,z:0},false);
    assert.equal(validateRoad({...state,units:moved}).valid,true);
    assert.equal(validateRoad({...state,units:moveRoadUnits(state,['base'],{x:100,y:0,z:0},false)}).valid,false);
    assert.equal(moveRoadUnits({...truck,units:[{...base,locked:true}]},['base'],{x:100,y:0,z:0},false)[0].x,0);
  });
  test('Assisted placement finds valid floor and stack positions for both models', () => {
    for(const model of ['MB5','MB6']) {
      let state={...truck,vehicle:{...ROAD_PRESETS.sider,capacityKg:26000},units:[]};
      for(let i=0;i<30;i++) {
        const next=findRoadPosition(state,makeRoadUnit(model,1000,String(i)));
        if(!next)break;
        state={...state,units:[...state.units,next]};
        assert.equal(validateRoad(state).valid,true);
      }
      assert.ok(state.units.length>10);assert.ok(validateRoad(state).total<=26000);
    }
  });
  test('Door checks allow unit-wise entry and distinguish sider side access', () => {
    const low={...truck.vehicle,rearHeight:1000,rearWidth:2500};
    assert.equal(validateRoad({...truck,vehicle:low,units:[base]}).valid,false);
    assert.equal(validateRoad({...truck,vehicle:{...low,kind:'sider',loading:'side-rear',sideHeight:2700},units:[base]}).valid,true);
  });
  test('Weight split and occupancy use external dimensions and only floor units', () => {
    const state={...truck,units:[base,{...base,id:'top',z:1076}]},r=validateRoad(state);
    assert.equal(r.frontWeight,r.rearWeight);
    assert.equal(r.floorPercent,1120*1220/(2500*8280)*100);
    assert.deepEqual(footprint({...base,turned:true}),{width:1220,length:1120,height:1076});
  });
  test('Snap reaches floor and wall without allowing an unsupported placement', () => {
    const state={...truck,units:[base]};
    const moved=moveRoadUnits(state,['base'],{x:-650,y:0,z:20},true);
    assert.equal(moved[0].x,-680);assert.equal(moved[0].z,0);
    assert.equal(validateRoad({...state,units:moved}).valid,true);
  });
  test('Invalid road inputs and excessive unit counts cannot pass validation', () => {
    assert.equal(validateRoad({...truck,gap:NaN}).valid,false);
    assert.equal(validateRoad({...truck,vehicle:{...truck.vehicle,width:0}}).valid,false);
    assert.equal(validateRoad({...truck,units:[{...base,cargoKg:NaN}]}).valid,false);
    assert.equal(validateRoad({...truck,units:[base,{...base}]}).valid,false);
  });
  const { findRoadBatch, ROAD_REFERENCES, dimensionsReady, bodyOffset, sceneLength, stackIds } = await load('utils/roadLoading.js');
  test('All nine vehicle profiles preserve reference ranges without inventing dimensions or payload', () => {
    assert.equal(Object.keys(ROAD_PRESETS).length,9);
    assert.equal(ROAD_REFERENCES.vuc.payload,'1,5–3 t');
    assert.equal(ROAD_REFERENCES.rodotrem.width,'2,45–2,50 m');
    for(const [kind,v] of Object.entries(ROAD_PRESETS)) {
      assert.equal(v.capacityKg,null);
      if(!['truck','sider'].includes(kind)) {assert.equal(v.length,0);assert.equal(v.height,0);assert.equal(dimensionsReady(v),false);assert.equal(findRoadBatch({...truck,vehicle:v},base,2),null);}
    }
  });
  test('A pair loads on an empty floor and every later pair stays together', () => {
    for(const model of ['MB5','MB6']) {
      let state={...truck,units:[]};
      for(let i=0;i<3;i++) {
        const pair=findRoadBatch(state,makeRoadUnit(model,1000,`pair-${i}`),2);
        assert.equal(pair.length,2);assert.equal(pair[0].z,0);assert.equal(pair[1].z,footprint(pair[0]).height);
        assert.equal(pair[0].x,pair[1].x);assert.equal(pair[0].y,pair[1].y);
        state={...state,units:[...state.units,...pair]};assert.equal(validateRoad(state).valid,true);
      }
      assert.equal(state.units.length,6);assert.equal(state.units.filter(u=>u.z===0).length,3);
    }
  });
  test('Pair insertion is atomic when weight, height or floor capacity permits only one', () => {
    for(const vehicle of [{...truck.vehicle,capacityKg:1500},{...truck.vehicle,height:2000}]) {
      const state={...truck,vehicle};assert.ok(findRoadBatch(state,base,1));assert.equal(findRoadBatch(state,base,2),null);assert.equal(state.units.length,0);
    }
    const exact={...truck,vehicle:{...truck.vehicle,width:1140,length:1240,height:2152,capacityKg:2230}};
    const pair=findRoadBatch(exact,base,2);assert.equal(pair.length,2);
    assert.equal(findRoadBatch({...exact,units:pair},{...base,id:'next'},2),null);
    assert.equal(validateRoad({...exact,units:pair}).total,2230);
  });
  const dual={...truck,vehicle:{...ROAD_PRESETS.bitrem,length:7000,width:2500,height:2600,secondBody:{length:8000,width:2400,height:2500},capacityKg:38000},units:[]};
  test('Bitrem and rodotrem use two independently bounded cargo bodies', () => {
    const a={...base,compartment:0},b={...base,id:'rear',compartment:1};
    assert.equal(validateRoad({...dual,units:[a,b]}).valid,true);
    assert.equal(validateRoad({...dual,units:[a,{...b,compartment:0}]}).valid,false);
    assert.equal(validateRoad({...dual,units:[{...b,x:700}]}).valid,false);
    assert.equal(validateRoad({...dual,units:[{...b,compartment:2}]}).valid,false);
    assert.equal(validateRoad({...dual,vehicle:{...dual.vehicle,secondBody:undefined},units:[b]}).valid,false);
  });
  test('Stacks cannot use a support in the other compartment', () => {
    assert.equal(validateRoad({...dual,units:[{...base,compartment:0},{...base,id:'top',compartment:1,z:1076}]}).valid,false);
    assert.equal(validateRoad({...dual,units:[{...base,compartment:1},{...base,id:'top',compartment:1,z:1076}]}).valid,true);
  });
  test('Pair insertion targets the selected compartment and includes both compartments in weight', () => {
    const first=findRoadBatch(dual,{...base,compartment:0},2);
    const next=findRoadBatch({...dual,units:first},{...base,id:'second',compartment:1},2);
    assert.equal(next.length,2);assert.ok(next.every(u=>u.compartment===1));
    const state={...dual,units:[...first,...next]};assert.equal(validateRoad(state).total,4460);
    assert.equal(findRoadBatch({...state,vehicle:{...state.vehicle,capacityKg:5000}},{...base,id:'third',compartment:1},2),null);
  });
  test('Coupling gap never becomes usable cargo floor and camera offsets preserve separation', () => {
    const v=dual.vehicle;
    assert.equal(sceneLength(v),16800);
    assert.equal(bodyOffset(v,0)+v.length/2, -900+(v.length-v.secondBody.length)/2);
    assert.equal((bodyOffset(v,1)-v.secondBody.length/2)-(bodyOffset(v,0)+v.length/2),1800);
    const r=validateRoad({...dual,units:[base]});assert.equal(r.floorPercent,1120*1220/(7000*2500+8000*2400)*100);
    assert.equal(sceneLength({...v,kind:'rodotrem'}),18000);
  });
  test('Selecting a stack never captures a unit in another body and group translation keeps support', () => {
    const pair=findRoadBatch(dual,{...base,compartment:1},2);
    const state={...dual,units:[...pair,{...pair[0],id:'other-body',compartment:0,y:0}]};
    const ids=stackIds(state.units,pair[1]);assert.deepEqual(ids,pair.map(u=>u.id));
    const moved=moveRoadUnits(state,ids,{x:0,y:200,z:0},false);
    assert.equal(validateRoad({...state,units:moved}).valid,true);
    assert.equal(moved[2].y,0);
  });
  test('A preassembled pair must pass the known opening at its full height', () => {
    const state={...truck,vehicle:{...truck.vehicle,rearHeight:2000,rearWidth:2500}};
    assert.ok(findRoadBatch(state,base,1));assert.equal(findRoadBatch(state,base,2),null);
    const side={...state,vehicle:{...state.vehicle,loading:'side-rear',sideHeight:2200}};
    const pair=findRoadBatch(side,base,2);assert.equal(pair.length,2);
    assert.equal(validateRoad({...side,units:pair,vehicle:{...side.vehicle,sideHeight:2000}}).valid,false);
  });
  const { initialLab, reduceLab, ready, fitsStack, MB6, boxHeight, leverGesture } = await load('utils/mb6Assembly.js');
  const operateLever = (state, index) => ['lift', 'slide', 'lower'].reduce((s, step) => reduceLab(s, { type: 'lever', index, step }), state);
  const assemble = state => {
    state = reduceLab(state, { type: 'lid' });
    for (let i = 0; i < 4; i++) state = reduceLab(state, { type: 'wall', index: i });
    for (let i = 0; i < 4; i++) state = operateLever(state, i);
    return reduceLab(state, { type: 'lid' });
  };
  test('MB6 starts folded and closed; lid guards every wall and premature closing', () => {
    let s = initialLab(); const original = JSON.parse(JSON.stringify(s));
    assert.equal(reduceLab(s, { type: 'wall', index: 0 }).boxes[0].walls[0], false);
    s = reduceLab(s, { type: 'lid' });
    assert.equal(operateLever(s, 0).boxes[0].locks[0], false);
    s = reduceLab(s, { type: 'wall', index: 0 });
    assert.equal(reduceLab(s, { type: 'lid' }).boxes[0].lid, false);
    assert.deepEqual(initialLab(), original);
  });
  test('MB6 assembles four independent walls and locks; adjacent locks prevent folding', () => {
    let s = assemble(initialLab()); assert.equal(ready(s.boxes[0]), true);
    s = reduceLab(s, { type: 'lid' });
    assert.equal(reduceLab(s, { type: 'wall', index: 0 }).boxes[0].walls[0], true);
    s = operateLever(s, 0);
    s = operateLever(s, 3);
    s = reduceLab(s, { type: 'wall', index: 0 });
    assert.deepEqual(s.boxes[0].walls, [false, true, true, true]);
    assert.equal(reduceLab(s, { type: 'lid' }).boxes[0].lid, false);
  });
  test('MB6 second box is independent and creation is bounded', () => {
    let s = assemble(initialLab()); s = reduceLab(s, { type: 'add' });
    assert.equal(ready(s.boxes[0]), true); assert.equal(ready(s.boxes[1]), false);
    assert.equal(reduceLab(s, { type: 'add' }).boxes.length, 2);
    assert.deepEqual(reduceLab(s, { type: 'reset' }), initialLab());
  });
  test('MB6 stack requires four matching feet: rejects offsets, heights, 90 degrees and incomplete boxes', () => {
    const s = assemble(reduceLab(assemble(initialLab()), { type: 'add' }));
    const base = s.boxes[0], top = { ...s.boxes[1], pose: { ...base.pose, y: MB6.h } };
    assert.equal(fitsStack(top, base), true);
    for (const pose of [{ ...top.pose, x: top.pose.x + 0.06 }, { ...top.pose, y: top.pose.y + 0.06 }, { ...top.pose, yaw: Math.PI / 2 }]) assert.equal(fitsStack({ ...top, pose }, base), false);
    assert.equal(fitsStack({ ...top, pose: { ...top.pose, yaw: Math.PI } }, base), true);
    assert.equal(fitsStack({ ...top, lid: false }, base), false);
    assert.equal(fitsStack(top, { ...base, locks: [true, true, false, true] }), false);
  });
  test('MB6 endpoint collision rejects overlap; supported base cannot move or open until unstacked', () => {
    let s = assemble(reduceLab(assemble(initialLab()), { type: 'add' }));
    const pose = { ...s.boxes[0].pose };
    assert.equal(reduceLab(s, { type: 'move', pose }).boxes[1].pose.x, 0.8);
    s = reduceLab(s, { type: 'move', pose: { ...s.boxes[1].pose, y: MB6.h } });
    s = reduceLab(s, { type: 'move', pose: { ...pose, y: MB6.h } });
    s = reduceLab(s, { type: 'stack' }); assert.equal(s.boxes[1].support, 1);
    s = reduceLab(s, { type: 'select', id: 1 });
    assert.deepEqual(reduceLab(s, { type: 'lid' }).boxes, s.boxes);
    assert.deepEqual(reduceLab(s, { type: 'move', pose: { ...pose, x: 2 } }).boxes, s.boxes);
    s = reduceLab(s, { type: 'select', id: 2 });
    s = reduceLab(s, { type: 'unstack' }); assert.equal(s.boxes[1].support, null);
    assert.equal(s.boxes[1].pose.y, 0);
  });
  test('MB6 invalid coordinates and invalid part indexes leave geometry unchanged', () => {
    const s = initialLab();
    for (const pose of [{ x: NaN, y: 0, z: 0, yaw: 0 }, { x: 0, y: -1, z: 0, yaw: 0 }, { x: 4, y: 0, z: 0, yaw: 0 }]) assert.deepEqual(reduceLab(s, { type: 'move', pose }).boxes, s.boxes);
    assert.deepEqual(reduceLab(s, { type: 'wall', index: 10 }).boxes, s.boxes);
  });
  test('MB6 lever needs lift, slide and lower; a raised engaged bolt still restrains both walls', () => {
    let s = initialLab(); s = reduceLab(s, { type: 'lid' });
    for (let i = 0; i < 4; i++) s = reduceLab(s, { type: 'wall', index: i });
    const operate = step => { s = reduceLab(s, { type: 'lever', index: 0, step }); };
    operate('slide'); assert.equal(s.boxes[0].bolts[0], false);
    operate('lift'); assert.equal(s.boxes[0].leverRaised[0], true); assert.equal(s.boxes[0].locks[0], false);
    operate('slide'); assert.equal(s.boxes[0].bolts[0], true); assert.equal(s.boxes[0].locks[0], false);
    assert.equal(reduceLab(s, { type: 'wall', index: 0 }).boxes[0].walls[0], true);
    assert.equal(reduceLab(s, { type: 'wall', index: 1 }).boxes[0].walls[1], true);
    assert.equal(reduceLab(s, { type: 'lid' }).boxes[0].lid, false);
    operate('lower'); assert.equal(s.boxes[0].locks[0], true);
    operate('lift'); assert.equal(s.boxes[0].locks[0], false);
    operate('slide'); operate('lower');
    assert.equal(s.boxes[0].bolts[0], false); assert.equal(s.boxes[0].leverRaised[0], false);
    s = reduceLab(s, { type: 'wall', index: 0 }); assert.equal(s.boxes[0].walls[0], false);
  });
  test('MB6 datasheet collapsed height and mouse gesture directions are respected', () => {
    assert.equal(boxHeight(initialLab().boxes[0]), 0.224);
    assert.equal(boxHeight(assemble(initialLab()).boxes[0]), 1.076);
    assert.equal(leverGesture(5, -50), 'lift'); assert.equal(leverGesture(5, 50), 'lower');
    assert.equal(leverGesture(50, 5), 'slide'); assert.equal(leverGesture(-50, 5), 'slide');
  });
  test('MB6 valid insertion seats the feet over pins without moving the lower box', () => {
    let s = assemble(reduceLab(assemble(initialLab()), { type: 'add' }));
    const base = JSON.parse(JSON.stringify(s.boxes[0]));
    s = reduceLab(s, { type: 'move', pose: { ...base.pose, y: MB6.h } });
    s = reduceLab(s, { type: 'stack' });
    assert.equal(s.boxes[1].pose.y, MB6.h - MB6.pin);
    assert.deepEqual(s.boxes[0], base);
  });
  test('MB6 new box finds a free floor slot after the first box is moved and rotated', () => {
    let s = reduceLab(initialLab(), { type: 'move', pose: { x: 0.8, y: 0, z: 0, yaw: Math.PI / 4 } });
    s = reduceLab(s, { type: 'add' });
    assert.equal(s.boxes.length, 2);
    assert.ok(Math.abs(s.boxes[0].pose.x - s.boxes[1].pose.x) > (MB6.w + MB6.d) / (2 * Math.sqrt(2)) + MB6.w / 2);
  });
  process.stdout.write(`\n${passed} calculation tests passed.\n`);
} finally { rmSync(output,{recursive:true,force:true}); }
