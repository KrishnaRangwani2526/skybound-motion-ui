import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hullPoint } from './aircraft-geometry';

export function cabinWindows(){
 const parts:THREE.BufferGeometry[]=[];
 for(let i=0;i<43;i++){
  const x=-4.22+i*.173;
  if(Math.abs(x+.92)<.16||Math.abs(x+.4)<.16)continue;
  const shape=new THREE.Shape();const w=.048,h=.077,r=.026;
  shape.moveTo(-w+r,-h);shape.lineTo(w-r,-h);shape.quadraticCurveTo(w,-h,w,-h+r);shape.lineTo(w,h-r);shape.quadraticCurveTo(w,h,w-r,h);shape.lineTo(-w+r,h);shape.quadraticCurveTo(-w,h,-w,h-r);shape.lineTo(-w,-h+r);shape.quadraticCurveTo(-w,-h,-w+r,-h);
  const g=new THREE.ShapeGeometry(shape,8);const p=g.getAttribute('position');
  for(let j=0;j<p.count;j++){const q=hullPoint(x+p.getX(j),.235+p.getY(j));p.setXYZ(j,q.x,q.y,q.z);}
  g.computeVertexNormals();parts.push(g);
 }
 const result=mergeGeometries(parts);parts.forEach(g=>g.dispose());return result;
}

export function fuselageSeams(){
 const parts:THREE.BufferGeometry[]=[];
 for(const [x,w,h] of [[-4.6,.27,.75],[3.38,.26,.71],[-.93,.20,.38],[-.4,.20,.38]]){
  const points:THREE.Vector3[]=[];
  for(let j=0;j<=64;j++){
   const angle=j/64*Math.PI*2;
   // Superellipse makes a softly radiused door rather than an oval.
   const sx=Math.sign(Math.cos(angle))*Math.pow(Math.abs(Math.cos(angle)),.32);
   const sy=Math.sign(Math.sin(angle))*Math.pow(Math.abs(Math.sin(angle)),.32);
   points.push(hullPoint(x+sx*w/2,.015+sy*h/2,.01));
  }
  parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,true),64,.004,4,true));
  const handle=new THREE.BoxGeometry(.055,.012,.008);const q=hullPoint(x+.06,-.01,.012);handle.translate(q.x,q.y,q.z);parts.push(handle);
 }
 const result=mergeGeometries(parts);parts.forEach(g=>g.dispose());return result;
}

export function fanBlades(){
 const parts:THREE.BufferGeometry[]=[];
 for(let i=0;i<28;i++){
  const positions:number[]=[],indices:number[]=[];
  for(let j=0;j<=9;j++){
   const t=j/9,r=.09+t*.327,angle=t*t*.45;
   for(const edge of [-1,1]){
    const a=angle+edge*(.085-.045*t);
    positions.push(.025*Math.sin(t*Math.PI)+edge*.012,r*Math.cos(a),r*Math.sin(a));
   }
  }
  for(let j=0;j<9;j++){const a=j*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();g.rotateX(i*Math.PI/14);parts.push(g);
 }
 const result=mergeGeometries(parts);parts.forEach(g=>g.dispose());return result;
}

export function wingFinish(paint:THREE.Color,metal:THREE.Color){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;
 const ctx=canvas.getContext('2d');
 if(ctx){
  ctx.fillStyle=paint.getStyle();ctx.fillRect(0,0,1024,1024);
  ctx.globalAlpha=.17;ctx.fillStyle=metal.getStyle();ctx.fillRect(300,0,450,1024);
  ctx.globalAlpha=.45;ctx.strokeStyle=metal.getStyle();ctx.lineWidth=1.4;
  for(const x of [95,300,750,890]){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,1024);ctx.stroke();}
  for(const y of [190,390,590,790]){ctx.beginPath();ctx.moveTo(750,y);ctx.lineTo(1024,y);ctx.stroke();}
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;return texture;
}