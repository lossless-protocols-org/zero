/**
 * M13 (v2.7.1): a piece split out of SettingsScreen. Rows are separated by a
 * divider, with none before the first row or after the last.
 */
import React from 'react';
import {Text} from 'react-native';
import {SettingsSection} from '../../../../../src/features/settings/components/SettingsSection';
import {renderWithTheme} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));

it('draws a divider between rows, none before the first or after the last', async () => {
  const {container} = await renderWithTheme(
    <SettingsSection title="Data">
      <Text>a</Text>
      <Text>b</Text>
      <Text>c</Text>
    </SettingsSection>,
  );
  const dividers = container.queryAll(node => JSON.stringify(node.props['style'] ?? '').includes('"height":1'));
  expect(dividers).toHaveLength(2);
});
