import {TextInput, View, KeyboardTypeOptions, type ReturnKeyTypeOptions} from 'react-native';
import React, {useState, useCallback, useMemo, memo, forwardRef} from 'react';
import {PrimaryText} from './PrimaryText';
import {Icon} from './Icons';
import type {ThemeColors} from '../hooks/useThemeColors';
import {gs} from '../globalStyles';
import type {FieldRules} from '../../i18n/validationSchema';
import type {IconName} from './IconRegistry';

interface CustomInputProps {
  input: string;
  setInput: (value: string) => void;
  colors: ThemeColors;
  placeholder: string;
  label?: string;
  schema?: FieldRules<string>;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoFocus?: boolean;
  secureTextEntry?: boolean;
  multiline?: boolean;
  maxLength?: number;
  onBlur?: () => void;
  onFocus?: () => void;
  leftIcon?: IconName;
  disabled?: boolean;
  /**
   * Keyboard flow between fields: 'next' keeps the keyboard up and
   * `onSubmitEditing` moves focus on; 'done' (default) closes it.
   */
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  /** Extra error lines from the caller (e.g. "already exists"). */
  externalError?: string;
}

type TextInputHandle = React.ElementRef<typeof TextInput>;

const CustomInputComponent = forwardRef<TextInputHandle, CustomInputProps>(
  (
    {
      colors,
      input,
      setInput,
      placeholder,
      label,
      schema,
      keyboardType,
      autoCapitalize,
      autoFocus = false,
      secureTextEntry = false,
      multiline = false,
      maxLength,
      onBlur,
      onFocus,
      leftIcon,
      disabled = false,
      returnKeyType,
      onSubmitEditing,
      externalError,
    },
    ref,
  ) => {
    const [hasInteracted, setHasInteracted] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const schemaErrors = hasInteracted ? (schema?.issues(input) ?? []) : [];
    const errors: Array<{message: string}> = externalError ? [...schemaErrors, {message: externalError}] : schemaErrors;

    const hasLeftIcon = !!leftIcon;
    const hasIcons = hasLeftIcon;

    // A visible resting edge (M31): the field was 1.11:1 against the page with none.
    const inputBorderColor = useMemo(() => {
      return isFocused ? colors.primaryText : colors.inputBorder;
    }, [isFocused, colors.primaryText, colors.inputBorder]);

    const inputBackgroundColor = useMemo(() => {
      return disabled ? colors.secondaryContainerColor : colors.secondaryAccent;
    }, [disabled, colors.secondaryContainerColor, colors.secondaryAccent]);

    const handleFocus = useCallback(() => {
      setIsFocused(true);
      onFocus?.();
    }, [onFocus]);

    const handleBlur = useCallback(() => {
      setIsFocused(false);
      setHasInteracted(true);
      onBlur?.();
    }, [onBlur]);

    const handleChangeText = useCallback(
      (text: string) => {
        setInput(text);
        if (!hasInteracted) {
          setHasInteracted(true);
        }
      },
      [setInput, hasInteracted],
    );

    return (
      <View style={disabled ? gs.opacity60 : undefined}>
        {label ? (
          <PrimaryText size={12} color={colors.secondaryText} style={gs.mb5}>
            {label}
          </PrimaryText>
        ) : null}
        <View
          style={
            hasIcons
              ? [
                  gs.minH48,
                  gs.itemsCenter,
                  gs.rounded12,
                  gs.pl10,
                  gs.justifyStart,
                  gs.row,
                  {borderWidth: 1.5, borderColor: inputBorderColor, backgroundColor: inputBackgroundColor},
                ]
              : undefined
          }>
          {hasLeftIcon && (
            <View style={gs.mr8}>
              <Icon name={leftIcon} size={20} color={colors.secondaryText} />
            </View>
          )}
          <TextInput
            ref={ref}
            style={
              hasIcons
                ? [gs.px15, gs.minH48, gs.wFull, gs.fontMedium, gs.noFontPadding, {color: colors.primaryText}]
                : [
                    gs.minH48,
                    gs.rounded12,
                    gs.px15,
                    gs.fontMedium,
                    gs.noFontPadding,
                    {
                      borderWidth: 1.5,
                      borderColor: inputBorderColor,
                      color: colors.primaryText,
                      backgroundColor: inputBackgroundColor,
                      marginBottom: 5,
                    },
                  ]
            }
            value={input}
            onChangeText={handleChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            placeholderTextColor={colors.secondaryText}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            autoFocus={autoFocus}
            secureTextEntry={secureTextEntry}
            multiline={multiline}
            maxLength={maxLength}
            editable={!disabled}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
            // Keep the keyboard up while focus hops to the next field.
            blurOnSubmit={returnKeyType === 'next' ? false : undefined}
            accessibilityLabel={label ?? placeholder}
          />
        </View>
        {errors.length > 0 && (
          <View style={gs.mb10}>
            {errors.map((error: {message: string}) => (
              <View key={error.message}>
                <PrimaryText size={12} color={colors.accentRed}>
                  {error.message}
                </PrimaryText>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  },
);

CustomInputComponent.displayName = 'CustomInput';

export const CustomInput = memo(CustomInputComponent);
