import React, {memo, useCallback, useRef, useState} from 'react';
import {FlatList, StyleSheet, useWindowDimensions, View, type ListViewToken} from 'react-native';
import {useTranslation} from 'react-i18next';
import PrimaryText from './PrimaryText';
import useThemeColors from '../../hooks/useThemeColors';
import SvgImage from '../../../assets/images/4.svg';
import SvgImage1 from '../../../assets/images/5.svg';
import SvgImage2 from '../../../assets/images/6.svg';
import {gs} from '../../styles/globalStyles';

const SLIDES = [
  {id: '1', titleKey: 'carousel.slide1Title', subtitleKey: 'carousel.slide1Subtitle'},
  {id: '2', titleKey: 'carousel.slide2Title', subtitleKey: 'carousel.slide2Subtitle'},
  {id: '3', titleKey: 'carousel.slide3Title', subtitleKey: 'carousel.slide3Subtitle'},
] as const;

type Slide = (typeof SLIDES)[number];

const SLIDE_IMAGES: Record<Slide['id'], React.FC<{width: string; height: string}>> = {
  '1': SvgImage,
  '2': SvgImage1,
  '3': SvgImage2,
};

const CAROUSEL_HEIGHT = 300;
const VIEWABILITY_CONFIG = {itemVisiblePercentThreshold: 50};

/**
 * Onboarding pager built on FlatList's native paging — no carousel library.
 * Three static slides need snapping and a dot indicator, both of which the
 * platform ScrollView already provides.
 */
const Carousel = () => {
  const colors = useThemeColors();
  const {t} = useTranslation();
  const {width} = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);

  // Kept in a ref: FlatList treats a changed onViewableItemsChanged identity
  // as a fatal error, so this callback must be stable for the list's lifetime.
  // RN 0.88 renamed the exported type ViewToken → ListViewToken (same shape).
  const onViewableItemsChanged = useRef(({viewableItems}: {viewableItems: Array<ListViewToken>}) => {
    const first = viewableItems[0];
    if (first?.index != null) {
      setActiveIndex(first.index);
    }
  }).current;

  const renderItem = useCallback(
    ({item}: {item: Slide}) => {
      const ImageComponent = SLIDE_IMAGES[item.id];
      return (
        <View style={[gs.center, {width}]}>
          <ImageComponent width="220" height="220" />
          <PrimaryText size={16} weight="semibold" style={gs.mt15}>
            {t(item.titleKey)}
          </PrimaryText>
          <PrimaryText size={12} color={colors.secondaryText} style={gs.mt4}>
            {t(item.subtitleKey)}
          </PrimaryText>
        </View>
      );
    },
    [width, t, colors.secondaryText],
  );

  return (
    <View style={gs.mt30p}>
      <FlatList
        data={SLIDES}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialNumToRender={1}
        style={{height: CAROUSEL_HEIGHT}}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY_CONFIG}
        getItemLayout={(_, index) => ({length: width, offset: width * index, index})}
      />
      <View style={[gs.rowCenter, gs.justifyCenter, gs.mt10]}>
        {SLIDES.map((slide, index) => {
          const isActive = index === activeIndex;
          return (
            <View
              key={slide.id}
              style={[
                gs.m3,
                gs.roundedFull,
                isActive ? styles.activeDot : styles.dot,
                {backgroundColor: isActive ? colors.primaryText : colors.secondaryAccent},
              ]}
            />
          );
        })}
      </View>
    </View>
  );
};

export default memo(Carousel);

const styles = StyleSheet.create({
  dot: {width: 6, height: 6},
  activeDot: {width: 8, height: 8},
});
