// 입체 지오메트리 생성 — Three.js BufferGeometry 팩토리.
// Creates solid geometries for the 8 kinds (sphere = approx wireframe+mesh).
import * as THREE from 'three';
import type { SolidId, SolidSize } from '../geo/solids';

export function createSolidGeometry(id: SolidId, size: SolidSize): THREE.BufferGeometry {
  const s = size.s;
  switch (id) {
    case 'cube':
      return new THREE.BoxGeometry(s, s, s);
    case 'cuboid':
      return new THREE.BoxGeometry(size.w ?? s * 1.5, size.h ?? s, size.d ?? s);
    case 'tri-prism': {
      // 정삼각기둥: 밑면 정삼각형 한 변 s, 길이 s (z축)
      const h = (Math.sqrt(3) / 2) * s;
      const geo = new THREE.CylinderGeometry(s / Math.sqrt(3), s / Math.sqrt(3), s, 3, 1);
      geo.rotateY(Math.PI / 2);
      geo.scale(1, 1, 1);
      void h;
      return geo;
    }
    case 'square-pyramid':
      return new THREE.ConeGeometry((s * Math.SQRT2) / 2, s, 4, 1);
    case 'tetra':
      return new THREE.TetrahedronGeometry(s * 0.9);
    case 'cylinder':
      return new THREE.CylinderGeometry(s / 2, s / 2, s, 48, 1, false);
    case 'cone':
      return new THREE.ConeGeometry(s / 2, s, 48, 1, false);
    case 'sphere':
      return new THREE.SphereGeometry(s / 2, 40, 28);
  }
}

export function solidGroup(id: SolidId, size: SolidSize): THREE.Group {
  const group = new THREE.Group();
  const geo = createSolidGeometry(id, size);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x6ea8fe,
    roughness: 0.35,
    metalness: 0.08,
    transparent: true,
    opacity: 0.96,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'solid';
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo, 20),
    new THREE.LineBasicMaterial({ color: 0x0b1526, transparent: true, opacity: 0.55 }),
  );
  edges.name = 'edges';
  group.add(mesh, edges);
  return group;
}
