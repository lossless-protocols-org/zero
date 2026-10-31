import {TouchableOpacity, View, useWindowDimensions} from 'react-native';
import React, {useCallback, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {SheetManager, SheetProps, ScrollView as SheetScrollView} from 'react-native-actions-sheet';
import {FlashList} from '@shopify/flash-list';
import {CustomBottomSheet} from '../components/atoms/CustomBottomSheet';
import useThemeColors from '../hooks/useThemeColors';
import allColors from '../../assets/jsons/categoryColors.json';
import {gs} from '../styles/globalStyles';

const ColorPickerSheet: React.FC<SheetProps<'color-picker-sheet'>> = React.memo(props => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const selectedColor = props.payload?.selectedColor;

  const {width: screenWidth, height: screenHeight} = useWindowDimensions();
  const colorsPerRow = 6;
  const colorSize = (screenWidth * 0.85) / colorsPerRow;

  const colorsList = useMemo(() => Object.keys(allColors), []);

  const handleSelectColor = useCallback(
    (color: string) => {
      props.payload?.onSelect?.(color);
    },
    [props.payload],
  );

  const renderColorItem = useCallback(
    ({item: color, index}: {item: string; index: number}) => (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('sheets.colourOption', {index: index + 1, count: colorsList.length})}
        accessibilityState={{selected: selectedColor === color}}
        style={[
          gs.m8,
          gs.center,
          gs.rounded8,
          {
            width: colorSize,
            height: colorSize,
            backgroundColor: selectedColor === color ? colors.primaryText : undefined,
          },
        ]}
        onPress={() => handleSelectColor(color)}>
        <View style={[gs.size36, gs.rounded18, {backgroundColor: color}]} />
      </TouchableOpacity>
    ),
    [colorSize, selectedColor, colors.primaryText, handleSelectColor, t, colorsList.length],
  );

  return (
    <CustomBottomSheet
      sheetId={props.sheetId}
      header={{
        title: t('sheets.selectColor'),
        showCloseButton: true,
        onClosePress: () => {
          void SheetManager.hide(props.sheetId);
        },
      }}
      gestureEnabled>
      {/* Viewport-relative: a fixed height is cramped on small phones and
          wastes space on tablets. */}
      <View style={[gs.px10, {height: screenHeight * 0.45}]}>
        <FlashList
          renderScrollComponent={SheetScrollView}
          data={colorsList}
          renderItem={renderColorItem}
          numColumns={6}
          keyExtractor={(color: string) => color}
        />
      </View>
    </CustomBottomSheet>
  );
});

export default ColorPickerSheet;
