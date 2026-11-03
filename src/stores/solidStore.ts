// 전역 상태 — 가벼운 pub/sub 스토어 (Zustand 대체, 의존성 없음).
import type { SolidId } from '../geo/solids';
import type { FuncKind } from '../scene/FuncSurface';

export type ViewId = 'solid' | 'slice' | 'func' | 'quiz' | 'print';

export interface StoreState {
  view: ViewId;
  solidId: SolidId;
  unfoldT: number;
  autoRotate: boolean;
  volumeFill: number; // 0..1 물 채우기
  showUnitCubes: boolean;
  sliceOffset: number; // -1..1
  sliceTilt: number; // 0..1
  sliceDiagonal: boolean;
  funcKind: FuncKind;
  a: number; b: number; c: number;
  A: number; B: number; C: number; D: number;
}

type Listener = (s: StoreState) => void;

const initial: StoreState = {
  view: 'solid',
  solidId: 'cube',
  unfoldT: 0,
  autoRotate: true,
  volumeFill: 0.5,
  showUnitCubes: false,
  sliceOffset: 0,
  sliceTilt: 0,
  sliceDiagonal: false,
  funcKind: 'quad',
  a: 1, b: 0, c: 0,
  A: 1, B: 1, C: 0, D: 0,
};

class Store {
  private state: StoreState = { ...initial };
  private listeners = new Set<Listener>();

  get(): StoreState {
    return this.state;
  }

  set(patch: Partial<StoreState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn(this.state));
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
}

export const store = new Store();
