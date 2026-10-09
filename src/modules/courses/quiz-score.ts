export interface QuizResult {
  score: number;
  total: number;
  // Per question, in order: was the pick right? Never the right option itself.
  results: boolean[];
}

export const scoreQuiz = (correct: number[], answers: number[]): QuizResult => {
  const results = correct.map((c, i) => answers[i] === c);
  return { score: results.filter(Boolean).length, total: correct.length, results };
};
