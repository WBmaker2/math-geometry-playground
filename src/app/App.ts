// App — SolidView / SliceView / FunctionView + 우측 공식 패널.
// Single WebGLRenderer, view switching, drag-orbit, live updates.
import * as THREE from 'three';
import { defaultSize, solidMeta } from '../geo/solids';
import { nameCrossSection, cubeVertices, cubeEdges, intersectConvex, normalize } from '../geo/slice';
import { parabolaVertex } from '../geo/functions';
import { solidGroup } from '../scene/SolidMesh';
import { NetMorph } from '../scene/NetMorph';
import { FuncSurface } from '../scene/FuncSurface';
import { buildCapMesh } from '../scene/SlicePlane';
import { store } from '../stores/solidStore';
import type { ViewId } from '../stores/solidStore';
import { mountPicker, } from '../ui/Picker';
import { mountUnfoldSlider, mountFormulaPanel } from '../ui/Panels';
import { mountQuiz } from '../ui/Quiz';
import { mountWorksheet } from '../ui/Worksheet';

const VIEW_TABS: Array<{ id: ViewId; ko: string }> = [
  { id: 'solid', ko: '입체·전개도' },
  { id: 'slice', ko: '단면 자르기' },
  { id: 'func', ko: '함수 그래프' },
  { id: 'quiz', ko: '퀴즈' },
  { id: 'print', ko: '인쇄 학습지' },
];

export class App {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera!: THREE.PerspectiveCamera;
  private stage = new THREE.Group();
  private solid: THREE.Group | null = null;
  private net: NetMorph | null = null;
  private func: FuncSurface | null = null;
  private water: THREE.Mesh | null = null;
  private unitCubes: THREE.Group | null = null;
  private clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  private planeHelper: THREE.Mesh;
  private cap: THREE.Mesh | null = null;
  private raf = 0;
  private rotX = -0.5;
  private rotY = 0.7;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private controlsKey = '';
  private sideCleanup: (() => void) | null = null;

  constructor(private root: HTMLElement) {
    this.planeHelper = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 4.4),
      new THREE.MeshBasicMaterial({ color: 0x38e1c6, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
    );
    this.buildDOM();
    this.initGL();
    this.syncFromStore();
    store.subscribe(() => this.syncFromStore());
    this.loop();
  }

