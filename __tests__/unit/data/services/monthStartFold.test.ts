/** The month start day as Pro data kept (L9, P11): counted while a day is chosen; removal clears it and nothing else. */
import {createUser, getAllUsers, setMonthStartDay} from '../../../../src/data/services/userService';
import {monthStartPart} from '../../../../src/data/services/monthStartFold';
import {removeProData} from '../../../../src/data/services/proDataService';

it('counts a chosen day as one kept thing; removing it leaves calendar months and the user as they were', async () => {
  const userId = await createUser('Asha', 'a@example.com');
  expect(await monthStartPart.count()).toBe(0);
  await setMonthStartDay(userId, 7);
  expect(await monthStartPart.count()).toBe(1);
  await removeProData([monthStartPart]);
  expect(await monthStartPart.count()).toBe(0);
  expect(await getAllUsers()).toEqual([{id: userId, username: 'Asha', email: 'a@example.com', monthStartDay: 1}]);
});
