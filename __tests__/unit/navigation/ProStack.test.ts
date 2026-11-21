/**
 * The two lists of Pro screens agree (3.0 law L8): every screen ProStack
 * mounts is a route the link handler drops without Pro and the gate holds a
 * downgrade for, and the reverse. A screen in one list only would be reachable
 * by a link, or thrown away mid-form, with every other test still green.
 */
import {PRO_ROUTES} from '../../../src/navigation/proLinks';
import {PRO_SCREENS} from '../../../src/navigation/ProStack';

it('ProStack mounts exactly the routes proLinks names', () => {
  expect(PRO_SCREENS.map(screen => screen.name).sort()).toEqual([...PRO_ROUTES].sort());
});

it('names each Pro screen once', () => {
  expect(new Set(PRO_SCREENS.map(screen => screen.name)).size).toBe(PRO_SCREENS.length);
});
