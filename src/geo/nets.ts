// 전개도 모핑 — 면별 foldAngle(t), 3D↔2D 정점 보간.
// Net morphing: foldAngle(t) per face + lerp between folded(3D) and flat(2D).
// t=0 접힘(입체), t=1 펼침(평면). 검증: t=0 닫힘 / t=1 평탄 오차 내.

export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

export interface NetFace2D {
  id: string;
  label: string;
  points: Vec2[];
  hinge?: string;
}

/** 펼치기 각도: t=0 → 0(접힘), t=1 → openAngle(펼침). 면별 openAngle 지정. */
export function foldAngle(t: number, openAngle = Math.PI / 2): number {
  const c = Math.min(1, Math.max(0, t));
  return c * openAngle;
}

/** 3D 정점 ↔ 2D 전개도 위치 보간 (z=0 평면에 펼침 가정). */
export function lerpFold(p3: Vec3, p2: Vec2, t: number): Vec3 {
  const c = Math.min(1, Math.max(0, t));
  const x = p3[0] + (p2[0] - p3[0]) * c;
  const y = p3[1] + (p2[1] - p3[1]) * c;
  const z = p3[2] * (1 - c);
  return [x, y, z];
}

/** 평탄도: t=1일 때 모든 z가 0 근처인지 확인용 (평균 |z|). */
export function meanAbsZ(positions: Vec3[]): number {
  if (positions.length === 0) return 0;
  return positions.reduce((a, p) => a + Math.abs(p[2]), 0) / positions.length;
}

/** 닫힘 오차: t=0일 때 보간 위치가 3D 위치와 같은지 (최대 거리). */
export function maxDeviation(a: Vec3[], b: Vec3[]): number {
  let m = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const d = Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1], a[i][2] - b[i][2]);
    if (d > m) m = d;
  }
  return m;
}

import type { SolidId } from './solids';

