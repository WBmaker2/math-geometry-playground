// 전개도 모핑 — 면을 경첩(hinge)축 기준 foldAngle(t)만큼 회전.
// NetMorph: hinge-pivot face groups; setUnfold(t) rotates each face open.
import * as THREE from 'three';
import type { SolidId, SolidSize } from '../geo/solids';

/** 정육면체 전개(십자형): 앞면을 기준으로 5개 면을 경첩 회전. 그 외 입체는 근사(폭발+평탄). */
export class NetMorph {
  readonly group = new THREE.Group();
  private pivots: THREE.Group[] = [];
  private openAngles: number[] = [];
  private basePos: THREE.Vector3[] = [];
  private flatPos: THREE.Vector3[] = [];
  private kind: SolidId;

  constructor(kind: SolidId, size: SolidSize) {
    this.kind = kind;
    this.build(kind, size);
  }

  private faceMesh(w: number, h: number, color: number): THREE.Mesh {
    const g = new THREE.PlaneGeometry(w, h);
    const m = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide }),
    );
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(g),
      new THREE.LineBasicMaterial({ color: 0x22345c }),
    );
    m.add(edge);
    return m;
  }

  private build(kind: SolidId, size: SolidSize) {
    const s = size.s;
    const palette = [0xffd166, 0x6ea8fe, 0x7de3a8, 0xff9db0, 0xc4b5fd, 0x9bf1e5];
    if (kind === 'cube' || kind === 'cuboid') {
      const w = kind === 'cuboid' ? (size.w ?? s * 1.5) : s;
      const h = kind === 'cuboid' ? (size.h ?? s) : s;
      const d = kind === 'cuboid' ? (size.d ?? s) : s;
      // 앞면 고정, 위/아래/좌/우/뒤를 경첩 회전
      const front = this.faceMesh(w, h, palette[0]);
      const frontPivot = new THREE.Group();
      frontPivot.add(front);
      this.group.add(frontPivot);
      this.pivots.push(frontPivot);
      this.openAngles.push(0);
      this.basePos.push(new THREE.Vector3(0, 0, d / 2));
      this.flatPos.push(new THREE.Vector3(0, 0, 0));
      frontPivot.position.set(0, 0, d / 2);

      const mk = (meshW: number, meshH: number, color: number, pivotPos: THREE.Vector3, meshOffset: THREE.Vector3, axis: 'x' | 'y', open: number, flat: THREE.Vector3) => {
        const m = this.faceMesh(meshW, meshH, color);
        m.position.copy(meshOffset);
        const pivot = new THREE.Group();
        pivot.position.copy(pivotPos);
        pivot.add(m);
        pivot.userData.axis = axis;
        this.group.add(pivot);
        this.pivots.push(pivot);
        this.openAngles.push(open);
        this.basePos.push(pivotPos.clone());
        this.flatPos.push(flat.clone());
      };
      const H = Math.PI / 2;
      // 위: 앞면 윗변 경첩, 위로 접힘 → 펼치면 위로
      mk(w, d, palette[1], new THREE.Vector3(0, h / 2, d / 2), new THREE.Vector3(0, d / 2, 0), 'x', H, new THREE.Vector3(0, h / 2 + d / 2, 0));
      // 아래
      mk(w, d, palette[2], new THREE.Vector3(0, -h / 2, d / 2), new THREE.Vector3(0, -d / 2, 0), 'x', -H, new THREE.Vector3(0, -h / 2 - d / 2, 0));
      // 왼쪽
      mk(d, h, palette[3], new THREE.Vector3(-w / 2, 0, d / 2), new THREE.Vector3(-d / 2, 0, 0), 'y', -H, new THREE.Vector3(-w / 2 - d / 2, 0, 0));
      // 오른쪽
      mk(d, h, palette[4], new THREE.Vector3(w / 2, 0, d / 2), new THREE.Vector3(d / 2, 0, 0), 'y', H, new THREE.Vector3(w / 2 + d / 2, 0, 0));
      // 뒤: 오른쪽 면 끝에 붙음 (연쇄 전개 단순화: 오른쪽으로 펼침)
      mk(w, h, palette[5], new THREE.Vector3(w / 2 + d, 0, d / 2), new THREE.Vector3(w / 2, 0, 0), 'y', H, new THREE.Vector3(w / 2 + d + w / 2, 0, 0));
      return;
    }
    // 그 외 입체: 면들을 원형으로 펼치는 근사 (폭발视图 + 평탄 보간)
    const count = kind === 'tetra' ? 4 : kind === 'tri-prism' ? 5 : kind === 'square-pyramid' ? 5 : kind === 'cone' ? 2 : kind === 'cylinder' ? 3 : 6;
    for (let i = 0; i < count; i++) {
      const m = this.faceMesh(s * 0.9, s * 0.9, palette[i % palette.length]);
      const ang = (i / count) * Math.PI * 2;
      const pivot = new THREE.Group();
      const r = s * 0.4;
      pivot.position.set(Math.cos(ang) * r, Math.sin(ang) * r, 0);
      m.position.set(0, 0, 0);
      pivot.add(m);
      pivot.userData.axis = i % 2 ? 'x' : 'y';
      pivot.userData.spin = ang;
      this.group.add(pivot);
      this.pivots.push(pivot);
      this.openAngles.push(Math.PI / 2);
      this.basePos.push(pivot.position.clone());
      this.flatPos.push(new THREE.Vector3(Math.cos(ang) * s * 1.4, Math.sin(ang) * s * 1.4, 0));
    }
  }

  /** t=0 접힘 → t=1 펼침. */
  setUnfold(t: number) {
    const c = Math.min(1, Math.max(0, t));
    for (let i = 0; i < this.pivots.length; i++) {
      const pivot = this.pivots[i];
      const axis = (pivot.userData.axis ?? 'x') as 'x' | 'y';
      // 접힘 각도 → 0(평면)으로 선형 보간. t=0 입체 / t=1 전개도.
      const folded = this.foldedAngle(i);
      const rot = folded * (1 - c);
      if (axis === 'x') {
        pivot.rotation.x = rot;
        pivot.rotation.y = 0;
      } else {
        pivot.rotation.y = rot;
        pivot.rotation.x = 0;
      }
      // 위치도 3D→2D 보간
      const b = this.basePos[i];
      const f = this.flatPos[i];
      const k = this.kind === 'cube' || this.kind === 'cuboid' ? 1 : 0.6;
      pivot.position.set(b.x + (f.x - b.x) * c * k, b.y + (f.y - b.y) * c * k, b.z * (1 - c));
    }
  }

  private foldedAngle(i: number): number {
    // 접힘 상태 회전값 (시각적 입체감용)
    if (this.kind !== 'cube' && this.kind !== 'cuboid') return 0;
    // [front, top, bottom, left, right, back]
    const table = [0, -Math.PI / 2, Math.PI / 2, Math.PI / 2, -Math.PI / 2, Math.PI];
    return table[i] ?? 0;
  }

  dispose() {
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const geo = (mesh as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
      if (geo) geo.dispose();
    });
  }
}
