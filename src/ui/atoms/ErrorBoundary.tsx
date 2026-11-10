import React, {Component, ErrorInfo, ReactNode} from 'react';
import {View, TouchableOpacity, StyleSheet, Appearance} from 'react-native';
import i18n from 'i18next';
import {PrimaryText} from './PrimaryText';
import {appendErrorLog} from '../../platform/errorLog';

interface ErrorBoundaryColors {
  background: string;
  text: string;
  secondaryText: string;
  buttonBackground: string;
  buttonText: string;
}

/**
 * Resolves theme colors for the error fallback UI. Uses Appearance API
 * directly because ErrorBoundary sits outside ThemeProvider and cannot
 * consume context.
 */
function getErrorBoundaryColors(): ErrorBoundaryColors {
  const isDark = Appearance.getColorScheme() === 'dark';
  return isDark
    ? {
        background: '#0F0F0F',
        text: '#FFFFFF',
        secondaryText: '#CCCCCC',
        buttonBackground: '#B1FB98',
        buttonText: '#000000',
      }
    : {
        background: '#FAFAF8',
        text: '#1A1A1A',
        secondaryText: '#505050',
        buttonBackground: '#6E8B3D',
        buttonText: '#FFFFFF',
      };
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {hasError: false};
  }

  static getDerivedStateFromError(): State {
    return {hasError: true};
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    appendErrorLog(error, true);
    if (__DEV__) {
      console.error('ErrorBoundary caught:', error, info.componentStack);
    }
  }

  handleRetry = () => {
    this.setState({hasError: false});
  };

  render() {
    if (this.state.hasError) {
      const c = getErrorBoundaryColors();
      return (
        <View style={[styles.container, {backgroundColor: c.background}]}>
          <PrimaryText size={40} weight="bold" color={c.text}>
            :(
          </PrimaryText>
          <PrimaryText size={16} weight="semibold" color={c.text} style={styles.title}>
            {i18n.t('errorBoundary.title')}
          </PrimaryText>
          <PrimaryText size={13} color={c.secondaryText} style={styles.subtitle}>
            {i18n.t('errorBoundary.message')}
          </PrimaryText>
          <TouchableOpacity
            onPress={this.handleRetry}
            accessibilityRole="button"
            style={[styles.button, {backgroundColor: c.buttonBackground}]}
            activeOpacity={0.7}>
            <PrimaryText size={14} weight="semibold" color={c.buttonText}>
              {i18n.t('errorBoundary.retry')}
            </PrimaryText>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
  },
});
