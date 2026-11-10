import {
  amountToFieldText,
  appendAmountOperator,
  evaluateAmountExpression,
  isAmountSum,
  normalizeAmountExpression,
} from '../../../src/domain/amountExpression';

const value = (text: string, decimals = 2): number | string => {
  const r = evaluateAmountExpression(text, decimals);
  return r.kind === 'value' ? r.value : r.kind === 'error' ? r.reason : 'empty';
};

describe('evaluateAmountExpression', () => {
  it.each([
    // plain amounts
    ['120', 120],
    ['12.5', 12.5],
    ['0.5', 0.5],
    ['007', 7],
    // the four operators
    ['120+45', 165],
    ['200−45', 155],
    ['12×3', 36],
    ['90÷4', 22.5],
    // precedence: × and ÷ before + and −, then left to right
    ['120+45×2', 210],
    ['100−20÷4', 95],
    ['2×3+4×5', 26],
    ['100÷4×2', 50],
    ['100−10−10', 80],
    ['10+20−5+1', 26],
    ['8÷2÷2', 2],
    // decimals and rounding to the currency
    ['0.1+0.2', 0.3],
    ['10÷3', 3.33],
    ['20÷3', 6.67],
    ['2.01÷2', 1.01], // 1.005: half away from zero, no binary drift
    ['5.35÷2', 2.68], // 2.675
    ['19.99×3', 59.97],
    // a trailing operator or point is ignored while typing
    ['120+', 120],
    ['120×', 120],
    ['12.', 12],
    ['5+.5', 5.5],
    // zero is a value (the amount rules then reject it), not an error
    ['5−5', 0],
    ['0×9', 0],
    // errors
    ['10÷0', 'divideByZero'],
    ['10÷0+5', 'divideByZero'],
    ['5−10', 'negative'],
    ['1−1.01', 'negative'],
    // audit 2026-11-08: Infinity and exponent-form results used to reach the form as NaN
    ['99999999999×99999999999', 'tooLarge'],
    [`${'9'.repeat(400)}×9`, 'tooLarge'],
    ['1000000000000000', 'tooLarge'],
    // a result smaller than one minor unit rounds to zero instead of NaN
    ['1÷10000000', 0],
    ['1÷3000000', 0],
    // nothing to read
    ['', 'empty'],
    ['+', 'empty'],
    ['×÷', 'empty'],
  ])('%s → %s', (text, expected) => {
    expect(value(text)).toBe(expected);
  });

  it('rounds to a currency without decimals, and with three', () => {
    expect(value('100÷3', 0)).toBe(33);
    expect(value('5÷2', 0)).toBe(3); // half away from zero, as Intl
    expect(value('10÷3', 3)).toBe(3.333);
    expect(value('2.01÷2', 2)).toBe(1.01); // 1.005 in binary is 1.00499…; the decimal shift still rounds up
    expect(value('0.001÷2', 3)).toBe(0.001); // 0.0005 is exponent-form-free but half rounds away from zero
  });

  it('accepts what a hardware keyboard types for the operators', () => {
    expect(value('10*3-5/5')).toBe(29);
    expect(value('4x4')).toBe(16);
  });

  it('says whether the text was a sum', () => {
    expect(evaluateAmountExpression('120', 2)).toEqual({kind: 'value', value: 120, isSum: false});
    expect(evaluateAmountExpression('120+1', 2)).toEqual({kind: 'value', value: 121, isSum: true});
  });
});

describe('normalizeAmountExpression', () => {
  it.each([
    ['12,5+3,25', 2, '12.5+3.25'],
    ['+12', 2, '12'],
    ['12+×3', 2, '12×3'],
    ['12.+3', 2, '12+3'],
    ['12.345', 2, '12.34'],
    ['1.2.3', 2, '1.23'],
    ['12.5', 0, '125'],
    ['+.5', 2, '0.5'],
    ['5×.5', 2, '5×0.5'],
    ['1 200 + 3a', 2, '1200+3'],
  ])('%s (decimals %s) → %s', (text, decimals, expected) => {
    expect(normalizeAmountExpression(text, decimals)).toBe(expected);
  });

  it('appends an operator key, replacing one just typed', () => {
    expect(appendAmountOperator('', '+', 2)).toBe('');
    expect(appendAmountOperator('12', '+', 2)).toBe('12+');
    expect(appendAmountOperator('12+', '×', 2)).toBe('12×');
    expect(isAmountSum('12+3')).toBe(true);
    expect(isAmountSum('12.5')).toBe(false);
  });
});

describe('amountToFieldText', () => {
  it('writes a result as a plain amount field holds it', () => {
    expect(amountToFieldText(210, 2)).toBe('210');
    expect(amountToFieldText(12.5, 2)).toBe('12.5');
    expect(amountToFieldText(3.33, 2)).toBe('3.33');
    expect(amountToFieldText(33, 0)).toBe('33');
    expect(amountToFieldText(1500000, 2)).toBe('1500000');
  });
});
