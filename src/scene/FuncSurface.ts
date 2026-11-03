// 함수 곡면 — 매개 그리드(z=f(x,y)), 슬라이더 변경 시 Float32Array 갱신.
// Live 3D curve/surface updated from sliders with memoized buffers.
import * as THREE from 'three';
import { buildSurfaceGrid, updateSurfaceGrid } from '../geo/functions';

export type FuncKind = 'quad' | 'trig' | 'saddle';

export interface FuncState {
  kind: FuncKind;
  a: number;
  b: number;
  c: number;
  A: number;
  B: number;
  C: number;
  D: number;
}

export function evalFunc(s: FuncState, x: number, y: number): number {
  switch (s.kind) {
    case 'quad':
      return s.a * x * x + s.b * x + s.c - y * y * 0.15;
    case 'trig':
      return s.A * Math.sin(s.B * x + s.C) * Math.cos(y * 0.8) + s.D;
    case 'saddle':
      return s.a * (x * x - y * y) * 0.4 + s.D;
  }
}

export class FuncSurface {
  readonly group = new THREE.Group();
  private mesh: THREE.Mesh;
  private positions: Float32Array;
  private segX = 48;
  private segY = 32;
  private range = 5;

  constructor() {
    const { positions, index } = buildSurfaceGrid(() => 0, -this.range, this.range, -3, 3, this.segX, this.segY);
    this.positions = positions;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.computeVertexNormals();
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: 0x7de3a8, wireframe: false, roughness: 0.4, metalness: 0.1, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }),
    );
    const wire = new THREE.Mesh(
      geo.clone(),
      new THREE.MeshBasicMaterial({ color: 0x0b3b2e, wireframe: true, transparent: true, opacity: 0.25 }),
    );
    wire.scale.set(1, 1, 1.001);
    this.group.add(this.mesh, wire);
    const axes = new THREE.AxesHelper(5.5);
    this.group.add(axes);
  }

  update(state: FuncState) {
    updateSurfaceGrid(this.positions, (x, y) => evalFunc(state, x, y), -this.range, this.range, -3, 3, this.segX, this.segY);
    (this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    const wire = this.group.children[1] as THREE.Mesh;
    (wire.geometry as THREE.BufferGeometry).copy(this.mesh.geometry);
  }

  dispose() {
    this.group.traverse((o) => {
      const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
      if (g) g.dispose();
    });
  }
}
