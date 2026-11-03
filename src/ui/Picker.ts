// 도형 선택기 — 8종 버튼 그리드.
import { SOLIDS } from '../geo/solids';
import type { SolidId } from '../geo/solids';
import { store } from '../stores/solidStore';

export function mountPicker(el: HTMLElement) {
  el.innerHTML = `<div class="picker" role="group" aria-label="입체 도형 선택">${SOLIDS.map(
    (s) => `<button type="button" data-solid="${s.id}" aria-pressed="${store.get().solidId === s.id}"><span class="p-name">${s.nameKo}</span><span class="p-en">${s.nameEn}</span></button>`,
  ).join('')}</div>`;
  el.querySelectorAll<HTMLButtonElement>('[data-solid]').forEach((btn) => {
    btn.addEventListener('click', () => {
      store.set({ solidId: btn.dataset.solid as SolidId });
      el.querySelectorAll('[data-solid]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    });
  });
  store.subscribe((s) => {
    el.querySelectorAll('[data-solid]').forEach((b) =>
      b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.solid === s.solidId)),
    );
  });
}
