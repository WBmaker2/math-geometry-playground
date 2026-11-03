// 단면 평면 시각화 — Three.js 클리핑 + 캡 다각형 메시.
// SlicePlane: draggable plane (offset slider) + cap polygon highlight.
import * as THREE from 'three';
import { intersectConvex, normalize } from '../geo/slice';
import type { Vec3 } from '../geo/nets';

export interface SliceResult {
  points: Vec3[];
  mesh: THREE.Mesh | null;
}

export function buildCapMesh(points: Vec3[], color = 0xff5d73): THREE.Mesh | null {
  if (points.length < 3) return null;
  const shape = new THREE.Shape();
  // 평면 기저에 투영해 Shape 생성 (간단히 x,y 사용 후 3D 복원 대신 ShapeGeometry를 평면에 배치)
  // 캡은 3D 삼각팬으로 직접 생성 — 가장 견고.
  const c: Vec3 = [
    points.reduce((a, p) => a + p[0], 0) / points.length,
    points.reduce((a, p) => a + p[1], 0) / points.length,
    points.reduce((a, p) => a + p[2], 0) / points.length,
  ];
  const verts: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    verts.push(c[0], c[1], c[2], p[0], p[1], p[2], q[0], q[1], q[2]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  const edgePts = [...points, points[0]].map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(edgePts),
    new THREE.LineBasicMaterial({ color: 0x7a0e1e }),
  );
  mesh.add(line);
  void shape;
  return mesh;
}

export class SliceController {
  readonly planeMesh: THREE.Mesh;
  readonly plane: THREE.Plane;
  cap: THREE.Mesh | null = null;

  constructor(size = 4) {
    this.plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    this.planeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ color: 0x38e1c6, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
    );
    const grid = new THREE.GridHelper(size, 8, 0x0b1526, 0x0b1526);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.35;
    grid.rotation.x = Math.PI / 2;
    this.planeMesh.add(grid);
  }

  /** tilt: 0=수평, 1=수직 / offset: -1..1 */
  update(tilt: number, offset: number, diagonal: boolean, vertices: Vec3[], edges: Array<[number, number]>): { points: Vec3[]; count: number } {
    const n: Vec3 = diagonal
      ? normalize([0.6, 1, 0.6])
      : tilt < 0.5
        ? normalize([0, 1, 0.25 * tilt * 2])
        : normalize([0, 0.2, 1]);
    const constant = -offset * 1.6;
    this.plane.normal.set(n[0], n[1], n[2]);
    this.plane.constant = constant;
    // 평면 메시 위치/회전 동기화
    this.planeMesh.position.set(-n[0] * constant, -n[1] * constant, -n[2] * constant);
    this.planeMesh.lookAt(this.planeMesh.position.clone().add(new THREE.Vector3(n[0], n[1], n[2])));
    const points = intersectConvex(vertices, edges, { normal: n, constant });
    if (this.cap) {
      this.planeMesh.parent?.remove(this.cap);
      this.cap.geometry.dispose();
      this.cap = null;
    }
    const cap = buildCapMesh(points);
    if (cap && this.planeMesh.parent) {
      this.planeMesh.parent.add(cap);
      this.cap = cap;
    }
    return { points, count: points.length };
  }
}
