// 전개도 모핑 — 경첩(hinge) 계층 구조. 피벗은 공유 모서리에 고정되고,
// setUnfold(t)는 접힘 회전 → 0(평면)으로 보간만 한다. 위치 보간 없음.
// 따라서 t=1 전개도에서는 모든 면이 모서리를 공유하며 붙어 있다.
// Hinge-tree net morph: pivots stay on shared edges; only rotation animates,
// so faces stay edge-connected for every t (t=0 solid, t=1 flat net).
import * as THREE from 'three';
import type { SolidId, SolidSize } from '../geo/solids';

interface Hinge {
  pivot: THREE.Group;
  folded: THREE.Quaternion;
  identity: THREE.Quaternion;
}

const IDENTITY = new THREE.Quaternion();

export class NetMorph {
  readonly group = new THREE.Group();
  private hinges: Hinge[] = [];

  constructor(private kind: SolidId, size: SolidSize) {
    this.build(size);
  }

  // ---- helpers ----

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

  /** 경첩 생성: parent 아래 pos에 피벗을 두고 접힘 회전(folded)을 기록. */
  private hinge(parent: THREE.Object3D, pos: THREE.Vector3, folded: THREE.Quaternion): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.copy(pos);
    pivot.quaternion.copy(folded);
    parent.add(pivot);
    this.hinges.push({ pivot, folded: folded.clone(), identity: IDENTITY.clone() });
    return pivot;
  }

  private hingeAxis(axis: 'x' | 'y', angle: number): THREE.Quaternion {
    const q = new THREE.Quaternion();
    if (axis === 'x') q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle);
    else q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    return q;
  }

  /** 자유 꼭짓점 C'를 목표점 T로 접는 회전 (둘 다 모서리 중점 M에 대해 수직인 경우). */
  private foldToward(edgeA: THREE.Vector3, edgeB: THREE.Vector3, free: THREE.Vector3, target: THREE.Vector3): THREE.Quaternion {
    const m = edgeA.clone().add(edgeB).multiplyScalar(0.5);
    const u1 = free.clone().sub(m).normalize();
    const u2 = target.clone().sub(m).normalize();
    return new THREE.Quaternion().setFromUnitVectors(u1, u2);
  }

  // ---- builds ----

  private build(size: SolidSize) {
    switch (this.kind) {
      case 'cube':
      case 'cuboid':
        this.buildBox(size);
        return;
      case 'tetra':
        this.buildTetra(size.s);
        return;
      case 'square-pyramid':
        this.buildPyramid(size.s);
        return;
      case 'tri-prism':
        this.buildTriPrism(size.s);
        return;
      case 'cylinder':
        this.buildCylinder(size.s);
        return;
      case 'cone':
        this.buildCone(size.s);
        return;
      case 'sphere':
        this.buildSphere(size.s);
        return;
    }
  }

  /** 정육면체/직육면체 십자 전개도: 앞 고정 + 위/아래/좌/우 + 뒤(오른쪽에 매달림). */
  private buildBox(size: SolidSize) {
    const s = size.s;
    const w = this.kind === 'cuboid' ? (size.w ?? s * 1.5) : s;
    const h = this.kind === 'cuboid' ? (size.h ?? s) : s;
    const d = this.kind === 'cuboid' ? (size.d ?? s) : s;
    const palette = [0xffd166, 0x6ea8fe, 0x7de3a8, 0xff9db0, 0xc4b5fd, 0x9bf1e5];
    const H = Math.PI / 2;
    // 앞면 (고정, z=0 평면)
    const front = this.faceMesh(w, h, palette[0]);
    this.group.add(front);
    // 위: 앞 윗변 경첩 → 뒤로 접힘(-90°)
    const top = this.hinge(this.group, new THREE.Vector3(0, h / 2, 0), this.hingeAxis('x', -H));
    const topMesh = this.faceMesh(w, d, palette[1]);
    topMesh.position.set(0, d / 2, 0);
    top.add(topMesh);
    // 아래: +90°
    const bottom = this.hinge(this.group, new THREE.Vector3(0, -h / 2, 0), this.hingeAxis('x', H));
    const bottomMesh = this.faceMesh(w, d, palette[2]);
    bottomMesh.position.set(0, -d / 2, 0);
    bottom.add(bottomMesh);
    // 왼쪽: -90° (뒤로)
    const left = this.hinge(this.group, new THREE.Vector3(-w / 2, 0, 0), this.hingeAxis('y', -H));
    const leftMesh = this.faceMesh(d, h, palette[3]);
    leftMesh.position.set(-d / 2, 0, 0);
    left.add(leftMesh);
    // 오른쪽: +90°
    const right = this.hinge(this.group, new THREE.Vector3(w / 2, 0, 0), this.hingeAxis('y', H));
    const rightMesh = this.faceMesh(d, h, palette[4]);
    rightMesh.position.set(d / 2, 0, 0);
    right.add(rightMesh);
    // 뒤: 오른쪽 면의 바깥변에 매달림 (상대 +90°)
    const back = this.hinge(right, new THREE.Vector3(d, 0, 0), this.hingeAxis('y', H));
    const backMesh = this.faceMesh(w, h, palette[5]);
    backMesh.position.set(w / 2, 0, 0);
    back.add(backMesh);
    // 접힘 상태 무게중심 보정 (앞 z=0, 뒤 z=-d → +d/2 이동)
    this.group.position.z = d / 2;
  }

  /** 정사면체: 중심 삼각형 + 3변에 매달린 삼각형 (꼭짓점으로 접힘 수치 계산). */
  private buildTetra(s: number) {
    const palette = [0xffd166, 0x6ea8fe, 0x7de3a8, 0xff9db0];
    const R = s / Math.sqrt(3);
    const verts = [90, 210, 330].map((deg) => {
      const a = (deg * Math.PI) / 180;
      return new THREE.Vector3(R * Math.cos(a), R * Math.sin(a), 0);
    });
    const H = Math.sqrt(2 / 3) * s;
    const apex = new THREE.Vector3(0, 0, H);
    // 밑면 (고정)
    const baseGeo = new THREE.BufferGeometry();
    baseGeo.setAttribute('position', new THREE.Float32BufferAttribute([
      verts[0].x, verts[0].y, 0, verts[1].x, verts[1].y, 0, verts[2].x, verts[2].y, 0,
    ], 3));
    baseGeo.computeVertexNormals();
    const base = new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({ color: palette[0], roughness: 0.5, side: THREE.DoubleSide }));
    base.add(new THREE.LineSegments(new THREE.EdgesGeometry(baseGeo), new THREE.LineBasicMaterial({ color: 0x22345c })));
    this.group.add(base);
    // 3개 옆면: 각 변마다 바깥쪽 정삼각형 → 꼭짓점으로 접기
    const edges: Array<[THREE.Vector3, THREE.Vector3]> = [[verts[0], verts[1]], [verts[1], verts[2]], [verts[2], verts[0]]];
    edges.forEach(([a, b], i) => {
      const m = a.clone().add(b).multiplyScalar(0.5);
      const outward = m.clone().normalize();
      const med = (Math.sqrt(3) / 2) * s;
      const free = m.clone().add(outward.multiplyScalar(med));
      const pivot = this.hinge(this.group, m, new THREE.Quaternion());
      // 면 형상 (평면 전개 위치에 그대로 그림)
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([
        a.x - m.x, a.y - m.y, 0, b.x - m.x, b.y - m.y, 0, free.x - m.x, free.y - m.y, 0,
      ], 3));
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: palette[(i + 1) % 4], roughness: 0.5, side: THREE.DoubleSide }));
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: 0x22345c })));
      pivot.add(mesh);
      // 접힘 회전 기록 (평면→꼭짓점)
      const q = this.foldToward(a, b, free, apex);
      pivot.quaternion.copy(q);
      const rec = this.hinges[this.hinges.length - 1];
      rec.folded.copy(q);
    });
  }

  /** 사각뿔: 정사각 밑면 + 4 이등변삼각형 (꼭짓점으로 접힘 수치 계산). */
  private buildPyramid(s: number) {
    const palette = [0xffd166, 0x6ea8fe, 0x7de3a8, 0xff9db0, 0xc4b5fd];
    const h = s; // 뿔 높이
    const apex = new THREE.Vector3(0, 0, h);
    const base = this.faceMesh(s, s, palette[0]);
    this.group.add(base);
    const slant = Math.sqrt(h * h + (s / 2) * (s / 2)); // 옆면 삼각형 높이
    const corners = [
      new THREE.Vector3(-s / 2, s / 2, 0), new THREE.Vector3(s / 2, s / 2, 0),
      new THREE.Vector3(s / 2, -s / 2, 0), new THREE.Vector3(-s / 2, -s / 2, 0),
    ];
    const edges: Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3]> = [
      [corners[0], corners[1], new THREE.Vector3(0, 1, 0)],
      [corners[1], corners[2], new THREE.Vector3(1, 0, 0)],
      [corners[2], corners[3], new THREE.Vector3(0, -1, 0)],
      [corners[3], corners[0], new THREE.Vector3(-1, 0, 0)],
    ];
    edges.forEach(([a, b, outward], i) => {
      const m = a.clone().add(b).multiplyScalar(0.5);
      const free = m.clone().add(outward.clone().multiplyScalar(slant));
      const pivot = this.hinge(this.group, m, new THREE.Quaternion());
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([
        a.x - m.x, a.y - m.y, 0, b.x - m.x, b.y - m.y, 0, free.x - m.x, free.y - m.y, 0,
      ], 3));
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: palette[i + 1], roughness: 0.5, side: THREE.DoubleSide }));
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: 0x22345c })));
      pivot.add(mesh);
      const q = this.foldToward(a, b, free, apex);
      pivot.quaternion.copy(q);
      this.hinges[this.hinges.length - 1].folded.copy(q);
    });
  }

  /** 삼각기둥: 직사각 3개 나란히 + 가운데에 삼각형 위아래. */
  private buildTriPrism(s: number) {
    const palette = [0xffd166, 0x6ea8fe, 0x7de3a8, 0xff9db0, 0xc4b5fd];
    const L = s;
    const F = (2 * Math.PI) / 3; // 120°: 세모 기둥 옆면 접힘각
    // 가운데 직사각 (고정)
    const mid = this.faceMesh(s, L, palette[1]);
    this.group.add(mid);
    // 왼쪽/오른쪽 직사각 (Y축 경첩, 같은 쪽으로 말리게 ±120°)
    const left = this.hinge(this.group, new THREE.Vector3(-s / 2, 0, 0), this.hingeAxis('y', -F));
    const lm = this.faceMesh(s, L, palette[0]);
    lm.position.set(-s / 2, 0, 0);
    left.add(lm);
    const right = this.hinge(this.group, new THREE.Vector3(s / 2, 0, 0), this.hingeAxis('y', F));
    const rm = this.faceMesh(s, L, palette[2]);
    rm.position.set(s / 2, 0, 0);
    right.add(rm);
    // 위/아래 삼각형 (가운데 직사각 상·하변 경첩, ∓90°)
    const med = (Math.sqrt(3) / 2) * s;
    const tri = (dir: number, color: number): THREE.Mesh => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([
        -s / 2, 0, 0, s / 2, 0, 0, 0, dir * med, 0,
      ], 3));
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.5, side: THREE.DoubleSide }));
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: 0x22345c })));
      return mesh;
    };
    const topH = this.hinge(this.group, new THREE.Vector3(0, L / 2, 0), this.hingeAxis('x', -Math.PI / 2));
    const tm = tri(1, palette[3]);
    tm.position.set(0, 0, 0);
    topH.add(tm);
    const botH = this.hinge(this.group, new THREE.Vector3(0, -L / 2, 0), this.hingeAxis('x', Math.PI / 2));
    const bm = tri(-1, palette[4]);
    botH.add(bm);
  }

  /** 원기둥: 옆면 직사각 + 위아래 원 (접힘 상태는 입체 고스트가 담당, 전개는 연결 유지). */
  private buildCylinder(s: number) {
    const r = s / 2;
    const w = Math.PI * s;
    const palette = [0xffd166, 0x6ea8fe, 0x7de3a8];
    const side = this.faceMesh(w, s, palette[0]);
    this.group.add(side);
    const circle = (color: number): THREE.Mesh => {
      const g = new THREE.CircleGeometry(r, 40);
      const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.5, side: THREE.DoubleSide }));
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 12), new THREE.LineBasicMaterial({ color: 0x22345c })));
      return mesh;
    };
    // 윗면: 직사각 윗변 중앙에 접함 (한 점이 아닌 변 공유처럼 보이게 중심 배치)
    const topH = this.hinge(this.group, new THREE.Vector3(0, s / 2, 0), this.hingeAxis('x', -Math.PI / 2));
    const top = circle(palette[1]);
    top.position.set(0, r, 0);
    topH.add(top);
    const botH = this.hinge(this.group, new THREE.Vector3(0, -s / 2, 0), this.hingeAxis('x', Math.PI / 2));
    const bot = circle(palette[2]);
    bot.position.set(0, -r, 0);
    botH.add(bot);
  }

  /** 원뿔: 부채꼴 + 밑면 원 (밑면은 부채꼴 호에 접하게 배치). */
  private buildCone(s: number) {
    const r = s / 2;
    const l = Math.sqrt(r * r + s * s);
    const palette = [0xffd166, 0x6ea8fe];
    const arc = Math.PI * 2 * (r / l);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.absarc(0, 0, l, -arc / 2, arc / 2, false);
    shape.lineTo(0, 0);
    const g = new THREE.ShapeGeometry(shape, 24);
    const sector = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: palette[0], roughness: 0.5, side: THREE.DoubleSide }));
    sector.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 12), new THREE.LineBasicMaterial({ color: 0x22345c })));
    this.group.add(sector);
    // 밑면 원: 부채꼴 호 중간점에 접하게
    const midAngle = 0;
    const px = l * Math.cos(midAngle);
    const py = l * Math.sin(midAngle);
    const baseH = this.hinge(this.group, new THREE.Vector3(px, py, 0), this.hingeAxis('x', 0));
    const cg = new THREE.CircleGeometry(r, 40);
    const base = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: palette[1], roughness: 0.5, side: THREE.DoubleSide }));
    base.position.set(r, 0, 0);
    baseH.add(base);
    void midAngle;
  }

  /** 구: 6개 렌즈 조각을 옆으로 나란히 (오렌지 껍질 근사, 변끼리 맞닿게). */
  private buildSphere(s: number) {
    const palette = [0xffd166, 0x6ea8fe, 0x7de3a8, 0xff9db0, 0xc4b5fd, 0x9bf1e5];
    const N = 16;
    let x = 0;
    for (let k = 0; k < 6; k++) {
      const half = Math.cos(0) * s * 0.3;
      void half;
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i <= N; i++) {
        const y = (i / N - 0.5) * s * 2;
        const wHalf = Math.cos((i / N - 0.5) * Math.PI) * s * 0.3;
        pts.push(new THREE.Vector2(wHalf, y));
      }
      for (let i = N; i >= 0; i--) {
        const y = (i / N - 0.5) * s * 2;
        const wHalf = Math.cos((i / N - 0.5) * Math.PI) * s * 0.3;
        pts.push(new THREE.Vector2(-wHalf, y));
      }
      const shape = new THREE.Shape(pts);
      const g = new THREE.ShapeGeometry(shape);
      g.computeBoundingBox();
      const bb = g.boundingBox!;
      const cw = bb.max.x - bb.min.x;
      const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: palette[k % palette.length], roughness: 0.5, side: THREE.DoubleSide }));
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), new THREE.LineBasicMaterial({ color: 0x22345c })));
      // 이전 조각 오른쪽 변에 맞닿게 배치
      mesh.position.set(x - bb.min.x, 0, 0);
      this.group.add(mesh);
      x += cw;
    }
  }

  /** t=0 접힘(입체) → t=1 펼침(전개도). 회전만 보간하므로 연결이 유지된다. */
  setUnfold(t: number) {
    const c = Math.min(1, Math.max(0, t));
    const k = 1 - c;
    for (const h of this.hinges) {
      h.pivot.quaternion.slerpQuaternions(h.identity, h.folded, k);
    }
  }

  dispose() {
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const geo = (mesh as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
      if (geo) geo.dispose();
    });
  }
}
