import { describe, expect, it } from 'vitest';
import { cockpitGeometry, HULL_PROFILE, smoothLathe, wingGeometry, fuselageGeometry, hullPoint, hullRadius, hullCenterline, airfoilGeometry } from './aircraft-geometry';
import { cabinWindows, fuselageSeams, fanBlades } from './aircraft-details';

describe('refined aircraft geometry',()=>{
 it('creates a smooth finite fuselage with accurate proportions',()=>{
  const g=smoothLathe(HULL_PROFILE);g.computeBoundingBox();
  expect(g.boundingBox?.min.y).toBeCloseTo(-6.3);
  expect(g.boundingBox?.max.y).toBeCloseTo(6.1);
  expect(Array.from(g.getAttribute('position').array).every(Number.isFinite)).toBe(true);
  g.dispose();
 });
 it('creates tapered wings with dihedral and closed surfaces',()=>{
  const g=wingGeometry();g.computeBoundingBox();
  expect(g.boundingBox?.max.z).toBeCloseTo(5.6);
  expect(g.getAttribute('position').count).toBe(2050);
  expect(Array.from(g.getAttribute('normal').array).every(Number.isFinite)).toBe(true);
  g.dispose();
 });
 it('places cockpit panes on the nose instead of floating above it',()=>{
  const g=cockpitGeometry();g.computeBoundingBox();
  expect(g.boundingBox?.max.x).toBeLessThan(-4.8);
  expect(g.boundingBox?.max.y).toBeLessThan(.5);
  expect(Array.from(g.getAttribute('position').array).every(Number.isFinite)).toBe(true);
  g.dispose();
 });
 it('fits nose details to the offset fuselage surface',()=>{
  const g=fuselageGeometry();g.computeBoundingBox();
  expect(g.boundingBox?.min.x).toBeCloseTo(-6.3);
  expect(g.boundingBox?.max.x).toBeCloseTo(6.1);
  for(const x of [-5.9,-5.5,-4.2,3.3]){
   const q=hullPoint(x,.23,0);
   expect(Math.hypot(q.y-hullCenterline(x),q.z)).toBeCloseTo(hullRadius(x),5);
  }
  g.dispose();
 });
 it('builds finite fitted cabin details and swept turbofan blades',()=>{
  for(const g of [cabinWindows(),fuselageSeams(),fanBlades()]){
   expect(g).not.toBeNull();
   if(!g)continue;
   expect(Array.from(g.getAttribute('position').array).every(Number.isFinite)).toBe(true);
   expect(Array.from(g.getAttribute('normal').array).every(Number.isFinite)).toBe(true);
   g.dispose();
  }
 });
 it('builds a thin airfoil vertical tail, not an extruded slab',()=>{
  const g=airfoilGeometry([[.4,3.4,5.7,0],[2.5,5.1,5.5,0]],.075,true);g.computeBoundingBox();
  expect(g.boundingBox?.max.y).toBeCloseTo(2.5);
  expect(g.boundingBox?.max.z).toBeLessThan(.1);
  g.dispose();
 });
});