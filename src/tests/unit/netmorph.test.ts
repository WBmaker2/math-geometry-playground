import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { NetMorph } from '../../scene/NetMorph';
import type { SolidId } from '../../geo/solids';

function allCornerSets(net: NetMorph): THREE.Vector3[][] {
  net.group.updateWorldMatrix(true, true);
  const meshes: THREE.Mesh[] = [];
  net.group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  return meshes.map((m) => {
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      if (!pts.some((q) => q.distanceTo(v) < 1e-6)) pts.push(v);
    }
    return pts;
  });
}

/** 월드 공간에서 면 메시의 4 모서리를 구한다. */
function worldCorners(net: NetMorph, index: number): THREE.Vector3[] {
  net.group.updateWorldMatrix(true, true);
  const meshes: THREE.Mesh[] = [];
  net.group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry?.type === 'PlaneGeometry') {
      meshes.push(o as THREE.Mesh);
    }
  });
  const m = meshes[index];
  const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute;
  // PlaneGeometry 정점 중 4 모서리 (중복 제외)
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
    if (!pts.some((q) => q.distanceTo(v) < 1e-9)) pts.push(v);
  }
  expect(pts.length).toBe(4);
  return pts;
}

/** 두 면이 한 변을 공유하는지 (2개 정점 일치). */
function sharedEdge(a: THREE.Vector3[], b: THREE.Vector3[], tol = 1e-6): boolean {
  let shared = 0;
  for (const p of a) {
    if (b.some((q) => p.distanceTo(q) < tol)) shared++;
  }
  return shared >= 2;
}

describe('NetMorph connectivity (cube)', () => {
  it('t=1 전개도에서 6면이 서로 붙어 있다 (십자 연결)', () => {
    const net = new NetMorph('cube', { s: 2 });
    net.setUnfold(1);
    const faces = [0, 1, 2, 3, 4, 5].map((i) => worldCorners(net, i));
    // 앞(0)-위(1), 앞-아래(2), 앞-좌(3), 앞-우(4), 우(4)-뒤(5) 연결
    expect(sharedEdge(faces[0], faces[1])).toBe(true);
    expect(sharedEdge(faces[0], faces[2])).toBe(true);
    expect(sharedEdge(faces[0], faces[3])).toBe(true);
    expect(sharedEdge(faces[0], faces[4])).toBe(true);
    expect(sharedEdge(faces[4], faces[5])).toBe(true);
  });

  it('t=0 접힘 상태에서 정육면체를 이룬다 (면 중심이 각 면 위치)', () => {
    const net = new NetMorph('cube', { s: 2 });
    net.setUnfold(0);
    net.group.updateWorldMatrix(true, true);
    const meshes: THREE.Mesh[] = [];
    net.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry?.type === 'PlaneGeometry') {
        meshes.push(o as THREE.Mesh);
      }
    });
    expect(meshes.length).toBe(6);
    const centers = meshes.map((m) => new THREE.Vector3().setFromMatrixPosition(m.matrixWorld));
    // 6면 중심: ±x, ±y, ±z 축상 거리 1 (s=2)
    for (const c of centers) {
      const ax = [Math.abs(c.x), Math.abs(c.y), Math.abs(c.z)];
      const big = ax.filter((v) => Math.abs(v - 1) < 1e-6).length;
      const small = ax.filter((v) => v < 1e-6).length;
      expect(big).toBe(1);
      expect(small).toBe(2);
    }
  });
});

describe('NetMorph flatness at t=1 (all solids)', () => {
  const kinds: SolidId[] = ['cube', 'cuboid', 'tri-prism', 'square-pyramid', 'tetra', 'cylinder', 'cone', 'sphere'];
  it.each(kinds)('%s 전개도는 한 평면에 있다', (kind) => {
    const net = new NetMorph(kind, { s: 2, w: 3, h: 2, d: 2 });
    net.setUnfold(1);
    const sets = allCornerSets(net);
    expect(sets.length).toBeGreaterThanOrEqual(2);
    const zs = sets.flat().map((v) => v.z);
    expect(Math.max(...zs) - Math.min(...zs)).toBeLessThan(1e-6);
  });

  it.each(['cube', 'tri-prism', 'square-pyramid', 'tetra'] as SolidId[])('%s 전개도의 각 면은 다른 면과 변을 공유한다', (kind) => {
    const net = new NetMorph(kind, { s: 2, w: 3, h: 2, d: 2 });
    net.setUnfold(1);
    const sets = allCornerSets(net);
    for (let i = 1; i < sets.length; i++) {
      const shares = sets.some((other, j) => {
        if (j === i) return false;
        let n = 0;
        for (const p of sets[i]) {
          if (other.some((q) => p.distanceTo(q) < 1e-6)) n++;
        }
        return n >= 2;
      });
      expect(shares).toBe(true);
    }
  });
});
