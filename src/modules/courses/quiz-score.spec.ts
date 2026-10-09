import { scoreQuiz } from './quiz-score';

describe('scoreQuiz', () => {
  it('marks each answer and counts the right ones', () => {
    expect(scoreQuiz([0, 2, 1], [0, 1, 1])).toEqual({ score: 2, total: 3, results: [true, false, true] });
    expect(scoreQuiz([], [])).toEqual({ score: 0, total: 0, results: [] });
  });
});
