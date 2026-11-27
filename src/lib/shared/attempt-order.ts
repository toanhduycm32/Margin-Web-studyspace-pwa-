import type { QuizQuestion } from "./types";

// The stored option index is its stable ID within the artifact. Only display order changes.
export function newOptionOrders(questions: QuizQuestion[], previous?: number[][]): number[][] {
  return questions.map((question, questionIndex) => {
    const order = question.options.map((_, index) => index);
    for (let index = order.length - 1; index > 0; index--) {
      const random = new Uint32Array(1);
      globalThis.crypto.getRandomValues(random);
      const swap = Math.floor((random[0] / 2 ** 32) * (index + 1));
      [order[index], order[swap]] = [order[swap], order[index]];
    }
    if (previous?.[questionIndex]?.length === order.length &&
        order.every((optionId, index) => optionId === previous[questionIndex][index])) {
      [order[0], order[1]] = [order[1], order[0]];
    }
    return order;
  });
}
