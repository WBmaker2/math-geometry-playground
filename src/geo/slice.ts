// 단면 계산 — 볼록 입체 plane∩mesh 교선 + 캡 다각형.
// Cross-section of convex solids: intersect edges with plane, order hull, name it.
import type { Vec3 } from './nets';

export interface PlaneDef {
  normal: Vec3; // 단위벡터 권장
  constant: number; // n·p + constant = 0
}

export function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

export function cubeVertices(s = 2): Vec3[] {
  const h = s / 2;
  return [
    [-h, -h, -h], [h, -h, -h], [h, h, -h], [-h, h, -h],
    [-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h],
  ];
}

export function cubeEdges(): Array<[number, number]> {
  return [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
}

function signedDist(p: Vec3, plane: PlaneDef): number {
  return plane.normal[0] * p[0] + plane.normal[1] * p[1] + plane.normal[2] * p[2] + plane.constant;
}

/** 볼록 다면체 모서리들과 평면의 교점 집합. */
export function intersectConvex(vertices: Vec3[], edges: Array<[number, number]>, plane: PlaneDef): Vec3[] {
  const pts: Vec3[] = [];
  for (const [ia, ib] of edges) {
    const a = vertices[ia];
    const b = vertices[ib];
    const da = signedDist(a, plane);
    const db = signedDist(b, plane);
    if (Math.abs(da) < 1e-9 && Math.abs(db) < 1e-9) {
      pts.push(a, b);
    } else if (Math.abs(da) < 1e-9) {
      pts.push(a);
    } else if (Math.abs(db) < 1e-9) {
      pts.push(b);
    } else if (da * db < 0) {
      const t = da / (da - db);
      pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  // 중복 제거
  const uniq: Vec3[] = [];
  for (const p of pts) {
    if (!uniq.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < 1e-7)) uniq.push(p);
  }
  return orderPolygon(uniq, plane.normal);
}

/** 평면 위 점들을 무게중심 기준 각도 정렬 (볼록 캡용). */
export function orderPolygon(points: Vec3[], normal: Vec3): Vec3[] {
  if (points.length <= 2) return points;
  const c: Vec3 = [
    points.reduce((a, p) => a + p[0], 0) / points.length,
    points.reduce((a, p) => a + p[1], 0) / points.length,
    points.reduce((a, p) => a + p[2], 0) / points.length,
  ];
  // 평면 기저 벡터
  const n = normalize(normal);
  const ref: Vec3 = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u: Vec3 = normalize([
    n[1] * ref[2] - n[2] * ref[1],
    n[2] * ref[0] - n[0] * ref[2],
    n[0] * ref[1] - n[1] * ref[0],
  ]);
  const v: Vec3 = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  return [...points].sort((p, q) => {
    const pa = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
    const qa = [q[0] - c[0], q[1] - c[1], q[2] - c[2]];
    const angP = Math.atan2(pa[0] * v[0] + pa[1] * v[1] + pa[2] * v[2], pa[0] * u[0] + pa[1] * u[1] + pa[2] * u[2]);
    const angQ = Math.atan2(qa[0] * v[0] + qa[1] * v[1] + qa[2] * v[2], qa[0] * u[0] + qa[1] * u[1] + qa[2] * u[2]);
    return angP - angQ;
  });
}

export interface SectionInfo {
  sides: number;
  nameKo: string;
  nameEn: string;
}

/** 꼭짓점 개수 → 단면 이름. 곡면(원기둥/원뿔/구)은 별도 이름 사용. */
export function nameCrossSection(sides: number): SectionInfo {
  switch (sides) {
    case 0:
      return { sides, nameKo: '만나지 않음', nameEn: 'No intersection' };
    case 1:
      return { sides, nameKo: '점', nameEn: 'Point' };
    case 2:
      return { sides, nameKo: '선분', nameEn: 'Segment' };
    case 3:
      return { sides, nameKo: '삼각형', nameEn: 'Triangle' };
    case 4:
      return { sides, nameKo: '사각형', nameEn: 'Quadrilateral' };
    case 5:
      return { sides, nameKo: '오각형', nameEn: 'Pentagon' };
    case 6:
      return { sides, nameKo: '육각형', nameEn: 'Hexagon' };
    default:
      return { sides, nameKo: `${sides}각형`, nameEn: `${sides}-gon` };
  }
}

/** 정육면체 대각 단면(육각형) 헬퍼 — 검증용. */
export function sliceCubeDiagonal(s = 2): Vec3[] {
  return intersectConvex(cubeVertices(s), cubeEdges(), { normal: normalize([1, 1, 1]), constant: 0 });
}

/** 3D 다각형의 넓이 (Newell 방법 — 어느 평면에 있어도 동작). */
export function polygonArea3D(points: Vec3[]): number {
  if (points.length < 3) return 0;
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1, z1] = points[i];
    const [x2, y2, z2] = points[(i + 1) % points.length];
    nx += (y1 - y2) * (z1 + z2);
    ny += (z1 - z2) * (x1 + x2);
    nz += (x1 - x2) * (y1 + y2);
  }
  return Math.hypot(nx, ny, nz) / 2;
}
