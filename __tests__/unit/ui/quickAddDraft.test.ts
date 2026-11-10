/** The quick-add sheet's "More details" hands one draft to the full form, once (2.8). */
import {setQuickAddDraft, takeQuickAddDraft} from '../../../src/ui/quickAddDraft';

it('is taken once, so a later Add starts empty', () => {
  expect(takeQuickAddDraft()).toBeNull();
  setQuickAddDraft({title: 'Chai', amount: '20', categoryId: 'c1'});
  expect(takeQuickAddDraft()).toEqual({title: 'Chai', amount: '20', categoryId: 'c1'});
  expect(takeQuickAddDraft()).toBeNull();
});
