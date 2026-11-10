import {booleanValue, createMmkvPreference} from './mmkvPreference';

/**
 * Settings → "Calculator in amount fields" (2.8). Off by default: amount
 * fields are the plain number keyboard. On: they also take + − × ÷ and show
 * the result as you type (domain/amountExpression); the form only ever sees
 * the result.
 */
export const calculatorPreference = createMmkvPreference('amountCalculator', booleanValue, false);
