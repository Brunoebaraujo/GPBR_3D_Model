import { Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import type { HandPose } from '../utils/handPose';

// Rounded articulated hand: anatomical finger lengths, three phalanges, thenar pad,
// tapered fingertips and nails. Shared geometry/materials keep GPU resources bounded.
export function controllerHand() {
  const root=new Group(), palm=new Group();root.add(palm);
  const skin=new MeshStandardMaterial({color:'#c68f72',roughness:.72});
  const nail=new MeshStandardMaterial({color:'#e7bdab',roughness:.45});
  const geometry=new SphereGeometry(1,20,12);
  const part=(parent:Group,x:number,y:number,z:number,w:number,h:number,d:number,material=skin)=>{
    const mesh=new Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(w/2,h/2,d/2);mesh.raycast=()=>undefined;parent.add(mesh);return mesh;
  };
  part(palm,0,0,0,.081,.034,.097);
  part(palm,.027,-.008,.014,.038,.034,.064); // thumb muscle
  part(palm,-.027,-.004,.017,.029,.028,.065);
  part(palm,0,0,.052,.055,.031,.046); // wrist
  const fingers:Group[][]=[];
  // Index sits beside the thumb (+X); middle longest and pinky shortest.
  const lengths=[[.034,.024,.019],[.038,.027,.020],[.035,.025,.019],[.027,.020,.017]];
  const widths=[.018,.019,.018,.015];
  for(let i=0;i<4;i++) {
    const base=new Group();base.position.set(.028-i*.019,0,-.034+(i===3?.008:0));base.rotation.y=(i-1.2)*.045;palm.add(base);
    const joints:Group[]=[];let parent=base;
    lengths[i].forEach((length,j)=>{
      const joint=new Group();parent.add(joint);if(j)joint.position.z=-lengths[i][j-1];
      const width=widths[i]*(1-j*.1);
      part(joint,0,0,-length/2,width,width*.95,length+width*.6);
      if(j===2)part(joint,0,width*.43,-length*.55,width*.65,.0025,length*.6,nail);
      joints.push(joint);parent=joint;
    });
    fingers.push(joints);
  }
  const thumb=new Group();thumb.position.set(.033,-.002,.02);palm.add(thumb);
  part(thumb,0,0,-.018,.024,.025,.045);
  const thumbTip=new Group();thumbTip.position.z=-.033;thumb.add(thumbTip);
  part(thumbTip,0,0,-.014,.021,.023,.038);
  part(thumbTip,0,.010,-.018,.013,.0025,.017,nail);
  const current:HandPose={index:0,fingers:0,thumb:0,roll:0};let initialized=false;
  return {root, update:(target:HandPose,left:boolean,dt:number)=>{
    const alpha=initialized?1-Math.exp(-18*Math.min(.05,Math.max(0,dt))):1;initialized=true;
    for(const key of ['index','fingers','thumb','roll'] as const)current[key]+=(target[key]-current[key])*alpha;
    palm.scale.x=left?1:-1;palm.rotation.z=current.roll;
    fingers.forEach((joints,i)=>joints.forEach((joint,j)=>{joint.rotation.x=-(i===0?current.index:current.fingers)*[1.1,1.35,.9][j];}));
    thumb.rotation.set(-current.thumb*.45,-.9+current.thumb*.65,-current.thumb*.65);
    thumbTip.rotation.x=-current.thumb*.85;
  },dispose:()=>{geometry.dispose();skin.dispose();nail.dispose();}};
}
