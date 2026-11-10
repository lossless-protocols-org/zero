import type {TestInstance} from 'test-renderer';

/**
 * The nearest component above `instance` that declares the handler prop
 * `name` (onPress, onSwipeableOpenStartDrag, …), read from React's fiber.
 *
 * For the two things `fireEvent` cannot express: a native gesture that never
 * runs under jest (a swipe starting), and two taps on the same handler before
 * React re-renders (a double tap during a fade). Prefer `fireEvent` for
 * everything else: it also checks that the target is enabled.
 */
export const handlerOf = <Args extends unknown[]>(instance: TestInstance, name: string): ((...args: Args) => void) => {
  let fiber = instance.unstable_fiber;
  while (fiber) {
    // memoizedProps is the props object React rendered this fiber with.
    const handler: unknown = (fiber.memoizedProps as Record<string, unknown> | null)?.[name];
    if (typeof handler === 'function') {
      return handler as (...args: Args) => void; // a component prop named like a handler is one
    }
    fiber = fiber.return;
  }
  throw new Error(`nothing above this element declares ${name}`);
};