  private buildDOM() {
    this.root.innerHTML = `
      <a class="skip-link" href="#main">본문으로 건너뛰기</a>
      <header class="topbar">
        <h1>Math Geometry Playground <span class="sub">3D 수학 도형 놀이터</span></h1>
        <nav class="tabs" role="tablist" aria-label="학습 모드">
          ${VIEW_TABS.map((t) => `<button role="tab" type="button" data-view="${t.id}" aria-selected="${store.get().view === t.id}">${t.ko}</button>`).join('')}
        </nav>
      </header>
      <div id="picker-wrap" class="picker-wrap"></div>
      <main id="main" class="layout">
        <section class="stage" aria-label="3D 도형 장면">
          <canvas id="scene" aria-label="3D 도형 장면"></canvas>
          <p class="placeholder" aria-live="polite"></p>
          <div id="view-controls" class="controls"></div>
        </section>
        <aside class="panel" aria-label="조작 패널">
          <div id="formula"></div>
          <div id="side-controls"></div>
        </aside>
      </main>
      <section id="quiz-sec" class="sheet" hidden></section>
      <section id="print-sec" class="sheet" hidden></section>
      <footer class="footer"><small>전개도는 수업용 개념 모형 · 드래그로 회전 · 휠로 확대</small></footer>`;

    mountPicker(this.root.querySelector('#picker-wrap')!);
    mountFormulaPanel(this.root.querySelector('#formula')!);
    mountQuiz(this.root.querySelector('#quiz-sec')!);
    mountWorksheet(this.root.querySelector('#print-sec')!);

    this.root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        store.set({ view: btn.dataset.view as ViewId });
        this.root.querySelectorAll('[data-view]').forEach((b) =>
          b.setAttribute('aria-selected', String(b === btn)),
        );
        if (btn.dataset.view === 'solid') {
          const start = this.root.querySelector('#start');
          start?.classList.add('btn-pulse');
        }
      });
    });
  }

  private initGL() {
    const canvas = this.root.querySelector<HTMLCanvasElement>('#scene')!;
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    } catch {
      canvas.insertAdjacentHTML('afterend', '<p>WebGL을 사용할 수 없어 2D 모드로 표시됩니다.</p>');
      throw new Error('webgl-unavailable');
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;
    this.scene.background = new THREE.Color(0x04070f);
    this.scene.fog = new THREE.Fog(0x04070f, 12, 26);
    this.camera = new THREE.PerspectiveCamera(45, 1.6, 0.1, 100);
    this.camera.position.set(4.4, 3.4, 5.6);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(5, 8, 6);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x6ea8fe, 0.5);
    fill.position.set(-6, 2, -4);
    this.scene.add(fill);
    const grid = new THREE.GridHelper(10, 10, 0x1e2c4a, 0x101c33);
    grid.position.y = -2.2;
    this.scene.add(grid);
    this.scene.add(this.stage);
    this.stage.add(this.planeHelper);
    this.planeHelper.visible = false;

    const resize = () => {
      const w = canvas.clientWidth || 640;
      const h = 380;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.rotY += (e.clientX - this.lastX) * 0.008;
      this.rotX = Math.max(-1.4, Math.min(1.4, this.rotX + (e.clientY - this.lastY) * 0.008));
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    canvas.addEventListener('pointerup', () => (this.dragging = false));
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const d = this.camera.position.length();
      const nd = Math.max(4, Math.min(14, d + e.deltaY * 0.01));
      this.camera.position.setLength(nd);
    }, { passive: false });
  }

  private clearStage() {
    if (this.solid) {
      this.stage.remove(this.solid);
      this.solid.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) (m.geometry as THREE.BufferGeometry).dispose();
      });
      this.solid = null;
    }
    if (this.net) {
      this.stage.remove(this.net.group);
      this.net.dispose();
      this.net = null;
    }
    if (this.func) {
      this.stage.remove(this.func.group);
      this.func.dispose();
      this.func = null;
    }
    if (this.cap) {
      this.stage.remove(this.cap);
      this.cap.geometry.dispose();
      this.cap = null;
    }
    if (this.water) {
      this.stage.remove(this.water);
      this.water.geometry.dispose();
      this.water = null;
    }
    if (this.unitCubes) {
      this.stage.remove(this.unitCubes);
      this.unitCubes.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) (m.geometry as THREE.BufferGeometry).dispose();
      });
      this.unitCubes = null;
    }
  }

  private syncFromStore() {
    const s = store.get();
    // 컨트롤 DOM은 뷰/입체가 바뀔 때만 다시 만든다.
    // 슬라이더 드래그 중에는 입력 요소를 교체하지 않는다 (끊김 방지).
    const controlsKey = `${s.view}:${s.solidId}`;
    if (controlsKey !== this.controlsKey) {
      this.controlsKey = controlsKey;
      try {
        this.renderControls(s.view);
      } catch {
        /* noop */
      }
    } else {
      this.syncControlValues();
    }
    const canvas = this.root.querySelector<HTMLCanvasElement>('#scene');
    const quizSec = this.root.querySelector<HTMLElement>('#quiz-sec')!;
    const printSec = this.root.querySelector<HTMLElement>('#print-sec')!;
    const stage = this.root.querySelector<HTMLElement>('.stage')!;
    quizSec.hidden = s.view !== 'quiz';
    printSec.hidden = s.view !== 'print';
    stage.style.display = s.view === 'quiz' || s.view === 'print' ? 'none' : '';
    if (s.view === 'quiz' || s.view === 'print') return;
    if (!this.renderer) return;

    // 씬 재구성 조건: 입체/뷰 변경 시에만 clear (슬라이더 드래그는 기존 객체 갱신)
    const wantKey = `${s.view}:${s.solidId}`;
    if (this.stage.userData.key !== wantKey) {
      this.clearStage();
      this.stage.userData.key = wantKey;
      const size = defaultSize(s.solidId);
      if (s.view === 'func') {
        this.func = new FuncSurface();
        this.stage.add(this.func.group);
        this.stage.rotation.set(0, 0, 0);
      } else {
        this.solid = solidGroup(s.solidId, size);
        this.net = new NetMorph(s.solidId, size);
        this.stage.add(this.solid, this.net.group);
        this.buildVolumeHelpers(size.s);
        // 단면 뷰에서만 클리핑 적용
        this.solid.traverse((o) => {
          const m = o as THREE.Mesh;
          const mat = m.material as THREE.Material | undefined;
          if (mat && 'clippingPlanes' in mat) {
            (mat as THREE.MeshStandardMaterial).clippingPlanes = s.view === 'slice' ? [this.clipPlane] : null;
            (mat as THREE.MeshStandardMaterial).clipShadows = false;
          }
        });
      }
    }
    this.applyState();
    void canvas;
  }

  private buildVolumeHelpers(s: number) {
    if (!this.solid) return;
    // 물 채우기: 반투명 파란 상자
    const waterGeo = new THREE.BoxGeometry(s * 0.94, 1, s * 0.94);
    waterGeo.translate(0, 0.5, 0);
    this.water = new THREE.Mesh(
      waterGeo,
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55, roughness: 0.2 }),
    );
    this.water.position.y = -s / 2;
    this.water.scale.y = 0.001;
    this.stage.add(this.water);
    // 단위立方: s=2 → 2×2×2 = 8개 작은 정육면체
    const cubes = new THREE.Group();
    const n = Math.max(1, Math.round(s));
    const cell = s / n;
    for (let ix = 0; ix < n; ix++) {
      for (let iy = 0; iy < n; iy++) {
        for (let iz = 0; iz < n; iz++) {
          const m = new THREE.Mesh(
            new THREE.BoxGeometry(cell * 0.86, cell * 0.86, cell * 0.86),
            new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.5 }),
          );
          m.position.set((ix - (n - 1) / 2) * cell, (iy - (n - 1) / 2) * cell, (iz - (n - 1) / 2) * cell);
          cubes.add(m);
        }
      }
    }
    cubes.visible = false;
    this.unitCubes = cubes;
    this.stage.add(cubes);
  }

  private applyState() {
    const s = store.get();
    if (s.view === 'func' && this.func) {
      this.func.update({ kind: s.funcKind, a: s.a, b: s.b, c: s.c, A: s.A, B: s.B, C: s.C, D: s.D });
      this.func.group.rotation.set(this.rotX, this.rotY, 0);
      this.planeHelper.visible = false;
      return;
    }
    if (!this.solid || !this.net) return;
    this.stage.rotation.set(this.rotX, this.rotY, 0);
    if (s.view === 'solid') {
      this.planeHelper.visible = false;
      if (this.cap) {
        this.stage.remove(this.cap);
        this.cap = null;
      }
      this.clipPlane.constant = 1e9; // 클리핑 해제 효과
      this.net.setUnfold(s.unfoldT);
      // 펼칠수록 입체는 투명하게, 전개도는 선명하게
      this.solid.visible = s.unfoldT < 0.85;
      this.net.group.visible = s.unfoldT > 0.02;
      this.solid.traverse((o) => {
        const m = o as THREE.Mesh;
        const mat = m.material as THREE.MeshStandardMaterial | undefined;
        if (mat && 'opacity' in mat) mat.opacity = 0.96 * (1 - s.unfoldT * 0.7);
      });
      if (this.water) {
        const size = defaultSize(s.solidId);
        // 펼치면(전개도) 물·단위立方체는 숨겨 전개도가 겹쳐 보이지 않게
        const showFill = !store.get().showUnitCubes && s.unfoldT < 0.5;
        this.water.visible = showFill;
        this.water.scale.y = Math.max(0.001, size.s * s.volumeFill);
      }
      if (this.unitCubes) this.unitCubes.visible = store.get().showUnitCubes && s.unfoldT < 0.5;
    } else if (s.view === 'slice') {
      this.net.group.visible = false;
      this.solid.visible = true;
      if (this.water) this.water.visible = false;
      if (this.unitCubes) this.unitCubes.visible = false;
      this.solid.traverse((o) => {
        const m = o as THREE.Mesh;
        const mat = m.material as THREE.MeshStandardMaterial | undefined;
        if (mat && 'opacity' in mat) mat.opacity = 0.96;
      });
      // 단면 평면 계산 (정육면체 계열은 정확한 볼록 교선, 곡면은 이름만)
      const size = defaultSize(s.solidId);
      const curved = s.solidId === 'cylinder' || s.solidId === 'cone' || s.solidId === 'sphere';
      const n = s.sliceDiagonal ? normalize([0.6, 1, 0.6]) : s.sliceTilt < 0.5 ? normalize([0, 1, 0.2]) : normalize([0, 0.25, 1]);
      const constant = -s.sliceOffset * (size.s * 0.8);
      this.clipPlane.normal.set(n[0], n[1], n[2]);
      this.clipPlane.constant = constant;
      this.planeHelper.visible = true;
      this.planeHelper.position.set(-n[0] * constant, -n[1] * constant, -n[2] * constant);
      this.planeHelper.lookAt(this.planeHelper.position.clone().add(new THREE.Vector3(n[0], n[1], n[2])));
      // 캡: 입체별 근사 정점
      let verts = cubeVertices(size.s);
      let edges = cubeEdges();
      if (s.solidId === 'tetra') {
        const r = size.s;
        verts = [[r, r, r], [-r, -r, r], [-r, r, -r], [r, -r, -r]];
        edges = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
      }
      const pts = curved ? [] : intersectConvex(verts, edges, { normal: n, constant });
      if (this.cap) {
        this.stage.remove(this.cap);
        this.cap.geometry.dispose();
        this.cap = null;
      }
      // 캡을 stage 회전과 무관하게 stage 안에 넣되, stage가 회전하므로 로컬 좌표 그대로 사용
      const cap = buildCapMesh(pts.length ? pts : []);
      if (cap) {
        this.stage.add(cap);
        this.cap = cap;
      }
      const label = this.root.querySelector('#slice-result');
      if (label) {
        let nameKo: string;
        let extra: string;
        if (curved) {
          nameKo = s.sliceTilt < 0.25 ? '원' : '타원';
          extra = `${solidMeta(s.solidId).nameKo}를 자르면 ${nameKo}이 나와요`;
        } else {
          const info = nameCrossSection(pts.length);
          nameKo = info.nameKo;
          extra = pts.length === 6 ? '정육면체 대각 단면 = 정육각형!' : `${solidMeta(s.solidId).nameKo} 단면: ${info.nameKo} (${pts.length}개 점)`;
        }
        label.innerHTML = `<strong data-testid="slice-name">${nameKo}</strong> — ${extra}`;
      }
    }
  }

  /** 뷰/입체 변경 없이 값만 바뀌었을 때: DOM을 다시 만들지 않고 값만 갱신. */
  private syncControlValues() {
    const s = store.get();
    if (s.view === 'solid') {
      const fill = this.root.querySelector<HTMLInputElement>('#fill');
      if (fill && document.activeElement !== fill) {
        fill.value = String(Math.round(s.volumeFill * 100));
      }
      const fillVal = this.root.querySelector('#fill-val');
      if (fillVal) fillVal.textContent = `${Math.round(s.volumeFill * 100)}%`;
    } else if (s.view === 'func') {
      const v = parabolaVertex({ a: s.a, b: s.b, c: s.c });
      const fv = this.root.querySelector('#func-vertex');
      if (fv) fv.innerHTML = `x=${v.x.toFixed(2)}, y=${v.y.toFixed(2)}`;
      for (const k of ['a', 'b', 'c', 'A', 'B', 'C', 'D'] as const) {
        const input = this.root.querySelector<HTMLInputElement>(`#f-${k}`);
        if (input && document.activeElement !== input) input.value = String(s[k]);
        const span = input?.parentElement?.querySelector('span');
        if (span) span.textContent = String(s[k]);
      }
    } else if (s.view === 'slice') {
      for (const [id, val] of [['#soff', s.sliceOffset * 100], ['#stilt', s.sliceTilt * 100]] as const) {
        const input = this.root.querySelector<HTMLInputElement>(id);
        if (input && document.activeElement !== input) input.value = String(Math.round(val));
      }
    }
  }

  private renderControls(view: ViewId) {
    // 이전 컨트롤의 스토어 구독 해제 (누수 방지)
    this.sideCleanup?.();
    this.sideCleanup = null;
    const box = this.root.querySelector('#view-controls')!;
    const side = this.root.querySelector('#side-controls')!;
    const s = store.get();
    if (view === 'solid') {
      box.innerHTML = `<p class="hint">하단 슬라이더로 펼치기 · 드래그로 회전</p>`;
      side.innerHTML = `
        <div id="unfold-box"></div>
        <label>물 채우기(부피) <span id="fill-val">${Math.round(s.volumeFill * 100)}%</span>
          <input id="fill" type="range" min="0" max="100" value="${Math.round(s.volumeFill * 100)}" aria-label="부피 물 채우기" /></label>
        <label class="check"><input id="cubes" type="checkbox" ${s.showUnitCubes ? 'checked' : ''} /> 단위立方(작은 정육면체) 보기</label>
        <label class="check"><input id="rot" type="checkbox" ${s.autoRotate ? 'checked' : ''} /> 자동 회전</label>`;
      this.sideCleanup = mountUnfoldSlider(side.querySelector('#unfold-box')!);
      side.querySelector('#fill')!.addEventListener('input', (e) =>
        store.set({ volumeFill: Number((e.target as HTMLInputElement).value) / 100 }),
      );
      side.querySelector('#cubes')!.addEventListener('change', (e) =>
        store.set({ showUnitCubes: (e.target as HTMLInputElement).checked }),
      );
      side.querySelector('#rot')!.addEventListener('change', (e) =>
        store.set({ autoRotate: (e.target as HTMLInputElement).checked }),
      );
    } else if (view === 'slice') {
      box.innerHTML = `<p id="slice-result" class="slice-result" aria-live="polite"></p>`;
      side.innerHTML = `
        <h2>단면 자르기</h2>
        <label>평면 위치 <input id="soff" type="range" min="-100" max="100" value="${Math.round(s.sliceOffset * 100)}" aria-label="단면 평면 위치" /></label>
        <label>평면 기울기 <input id="stilt" type="range" min="0" max="100" value="${Math.round(s.sliceTilt * 100)}" aria-label="단면 평면 기울기" /></label>
        <label class="check"><input id="sdiag" type="checkbox" ${s.sliceDiagonal ? 'checked' : ''} /> 대각선으로 자르기(육각형 도전)</label>
        <p class="hint">정육면체를 대각선으로 자르면 <strong>육각형</strong>이 나와요.</p>`;
      side.querySelector('#soff')!.addEventListener('input', (e) =>
        store.set({ sliceOffset: Number((e.target as HTMLInputElement).value) / 100 }),
      );
      side.querySelector('#stilt')!.addEventListener('input', (e) =>
        store.set({ sliceTilt: Number((e.target as HTMLInputElement).value) / 100 }),
      );
      side.querySelector('#sdiag')!.addEventListener('change', (e) =>
        store.set({ sliceDiagonal: (e.target as HTMLInputElement).checked }),
      );
    } else if (view === 'func') {
      const v = parabolaVertex({ a: s.a, b: s.b, c: s.c });
      box.innerHTML = `<p class="hint">포물선 꼭짓점: <strong id="func-vertex">x=${v.x.toFixed(2)}, y=${v.y.toFixed(2)}</strong> (−b/2a)</p>`;
      side.innerHTML = `
        <h2>함수 계수</h2>
        <label>종류 <select id="fkind" aria-label="함수 종류">
          <option value="quad" ${s.funcKind === 'quad' ? 'selected' : ''}>2차 곡면 (y=ax²+bx+c)</option>
          <option value="trig" ${s.funcKind === 'trig' ? 'selected' : ''}>삼각함수 (A·sin(Bx+C)+D)</option>
          <option value="saddle" ${s.funcKind === 'saddle' ? 'selected' : ''}>안장곡면</option>
        </select></label>
        ${slider('a', 'a (휘어짐)', s.a, -2, 2, 0.1)}
        ${slider('b', 'b (기울기)', s.b, -3, 3, 0.1)}
        ${slider('c', 'c (높이)', s.c, -2, 2, 0.1)}
        ${slider('A', 'A (진폭)', s.A, -2, 2, 0.1)}
        ${slider('B', 'B (주기)', s.B, 0.2, 3, 0.1)}
        ${slider('C', 'C (위상)', s.C, -3.14, 3.14, 0.1)}
        ${slider('D', 'D (상하 이동)', s.D, -2, 2, 0.1)}`;
      side.querySelector('#fkind')!.addEventListener('change', (e) =>
        store.set({ funcKind: (e.target as HTMLSelectElement).value as typeof s.funcKind }),
      );
      for (const k of ['a', 'b', 'c', 'A', 'B', 'C', 'D'] as const) {
        side.querySelector(`#f-${k}`)!.addEventListener('input', (e) =>
          store.set({ [k]: Number((e.target as HTMLInputElement).value) } as Partial<typeof s>),
        );
      }
    } else {
      box.innerHTML = '';
      side.innerHTML = `<p class="hint">${view === 'quiz' ? '퀴즈 탭에서 문제를 풀어 보세요.' : '인쇄 탭에서 전개도를 출력하세요.'}</p>`;
    }
  }

  private loop = () => {
    const s = store.get();
    if (s.autoRotate && (s.view === 'solid' || s.view === 'slice') && !this.dragging) {
      this.rotY += 0.004;
      this.applyState();
    }
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
    void this.raf;
  };
}

function slider(key: string, label: string, value: number, min: number, max: number, step: number): string {
  return `<label>${label} <span>${value}</span><input id="f-${key}" data-testid="func-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}" /></label>`;
}
