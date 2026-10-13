import { describe, expect, it } from 'vitest';
import { cockpitGeometry, HULL_PROFILE, smoothLathe, wingGeometry } from './aircraft-geometry';

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
  expect(g.boundingBox?.max.z).toBeCloseTo(5.65);
  expect(g.getAttribute('position').count).toBe(264);
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
});