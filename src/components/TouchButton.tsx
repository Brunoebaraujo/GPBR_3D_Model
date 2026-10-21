import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CanvasTexture, type Group } from 'three';
type Vec=[number,number,number];
export function PanelText({text,width,height,position=[0,0,0],color='#122937'}:{text:string;width:number;height:number;position?:Vec;color?:string}) {
  const texture=useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=Math.max(64,Math.round(1024*height/width));
    const ctx=canvas.getContext('2d')!;ctx.fillStyle=color;ctx.fillRect(0,0,canvas.width,canvas.height);
    let font=canvas.height*.62;ctx.font=`bold ${font}px sans-serif`;
    font*=Math.min(1,canvas.width*.9/Math.max(1,ctx.measureText(text).width));
    ctx.font=`bold ${font}px sans-serif`;ctx.fillStyle='white';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,canvas.width/2,canvas.height/2);
    return new CanvasTexture(canvas);
  },[text,width,height,color]);
  useEffect(()=>()=>texture.dispose(),[texture]);
  return <mesh position={position}><planeGeometry args={[width,height]}/><meshBasicMaterial map={texture} toneMapped={false}/></mesh>;
}
export function TouchButton({text,position,width=.52,height=.17,color='#087c70',disabled=false,onPress}:{text:string;position:Vec;width?:number;height?:number;color?:string;disabled?:boolean;onPress:()=>void}) {
  const root=useRef<Group>(null),cap=useRef<Group>(null);const {gl}=useThree();
  const data=useMemo(()=>({xrTouch:true,width,height,pressed:false,disabled,onPress}),[width,height,disabled,onPress]);
  useFrame((_,dt)=>{if(cap.current)cap.current.position.z+=( (root.current?.userData.pressed ? -.022 : 0)-cap.current.position.z)*Math.min(1,dt*25);});
  return <group ref={root} position={position} userData={data} onClick={e=>{e.stopPropagation();if(!gl.xr.isPresenting && !disabled)onPress();}}>
    <mesh position={[0,0,-.025]}><boxGeometry args={[width+.035,height+.035,.07]}/><meshStandardMaterial color="#0a141e" metalness={.5} roughness={.35}/></mesh>
    <group ref={cap}>
      <mesh><boxGeometry args={[width,height,.06]}/><meshStandardMaterial color={disabled?'#46515b':color} roughness={.35}/></mesh>
      <PanelText text={text} width={width*.94} height={height*.88} position={[0,0,.031]} color={disabled?'#46515b':color}/>
    </group>
  </group>;
}
