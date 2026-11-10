/**
 * The row above the category list. Out of reorder mode it held an empty text
 * where the drag hint goes, which VoiceOver kept as a blank element with no
 * description (iOS accessibility audit on the iPhone, 2026-11-09).
 */
import React from 'react';
import {screen} from '@testing-library/react-native';
import {ReorderToolbar} from '../../../../../src/features/categories/components/ReorderToolbar';
import {renderWithTheme, themeColors} from '../../../../harness/render';

jest.mock('react-i18next', () => require('../../../../harness/mocks/reactI18next'));

/** Every text the toolbar draws, as the screen reader would meet it. */
const texts = () => screen.container.queryAll(node => node.type === 'Text').map(node => node.props['children']);

const show = async (reordering: boolean, canReorder = true) =>
  renderWithTheme(
    <ReorderToolbar
      reordering={reordering}
      canReorder={canReorder}
      onToggle={jest.fn()}
      colors={await themeColors()}
    />,
  );

it('draws no empty text out of reorder mode, only the Reorder button', async () => {
  await show(false);
  expect(texts()).toEqual(['categories.reorder']);
});

it('shows the drag hint and Done while reordering', async () => {
  await show(true);
  expect(texts()).toEqual(['categories.reorderHint', 'categories.reorderDone']);
});

it('takes no space when there is nothing to reorder (one income category)', async () => {
  await show(false, false);
  expect(screen.toJSON()).toBeNull();
});