/** 전개도 2D 면 목록 (SVG 인쇄용). 각 입체별 면 개수는 solids.ts와 일치해야 함. */
export function getNetFaces2D(id: SolidId, s = 100): NetFace2D[] {
  const sq = (x: number, y: number, label: string, hid: string): NetFace2D => ({
    id: hid,
    label,
    points: [[x, y], [x + s, y], [x + s, y + s], [x, y + s]],
    hinge: hid,
  });
  switch (id) {
    case 'cube':
      // 십자 전개도 6면
      return [
        sq(s, 0, '위', 'top'),
        sq(0, s, '왼쪽', 'left'),
        sq(s, s, '앞', 'front'),
        sq(2 * s, s, '오른쪽', 'right'),
        sq(3 * s, s, '뒤', 'back'),
        sq(s, 2 * s, '아래', 'bottom'),
      ];
    case 'cuboid': {
      const w = s * 1.5;
      const h = s;
      const d = s;
      const rect = (x: number, y: number, rw: number, rh: number, label: string, hid: string): NetFace2D => ({
        id: hid, label, hinge: hid,
        points: [[x, y], [x + rw, y], [x + rw, y + rh], [x, y + rh]],
      });
      return [
        rect(h, 0, w, d, '위', 'top'),
        rect(0, d, h, d, '왼쪽', 'left'),
        rect(h, d, w, d, '앞', 'front'),
        rect(h + w, d, h, d, '오른쪽', 'right'),
        rect(h + w + h, d, w, d, '뒤', 'back'),
        rect(h, d + d, w, h, '아래', 'bottom'),
      ];
    }
    case 'tri-prism': {
      const h = (Math.sqrt(3) / 2) * s;
      const r = (x: number, y: number, label: string, hid: string): NetFace2D => ({
        id: hid, label, hinge: hid, points: [[x, y], [x + s, y], [x + s, y + s], [x, y + s]],
      });
      // 삼각형은 가운데 직사각형의 위·아래 변과 온전히 맞닿게 (변 공유)
      const triTop: NetFace2D = {
        id: 'tri-top', label: '삼각형·위', hinge: 'tri-top',
        points: [[s, h], [2 * s, h], [1.5 * s, 0]],
      };
      const triBottom: NetFace2D = {
        id: 'tri-bottom', label: '삼각형·아래', hinge: 'tri-bottom',
        points: [[s, h + s], [2 * s, h + s], [1.5 * s, 2 * h + s]],
      };
      return [
        triTop,
        r(0, h, '직사각형1', 'side1'),
        r(s, h, '직사각형2', 'side2'),
        r(2 * s, h, '직사각형3', 'side3'),
        triBottom,
      ];
    }
    case 'square-pyramid': {
      const apex = s * 0.9;
      const triAt = (cx: number, cy: number, dx: number, dy: number, label: string, hid: string): NetFace2D => ({
        id: hid, label, hinge: hid,
        points: [[cx - s / 2, cy], [cx + s / 2, cy], [cx + dx, cy + dy]],
      });
      return [
        { id: 'base', label: '밑면', hinge: 'base', points: [[s, s], [2 * s, s], [2 * s, 2 * s], [s, 2 * s]] },
        triAt(1.5 * s, s, 0, -apex, '앞 삼각형', 'tri-f'),
        triAt(1.5 * s, 2 * s, 0, apex, '뒤 삼각형', 'tri-b'),
        { id: 'tri-l', label: '왼쪽 삼각형', hinge: 'tri-l', points: [[s, s], [s, 2 * s], [s - apex, 1.5 * s]] },
        { id: 'tri-r', label: '오른쪽 삼각형', hinge: 'tri-r', points: [[2 * s, s], [2 * s, 2 * s], [2 * s + apex, 1.5 * s]] },
      ];
    }
    case 'tetra': {
      const h = (Math.sqrt(3) / 2) * s;
      return [
        { id: 't0', label: '면1', hinge: 't0', points: [[s, 0], [2 * s, 0], [1.5 * s, h]] },
        { id: 't1', label: '면2', hinge: 't1', points: [[s, 0], [1.5 * s, h], [0.5 * s, h]] },
        { id: 't2', label: '면3', hinge: 't2', points: [[2 * s, 0], [1.5 * s, h], [2.5 * s, h]] },
        { id: 't3', label: '면4(밑)', hinge: 't3', points: [[1.5 * s, h], [0.5 * s, h], [s, 2 * h]] },
      ];
    }
    case 'cylinder': {
      const faces: NetFace2D[] = [];
      // 옆면 직사각형 (가로=원둘레 근사 2πr, 여기선 r=s/2 → πs)
      const w = Math.PI * s;
      faces.push({ id: 'side', label: '옆면', hinge: 'side', points: [[0, s / 2], [w, s / 2], [w, s / 2 + s], [0, s / 2 + s]] });
      // 원 2개 (다각형 근사 24각형)
      const circle = (cx: number, cy: number, idn: string, label: string): NetFace2D => {
        const pts: Vec2[] = [];
        const r = s / 2;
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
        }
        return { id: idn, label, hinge: idn, points: pts };
      };
      faces.push(circle(w / 2, 0, 'top', '윗면(원)'));
      faces.push(circle(w / 2, 2 * s, 'bottom', '아랫면(원)'));
      return faces;
    }
    case 'cone': {
      // 부채꼴 (근사 폴리곤) + 밑면 원
      const r = s / 2;
      const l = Math.sqrt(r * r + s * s);
      const arc = Math.PI * 2 * (r / l);
      const pts: Vec2[] = [[0, 0]];
      const N = 28;
      for (let i = 0; i <= N; i++) {
        const a = -arc / 2 + (arc * i) / N;
        pts.push([l * Math.cos(a), l * Math.sin(a)]);
      }
      const shift: Vec2[] = pts.map(([x, y]) => [x + l + 10, y + l + 10]);
      // 밑면 원: 부채꼴 호의 한가운데 점(각도 0)에 바깥쪽으로 접하게 배치 (겹침 방지)
      const arcMidX = l + 10 + l;
      const arcMidY = l + 10;
      const cpts: Vec2[] = [];
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        cpts.push([arcMidX + r + r * Math.cos(a), arcMidY + r * Math.sin(a)]);
      }
      return [
        { id: 'sector', label: '옆면(부채꼴)', hinge: 'sector', points: shift },
        { id: 'base', label: '밑면(원)', hinge: 'base', points: cpts },
      ];
    }
    case 'sphere': {
      // 오렌지 껍질 근사: 6개 렌즈 조각
      const faces: NetFace2D[] = [];
      for (let k = 0; k < 6; k++) {
        const pts: Vec2[] = [];
        const N = 16;
        for (let i = 0; i <= N; i++) {
          const y = (i / N - 0.5) * s * 2;
          const wHalf = Math.cos((i / N - 0.5) * Math.PI) * s * 0.3;
          pts.push([k * s * 0.8 + wHalf, y + s]);
        }
        for (let i = N; i >= 0; i--) {
          const y = (i / N - 0.5) * s * 2;
          const wHalf = Math.cos((i / N - 0.5) * Math.PI) * s * 0.3;
          pts.push([k * s * 0.8 - wHalf, y + s]);
        }
        faces.push({ id: `gore-${k}`, label: `조각${k + 1}`, hinge: `gore-${k}`, points: pts });
      }
      return faces;
    }
  }
}

export function faceCount(id: SolidId): number {
  return getNetFaces2D(id).length;
}

/** 인쇄용 SVG 문자열. 정육면체는 6개 면(polygon당 data-face) 포함. */
export function buildNetSVG(id: SolidId, color = '#ffd166'): string {
  const faces = getNetFaces2D(id, 60);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const f of faces) {
    for (const [x, y] of f.points) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const pad = 20;
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;
  const polys = faces
    .map((f, i) => {
      const pts = f.points.map(([x, y]) => `${(x - minX + pad).toFixed(1)},${(y - minY + pad).toFixed(1)}`).join(' ');
      return `<polygon data-face="${f.id}" data-index="${i}" points="${pts}" fill="${i % 2 ? '#ffffff' : color}" fill-opacity="0.85" stroke="#1e2c4a" stroke-width="2" stroke-dasharray="${i === 0 ? 'none' : '8 4'}"/><text x="${((f.points[0][0] + f.points[2 % f.points.length][0]) / 2 - minX + pad).toFixed(1)}" y="${((f.points[0][1] + f.points[2 % f.points.length][1]) / 2 - minY + pad).toFixed(1)}" font-size="11" text-anchor="middle" fill="#1e2c4a">${f.label}</text>`;
    })
    .join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" role="img" aria-label="${id} 전개도">\n${polys}\n</svg>`;
}
