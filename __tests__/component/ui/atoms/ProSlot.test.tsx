/** A Pro section inside a free screen renders nothing without Pro: no lock, no badge, no teaser (law L8, plan rule 6). */
import React from 'react';
import {Text} from 'react-native';
import {act, render, screen} from '@testing-library/react-native';
import {ProSlot} from '../../../../src/ui/atoms/ProSlot';
import {resetEntitlement, setEntitlement} from '../../../harness/mocks/entitlement';

jest.mock('../../../../src/pro/entitlementStore', () =>
  require('../../../harness/mocks/entitlement').entitlementStoreMock(),
);

afterEach(async () => {
  await act(async () => resetEntitlement());
});

it('draws its children with Pro, and nothing at all without', async () => {
  await render(
    <ProSlot feature="accounts">
      <Text>Net worth</Text>
    </ProSlot>,
  );
  expect(screen.toJSON()).toBeNull();
  await act(async () => setEntitlement({state: 'subscribed'}));
  expect(screen.getByText('Net worth')).toBeTruthy();
  await act(async () => setEntitlement({state: 'expired'}));
  expect(screen.toJSON()).toBeNull();
});
