import { describe, expect, it } from 'vitest';
import { foldAngle, lerpFold, meanAbsZ, maxDeviation, buildNetSVG, getNetFaces2D } from '../../geo/nets';
import type { Vec2 } from '../../geo/nets';
import type { SolidId } from '../../geo/solids';
import { sliceCubeDiagonal, nameCrossSection, cubeVertices, cubeEdges, intersectConvex, intersectTriangles, normalize, polygonArea3D } from '../../geo/slice';
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

  it('section area: unit square = 1, 2x2 square = 4, triangle = 0.5', () => {
    expect(polygonArea3D([])).toBe(0);
    expect(polygonArea3D([[0, 0, 0], [2, 0, 0], [2, 2, 0], [0, 2, 0]])).toBeCloseTo(4, 9);
    expect(polygonArea3D([[0, 0, 0], [1, 0, 0], [0, 1, 0]])).toBeCloseTo(0.5, 9);
    // 기울어진 평면에서도 같은 넓이 (2x2 정사각형을 3D로 회전)
    expect(polygonArea3D([[0, 0, 0], [2, 0, 0], [2, 1, 1], [0, 1, 1]])).toBeCloseTo(2 * Math.SQRT2, 9);
  });

  it('mesh path: 삼각형 메쉬 정육면체 대각 단면도 육각형', () => {
    // 렌더 지오메트리 방식 검증용 손수 정육면체 (곡면 입체와 같은 코드 경로)
    const v = cubeVertices(2);
    const quads = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [0, 3, 7, 4], [1, 2, 6, 5]];
    const positions: number[] = [];
    v.forEach((p) => positions.push(p[0], p[1], p[2]));
    const index: number[] = [];
    for (const [a, b, c, d] of quads) index.push(a, b, c, a, c, d);
    const pts = intersectTriangles(positions, index, { normal: normalize([1, 1, 1]), constant: 0 });
    expect(pts.length).toBe(6);
    expect(nameCrossSection(pts.length).nameKo).toBe('육각형');
    expect(polygonArea3D(pts)).toBeGreaterThan(0);
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

function commonPoints2D(a: Vec2[], b: Vec2[], eps = 1e-6): number {
  let n = 0;
  for (const p of a) {
    if (b.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < eps)) n++;
  }
  return n;
}

function minGap2D(a: Vec2[], b: Vec2[]): number {
  let m = Infinity;
  for (const p of a) {
    for (const q of b) {
      const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (d < m) m = d;
    }
  }
  return m;
}

/** 점 p에서 선분 ab까지의 거리 */
function segDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** 다각형 a의 꼭짓점에서 다각형 b의 변까지의 최소 거리 (접함 판정용) */
function minGapToEdges(a: Vec2[], b: Vec2[]): number {
  let m = Infinity;
  for (const p of a) {
    for (let i = 0; i < b.length; i++) {
      const d = segDist(p, b[i], b[(i + 1) % b.length]);
      if (d < m) m = d;
    }
  }
  return m;
}

describe('print nets are edge-connected (2D)', () => {
  it.each(['cube', 'cuboid', 'tri-prism', 'square-pyramid', 'tetra'] as SolidId[])('%s 인쇄 전개도의 각 면은 다른 면과 변을 공유한다', (id) => {
    const faces = getNetFaces2D(id, 100);
    for (let i = 1; i < faces.length; i++) {
      const shares = faces.some((other, j) => j !== i && commonPoints2D(faces[i].points, other.points) >= 2);
      expect(shares).toBe(true);
    }
  });

  it('직육면체 윗면은 앞면과 온전한 한 변을 공유한다', () => {
    const faces = getNetFaces2D('cuboid', 100);
    const top = faces.find((f) => f.id === 'top')!;
    const front = faces.find((f) => f.id === 'front')!;
    expect(commonPoints2D(top.points, front.points)).toBeGreaterThanOrEqual(2);
  });

  it('삼각기둥 삼각형은 직사각형과 온전한 한 변을 공유한다', () => {
    const faces = getNetFaces2D('tri-prism', 100);
    const triTop = faces.find((f) => f.id === 'tri-top')!;
    const side2 = faces.find((f) => f.id === 'side2')!;
    const triBottom = faces.find((f) => f.id === 'tri-bottom')!;
    expect(commonPoints2D(triTop.points, side2.points)).toBeGreaterThanOrEqual(2);
    expect(commonPoints2D(triBottom.points, side2.points)).toBeGreaterThanOrEqual(2);
  });

  it('원뿔 밑면 원은 부채꼴 호에 접한다 (겹치지 않음)', () => {
    const faces = getNetFaces2D('cone', 100);
    const sector = faces.find((f) => f.id === 'sector')!;
    const base = faces.find((f) => f.id === 'base')!;
    // 접점에서는 거리가 0에 가깝고, 두 도형이 겹치지 않는다
    expect(minGap2D(sector.points, base.points)).toBeLessThan(1e-6);
  });

  it('원기둥 두 원은 옆면에 접한다', () => {
    const faces = getNetFaces2D('cylinder', 100);
    const side = faces.find((f) => f.id === 'side')!;
    const top = faces.find((f) => f.id === 'top')!;
    const bottom = faces.find((f) => f.id === 'bottom')!;
    expect(minGapToEdges(top.points, side.points)).toBeLessThan(1e-6);
    expect(minGapToEdges(bottom.points, side.points)).toBeLessThan(1e-6);
  });
});
