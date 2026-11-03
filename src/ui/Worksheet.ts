// 전개도 인쇄 학습지 (F6) — SVG 투영 + 접는선.
import { buildNetSVG, faceCount } from '../geo/nets';
import { solidMeta } from '../geo/solids';
import { store } from '../stores/solidStore';

export function mountWorksheet(el: HTMLElement) {
  const render = () => {
    const id = store.get().solidId;
    const meta = solidMeta(id);
    const svg = buildNetSVG(id);
    el.innerHTML = `
      <h2>전개도 인쇄 학습지</h2>
      <p>${meta.nameKo} 전개도 — 면 ${faceCount(id)}개 · 실선은 자르는 선, 점선은 접는 선</p>
      <div class="print-svg" data-testid="net-svg">${svg}</div>
      <div class="row">
        <button type="button" id="print-btn" class="btn-pulse">인쇄하기</button>
        <button type="button" id="download-btn">SVG 저장</button>
      </div>
      <ol class="worksheet">
        <li>전개도의 면 개수를 세어 보세요. (${meta.faces}개가 맞나요?)</li>
        <li>마주보는 면끼리 같은 색으로 칠해 보세요.</li>
        <li>오려서 접으면 어떤 입체가 되나요? 이름을 써 보세요.</li>
      </ol>`;
    el.querySelector('#print-btn')!.addEventListener('click', () => window.print());
    el.querySelector('#download-btn')!.addEventListener('click', () => {
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${id}-net.svg`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };
  render();
  store.subscribe(render);
}
