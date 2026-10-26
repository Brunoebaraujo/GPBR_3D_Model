import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';

// Stylized gloves attached to grip space; no optical hand tracking required.
export function controllerHand() {
  const root=new Group(), palm=new Group(); root.add(palm);
  const material=new MeshStandardMaterial({color:'#d5e6ef',roughness:.65});
  const geometry=new BoxGeometry(1,1,1), joints:Group[]=[];
  const part=(parent:Group,x:number,y:number,z:number,w:number,h:number,d:number)=>{
    const mesh=new Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.raycast=()=>undefined;parent.add(mesh);
  };
  part(palm,0,0,0,.075,.028,.085);
  for(let i=0;i<4;i++) {
    const finger=new Group();finger.position.set((i-1.5)*.019,0,-.04);palm.add(finger);joints.push(finger);
    part(finger,0,0,-.018,.015,.023,.036);
    const tip=new Group();tip.position.z=-.036;finger.add(tip);joints.push(tip);part(tip,0,0,-.013,.014,.021,.026);
  }
  const thumb=new Group();thumb.position.set(.043,0,.012);thumb.rotation.y=-.7;palm.add(thumb);part(thumb,0,0,-.025,.022,.025,.05);
  return {root, update:(value:number,left:boolean)=>{palm.scale.x=left?1:-1;palm.rotation.z=left?Math.PI/2:-Math.PI/2;joints.forEach(j=>j.rotation.x=-value*1.45);thumb.rotation.z=-value*.8;},dispose:()=>{geometry.dispose();material.dispose();}};
}
