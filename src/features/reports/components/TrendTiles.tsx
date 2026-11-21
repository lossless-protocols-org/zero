import React from 'react';
import {StyleSheet, View} from 'react-native';
import {PrimaryText} from '../../../ui/atoms/PrimaryText';
import {AMOUNT_FONT_CAP} from '../../../ui/atoms/Amount';
import {useThemeColors} from '../../../ui/hooks/useThemeColors';
import {gs} from '../../../ui/globalStyles';

interface TrendTilesProps {
  tiles: ReadonlyArray<{
    key: string;
    /** What the tile leads with: "42%", "▼ 33%", "Lowest". */
    figure: string;
    /** A few words saying what the figure is. */
    words: string;
    /** The whole fact as a sentence, for a screen reader. */
    spoken: string;
    /** 'good' and 'bad' colour the figure; its words say the same without colour. */
    tone?: 'good' | 'bad';
  }>;
}

/** What stood out, as tiles two to a row: the figure first and large, then what it is. */
export const TrendTiles: React.FC<TrendTilesProps> = ({tiles}) => {
  const colors = useThemeColors();
  return (
    <View style={[gs.row, gs.wrap, gs.gap8]}>
      {tiles.map(tile => (
        <View
          key={tile.key}
          accessible
          accessibilityLabel={tile.spoken}
          style={[gs.p12, gs.rounded12, styles.tile, {backgroundColor: colors.containerColor}]}>
          <PrimaryText
            size={20}
            weight="bold"
            variant="number"
            numberOfLines={1}
            adjustsFontSizeToFit
            maxFontSizeMultiplier={AMOUNT_FONT_CAP}
            color={tile.tone === 'good' ? colors.accentGreen : tile.tone === 'bad' ? colors.accentRed : undefined}>
            {tile.figure}
          </PrimaryText>
          <PrimaryText size={11} color={colors.secondaryText} style={gs.mt3}>
            {tile.words}
          </PrimaryText>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  // Two to a row with the gap between them; a last odd one takes the row.
  tile: {flexBasis: '45%', flexGrow: 1},
});
