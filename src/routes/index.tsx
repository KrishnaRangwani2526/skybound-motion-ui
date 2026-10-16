import { createFileRoute, ClientOnly } from '@tanstack/react-router';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Expand, Pause, Play, RotateCcw, Plane, Maximize2, MoveUpRight, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import sky from '@/assets/sky.jpg';
import type { AircraftView, FlightInput } from '@/components/aircraft/airplane-scene';
type Dir = 'up'|'down'|'left'|'right';
const KEYS:Record<string,Dir>={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
function useSteering(){
 const input=useRef<FlightInput>({x:0,y:0});const held=useRef(new Set<Dir>());const [active,setActive]=useState<Dir[]>([]);
 const sync=()=>{const h=held.current;input.current.x=(h.has('right')?1:0)-(h.has('left')?1:0);input.current.y=(h.has('up')?1:0)-(h.has('down')?1:0);setActive([...h]);};
 const press=(d:Dir)=>{held.current.add(d);sync();};const release=(d:Dir)=>{held.current.delete(d);sync();};
 useEffect(()=>{
  const down=(e:KeyboardEvent)=>{const d=KEYS[e.code];if(!d||(e.target as HTMLElement)?.tagName==='INPUT')return;e.preventDefault();if(!held.current.has(d))press(d);};
  const up=(e:KeyboardEvent)=>{const d=KEYS[e.code];if(d)release(d);};
  const clear=()=>{held.current.clear();sync();};
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',clear);
  return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',clear);};
 },[]);
 return {input,active,press,release};
}
const AirplaneScene = lazy(() => import('@/components/aircraft/airplane-scene'));
export const Route = createFileRoute('/')({
 head:()=>({meta:[{title:'Aeronaut — The art of flight'},{name:'description',content:'Explore a realistic 3D passenger jet in motion. A beautifully simple interactive aviation experience.'},{property:'og:title',content:'Aeronaut — The art of flight'},{property:'og:description',content:'A closer look at the extraordinary. Explore a passenger aircraft in an immersive 3D flight scene.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
 component:Index,
});
function Index(){
 const [playing,setPlaying]=useState(true);const [view,setView]=useState<AircraftView>('perspective');const [reset,setReset]=useState(0);const [progress,setProgress]=useState(0);const [zoom,setZoom]=useState(1);const [fullscreen,setFullscreen]=useState(false);
 const app=useRef<HTMLDivElement>(null);const steer=useSteering();
 const pad=(d:Dir,label:string,Icon:typeof ChevronUp)=><Button key={d} variant="cockpit" size="icon" className={`pad-${d}`} data-active={steer.active.includes(d)} aria-label={label} title={label} onPointerDown={e=>{e.preventDefault();steer.press(d);}} onPointerUp={()=>steer.release(d)} onPointerCancel={()=>steer.release(d)} onPointerLeave={()=>steer.release(d)}><Icon/></Button>;
 useEffect(()=>{if(!playing||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const timer=setInterval(()=>setProgress(p=>(p+.1)%30),100);return()=>clearInterval(timer);},[playing]);
 useEffect(()=>{const update=()=>setFullscreen(Boolean(document.fullscreenElement));document.addEventListener('fullscreenchange',update);return()=>document.removeEventListener('fullscreenchange',update);},[]);
 const toggleFullscreen=async()=>{if(document.fullscreenElement){await document.exitFullscreen();}else if(app.current?.requestFullscreen){await app.current.requestFullscreen();}};
 const restart=()=>{setView('perspective');setReset(r=>r+1);setZoom(1);setProgress(0);};
 const time=`00:${Math.floor(progress).toString().padStart(2,'0')}`;
 return <div className="flight-app" ref={app}>
 <header className="topbar"><a href="/" className="brand" aria-label="Aeronaut home"><Plane className="brand-symbol" strokeWidth={2.2}/>aeronaut<span className="text-primary">.</span></a><div className="top-center"><span className="status-dot"/>An aviation experience</div><span className="edition">EXPLORER SERIES &nbsp; / &nbsp; 001</span></header>
 <main>
 <section className="stage" aria-label="Interactive 3D passenger airplane">
 <img className="sky" src={sky} width={1920} height={1088} alt="Sunlit clouds from cruising altitude"/>
 <div className="stage-copy"><div className="eyebrow">A different perspective</div><h1>The art of flight.</h1><p className="subtitle">Precision in every curve. Freedom in every mile.<br/>A closer look at the extraordinary.</p></div>
 <div className="stage-number"><strong>Above & beyond</strong>35,000 FT &nbsp; / &nbsp; CLEAR SKIES</div>
 <div className="canvas-wrap"><ClientOnly fallback={<div className="canvas-loading">Preparing for takeoff…</div>}><Suspense fallback={<div className="canvas-loading">Preparing for takeoff…</div>}><AirplaneScene playing={playing} view={view} reset={reset} progress={progress/30} zoom={zoom} input={steer.input}/></Suspense></ClientOnly></div>
 <div className="aircraft-tag"><div className="eyebrow">The aircraft</div><div className="model">Aeronaut A320 <span>01 / 01</span></div><div className="desc">Narrow-body. Wide possibilities.</div></div>
 <div className="flight-pad" aria-label="Steer the airplane"><span className="pad-hint">Steer · arrows / WASD</span>{pad('up','Climb',ChevronUp)}{pad('left','Fly left',ChevronLeft)}{pad('right','Fly right',ChevronRight)}{pad('down','Descend',ChevronDown)}</div>
 <div className="view-controls" aria-label="Camera views">{(['perspective','side','front','top'] as AircraftView[]).map(v=><Button key={v} variant="view" data-active={view===v} aria-pressed={view===v} onClick={()=>setView(v)}>{v==='perspective'?'Perspective':v==='side'?'Side view':v==='front'?'Front view':'Top view'}</Button>)}</div>
 <div className="scene-actions"><Button variant="cockpit" size="icon" title="Reset view" aria-label="Reset view" onClick={restart}><RotateCcw/></Button><Button variant="cockpit" size="icon" title={fullscreen?'Exit fullscreen':'Enter fullscreen'} aria-label={fullscreen?'Exit fullscreen':'Enter fullscreen'} onClick={toggleFullscreen}><Expand/></Button></div>
 <div className="playback"><Button variant="flight" size="icon" className="play-btn" aria-label={playing?'Pause animation':'Play animation'} title={playing?'Pause animation':'Play animation'} onClick={()=>setPlaying(p=>!p)}>{playing?<Pause size={14} fill="currentColor"/>:<Play size={14} fill="currentColor"/>}</Button><span className="time">{time} <span className="text-border">/</span> 00:30</span><input className="timeline" type="range" min="0" max="30" step=".1" value={progress} onChange={e=>setProgress(Number(e.target.value))} aria-label="Animation timeline"/><span className="scene-label"><span className="status-dot"/>{playing?'IN MOTION':'PAUSED'}</span><Button variant="ghost" size="icon" aria-label={zoom<1?'Zoom out':'Zoom in'} title={zoom<1?'Zoom out':'Zoom in'} onClick={()=>setZoom(z=>z<1?1:.8)}><Maximize2 size={14}/></Button></div>
 </section>
 <section className="stats" aria-label="Aircraft specifications"><div className="stat"><div className="stat-label">Flight status</div><div className="flight-status"><span className="status-dot"/>{playing?'Cruising. Effortlessly.':'Taking a moment.'}<MoveUpRight size={15}/></div></div><div className="stat"><div className="stat-label">Cruising altitude</div><div className="stat-value">35,000<small>ft</small></div></div><div className="stat"><div className="stat-label">Cruise speed</div><div className="stat-value">840<small>km/h</small></div></div><div className="stat"><div className="stat-label">Wingspan</div><div className="stat-value">35.8<small>m</small></div></div><div className="stat"><div className="stat-label">Range</div><div className="stat-value">6,300<small>km</small></div></div></section>
 </main><footer className="bottom"><span>© 2026 Aeronaut. Made for the love of flight.</span><span>A little closer to the sky <ArrowUpRight size={12}/></span></footer>
 </div>;
}
