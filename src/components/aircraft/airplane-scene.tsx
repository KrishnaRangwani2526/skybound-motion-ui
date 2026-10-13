import { useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Lightformer } from '@react-three/drei';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HULL_PROFILE, smoothLathe, wingGeometry, cockpitGeometry } from './aircraft-geometry';
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
 const g = new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:true,bevelSegments:5,steps:1,bevelSize:.035,bevelThickness:.018}); g.computeVertexNormals(); return g;
 },[JSON.stringify(points),thickness]);
 return <mesh geometry={geometry} castShadow><meshStandardMaterial color={color} metalness={.35} roughness={.32}/></mesh>;
}
function Jet({ playing, progress }:Pick<Props,'playing'|'progress'>) {
 const group = useRef<THREE.Group>(null); const p = usePalette();
 const phase=useRef(0);const fan=useRef<THREE.Group>(null);const fanOther=useRef<THREE.Group>(null);
 const hull = useMemo(() => smoothLathe(HULL_PROFILE),[]);
 const nacelle = useMemo(() => smoothLathe([[-.95,.49],[-.88,.53],[-.65,.56],[-.25,.555],[.2,.51],[.6,.4],[.88,.33]],70),[]);
 const wing = useMemo(wingGeometry,[]);const cockpit=useMemo(cockpitGeometry,[]);
 const windows = useMemo(()=>{
 const parts=Array.from({length:40},(_,i)=>{const g=new THREE.SphereGeometry(1,12,8);g.scale(.057,.082,.012);g.rotateX(.36);g.translate(-4.35+i*.19,.265,.718);return g;});
 const merged=mergeGeometries(parts);parts.forEach(g=>g.dispose());return merged;
 },[]);
 const blades=useMemo(()=>{
 const parts=Array.from({length:24},(_,i)=>{const g=new THREE.BoxGeometry(.024,.31,.052);g.rotateY(.55);g.translate(0,.255,0);g.rotateX(i*Math.PI/12);return g;});
 const merged=mergeGeometries(parts);parts.forEach(g=>g.dispose());return merged;
 },[]);
 useEffect(()=>()=>{hull.dispose();nacelle.dispose();wing.dispose();cockpit.dispose();windows?.dispose();blades?.dispose();},[hull,nacelle,wing,cockpit,windows,blades]);
 const label = useMemo(() => {const c=document.createElement('canvas');c.width=1024;c.height=128; const ctx=c.getContext('2d'); if(ctx){ctx.clearRect(0,0,1024,128);ctx.fillStyle=p.teal.getStyle();ctx.font='500 78px Arial';ctx.fillText('A E R O N A U T',15,95);} const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;return texture;},[p]);
 useEffect(()=>()=>label.dispose(),[label]);
 useFrame((_,rawDelta)=>{
 const jet=group.current;if(!jet)return;const dt=Math.min(rawDelta,.05);
 if(playing){phase.current+=dt;for(const f of [fan.current,fanOther.current])if(f)f.rotation.x+=dt*7;}
 const ease=1-Math.exp(-4*dt);
 jet.position.y=THREE.MathUtils.lerp(jet.position.y,Math.sin(phase.current*.5)*.065,ease);
 jet.rotation.x=THREE.MathUtils.lerp(jet.rotation.x,Math.sin(phase.current*.28)*.012,ease);
 jet.rotation.z=THREE.MathUtils.lerp(jet.rotation.z,Math.sin(progress*Math.PI*2)*.012,ease);
 });
 return <group ref={group}>
 <mesh geometry={hull} rotation={[0,0,-Math.PI/2]} castShadow receiveShadow><meshPhysicalMaterial color={p.white} metalness={.12} roughness={.3} clearcoat={.55} clearcoatRoughness={.24}/></mesh>
 <mesh position={[.25,-.48,0]} scale={[2.15,.38,.88]}><sphereGeometry args={[1,48,24]}/><meshPhysicalMaterial color={p.white} metalness={.12} roughness={.32} clearcoat={.4}/></mesh>
 {/* Swept wings with defined root chords, tapered tips, and winglets. */}
 {[-1,1].map(side=><group key={side} scale={[1,1,side]}>
 <mesh geometry={wing} castShadow receiveShadow><meshPhysicalMaterial color={p.white} metalness={.22} roughness={.33} clearcoat={.3} side={THREE.DoubleSide}/></mesh>
 <group position={[1.85,.2,5.65]} rotation={[-.18,-.13,0]}><Surface color={p.teal} points={[[0,0],[.6,0],[.83,.82],[.52,1.08],[.35,.88]]} thickness={.035}/></group>
 <group rotation={[Math.PI/2,0,0]} position={[0,.05,0]}><Surface color={p.white} points={[[4.15,.22],[5.6,.22],[6.05,2.3],[5.5,2.45]]} thickness={.045}/></group>
 <mesh position={[-.15,-.58,1.9]} scale={[.8,.4,.13]}><sphereGeometry args={[1,24,16]}/><meshStandardMaterial color={p.white} roughness={.35}/></mesh>
 <group position={[-.85,-.98,1.9]}>
 <mesh geometry={nacelle} rotation={[0,0,-Math.PI/2]} castShadow><meshStandardMaterial color={p.white} metalness={.15} roughness={.3} side={THREE.DoubleSide}/></mesh>
 <mesh rotation={[0,Math.PI/2,0]} position={[-.92,0,0]}><torusGeometry args={[.48,.045,16,64]}/><meshStandardMaterial color={p.metal} metalness={.8} roughness={.23}/></mesh>
 <mesh rotation={[0,Math.PI/2,0]} position={[-.64,0,0]}><circleGeometry args={[.445,48]}/><meshStandardMaterial color={p.dark} side={THREE.DoubleSide}/></mesh>
 <group ref={side===1?fan:fanOther} position={[-.68,0,0]}>{blades&&<mesh geometry={blades}><meshStandardMaterial color={p.metal} metalness={.85} roughness={.35}/></mesh>}</group>
 <mesh position={[-.76,0,0]} rotation={[0,0,-Math.PI/2]}><coneGeometry args={[.115,.24,32]}/><meshStandardMaterial color={p.metal} metalness={.6}/></mesh>
 <mesh rotation={[0,Math.PI/2,0]} position={[.93,0,0]}><circleGeometry args={[.29,32]}/><meshStandardMaterial color={p.dark} side={THREE.DoubleSide}/></mesh>
 </group>
 {/* Cabin windows and emergency-exit outlines. */}
 {windows&&<mesh geometry={windows}><meshPhysicalMaterial color={p.glass} metalness={.3} roughness={.14} clearcoat={1}/></mesh>}
 <mesh position={[-2.7,-.025,.767]}><planeGeometry args={[2.6,.33]}/><meshBasicMaterial map={label} transparent depthWrite={false}/></mesh>
 {[-4.75,3.5].map(x=><mesh key={x} position={[x,-.025,x<0?.709:.661]}><boxGeometry args={[.018,.65,.008]}/><meshStandardMaterial color={p.metal}/></mesh>)}
 <mesh geometry={cockpit}><meshPhysicalMaterial color={p.glass} metalness={.25} roughness={.12} clearcoat={1} side={THREE.DoubleSide}/></mesh>
 </group>)}
 <group position={[0,.45,0]}><Surface color={p.teal} points={[[3.3,0],[5.85,0],[5.78,2.65],[5.14,2.9],[4.5,1.1]]} thickness={.12}/></group>
 <mesh position={[5.12,2.12,.143]} rotation={[0,0,-.55]}><planeGeometry args={[.11,.63]}/><meshBasicMaterial color={p.white}/></mesh>
 <mesh position={[5.32,2.02,.144]} rotation={[0,0,-.55]}><planeGeometry args={[.11,.4]}/><meshBasicMaterial color={p.white}/></mesh>
 </group>;
}
function CameraRig({view,reset,zoom}:Pick<Props,'view'|'reset'|'zoom'>) {
 const controls=useRef<OrbitControlsImpl>(null);const target=useRef(new THREE.Vector3(-12,7.5,14));const transitioning=useRef(false);
 const { camera, size }=useThree();
 useEffect(()=>{if(camera instanceof THREE.PerspectiveCamera){camera.fov=size.width<800?54:38;camera.updateProjectionMatrix();}},[camera,size.width]);
 useEffect(()=>{
 const positions:Record<AircraftView,[number,number,number]>={perspective:[-12,7.5,14],side:[0,1.2,20],front:[-21,1.5,0],top:[0,22,.01]};
 target.current.set(...positions[view]).multiplyScalar(zoom);transitioning.current=true;
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){camera.position.copy(target.current);transitioning.current=false;controls.current?.update();}
 },[view,reset,zoom,camera]);
 useFrame((_,delta)=>{
 const c=controls.current;if(!c||!transitioning.current)return;
 const current=new THREE.Spherical().setFromVector3(camera.position);const goal=new THREE.Spherical().setFromVector3(target.current);
 const t=1-Math.exp(-5*Math.min(delta,.05));
 current.radius=THREE.MathUtils.lerp(current.radius,goal.radius,t);current.phi=THREE.MathUtils.lerp(current.phi,goal.phi,t);
 const angle=Math.atan2(Math.sin(goal.theta-current.theta),Math.cos(goal.theta-current.theta));current.theta+=angle*t;
 camera.position.setFromSpherical(current);c.target.set(0,.1,0);c.update();
 if(camera.position.distanceTo(target.current)<.025)transitioning.current=false;
 });
 return <OrbitControls ref={controls} onStart={()=>{transitioning.current=false;}} enablePan={false} minDistance={12} maxDistance={32} enableDamping dampingFactor={.075} rotateSpeed={.6} zoomSpeed={.7} maxPolarAngle={Math.PI*.88}/>;
}
export default function AirplaneScene(props:Props) {
 const [reduced,setReduced]=useState(false); useEffect(()=>setReduced(matchMedia('(prefers-reduced-motion: reduce)').matches),[]);
 const palette=usePalette();
 return <Canvas shadows camera={{position:[-12,7.5,14],fov:38}} dpr={[1,2]} gl={{antialias:true,alpha:true}}>
 <ambientLight intensity={.45}/><hemisphereLight args={[palette.sky,palette.metal,.8]}/>
 <directionalLight position={[-8,12,8]} intensity={2.4} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} shadow-normalBias={.035}/><directionalLight position={[5,3,-8]} intensity={.7}/>
 <Environment resolution={128}>
 <Lightformer color={palette.white} intensity={2.5} position={[0,8,0]} rotation-x={Math.PI/2} scale={[20,20,1]}/>
 <Lightformer color={palette.sky} intensity={1.5} position={[-8,3,4]} rotation-y={Math.PI/2} scale={[12,8,1]}/>
 <Lightformer color={palette.white} intensity={1} position={[5,2,-8]} scale={[15,4,1]}/>
 </Environment>
 <Jet playing={props.playing&&!reduced} progress={props.progress}/><CameraRig {...props}/>
 </Canvas>;
}
