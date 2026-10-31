/**
 * M32 (v2.7.1): in Arabic, Hebrew, Persian and Urdu the back arrow and the
 * chevrons point the other way. Icon mirrors the directional glyphs when the
 * layout is right-to-left; everything else is drawn as is.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {I18nManager, View} from 'react-native';
import Icon from '../Icons';

const setRTL = (isRTL: boolean) => {
  Object.defineProperty(I18nManager, 'isRTL', {value: isRTL, configurable: true, writable: true});
};

afterEach(() => setRTL(false));

/**
 * The style of the View that mirrors the icon, if any. The transform must sit
 * on a View: react-native-svg reads a `style.transform` on the Svg as an SVG
 * transform around (0,0), which flipped the glyph out of its box — the back
 * arrow vanished on the device.
 */
const styleOf = async (name: string): Promise<unknown> => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<Icon name={name} />);
  });
  const transformed = renderer?.root.findAll(node => node.props['style']?.transform !== undefined) ?? [];
  // View, and the host 'View' it renders with the same style.
  const isView = (type: unknown) => type === View || type === 'View';
  expect(transformed.length === 0 || transformed.every(node => isView(node.type))).toBe(true);
  return transformed[0]?.props['style'];
};

const MIRRORED = {transform: [{scaleX: -1}]};

describe('Icon in right-to-left layouts', () => {
  it.each(['arrow-left', 'chevron-left', 'chevron-right'])('mirrors %s', async name => {
    setRTL(true);
    expect(await styleOf(name)).toEqual(MIRRORED);
  });

  it('leaves non-directional icons alone', async () => {
    setRTL(true);
    expect(await styleOf('utensils-crossed')).toBeUndefined();
    expect(await styleOf('arrow-left-right')).toBeUndefined();
  });

  it('draws directional icons as is left-to-right', async () => {
    setRTL(false);
    expect(await styleOf('arrow-left')).toBeUndefined();
  });
});
