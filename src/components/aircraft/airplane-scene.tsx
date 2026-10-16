import { useMemo, useRef, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Lightformer } from '@react-three/drei';
import { smoothLathe, fuselageGeometry, airfoilGeometry, wingGeometry, cockpitGeometry } from './aircraft-geometry';
import { cabinWindows, fuselageSeams, fanBlades, wingFinish } from './aircraft-details';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

export type AircraftView = 'perspective' | 'side' | 'front' | 'top';
export type FlightInput = { x: number; y: number };
type Props = { playing: boolean; view: AircraftView; reset: number; progress: number; zoom: number; input: { current: FlightInput } };
// Flight feel: gentle airliner response, kept inside the visible stage.
const SPEED = 3.2, RESPONSE = 2.2, BOUND_H = 3.6, BOUND_V = 1.6;
const RIGHT = new THREE.Vector3(), UP = new THREE.Vector3(0,1,0), GOAL = new THREE.Vector3();
function Flight({ input, reset, children }: { input: Props['input']; reset: number; children: ReactNode }) {
 const group = useRef<THREE.Group>(null); const vel = useRef(new THREE.Vector3());
 useEffect(()=>{group.current?.position.set(0,0,0);vel.current.set(0,0,0);},[reset]);
 useFrame((state,raw)=>{
  const g=group.current;if(!g)return;const dt=Math.min(raw,.05);
  state.camera.getWorldDirection(RIGHT);RIGHT.y=0;RIGHT.normalize().cross(UP).normalize();
  const {x,y}=input.current;
  GOAL.copy(RIGHT).multiplyScalar(x*SPEED).addScaledVector(UP,y*SPEED*.6);
  vel.current.lerp(GOAL,1-Math.exp(-RESPONSE*dt));
  g.position.addScaledVector(vel.current,dt);
  g.position.set(THREE.MathUtils.clamp(g.position.x,-BOUND_H,BOUND_H),THREE.MathUtils.clamp(g.position.y,-BOUND_V,BOUND_V),THREE.MathUtils.clamp(g.position.z,-BOUND_H,BOUND_H));
  const e=1-Math.exp(-3*dt);
  // Bank into sideways motion and lift the nose when climbing.
  g.rotation.x=THREE.MathUtils.lerp(g.rotation.x,THREE.MathUtils.clamp(vel.current.z*.12,-.35,.35),e);
  g.rotation.z=THREE.MathUtils.lerp(g.rotation.z,THREE.MathUtils.clamp(-vel.current.y*.09,-.2,.2),e);
  g.rotation.y=THREE.MathUtils.lerp(g.rotation.y,THREE.MathUtils.clamp(vel.current.z*.05,-.15,.15),e);
 });
 return <group ref={group}>{children}</group>;
}
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
function Jet({ playing, progress }:Pick<Props,'playing'|'progress'>) {
 const group = useRef<THREE.Group>(null); const p = usePalette();
 const phase=useRef(0);const fan=useRef<THREE.Group>(null);const fanOther=useRef<THREE.Group>(null);
 const hull = useMemo(fuselageGeometry,[]);
 const nacelle = useMemo(() => smoothLathe([[-.98,.46],[-.97,.48],[-.91,.51],[-.7,.53],[-.26,.51],[.23,.45],[.61,.35],[.81,.30],[.82,.27],[.57,.27],[.2,.33],[-.25,.39],[-.76,.425],[-.94,.425],[-.98,.46]],100),[]);
 const wing = useMemo(wingGeometry,[]);const cockpit=useMemo(cockpitGeometry,[]);
 const windows = useMemo(cabinWindows,[]),blades=useMemo(fanBlades,[]),seams=useMemo(fuselageSeams,[]);
 const stabilizer=useMemo(()=>airfoilGeometry([[.34,3.86,5.4,.03],[1.2,4.3,5.6,.09],[2.18,5.1,5.75,.18]],.065),[]);
 const fin=useMemo(()=>airfoilGeometry([[.40,3.38,5.75,0],[.72,3.96,5.72,0],[1.25,4.27,5.67,0],[2.48,5.05,5.55,0]],.075,true),[]);
 const winglet=useMemo(()=>airfoilGeometry([[.17,1.6,2.28,5.6],[.29,1.70,2.29,5.74],[.56,1.89,2.31,5.79],[1.04,2.12,2.34,5.80]],.07,true),[]);
 const wingMap=useMemo(()=>wingFinish(p.white,p.metal),[p]);
 useEffect(()=>()=>{hull.dispose();nacelle.dispose();wing.dispose();cockpit.dispose();windows?.dispose();blades?.dispose();seams?.dispose();stabilizer.dispose();fin.dispose();winglet.dispose();wingMap.dispose();},[hull,nacelle,wing,cockpit,windows,blades,seams,stabilizer,fin,winglet,wingMap]);
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
 <mesh geometry={hull} castShadow receiveShadow><meshPhysicalMaterial color={p.white} metalness={.08} roughness={.28} clearcoat={.65} clearcoatRoughness={.2}/></mesh>
 <mesh position={[.25,-.42,0]} scale={[1.94,.30,.76]} castShadow><sphereGeometry args={[1,48,24]}/><meshPhysicalMaterial color={p.white} metalness={.08} roughness={.32} clearcoat={.4}/></mesh>
 {/* Swept wings with defined root chords, tapered tips, and winglets. */}
 {[-1,1].map(side=><group key={side} scale={[1,1,side]}>
 <mesh geometry={wing} castShadow receiveShadow><meshPhysicalMaterial map={wingMap} metalness={.18} roughness={.35} clearcoat={.3} side={THREE.DoubleSide}/></mesh>
 <mesh geometry={winglet} castShadow><meshPhysicalMaterial color={p.teal} metalness={.12} roughness={.3} clearcoat={.5} side={THREE.DoubleSide}/></mesh>
 <mesh geometry={stabilizer} castShadow receiveShadow><meshPhysicalMaterial color={p.white} metalness={.12} roughness={.35} side={THREE.DoubleSide}/></mesh>
 <mesh position={[-.15,-.58,1.9]} scale={[.8,.4,.13]}><sphereGeometry args={[1,24,16]}/><meshStandardMaterial color={p.white} roughness={.35}/></mesh>
 <group position={[-.85,-.98,1.9]}>
 <mesh geometry={nacelle} rotation={[0,0,-Math.PI/2]} castShadow><meshStandardMaterial color={p.white} metalness={.15} roughness={.3} side={THREE.DoubleSide}/></mesh>
 <mesh rotation={[0,Math.PI/2,0]} position={[-.963,0,0]}><torusGeometry args={[.454,.024,16,64]}/><meshStandardMaterial color={p.metal} metalness={.88} roughness={.24}/></mesh>
 <mesh rotation={[0,Math.PI/2,0]} position={[-.73,0,0]}><circleGeometry args={[.43,48]}/><meshStandardMaterial color={p.dark} side={THREE.DoubleSide}/></mesh>
 <group ref={side===1?fan:fanOther} position={[-.80,0,0]}>{blades&&<mesh geometry={blades}><meshStandardMaterial color={p.metal} metalness={.82} roughness={.4} side={THREE.DoubleSide}/></mesh>}</group>
 <mesh position={[-.87,0,0]} rotation={[0,0,Math.PI/2]}><coneGeometry args={[.105,.18,32]}/><meshStandardMaterial color={p.dark} metalness={.6} roughness={.3}/></mesh>
 <mesh rotation={[0,0,-Math.PI/2]} position={[.72,0,0]}><cylinderGeometry args={[.20,.25,.3,48,1,true]}/><meshStandardMaterial color={p.metal} metalness={.8} roughness={.45} side={THREE.DoubleSide}/></mesh>
 <mesh rotation={[0,Math.PI/2,0]} position={[.78,0,0]}><circleGeometry args={[.195,32]}/><meshStandardMaterial color={p.dark} side={THREE.DoubleSide}/></mesh>
 </group>
 {/* Cabin windows and emergency-exit outlines. */}
 {windows&&<mesh geometry={windows}><meshPhysicalMaterial color={p.glass} metalness={.3} roughness={.14} clearcoat={1}/></mesh>}
 <mesh position={[-2.65,-.015,.674]}><planeGeometry args={[2.65,.31]}/><meshBasicMaterial map={label} transparent depthWrite={false}/></mesh>
 {seams&&<mesh geometry={seams}><meshStandardMaterial color={p.metal} roughness={.6}/></mesh>}
 <mesh geometry={cockpit}><meshPhysicalMaterial color={p.glass} metalness={.25} roughness={.12} clearcoat={1} side={THREE.DoubleSide}/></mesh>
 </group>)}
 <mesh geometry={fin} castShadow receiveShadow><meshPhysicalMaterial color={p.teal} metalness={.12} roughness={.3} clearcoat={.5} side={THREE.DoubleSide}/></mesh>
 {[-1,1].map(side=><group key={side} scale={[1,1,side]}><mesh position={[5.12,1.91,.07]} rotation={[0,0,-.55]}><planeGeometry args={[.07,.44]}/><meshBasicMaterial color={p.white}/></mesh><mesh position={[5.28,1.85,.065]} rotation={[0,0,-.55]}><planeGeometry args={[.07,.29]}/><meshBasicMaterial color={p.white}/></mesh></group>)}
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
 <Flight input={props.input} reset={props.reset}><Jet playing={props.playing&&!reduced} progress={props.progress}/></Flight><CameraRig {...props}/>
 </Canvas>;
}
