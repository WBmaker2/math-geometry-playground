// 펼치기 슬라이더 + 공식·수치 실시간 패널.
import { solidMeta, surfaceArea, volume, defaultSize } from '../geo/solids';
import { parabolaVertex } from '../geo/functions';
import { store } from '../stores/solidStore';

export function mountUnfoldSlider(el: HTMLElement) {
  el.innerHTML = `
    <label class="slider-row">펼치기 <span id="unfold-val">0%</span>
      <input id="unfold" type="range" min="0" max="100" value="${Math.round(store.get().unfoldT * 100)}" aria-label="전개도 펼치기 정도" />
    </label>
    <div class="row">
      <button id="start" class="btn-pulse" type="button">전개도 펴기</button>
      <button id="fold-back" type="button">접기</button>
    </div>`;
  const input = el.querySelector<HTMLInputElement>('#unfold')!;
  const val = el.querySelector('#unfold-val')!;
  const sync = () => {
    input.value = String(Math.round(store.get().unfoldT * 100));
    val.textContent = `${input.value}%`;
  };
  input.addEventListener('input', () => {
    store.set({ unfoldT: Number(input.value) / 100 });
    val.textContent = `${input.value}%`;
  });
  el.querySelector('#start')!.addEventListener('click', () => {
    animateTo(1);
    document.querySelector('.placeholder')?.replaceChildren();
    const ph = document.querySelector('.placeholder');
    if (ph) ph.textContent = '전개도가 펼쳐졌습니다. 면의 개수를 세어 보세요.';
  });
  el.querySelector('#fold-back')!.addEventListener('click', () => animateTo(0));
  store.subscribe(sync);

  function animateTo(target: number) {
    const from = store.get().unfoldT;
    const t0 = performance.now();
    const dur = 700;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      store.set({ unfoldT: from + (target - from) * k });
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

export function mountFormulaPanel(el: HTMLElement) {
  const render = () => {
    const s = store.get();
    const meta = solidMeta(s.solidId);
    const size = defaultSize(s.solidId);
    const sa = surfaceArea(s.solidId, size);
    const vo = volume(s.solidId, size);
    const vertex = parabolaVertex({ a: s.a, b: s.b, c: s.c });
    el.innerHTML = `
      <h2>공식·수치</h2>
      <dl class="facts">
        <div><dt>입체</dt><dd>${meta.nameKo} <span class="dim">${meta.nameEn} · 면 ${meta.faces} · 모서리 ${meta.edges} · 꼭짓점 ${meta.vertices}</span></dd></div>
        <div><dt>겉넓이</dt><dd>${meta.formulaKo}<br /><strong data-testid="surface-value">${sa.toFixed(2)}</strong> <span class="dim">(한 변 ${size.s})</span></dd></div>
        <div><dt>부피</dt><dd>${meta.volumeKo}<br /><strong data-testid="volume-value">${vo.toFixed(2)}</strong></dd></div>
        <div><dt>전개도</dt><dd>${meta.netMemoKo}</dd></div>
        <div><dt>포물선 꼭짓점</dt><dd data-testid="vertex-value">x=${vertex.x.toFixed(2)}, y=${vertex.y.toFixed(2)} <span class="dim">(−b/2a)</span></dd></div>
      </dl>`;
  };
  render();
  store.subscribe(render);
}
