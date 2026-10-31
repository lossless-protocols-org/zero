import {TouchableOpacity, View, useWindowDimensions} from 'react-native';
import React, {useCallback, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {SheetManager, SheetProps, ScrollView as SheetScrollView} from 'react-native-actions-sheet';
import {FlashList} from '@shopify/flash-list';
import {CustomBottomSheet} from '../components/atoms/CustomBottomSheet';
import useThemeColors from '../hooks/useThemeColors';
import CustomInput from '../components/atoms/CustomInput';
import Icon from '../components/atoms/Icons';
import PrimaryText from '../components/atoms/PrimaryText';
import {CATEGORY_ICONS} from '../constants/categoryIcons';
import {iconKeywords} from '../constants/iconKeywords';
import {gs} from '../styles/globalStyles';

const IconPickerSheet: React.FC<SheetProps<'icon-picker-sheet'>> = React.memo(props => {
  const {t} = useTranslation();
  const colors = useThemeColors();
  const [searchText, setSearchText] = useState('');
  const selectedIcon = props.payload?.selectedIcon;

  const {width: screenWidth, height: screenHeight} = useWindowDimensions();
  const iconsPerRow = 6;
  const iconSize = (screenWidth * 0.85) / iconsPerRow;

  const filteredIcons = useMemo(() => {
    if (!searchText) return CATEGORY_ICONS;
    const normalized = searchText.toLowerCase().replace(/[-\s]/g, '');
    return CATEGORY_ICONS.filter(iconName => {
      if (iconName.toLowerCase().replace(/[-\s]/g, '').includes(normalized)) return true;
      const keywords = iconKeywords[iconName];
      if (keywords) {
        return keywords.some(kw => kw.replace(/[-\s]/g, '').includes(normalized));
      }
      return false;
    });
  }, [searchText]);

  const handleSelectIcon = useCallback(
    (iconName: string) => {
      props.payload?.onSelect?.(iconName);
    },
    [props.payload],
  );

  const handleClose = useCallback(() => {
    setSearchText('');
  }, []);

  const renderIconItem = useCallback(
    ({item}: {item: string}) => (
      <TouchableOpacity
        accessibilityRole="button"
        // Icon names are kebab-case words ('shopping-bag'): read them as words.
        accessibilityLabel={item.replaceAll('-', ' ')}
        accessibilityState={{selected: selectedIcon === item}}
        style={[
          gs.m8,
          gs.center,
          gs.rounded8,
          {
            width: iconSize,
            height: iconSize,
            backgroundColor: selectedIcon === item ? colors.primaryText : undefined,
          },
        ]}
        onPress={() => handleSelectIcon(item)}>
        <Icon name={item} size={30} color={selectedIcon === item ? colors.containerColor : colors.secondaryText} />
      </TouchableOpacity>
    ),
    [colors, selectedIcon, iconSize, handleSelectIcon],
  );

  return (
    <CustomBottomSheet
      sheetId={props.sheetId}
      header={{
        title: t('sheets.selectIcon'),
        showCloseButton: true,
        onClosePress: () => {
          void SheetManager.hide(props.sheetId);
        },
      }}
      onClose={handleClose}
      gestureEnabled>
      <View style={gs.px15}>
        <CustomInput
          input={searchText}
          label={undefined}
          colors={colors}
          placeholder={t('sheets.searchIcons')}
          setInput={setSearchText}
          schema={undefined}
        />
      </View>

      {/* Viewport-relative: a fixed height is cramped on small phones and
          wastes space on tablets. */}
      <View style={[gs.px10, {height: screenHeight * 0.45}]}>
        {filteredIcons.length === 0 ? (
          <View style={[gs.flex1, gs.center]}>
            <Icon name="search" size={40} color={colors.secondaryText} />
            <PrimaryText size={14} color={colors.secondaryText} style={gs.mt10}>
              {t('sheets.noIconsFound')}
            </PrimaryText>
          </View>
        ) : (
          <FlashList
            renderScrollComponent={SheetScrollView}
            data={filteredIcons}
            renderItem={renderIconItem}
            numColumns={6}
            keyExtractor={(iconItem: string) => iconItem}
          />
        )}
      </View>
    </CustomBottomSheet>
  );
});

export default IconPickerSheet;
