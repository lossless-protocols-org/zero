import {StyleSheet} from 'react-native';

// Standard hitSlop for touch targets (Apple HIG: 44pt, Android: 48dp): an
// 18 pt icon plus 14 on each side is 46 (M30; it was 10, i.e. 38).
export const hitSlop = {top: 14, bottom: 14, left: 14, right: 14};

export const gs = StyleSheet.create({
  // LAYOUT - Flex

  flex1: {flex: 1},
  flexGrow: {flexGrow: 1},
  flexShrink: {flexShrink: 1},

  row: {flexDirection: 'row'},
  col: {flexDirection: 'column'},

  wrap: {flexWrap: 'wrap'},

  // ALIGNMENT

  itemsCenter: {alignItems: 'center'},
  itemsStart: {alignItems: 'flex-start'},
  itemsEnd: {alignItems: 'flex-end'},
  itemsStretch: {alignItems: 'stretch'},

  justifyCenter: {justifyContent: 'center'},
  justifyStart: {justifyContent: 'flex-start'},
  justifyEnd: {justifyContent: 'flex-end'},
  justifyBetween: {justifyContent: 'space-between'},
  justifyAround: {justifyContent: 'space-around'},
  justifyEvenly: {justifyContent: 'space-evenly'},

  center: {alignItems: 'center', justifyContent: 'center'},
  rowCenter: {flexDirection: 'row', alignItems: 'center'},
  rowBetween: {flexDirection: 'row', justifyContent: 'space-between'},
  rowBetweenCenter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  colCenter: {flexDirection: 'column', alignItems: 'center'},

  selfCenter: {alignSelf: 'center'},

  // MARGIN

  m0: {margin: 0},
  m3: {margin: 3},
  m5: {margin: 5},
  m8: {margin: 8},
  m10: {margin: 10},

  mt2: {marginTop: 2},
  mt3: {marginTop: 3},
  mt4: {marginTop: 4},
  mt5: {marginTop: 5},
  mt6: {marginTop: 6},
  mt7: {marginTop: 7},
  mt8: {marginTop: 8},
  mt10: {marginTop: 10},
  mt15: {marginTop: 15},
  mt20: {marginTop: 20},
  mt30: {marginTop: 30},

  mb3: {marginBottom: 3},
  mb5: {marginBottom: 5},
  mb6: {marginBottom: 6},
  mb8: {marginBottom: 8},
  mb10: {marginBottom: 10},
  mb12: {marginBottom: 12},
  mb15: {marginBottom: 15},
  mb20: {marginBottom: 20},
  mb30: {marginBottom: 30},

  ml3: {marginStart: 3},
  ml8: {marginStart: 8},
  ml10: {marginStart: 10},
  ml12: {marginStart: 12},
  ml20: {marginStart: 20},

  mr3: {marginEnd: 3},
  mr5: {marginEnd: 5},
  mr6: {marginEnd: 6},
  mr8: {marginEnd: 8},
  mr10: {marginEnd: 10},

  mx3: {marginHorizontal: 3},
  mx16: {marginHorizontal: 16},
  mx20: {marginHorizontal: 20},

  my4: {marginVertical: 4},
  my10: {marginVertical: 10},

  // PADDING

  p2: {padding: 2},
  p3: {padding: 3},
  p5: {padding: 5},
  p8: {padding: 8},
  p10: {padding: 10},
  p12: {padding: 12},
  p14: {padding: 14},
  p15: {padding: 15},
  p20: {padding: 20},

  pt5: {paddingTop: 5},
  pt8: {paddingTop: 8},
  pt10: {paddingTop: 10},
  pt12: {paddingTop: 12},
  pt15: {paddingTop: 15},
  pt20: {paddingTop: 20},

  pb5: {paddingBottom: 5},
  pb10: {paddingBottom: 10},
  pb20: {paddingBottom: 20},
  pb80: {paddingBottom: 80},
  pb100: {paddingBottom: 100},

  pl10: {paddingStart: 10},
  pl15: {paddingStart: 15},

  pr5: {paddingEnd: 5},
  pr10: {paddingEnd: 10},

  px10: {paddingHorizontal: 10},
  px12: {paddingHorizontal: 12},
  px14: {paddingHorizontal: 14},
  px15: {paddingHorizontal: 15},
  px16: {paddingHorizontal: 16},
  px20: {paddingHorizontal: 20},

  py8: {paddingVertical: 8},
  py10: {paddingVertical: 10},
  py12: {paddingVertical: 12},
  py20: {paddingVertical: 20},

  // TYPOGRAPHY

  text9: {fontSize: 9},
  text10: {fontSize: 10},
  text11: {fontSize: 11},
  text12: {fontSize: 12},
  text13: {fontSize: 13},
  text14: {fontSize: 14},
  text15: {fontSize: 15},
  text16: {fontSize: 16},
  text17: {fontSize: 17},
  text18: {fontSize: 18},
  text20: {fontSize: 20},
  text24: {fontSize: 24},
  text25: {fontSize: 25},
  text30: {fontSize: 30},

  textCenter: {textAlign: 'center'},
  textLeft: {textAlign: 'left'},
  textRight: {textAlign: 'right'},

  fontRegular: {fontFamily: 'GoogleSansCode-Regular'},
  fontMedium: {fontFamily: 'GoogleSansCode-Medium'},
  fontSemiBold: {fontFamily: 'GoogleSansCode-SemiBold'},
  fontBold: {fontFamily: 'GoogleSansCode-Bold'},
  fontLight: {fontFamily: 'GoogleSansCode-Light'},

  numRegular: {fontFamily: 'GoogleSansCode-Regular'},
  numMedium: {fontFamily: 'GoogleSansCode-Medium'},
  numSemiBold: {fontFamily: 'GoogleSansCode-SemiBold'},
  numBold: {fontFamily: 'GoogleSansCode-Bold'},
  numLight: {fontFamily: 'GoogleSansCode-Light'},

  // BORDER RADIUS

  rounded2: {borderRadius: 2},
  rounded3: {borderRadius: 3},
  rounded4: {borderRadius: 4},
  rounded5: {borderRadius: 5},
  rounded8: {borderRadius: 8},
  rounded10: {borderRadius: 10},
  rounded12: {borderRadius: 12},
  rounded15: {borderRadius: 15},
  rounded16: {borderRadius: 16},
  rounded18: {borderRadius: 18},
  rounded24: {borderRadius: 24},
  roundedFull: {borderRadius: 9999},

  roundedTop15: {borderTopLeftRadius: 15, borderTopRightRadius: 15},
  roundedTop24: {borderTopLeftRadius: 24, borderTopRightRadius: 24},

  // BORDER WIDTH

  border0: {borderWidth: 0},
  border1: {borderWidth: 1},
  border2: {borderWidth: 2},

  // SIZE

  w8: {width: 8},
  w30: {width: 30},
  w40: {width: 40},
  w50: {width: 50},
  w60: {width: 60},
  w150: {width: 150},

  wFull: {width: '100%'},
  w50p: {width: '50%'},
  w80p: {width: '80%'},

  h4: {height: 4},
  h8: {height: 8},
  h10: {height: 10},
  h30: {height: 30},
  h35: {height: 35},
  h40: {height: 40},
  h45: {height: 45},
  h48: {height: 48},
  h50: {height: 50},
  h60: {height: 60},
  h70: {height: 70},
  h80: {height: 80},
  h100: {height: 100},
  h150: {height: 150},
  h170: {height: 170},
  h200: {height: 200},
  h350: {height: 350},

  hFull: {height: '100%'},

  minH2: {minHeight: 2},
  minH45: {minHeight: 45},
  minH55: {minHeight: 55},

  size8: {width: 8, height: 8},
  size30: {width: 30, height: 30},
  size32: {width: 32, height: 32},
  size35: {width: 35, height: 35},
  size40: {width: 40, height: 40},
  size50: {width: 50, height: 50},
  size60: {width: 60, height: 60},
  size100: {width: 100, height: 100},

  // GAP

  gap2: {gap: 2},
  gap4: {gap: 4},
  gap6: {gap: 6},
  gap8: {gap: 8},
  gap10: {gap: 10},
  gap12: {gap: 12},
  gap16: {gap: 16},

  // POSITION

  absolute: {position: 'absolute'},
  relative: {position: 'relative'},

  zIndex1: {zIndex: 1},
  zIndex2: {zIndex: 2},
  zIndex3: {zIndex: 3},

  // OPACITY

  opacity0: {opacity: 0},
  opacity50: {opacity: 0.5},
  opacity60: {opacity: 0.6},
  opacity70: {opacity: 0.7},
  /** A control that is shown but unavailable (a greyed chevron or month). */
  dimmed: {opacity: 0.35},
  opacity100: {opacity: 1},

  // OVERFLOW

  overflowHidden: {overflow: 'hidden'},
  overflowVisible: {overflow: 'visible'},

  // ADDITIONAL SIZES

  w16: {width: 16},
  w20: {width: 20},
  h16: {height: 16},
  h26: {height: 26},
  h34: {height: 34},
  h36: {height: 36},
  h65: {height: 65},
  h320: {height: 320},
  minW70: {minWidth: 70},
  minH60: {minHeight: 60},
  minH200: {minHeight: 200},
  size6: {width: 6, height: 6},
  size10: {width: 10, height: 10},
  size16: {width: 16, height: 16},
  size20: {width: 20, height: 20},
  size24: {width: 24, height: 24},
  size36: {width: 36, height: 36},
  size80: {width: 80, height: 80},

  // PERCENTAGE MARGINS/PADDINGS

  pt5p: {paddingTop: '5%'},
  pt10p: {paddingTop: '10%'},
  pt15p: {paddingTop: '15%'},
  pt20p: {paddingTop: '20%'},
  pb5p: {paddingBottom: '5%'},
  mb2p: {marginBottom: '2%'},
  mb5p: {marginBottom: '5%'},
  mb10p: {marginBottom: '10%'},
  mb20p: {marginBottom: '20%'},
  mt2p: {marginTop: '2%'},
  mt3p: {marginTop: '3%'},
  mt5p: {marginTop: '5%'},
  mt8p: {marginTop: '8%'},
  mt12p: {marginTop: '12%'},
  mt30p: {marginTop: '30%'},

  // ADDITIONAL PADDINGS

  px3: {paddingHorizontal: 3},
  px5: {paddingHorizontal: 5},
  px8: {paddingHorizontal: 8},
  py3: {paddingVertical: 3},
  py5: {paddingVertical: 5},

  // BORDER

  borderBottom1: {borderBottomWidth: 1},
  borderBottom05: {borderBottomWidth: 0.5},
  borderBottom08: {borderBottomWidth: 0.8},
  /** Hairline rule; colour it at the call site. */
  hairline: {height: 0.5},
  borderTop08: {borderTopWidth: 0.8},
  border15: {borderWidth: 1.5},

  // POSITION OFFSETS

  bottom15: {bottom: 15},
  // Logical: the trailing edge, which is the left in a right-to-left layout (M32).
  end15: {end: 15},
  bottom15p: {bottom: '15%'},

  // TEXT SPECIFIC

  noFontPadding: {includeFontPadding: false},

  // SELF ALIGNMENT

  selfEnd: {alignSelf: 'flex-end'},
  selfStart: {alignSelf: 'flex-start'},

  // WIDTH CAPS

  /** Chip and label text that must truncate rather than push neighbours. */
  maxW160: {maxWidth: 160},
  maxW220: {maxWidth: 220},
  /** Takes no space (a hidden sheet indicator). */
  size0: {width: 0, height: 0},

  // MINIMUM HEIGHTS (M30): grow with the OS font size instead of clipping it.

  /** The smallest comfortable touch target. */
  minTouch: {minHeight: 44, justifyContent: 'center'},
  minH48: {minHeight: 48},
  minH80: {minHeight: 80},
});
