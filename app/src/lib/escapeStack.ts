// 열린 팝업들의 ESC 순서(useEscapeKey가 씀, 검사: escapeStack.test.ts) — ESC 한 번에 맨 위 팝업 하나만 닫음.
// 맨 위 = 가장 나중에 열린 팝업. 단, 한 번의 화면 갱신에 같이 열린 팝업(주소로 연 팝업과 그 안의 팝업 등)은 React가 안쪽
// 팝업의 effect를 먼저 실행해서, 열린 순서만 보면 바깥 팝업이 위로 잡힘 — 같은 순간에 열린 것끼리는 그린 순서(바깥 → 안쪽)로
// 다시 정렬해서 안쪽이 위로 감. "같은 순간"은 effect들이 한꺼번에 실행되는 동안이라, 다음 마이크로태스크에서 한 묶음으로 쌓음
// (키 입력은 그 전에 들어오지 않음).

type Entry = { order: number; handler: () => void };

export function createEscapeStack(schedule: (fn: () => void) => void = (fn) => queueMicrotask(fn)) {
  let renderSeq = 0;
  let stack: Entry[] = [];
  let pending: Entry[] = [];
  let scheduled = false;

  function flush() {
    scheduled = false;
    if (pending.length === 0) return;
    const batch = [...pending].sort((a, b) => a.order - b.order);
    pending = [];
    stack = [...stack, ...batch];
  }

  return {
    /** 컴포넌트를 처음 그릴 때 한 번 — 바깥 컴포넌트가 안쪽보다 먼저 그려지므로 작은 번호. */
    nextRenderOrder: () => ++renderSeq,
    /** 팝업이 열릴 때. 돌려준 함수로 뺌(닫힐 때). */
    add(order: number, handler: () => void) {
      const entry: Entry = { order, handler };
      pending.push(entry);
      if (!scheduled) {
        scheduled = true;
        schedule(flush);
      }
      return () => {
        pending = pending.filter((e) => e !== entry);
        stack = stack.filter((e) => e !== entry);
      };
    },
    size: () => stack.length + pending.length,
    /** ESC — 맨 위 팝업의 처리를 부름. 열린 팝업이 없으면 false. */
    pressTop(): boolean {
      flush();
      const top = stack[stack.length - 1];
      if (!top) return false;
      top.handler();
      return true;
    },
  };
}

export const escapeStack = createEscapeStack();
