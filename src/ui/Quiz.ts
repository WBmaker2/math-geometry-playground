// 전개도↔입체 자동 퀴즈 (F2).
import { SOLIDS } from '../geo/solids';
import type { SolidId } from '../geo/solids';

export interface QuizQuestion {
  prompt: string;
  choices: string[];
  answer: number;
  explain: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function makeQuestion(solidId?: SolidId): QuizQuestion {
  const pool = SOLIDS.filter((s) => s.id !== 'sphere');
  const target = pool.find((s) => s.id === solidId) ?? pool[Math.floor(Math.random() * pool.length)];
  const distract = shuffle(pool.filter((s) => s.id !== target.id)).slice(0, 3).map((s) => s.nameKo);
  const choices = shuffle([target.nameKo, ...distract]);
  return {
    prompt: `이 전개도는 어떤 입체일까요? (면 ${target.faces}개 · 모서리 ${target.edges}개)`,
    choices,
    answer: choices.indexOf(target.nameKo),
    explain: `${target.nameKo} — ${target.netMemoKo}`,
  };
}

export function mountQuiz(el: HTMLElement) {
  let q = makeQuestion();
  let score = 0;
  let total = 0;
  const render = (feedback = '') => {
    el.innerHTML = `
      <h2>전개도 퀴즈</h2>
      <p class="quiz-prompt">${q.prompt}</p>
      <div class="quiz-choices" role="group" aria-label="선택지">
        ${q.choices.map((c, i) => `<button type="button" data-i="${i}">${c}</button>`).join('')}
      </div>
      <p class="quiz-feedback" aria-live="polite">${feedback}</p>
      <p class="quiz-score" data-testid="quiz-score">점수 ${score} / ${total}</p>
      <button type="button" id="quiz-next">다음 문제</button>`;
    el.querySelectorAll<HTMLButtonElement>('[data-i]').forEach((btn) => {
      btn.addEventListener('click', () => {
        total += 1;
        const ok = Number(btn.dataset.i) === q.answer;
        if (ok) score += 1;
        render(ok ? `⭕ 정답! ${q.explain}` : `❌ 아쉬워요. 정답은 “${q.choices[q.answer]}” — ${q.explain}`);
      });
    });
    el.querySelector('#quiz-next')!.addEventListener('click', () => {
      q = makeQuestion();
      render();
    });
  };
  render();
}
