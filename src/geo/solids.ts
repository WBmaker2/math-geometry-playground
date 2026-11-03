// 기하 입체 정의 — 8종 (F1). 순수 계산, Three.js 의존 없음.
// Solid definitions (8 kinds) — pure math, no Three.js dependency.

export type SolidId =
  | 'cube'
  | 'cuboid'
  | 'tri-prism'
  | 'square-pyramid'
  | 'tetra'
  | 'cylinder'
  | 'cone'
  | 'sphere';

export interface SolidSize {
  /** 한 변 / 대표 길이 (기본 2) */
  s: number;
  /** 직육면체용 가로·세로 (기본 s) */
  w?: number;
  h?: number;
  d?: number;
}

export interface SolidMeta {
  id: SolidId;
  nameKo: string;
  nameEn: string;
  faces: number;
  edges: number;
  vertices: number;
  formulaKo: string;
  formulaEn: string;
  volumeKo: string;
  netMemoKo: string;
}

export const SOLIDS: SolidMeta[] = [
  { id: 'cube', nameKo: '정육면체', nameEn: 'Cube', faces: 6, edges: 12, vertices: 8, formulaKo: '겉넓이 = 6 × (한 변)²', formulaEn: 'Surface = 6s²', volumeKo: '부피 = (한 변)³', netMemoKo: '십자 전개도가 대표적. 마주보는 면끼리 같은 색.' },
  { id: 'cuboid', nameKo: '직육면체', nameEn: 'Cuboid', faces: 6, edges: 12, vertices: 8, formulaKo: '겉넓이 = 2(ab+bc+ca)', formulaEn: 'Surface = 2(ab+bc+ca)', volumeKo: '부피 = 가로×세로×높이', netMemoKo: '같은 크기 면이 2개씩 3쌍.' },
  { id: 'tri-prism', nameKo: '삼각기둥', nameEn: 'Triangular prism', faces: 5, edges: 9, vertices: 6, formulaKo: '겉넓이 = 2×밑넓이 + 옆넓이', formulaEn: 'Surface = 2B + Ph', volumeKo: '부피 = 밑넓이×높이', netMemoKo: '삼각형 2개 + 직사각형 3개.' },
  { id: 'square-pyramid', nameKo: '사각뿔', nameEn: 'Square pyramid', faces: 5, edges: 8, vertices: 5, formulaKo: '겉넓이 = 밑넓이 + 4×옆면', formulaEn: 'Surface = B + 2sl', volumeKo: '부피 = 밑넓이×높이÷3', netMemoKo: '정사각형 1개 + 삼각형 4개.' },
  { id: 'tetra', nameKo: '정사면체', nameEn: 'Tetrahedron', faces: 4, edges: 6, vertices: 4, formulaKo: '겉넓이 = √3 × (한 변)²', formulaEn: 'Surface = √3·s²', volumeKo: '부피 = s³÷(6√2)', netMemoKo: '정삼각형 4개.' },
  { id: 'cylinder', nameKo: '원기둥', nameEn: 'Cylinder', faces: 3, edges: 2, vertices: 0, formulaKo: '겉넓이 = 2πr² + 2πrh', formulaEn: 'Surface = 2πr²+2πrh', volumeKo: '부피 = πr²h', netMemoKo: '원 2개 + 옆면 직사각형(가로=둘레).' },
  { id: 'cone', nameKo: '원뿔', nameEn: 'Cone', faces: 2, edges: 1, vertices: 1, formulaKo: '겉넓이 = πr² + πrl', formulaEn: 'Surface = πr²+πrl', volumeKo: '부피 = πr²h÷3', netMemoKo: '원 1개 + 부채꼴 1개.' },
  { id: 'sphere', nameKo: '구', nameEn: 'Sphere (approx)', faces: 1, edges: 0, vertices: 0, formulaKo: '겉넓이 = 4πr²', formulaEn: 'Surface = 4πr²', volumeKo: '부피 = 4πr³÷3', netMemoKo: '펼칠 수 없음 — 근사 조각(오렌지 껍질)으로 이해.' },
];

export function defaultSize(id: SolidId): SolidSize {
  switch (id) {
    case 'cuboid':
      return { s: 2, w: 3, h: 2, d: 2 };
    default:
      return { s: 2 };
  }
}

/** 한 변 s 기준 겉넓이 (직육면체는 w,h,d 사용) */
export function surfaceArea(id: SolidId, size: SolidSize): number {
  const s = size.s;
  switch (id) {
    case 'cube':
      return 6 * s * s;
    case 'cuboid': {
      const a = size.w ?? s;
      const b = size.h ?? s;
      const c = size.d ?? s;
      return 2 * (a * b + b * c + c * a);
    }
    case 'tri-prism': {
      // 정삼각형 밑면 한 변 s, 높이(기둥 길이) s
      const base = (Math.sqrt(3) / 4) * s * s;
      return 2 * base + 3 * s * s;
    }
    case 'square-pyramid': {
      // 밑변 s, 옆면은 이등변삼각형 (높이 slant = sqrt(s²-(s/2)² + h²)) — h=s 가정 단순화
      const slant = Math.sqrt(s * s + (s / 2) * (s / 2));
      return s * s + 2 * s * slant;
    }
    case 'tetra':
      return Math.sqrt(3) * s * s;
    case 'cylinder': {
      const r = s / 2;
      const h = s;
      return 2 * Math.PI * r * r + 2 * Math.PI * r * h;
    }
    case 'cone': {
      const r = s / 2;
      const h = s;
      const l = Math.sqrt(r * r + h * h);
      return Math.PI * r * r + Math.PI * r * l;
    }
    case 'sphere': {
      const r = s / 2;
      return 4 * Math.PI * r * r;
    }
  }
}

/** 한 변 s 기준 부피 */
export function volume(id: SolidId, size: SolidSize): number {
  const s = size.s;
  switch (id) {
    case 'cube':
      return s * s * s;
    case 'cuboid':
      return (size.w ?? s) * (size.h ?? s) * (size.d ?? s);
    case 'tri-prism':
      return ((Math.sqrt(3) / 4) * s * s) * s;
    case 'square-pyramid':
      return (s * s * s) / 3;
    case 'tetra':
      return (s * s * s) / (6 * Math.sqrt(2));
    case 'cylinder': {
      const r = s / 2;
      return Math.PI * r * r * s;
    }
    case 'cone': {
      const r = s / 2;
      return (Math.PI * r * r * s) / 3;
    }
    case 'sphere': {
      const r = s / 2;
      return ((4 * Math.PI * r * r * r) / 3);
    }
  }
}

export function solidMeta(id: SolidId): SolidMeta {
  const m = SOLIDS.find((s) => s.id === id);
  if (!m) throw new Error(`unknown solid: ${id}`);
  return m;
}

/** 물 채우기·단위立方체가 성립하는 상자형 입체인지 (박스형 물통만 정확히 채울 수 있음). */
export function supportsVolumeFill(id: SolidId): boolean {
  return id === 'cube' || id === 'cuboid';
}
