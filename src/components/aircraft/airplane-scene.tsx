import { useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

export type AircraftView = 'perspective' | 'side' | 'front' | 'top';
type Props = { playing: boolean; view: AircraftView; reset: number; progress: number; zoom: number };
function usePalette() {
 return useMemo(() => {
 const s = getComputedStyle(document.documentElement);
 const color = (name: string) => {
 const el = document.createElement('span'); el.style.color = s.getPropertyValue(name); document.body.appendChild(el);
 const rgb = getComputedStyle(el).color; el.remove();
 // Convert CSS Color 4 tokens to a Three-compatible sRGB value through canvas.
 const c = document.createElement('canvas'); c.width = 1; c.height = 1; const ctx = c.getContext('2d');
 if (!ctx) return new THREE.Color('white'); ctx.fillStyle = rgb; ctx.fillRect(0,0,1,1); const p = ctx.getImageData(0,0,1,1).data;
 return new THREE.Color().setRGB((p[0] ?? 255)/255,(p[1] ?? 255)/255,(p[2] ?? 255)/255,THREE.SRGBColorSpace);
 };
 return { white:color('--airframe'), metal:color('--airframe-metal'), glass:color('--airframe-glass'), teal:color('--airframe-livery'), dark:color('--engine-interior'), sky:color('--background') };
 },[]);
}
function Surface({ points, color, thickness = .07 }: { points:[number,number][]; color:THREE.Color; thickness?:number }) {
 const geometry = useMemo(() => {
 const shape = new THREE.Shape(); points.forEach(([x,y],i) => i ? shape.lineTo(x,y) : shape.moveTo(x,y)); shape.closePath();
 const g = new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.025,bevelThickness:.015}); g.computeVertexNormals(); return g;
 },[points,thickness]);
 return <mesh geometry={geometry} castShadow><meshStandardMaterial color={color} metalness={.35} roughness={.32}/></mesh>;
}
function Jet({ playing, progress }:Pick<Props,'playing'|'progress'>) {
 const group = useRef<THREE.Group>(null); const p = usePalette();
 const hull = useMemo(() => new THREE.LatheGeometry([[-6.3,0],[-6.15,.18],[-5.85,.4],[-5.35,.62],[-4.7,.73],[-3.8,.76],[2.9,.76],[3.7,.68],[4.5,.48],[5.3,.25],[5.9,.09],[6.1,0]].map(([x,r]) => new THREE.Vector2(r,x)),96),[]);
 const nacelle = useMemo(() => new THREE.LatheGeometry([[-.95,.49],[-.83,.55],[-.45,.57],[.35,.49],[.78,.35],[.92,.32]].map(([x,r])=>new THREE.Vector2(r,x)),64),[]);
 const label = useMemo(() => {const c=document.createElement('canvas');c.width=1024;c.height=128; const ctx=c.getContext('2d'); if(ctx){ctx.clearRect(0,0,1024,128);ctx.fillStyle=p.teal.getStyle();ctx.font='500 78px Arial';ctx.fillText('A E R O N A U T',15,95);} return new THREE.CanvasTexture(c);},[p]);
 useFrame(({clock}) => { if(!group.current) return; if(playing){group.current.position.y=Math.sin(clock.elapsedTime*.55)*.075;group.current.rotation.x=Math.sin(clock.elapsedTime*.3)*.018;} group.current.rotation.z=Math.sin(progress*Math.PI*2)*.012; });
 return <group ref={group}>
 <mesh geometry={hull} rotation={[0,0,-Math.PI/2]} castShadow><meshStandardMaterial color={p.white} metalness={.24} roughness={.29}/></mesh>
 {/* Swept wings with defined root chords, tapered tips, and winglets. */}
 {[-1,1].map(side=><group key={side} scale={[1,1,side]}>
 <group rotation={[Math.PI/2,0,0]} position={[0,-.25,0]}><Surface color={p.white} points={[[-1.6,.56],[1.7,.56],[4.2,5.65],[3.5,5.9],[.4,2.1]]}/></group>
 <group position={[3.5,-.22,5.83]} rotation={[0,-.13,0]}><Surface color={p.teal} points={[[0,0],[.7,0],[1,1.05],[.65,1.25]]} thickness={.035}/></group>
 <group rotation={[Math.PI/2,0,0]} position={[0,.05,0]}><Surface color={p.white} points={[[4.15,.22],[5.6,.22],[6.6,2.4],[5.9,2.65]]} thickness={.045}/></group>
 <mesh position={[.2,-.58,2.05]} scale={[1.15,.45,.14]}><boxGeometry/><meshStandardMaterial color={p.metal} roughness={.4}/></mesh>
 <group position={[-.2,-1.0,2.05]}>
 <mesh geometry={nacelle} rotation={[0,0,-Math.PI/2]} castShadow><meshStandardMaterial color={p.white} metalness={.35} roughness={.25} side={THREE.DoubleSide}/></mesh>
 <mesh rotation={[0,Math.PI/2,0]} position={[-.92,0,0]}><torusGeometry args={[.48,.045,16,64]}/><meshStandardMaterial color={p.metal} metalness={.8} roughness={.23}/></mesh>
 <mesh rotation={[0,Math.PI/2,0]} position={[-.79,0,0]}><circleGeometry args={[.445,48]}/><meshStandardMaterial color={p.dark} side={THREE.DoubleSide}/></mesh>
 {Array.from({length:20},(_,i)=><mesh key={i} position={[-.8,Math.cos(i*Math.PI/10)*.25,Math.sin(i*Math.PI/10)*.25]} rotation={[i*Math.PI/10,.4,0]} scale={[.015,.25,.043]}><boxGeometry/><meshStandardMaterial color={p.metal} metalness={.75} roughness={.4}/></mesh>)}
 <mesh position={[-.85,0,0]} rotation={[0,0,-Math.PI/2]}><coneGeometry args={[.115,.24,32]}/><meshStandardMaterial color={p.metal} metalness={.6}/></mesh>
 <mesh rotation={[0,Math.PI/2,0]} position={[.93,0,0]}><circleGeometry args={[.29,32]}/><meshStandardMaterial color={p.dark} side={THREE.DoubleSide}/></mesh>
 </group>
 {/* Cabin windows and emergency-exit outlines. */}
 {Array.from({length:42},(_,i)=><mesh key={i} position={[-4.45+i*.194,.27,.706]} rotation={[.33,0,0]} scale={[.06,.09,.019]}><sphereGeometry args={[1,12,10]}/><meshStandardMaterial color={p.glass} metalness={.35} roughness={.18}/></mesh>)}
 <mesh position={[-2.7,-.025,.767]}><planeGeometry args={[2.6,.33]}/><meshBasicMaterial map={label} transparent depthWrite={false}/></mesh>
 {[-4.75,3.5].map(x=><mesh key={x} position={[x,-.025,x<0?.709:.661]}><boxGeometry args={[.018,.65,.008]}/><meshStandardMaterial color={p.metal}/></mesh>)}
 <mesh position={[-5.42,.38,.37]} rotation={[0,-.55,-.16]} scale={[.31,.16,.045]}><sphereGeometry args={[1,16,12]}/><meshStandardMaterial color={p.glass} roughness={.1} metalness={.45}/></mesh>
 <mesh position={[-5.17,.4,.5]} rotation={[0,-.2,-.12]} scale={[.16,.14,.025]}><sphereGeometry args={[1,16,12]}/><meshStandardMaterial color={p.glass} roughness={.1}/></mesh>
 </group>)}
 <group position={[0,.45,0]}><Surface color={p.teal} points={[[3.3,0],[5.85,0],[5.78,2.65],[5.14,2.9],[4.5,1.1]]} thickness={.12}/></group>
 <mesh position={[5.12,2.12,.143]} rotation={[0,0,-.55]}><planeGeometry args={[.11,.63]}/><meshBasicMaterial color={p.white}/></mesh>
 <mesh position={[5.32,2.02,.144]} rotation={[0,0,-.55]}><planeGeometry args={[.11,.4]}/><meshBasicMaterial color={p.white}/></mesh>
 </group>;
}
function CameraRig({view,reset,zoom}:Pick<Props,'view'|'reset'|'zoom'>) {
 const controls=useRef<OrbitControlsImpl>(null);
 const { camera, size } = useThree();
 useEffect(()=>{if(camera instanceof THREE.PerspectiveCamera){camera.fov=size.width<800?46:38;camera.updateProjectionMatrix();}},[camera,size.width]);
 useEffect(()=>{const c=controls.current;if(!c)return; const positions:Record<AircraftView,[number,number,number]>={perspective:[-12,7.5,14],side:[0,2,20],front:[-21,2,0],top:[0,22,.01]}; c.object.position.set(...positions[view]).multiplyScalar(zoom);c.target.set(0,.1,0);c.update();},[view,reset,zoom]);
 return <OrbitControls ref={controls} enablePan={false} minDistance={12} maxDistance={32} enableDamping dampingFactor={.06} maxPolarAngle={Math.PI*.88}/>;
}
export default function AirplaneScene(props:Props) {
 const [reduced,setReduced]=useState(false); useEffect(()=>setReduced(matchMedia('(prefers-reduced-motion: reduce)').matches),[]);
 const palette=usePalette();
 return <Canvas camera={{position:[-12,7.5,14],fov:38}} dpr={[1,2]} gl={{antialias:true,alpha:true}}>
 <ambientLight intensity={1.8}/><hemisphereLight args={[palette.sky,palette.metal,2]}/>
 <directionalLight position={[-8,12,8]} intensity={3.5}/><directionalLight position={[5,3,-8]} intensity={2}/>
 <Jet playing={props.playing&&!reduced} progress={props.progress}/><CameraRig {...props}/>
 </Canvas>;
}
