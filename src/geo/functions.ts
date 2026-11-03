// 함수 그래프 계산 — 2차·삼각함수. Float32Array 메모이제이션 갱신용.
// Function math: quadratic y=ax²+bx+c, trig y=A·sin(Bx+C)+D, plus surface grids.

export interface QuadParams {
  a: number;
  b: number;
  c: number;
}

export interface TrigParams {
  A: number;
  B: number;
  C: number;
  D: number;
}

export function parabola(p: QuadParams, x: number): number {
  return p.a * x * x + p.b * x + p.c;
}

export function parabolaVertex(p: QuadParams): { x: number; y: number } {
  if (Math.abs(p.a) < 1e-12) return { x: 0, y: p.c };
  const x = -p.b / (2 * p.a);
  return { x, y: parabola(p, x) };
}

export function trig(p: TrigParams, x: number): number {
  return p.A * Math.sin(p.B * x + p.C) + p.D;
}

/** 2D 곡선 샘플 (x 범위 균등 분할). */
export function buildCurvePoints(
  fn: (x: number) => number,
  xMin: number,
  xMax: number,
  segments: number,
): Float32Array {
  const out = new Float32Array((segments + 1) * 3);
  for (let i = 0; i <= segments; i++) {
    const x = xMin + ((xMax - xMin) * i) / segments;
    out[i * 3] = x;
    out[i * 3 + 1] = fn(x);
    out[i * 3 + 2] = 0;
  }
  return out;
}

/** 곡면 그리드 z=f(x,y) — 슬라이더 변경 시 재계산. 인덱스 포함. */
export function buildSurfaceGrid(
  fn: (x: number, y: number) => number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  segX: number,
  segY: number,
): { positions: Float32Array; index: Uint32Array; nx: number; ny: number } {
  const nx = segX + 1;
  const ny = segY + 1;
  const positions = new Float32Array(nx * ny * 3);
  let k = 0;
  for (let iy = 0; iy < ny; iy++) {
    const y = yMin + ((yMax - yMin) * iy) / segY;
    for (let ix = 0; ix < nx; ix++) {
      const x = xMin + ((xMax - xMin) * ix) / segX;
      positions[k++] = x;
      positions[k++] = y;
      positions[k++] = fn(x, y);
    }
  }
  const index = new Uint32Array(segX * segY * 6);
  let q = 0;
  for (let iy = 0; iy < segY; iy++) {
    for (let ix = 0; ix < segX; ix++) {
      const a = iy * nx + ix;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      index[q++] = a;
      index[q++] = c;
      index[q++] = b;
      index[q++] = b;
      index[q++] = c;
      index[q++] = d;
    }
  }
  return { positions, index, nx, ny };
}

/** 기존 Float32Array 버퍼에 덮어쓰기 (GC 절약). */
export function updateSurfaceGrid(
  positions: Float32Array,
  fn: (x: number, y: number) => number,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  segX: number,
  segY: number,
): void {
  let k = 0;
  for (let iy = 0; iy <= segY; iy++) {
    const y = yMin + ((yMax - yMin) * iy) / segY;
    for (let ix = 0; ix <= segX; ix++) {
      const x = xMin + ((xMax - xMin) * ix) / segX;
      positions[k++] = x;
      positions[k++] = y;
      positions[k++] = fn(x, y);
    }
  }
}
