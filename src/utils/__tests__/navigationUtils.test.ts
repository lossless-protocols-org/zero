/**
 * Regression test for the v2.6.6 back-arrow crash.
 *
 * `goBack` is wired as `onPress={goBack}` on six screens, so React Native
 * invokes it with the press event as its first argument. v2.6.6 declared an
 * optional callback parameter and ran `action?.()`, which called the event
 * object as a function: a fatal `TypeError: Object is not a function` on every
 * tap of those back arrows (706 affected users in Play Console). These tests
 * call `goBack` exactly the way a press handler does.
 */
import {CommonActions} from '@react-navigation/native';
import {goBack, navigate, setNavigationRef} from '../navigationUtils';

const fakeEvent = {nativeEvent: {locationX: 1, locationY: 2}, persist: () => {}};

describe('goBack', () => {
  it('does not throw when invoked as a press handler (event object as first arg)', () => {
    const dispatch = jest.fn();
    setNavigationRef({dispatch} as never);

    // Exactly what <TouchableOpacity onPress={goBack} /> does at runtime.
    expect(() => (goBack as unknown as (e: unknown) => boolean)(fakeEvent)).not.toThrow();
    expect(dispatch).toHaveBeenCalledWith(CommonActions.goBack());
  });

  it('dispatches goBack and reports success when a ref is set', () => {
    const dispatch = jest.fn();
    setNavigationRef({dispatch} as never);
    expect(goBack()).toBe(true);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('reports failure and does nothing when no ref is set', () => {
    setNavigationRef(null as never);
    expect(goBack()).toBe(false);
  });

  it('accepts no callback parameter at all (the footgun is gone from the type)', () => {
    // Compile-time guard: a second parameter must be a type error. The cast
    // below only exists so the file still compiles; the real assertion is the
    // `@ts-expect-error` line.
    // @ts-expect-error goBack takes no arguments
    const call = () => goBack(() => undefined);
    expect(typeof call).toBe('function');
  });
});

describe('navigate', () => {
  it('dispatches a navigate action with params', () => {
    const dispatch = jest.fn();
    setNavigationRef({dispatch} as never);
    navigate('AddDebtsScreen', {debtorId: 'd1', debtorName: 'Sam'});
    expect(dispatch).toHaveBeenCalledWith(
      CommonActions.navigate({name: 'AddDebtsScreen', params: {debtorId: 'd1', debtorName: 'Sam'}}),
    );
  });
});
