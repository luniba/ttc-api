import { sumPrices } from './orders.service';

describe('sumPrices', () => {
  it('adds in cents, so floats never drift', () => {
    expect(sumPrices([0.1, 0.2])).toBe(0.3);
    expect(sumPrices([99, 49.5, 0.99])).toBe(149.49);
    expect(sumPrices([])).toBe(0);
  });
});
