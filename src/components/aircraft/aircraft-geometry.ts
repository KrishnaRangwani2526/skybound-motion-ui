import * as THREE from 'three';

export type ProfilePoint = [number, number];
export const HULL_PROFILE: ProfilePoint[] = [[-6.3,0],[-6.27,.10],[-6.15,.23],[-5.95,.36],[-5.65,.48],[-5.3,.59],[-4.8,.65],[-4.2,.67],[2.7,.67],[3.3,.63],[4,.51],[4.7,.35],[5.4,.17],[6.1,0]];

const hullSamples = new THREE.CatmullRomCurve3(HULL_PROFILE.map(([x,r])=>new THREE.Vector3(x,r,0)),false,'centripetal').getPoints(1200);
export function hullRadius(x:number) {
 const next=hullSamples.findIndex(p=>p.x>=x);
 if(next<0)return 0;
 const a=hullSamples[Math.max(0,next-1)],b=hullSamples[next];
 if(!a||!b)return 0;
 return THREE.MathUtils.lerp(a.y,b.y,b.x===a.x?0:(x-a.x)/(b.x-a.x));
}
export const hullCenterline=(x:number)=>-.11*THREE.MathUtils.smoothstep(-x,4.8,6.3);
export function fuselageGeometry(){
 const g=smoothLathe(HULL_PROFILE,220);g.rotateZ(-Math.PI/2);
 const p=g.getAttribute('position');
 for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+hullCenterline(p.getX(i)));
 g.computeVertexNormals();return g;
}
export function hullPoint(x:number,y:number,offset=.008){
 const radius=hullRadius(x),relativeY=y-hullCenterline(x);
 return new THREE.Vector3(x,y,Math.sqrt(Math.max(0,radius*radius-relativeY*relativeY))+offset);
}

// Every span station has a rounded leading edge and a closed, fine trailing edge.
export type AirfoilRow=[number,number,number,number];
export const WING_ROWS:AirfoilRow[]=[[.5,-1.65,1.65,-.28],[1.5,-1.12,1.82,-.2],[3.6,.24,2.28,-.04],[5.6,1.6,2.28,.17]];
export function airfoilGeometry(rows:AirfoilRow[], thickness=.075, vertical=false){
 const curve=new THREE.CatmullRomCurve3(rows.map(([span,lead,trail,height])=>new THREE.Vector3(span,lead,trail)),false,'centripetal');
 const stations=24,chordSteps=40,stride=(chordSteps+1)*2;
 const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
 for(let i=0;i<=stations;i++){
  const t=i/stations;const q=curve.getPoint(t);
  const index=Math.min(rows.length-2,Math.floor(t*(rows.length-1)));const a=rows[index],b=rows[index+1];
  const height=a&&b?THREE.MathUtils.lerp(a[3],b[3],t*(rows.length-1)-index):0;
  for(let face=0;face<2;face++)for(let j=0;j<=chordSteps;j++){
   const u=j/chordSteps,chord=q.z-q.y;
   const h=5*thickness*chord*(.2969*Math.sqrt(u)-.126*u-.3516*u*u+.2843*u*u*u-.1036*u*u*u*u);
   const camber=vertical?0:Math.sin(u*Math.PI)*.015;
   const x=q.y+chord*u,cross=height+camber+(face===0?h:-h);
   positions.push(x,vertical?q.x:cross,vertical?cross:q.x);uvs.push(u,t);
  }
 }
 for(let i=0;i<stations;i++)for(let face=0;face<2;face++)for(let j=0;j<chordSteps;j++){
  const a=i*stride+face*(chordSteps+1)+j,b=a+stride;
  if(face===0)indices.push(a,b,a+1,b,b+1,a+1);else indices.push(a,a+1,b,b,a+1,b+1);
 }
 for(const row of [0,stations])for(let j=0;j<chordSteps;j++){
  const a=row*stride+j,b=a+chordSteps+1;
  if(row===0)indices.push(a,a+1,b,b,a+1,b+1);else indices.push(a,b,a+1,b,b+1,a+1);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

export function smoothLathe(profile: ProfilePoint[], samples = 160) {
 const curve = new THREE.CatmullRomCurve3(profile.map(([x,r]) => new THREE.Vector3(x,r,0)),false,'centripetal');
 const points = curve.getPoints(samples).map(p=>new THREE.Vector2(Math.max(0,p.y),p.x));
 return new THREE.LatheGeometry(points,80);
}

// A closed, tapered airfoil: rounded leading edge, fine trailing edge, gentle dihedral.
export function wingGeometry() {
 return airfoilGeometry(WING_ROWS);
}

export function cockpitGeometry() {
 const panes:ProfilePoint[][]=[ [[-5.99,.17],[-5.86,.34],[-5.60,.40],[-5.68,.18]], [[-5.64,.18],[-5.56,.41],[-5.27,.42],[-5.29,.19]], [[-5.24,.19],[-5.22,.42],[-5.02,.40],[-4.98,.22]] ];
 const positions:number[]=[];const indices:number[]=[];
 panes.forEach(pane=>{
  const offset=positions.length/3;
  const [bottomLeft,topLeft,topRight,bottomRight]=pane;
  if(!bottomLeft||!topLeft||!topRight||!bottomRight)return;
  for(let row=0;row<=8;row++)for(let col=0;col<=8;col++){
   const u=col/8,v=row/8;
   const x=THREE.MathUtils.lerp(THREE.MathUtils.lerp(bottomLeft[0],bottomRight[0],u),THREE.MathUtils.lerp(topLeft[0],topRight[0],u),v);
   const y=THREE.MathUtils.lerp(THREE.MathUtils.lerp(bottomLeft[1],bottomRight[1],u),THREE.MathUtils.lerp(topLeft[1],topRight[1],u),v);
   positions.push(...hullPoint(x,y,.009).toArray());
  }
  for(let row=0;row<8;row++)for(let col=0;col<8;col++){
   const a=offset+row*9+col;indices.push(a,a+9,a+1,a+1,a+9,a+10);
  }
 });
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}