import * as THREE from 'three';

export type ProfilePoint = [number, number];
export const HULL_PROFILE: ProfilePoint[] = [[-6.3,0],[-6.18,.15],[-5.9,.34],[-5.5,.53],[-5,.67],[-4.4,.74],[-3.5,.76],[2.7,.76],[3.5,.69],[4.3,.52],[5,.32],[5.65,.14],[6.1,0]];

export function smoothLathe(profile: ProfilePoint[], samples = 160) {
 const curve = new THREE.CatmullRomCurve3(profile.map(([x,r]) => new THREE.Vector3(x,r,0)),false,'centripetal');
 const points = curve.getPoints(samples).map(p=>new THREE.Vector2(Math.max(0,p.y),p.x));
 return new THREE.LatheGeometry(points,80);
}

// A closed, tapered airfoil: rounded leading edge, fine trailing edge, gentle dihedral.
export function wingGeometry() {
 const rows = [ [.58,-1.7,1.7,-.25], [1.7,-1.05,1.95,-.18], [3.7,.4,2.65,-.02], [5.65,1.85,2.45,.2] ];
 const chordSteps=32; const positions:number[]=[]; const indices:number[]=[];
 const count=(chordSteps+1)*2;
 rows.forEach(([z=0,lead=0,trail=0,height=0])=>{
  for(let face=0;face<2;face++) for(let j=0;j<=chordSteps;j++) {
   const t=j/chordSteps; const chord=trail-lead;
   const thickness=5*.09*chord*(.2969*Math.sqrt(t)-.126*t-.3516*t*t+.2843*t*t*t-.1036*t*t*t*t);
   positions.push(lead+chord*t,height+Math.sin(t*Math.PI)*.025+(face===0?thickness:-thickness),z);
  }
 });
 for(let row=0;row<rows.length-1;row++) for(let face=0;face<2;face++) for(let j=0;j<chordSteps;j++) {
  const a=row*count+face*(chordSteps+1)+j,b=a+count;
  if(face===0)indices.push(a,b,a+1,b,b+1,a+1);else indices.push(a,a+1,b,b,a+1,b+1);
 }
 for(const row of [0,rows.length-1])for(let j=0;j<chordSteps;j++) {
  const a=row*count+j,b=a+chordSteps+1;indices.push(a,a+1,b,b,a+1,b+1);
 }
 const geometry=new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

export function cockpitGeometry() {
 const panes:ProfilePoint[][]=[ [[-5.76,.24],[-5.55,.46],[-5.23,.48],[-5.32,.24]], [[-5.25,.25],[-5.16,.48],[-4.86,.46],[-4.83,.24]] ];
 const positions:number[]=[];const indices:number[]=[];
 const curve=new THREE.CatmullRomCurve3(HULL_PROFILE.map(([x,r])=>new THREE.Vector3(x,r,0)),false,'centripetal');
 const profile=curve.getPoints(500);
 panes.forEach(pane=>{
  const offset=positions.length/3;
  const [bottomLeft,topLeft,topRight,bottomRight]=pane;
  if(!bottomLeft||!topLeft||!topRight||!bottomRight)return;
  for(let row=0;row<=8;row++)for(let col=0;col<=8;col++){
   const u=col/8,v=row/8;
   const x=THREE.MathUtils.lerp(THREE.MathUtils.lerp(bottomLeft[0],bottomRight[0],u),THREE.MathUtils.lerp(topLeft[0],topRight[0],u),v);
   const y=THREE.MathUtils.lerp(THREE.MathUtils.lerp(bottomLeft[1],bottomRight[1],u),THREE.MathUtils.lerp(topLeft[1],topRight[1],u),v);
   const next=profile.findIndex(p=>p.x>x);const a=profile[Math.max(0,next-1)];const b=profile[Math.max(0,next)];
   const radius=a&&b?THREE.MathUtils.lerp(a.y,b.y,(x-a.x)/(b.x-a.x)):.5;
   positions.push(x,y,Math.sqrt(Math.max(.001,radius*radius-y*y))+.012);
  }
  for(let row=0;row<8;row++)for(let col=0;col<8;col++){
   const a=offset+row*9+col;indices.push(a,a+9,a+1,a+1,a+9,a+10);
  }
 });
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}