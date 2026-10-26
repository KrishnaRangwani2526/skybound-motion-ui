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
type Props = { playing: boolean; view: AircraftView; reset: number; progress: number; zoom: number; input: { current: FlightInput }; dock: { current: HTMLElement | null } };
// Flight feel: gentle airliner response, roaming the whole visible sky.
const CLOUD_SPEED = 6, CLOUD_SPAN = 70;
function Clouds({ playing }: { playing: boolean }) {
 const group = useRef<THREE.Group>(null);
 const puffs = useMemo(() => Array.from({ length: 26 }, (_, i) => {
  const r = (n: number) => { const s = Math.sin((i + 1) * 12.9898 * n) * 43758.5453; return s - Math.floor(s); };
  return { x: (r(1) - .5) * CLOUD_SPAN, y: (r(2) > .35 ? -1 : 1) * (6 + r(3) * 6), z: -8 - r(4) * 30, s: 1.2 + r(5) * 2.2 };
 }), []);
 useFrame((_, raw) => {
  const g = group.current; if (!g || !playing) return; const dt = Math.min(raw, .05);
  for (const c of g.children) { c.position.x -= CLOUD_SPEED * dt; if (c.position.x < -CLOUD_SPAN / 2) c.position.x += CLOUD_SPAN; }
 });
 // Soft billboard wisps read as real vapor instead of solid blobs.
 const tex = useMemo(() => { const c = document.createElement('canvas'); c.width = c.height = 128; const ctx = c.getContext('2d');
  if (ctx) { const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.45, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }, []);
 useEffect(() => () => tex.dispose(), [tex]);
 return <group ref={group}>{puffs.map((p, i) => <group key={i} position={[p.x, p.y, p.z]} scale={p.s}>
  {([[0, 0, 2.6], [1.3, -.2, 2], [-1.2, -.25, 1.9], [.3, .4, 1.7]] as [number, number, number][]).map(([x, y, s], j) =>
   <sprite key={j} position={[x, y, 0]} scale={[s * 1.8, s, 1]}><spriteMaterial map={tex} color="#ffffff" transparent opacity={.6} depthWrite={false} toneMapped={false} /></sprite>)}
 </group>)}</group>;
}
// Autopilot: the jet crosses left to right, shrinks into its small icon mark at
// the far end, then glides back with a fading gradient and docks into the
// Aeronaut brand icon before taking off again from the left.
const CROSS_TIME = 10, CROSS_HALF = 15, SHRINK_TIME = 1.8, DOCK_HOLD = 1.7, DOCK_FADE = .9;
const RIGHT = new THREE.Vector3(), FWD = new THREE.Vector3(), UP = new THREE.Vector3(0,1,0), POS = new THREE.Vector3(), NEXT = new THREE.Vector3();
const DIR = new THREE.Vector3(), SWAY = new THREE.Vector3(), UNP = new THREE.Vector3(), LOOK = new THREE.Vector3();
function pathPoint(t:number,out:THREE.Vector3){
 // Stage one glides dead straight: a level line across the screen at a fixed depth.
 const s=THREE.MathUtils.lerp(-CROSS_HALF,CROSS_HALF,t);
 return out.copy(RIGHT).multiplyScalar(s).addScaledVector(UP,-.2);
}
// Project the brand icon's on-screen position into the flight volume so the jet can dock into it.
function dockPoint(state:{camera:THREE.Camera;gl:{domElement:HTMLCanvasElement}},el:HTMLElement|null,out:THREE.Vector3){
 const cr=state.gl.domElement.getBoundingClientRect();
 let nx=-.85,ny=.9;
 const r=el?.getBoundingClientRect();
 if(r&&r.width>0&&cr.width>0){
  nx=((r.left+r.width/2-cr.left)/cr.width)*2-1;
  ny=-(((r.top+r.height/2-cr.top)/cr.height)*2-1);
  // The logo sits above the canvas: dock just inside the canvas corner beneath it.
  if(ny>1)ny=.9; if(nx<-1)nx=-.85;
 }
 UNP.set(nx,ny,.5).unproject(state.camera);
 return out.copy(state.camera.position).addScaledVector(UNP.sub(state.camera.position).normalize(),state.camera.position.length()*1.05);
}
// Gradient fade: multiplies every material's opacity while remembering its resting state.
function applyFade(g:THREE.Object3D,o:number){
 g.traverse(obj=>{
  const m=(obj as THREE.Mesh).material as THREE.Material|THREE.Material[]|undefined;
  if(!m)return;
  for(const mat of Array.isArray(m)?m:[m]){
   const any=mat as THREE.Material&{__keepT?:boolean;__baseO?:number};
   if(any.__baseO===undefined){any.__baseO=mat.opacity;any.__keepT=mat.transparent;}
   if(o<1){mat.transparent=true;mat.opacity=any.__baseO*o;}
   else{mat.transparent=any.__keepT??mat.transparent;mat.opacity=any.__baseO;}
  }
 });
}
function Flight({playing,reset,dock,children}:{playing:boolean;reset:number;dock:{current:HTMLElement|null};children:ReactNode}){
 const group=useRef<THREE.Group>(null);
 const phase=useRef<'cross'|'shrink'|'return'|'docked'>('cross');
 const t=useRef(0);const pt=useRef(0);const cycle=useRef(0);
 const scale=useRef(1);const fade=useRef(1);const roll=useRef(0);
 const facing=useRef(new THREE.Vector3(1,0,0));
 const seen=useRef(reset);
 const goal=useMemo(()=>new THREE.Vector3(-24,10,0),[]);
 useFrame((state,raw)=>{
  const g=group.current;if(!g)return;
  const dt=Math.min(raw,.05);
  if(seen.current!==reset){
   seen.current=reset;
   phase.current='cross';t.current=0;pt.current=0;cycle.current=0;scale.current=1;fade.current=1;roll.current=0;
   facing.current.set(1,0,0);applyFade(g,1);
   dock.current?.classList.remove('brand-docked');
  }
  if(!playing)return;
  state.camera.getWorldDirection(FWD);FWD.y=0;FWD.normalize();RIGHT.copy(FWD).cross(UP).normalize();
  const ease=1-Math.exp(-4*dt);
  const dir=DIR.copy(RIGHT);
  if(phase.current==='cross'){
   const nt=t.current+dt/CROSS_TIME;
   if(nt>=1){t.current=1;phase.current='shrink';pt.current=0;}
   else t.current=nt;
   pathPoint(t.current,POS);pathPoint(Math.min(t.current+.004,1),NEXT);
   g.position.copy(POS);dir.copy(NEXT).sub(POS);
   if(dir.lengthSq()<1e-6)dir.copy(RIGHT);
   // Straight glide: no banking, wings stay level across the crossing.
   roll.current=THREE.MathUtils.lerp(roll.current,0,ease);
   scale.current=THREE.MathUtils.lerp(scale.current,1,ease);
   cycle.current+=dt;
  }else if(phase.current==='shrink'){
   // Drift past the right edge while easing down to icon size.
   pt.current+=dt;
   const k=THREE.MathUtils.smoothstep(Math.min(pt.current/SHRINK_TIME,1),0,1);
   pathPoint(1,POS);
   POS.addScaledVector(RIGHT,pt.current*2.2).addScaledVector(UP,pt.current*.9);
   g.position.copy(POS);
   dir.copy(RIGHT).addScaledVector(UP,.35).normalize();
   roll.current=THREE.MathUtils.lerp(roll.current,0,ease);
   scale.current=THREE.MathUtils.lerp(1,.16,k);
   if(pt.current>=SHRINK_TIME){phase.current='return';pt.current=0;dockPoint(state,dock.current,goal);}
  }else if(phase.current==='return'){
   // Glide back toward the brand icon, slowing as it approaches, with a gentle sway.
   pt.current+=dt;
   dockPoint(state,dock.current,goal);
   const dist=goal.distanceTo(g.position);
   dir.copy(goal).sub(g.position).divideScalar(dist||1);
   SWAY.copy(dir).cross(UP).normalize();
   dir.addScaledVector(SWAY,Math.sin(pt.current*2.2)*.35*Math.min(dist/14,1)).normalize();
   const speed=THREE.MathUtils.clamp(dist*2,1.2,12);
   g.position.addScaledVector(dir,speed*dt);
   scale.current=THREE.MathUtils.lerp(scale.current,.13,1-Math.exp(-2.5*dt));
   roll.current=THREE.MathUtils.lerp(roll.current,Math.sin(pt.current*2.2)*-.3,ease);
   if(dist<.5){phase.current='docked';pt.current=0;dock.current?.classList.add('brand-docked');}
  }else{
   // Docked: settle into the icon spot, fade out, then take off from the left again.
   pt.current+=dt;
   dockPoint(state,dock.current,goal);
   g.position.lerp(goal,1-Math.exp(-6*dt));
   dir.copy(RIGHT).negate();
   roll.current=THREE.MathUtils.lerp(roll.current,0,ease);
   scale.current=THREE.MathUtils.lerp(scale.current,.11,ease);
   if(pt.current>=DOCK_HOLD){
    phase.current='cross';t.current=0;cycle.current=0;
    scale.current=1;fade.current=0;roll.current=0;facing.current.copy(RIGHT);
    pathPoint(0,POS);g.position.copy(POS);
    dock.current?.classList.remove('brand-docked');
   }
  }
  // Nose eases toward the travel direction so turns sweep like a real airliner.
  facing.current.lerp(dir,1-Math.exp(-3*dt)).normalize();
  if(facing.current.lengthSq()<.5)facing.current.copy(RIGHT);
  g.lookAt(LOOK.copy(g.position).add(facing.current));
  g.rotateZ(roll.current);
  g.scale.setScalar(scale.current);
  let target=1;
  if(phase.current==='docked')target=Math.max(0,1-pt.current/DOCK_FADE);
  else if(phase.current==='cross'&&cycle.current<.6)target=cycle.current/.6;
  if(Math.abs(target-fade.current)>.004){fade.current=target;applyFade(g,target);}
 });
 // Inner rotation points the jet's nose (local -x) along the travel direction (+z for lookAt).
 return <group ref={group}><group rotation-y={Math.PI/2} scale={.5}>{children}</group></group>;
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
  const beacon=useRef<THREE.Mesh>(null);
  // Contrail fades from dense near the engine to nothing far behind (cylinder v runs top to bottom).
  const trail=useMemo(()=>{const c=document.createElement('canvas');c.width=4;c.height=256;const ctx=c.getContext('2d');if(ctx){const g=ctx.createLinearGradient(0,0,0,256);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.85,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,4,256);}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;},[]);
  useEffect(()=>()=>trail.dispose(),[trail]);
  useFrame((_,rawDelta)=>{
  const jet=group.current;if(!jet)return;const dt=Math.min(rawDelta,.05);
  if(playing){phase.current+=dt;for(const f of [fan.current,fanOther.current])if(f)f.rotation.x+=dt*7;}
  const b=beacon.current?.material;if(b instanceof THREE.MeshBasicMaterial)b.opacity=(phase.current%1.2)<.12?1:.15;
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
  {/* Wingtip navigation light: red to port, green to starboard. */}
  <mesh position={[2.3,.2,5.62]}><sphereGeometry args={[.045,12,8]}/><meshBasicMaterial color={side===1?'#ff3b30':'#34d058'} toneMapped={false}/></mesh>
  {/* Fading engine contrail streaming behind the nacelle. */}
  {playing&&<mesh position={[6.9,-.98,1.9]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.32,.06,14,24,1,true]}/><meshBasicMaterial map={trail} color="#ffffff" transparent opacity={.5} depthWrite={false} toneMapped={false} side={THREE.DoubleSide}/></mesh>}
  </group>)}
  <mesh ref={beacon} position={[.2,.7,0]}><sphereGeometry args={[.04,12,8]}/><meshBasicMaterial color="#ff3b30" toneMapped={false} transparent/></mesh>
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
 return <Canvas shadows camera={{position:[-12,7.5,14],fov:38}} dpr={[1,2]} gl={{antialias:true,alpha:true,toneMapping:THREE.ACESFilmicToneMapping,toneMappingExposure:1.1}}>
 <ambientLight intensity={.45}/><hemisphereLight args={[palette.sky,palette.metal,.8]}/>
 <directionalLight position={[-8,12,8]} intensity={2.4} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} shadow-normalBias={.035}/><directionalLight position={[5,3,-8]} intensity={.7}/>
 <Environment resolution={128}>
 <Lightformer color={palette.white} intensity={2.5} position={[0,8,0]} rotation-x={Math.PI/2} scale={[20,20,1]}/>
 <Lightformer color={palette.sky} intensity={1.5} position={[-8,3,4]} rotation-y={Math.PI/2} scale={[12,8,1]}/>
 <Lightformer color={palette.white} intensity={1} position={[5,2,-8]} scale={[15,4,1]}/>
 </Environment>
 <Clouds playing={props.playing&&!reduced}/>
 <Flight playing={props.playing} reset={props.reset} dock={props.dock}><Jet playing={props.playing&&!reduced} progress={props.progress}/></Flight><CameraRig {...props}/>
 </Canvas>;
}
