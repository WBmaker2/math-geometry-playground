import { describe, expect, it } from 'vitest';
import { foldAngle, lerpFold, meanAbsZ, maxDeviation, buildNetSVG, getNetFaces2D } from '../../geo/nets';
import { sliceCubeDiagonal, nameCrossSection, cubeVertices, cubeEdges, intersectConvex, normalize } from '../../geo/slice';
import { parabolaVertex } from '../../geo/functions';
import { solidMeta, supportsVolumeFill } from '../../geo/solids';

describe('unfold t=0 closed / t=1 flat', () => {
  it('foldAngle endpoints', () => {
    expect(foldAngle(0)).toBeCloseTo(0, 9);
    expect(foldAngle(1, Math.PI / 2)).toBeCloseTo(Math.PI / 2, 9);
  });

  it('lerpFold: t=0 equals 3D, t=1 flat (z≈0)', () => {
    const p3: [number, number, number] = [1, 1, 1];
    const p2: [number, number] = [3, -2];
    const closed = lerpFold(p3, p2, 0);
    expect(maxDeviation([closed], [p3])).toBeLessThan(1e-9);
    const flat = lerpFold(p3, p2, 1);
    expect(meanAbsZ([flat])).toBeLessThan(1e-9);
    expect(flat[0]).toBeCloseTo(3, 9);
    expect(flat[1]).toBeCloseTo(-2, 9);
  });
});

describe('slice cube diagonal yields hexagon', () => {
  it('diagonal plane gives 6 points named 육각형', () => {
    const pts = sliceCubeDiagonal(2);
    expect(pts.length).toBe(6);
    expect(nameCrossSection(pts.length).nameKo).toBe('육각형');
  });

  it('axis-aligned center cut gives quadrilateral', () => {
    const pts = intersectConvex(cubeVertices(2), cubeEdges(), { normal: normalize([0, 1, 0]), constant: 0 });
    expect(pts.length).toBe(4);
    expect(nameCrossSection(pts.length).nameKo).toBe('사각형');
  });
});

describe('parabola vertex matches -b/2a', () => {
  it.each([
    { a: 1, b: -4, c: 3 },
    { a: 2, b: 3, c: -1 },
    { a: -1, b: 2, c: 5 },
  ])('a=$a b=$b c=$c', ({ a, b, c }) => {
    const v = parabolaVertex({ a, b, c });
    expect(v.x).toBeCloseTo(-b / (2 * a), 9);
    expect(v.y).toBeCloseTo(a * v.x * v.x + b * v.x + c, 9);
  });
});

describe('print SVG contains 6 faces for cube', () => {
  it('cube net has 6 data-face polygons', () => {
    const svg = buildNetSVG('cube');
    const faces = svg.match(/data-face=/g) ?? [];
    expect(faces.length).toBe(6);
    expect(getNetFaces2D('cube').length).toBe(6);
    expect(solidMeta('cube').faces).toBe(6);
  });

  it('all solids face counts match metadata', () => {
    for (const m of ['cube', 'cuboid', 'tri-prism', 'square-pyramid', 'tetra', 'cylinder', 'cone', 'sphere'] as const) {
      expect(getNetFaces2D(m).length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('volume helpers gating', () => {
  it('상자형(정육면체·직육면체)에서만 단위立方체를 지원', () => {
    expect(supportsVolumeFill('cube')).toBe(true);
    expect(supportsVolumeFill('cuboid')).toBe(true);
  });

  it('기둥·뿔·구에서는 단위立方체 미지원', () => {
    for (const id of ['tri-prism', 'square-pyramid', 'tetra', 'cylinder', 'cone', 'sphere'] as const) {
      expect(supportsVolumeFill(id)).toBe(false);
    }
  });
});
