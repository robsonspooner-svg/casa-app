import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { THEME } from '@casa/config';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Image
              source={require('../assets/casa_logo.png')}
              style={styles.logo}
            />
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.subtitle}>
              The app encountered an unexpected error. Please try restarting.
            </Text>
            <ScrollView style={styles.errorBox} contentContainerStyle={styles.errorBoxContent}>
              <Text style={styles.errorText}>
                {this.state.error?.message || 'Unknown error'}
              </Text>
              {this.state.error?.stack ? (
                <Text style={styles.stackText}>
                  {this.state.error.stack.substring(0, 500)}
                </Text>
              ) : null}
            </ScrollView>
            <TouchableOpacity style={styles.button} onPress={this.handleRestart}>
              <Text style={styles.buttonText}>Restart</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    maxWidth: 340,
    width: '100%',
  },
  logo: {
    width: 64,
    height: 64,
    resizeMode: 'contain',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 21,
  },
  errorBox: {
    width: '100%',
    maxHeight: 160,
    backgroundColor: THEME.colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 24,
  },
  errorBoxContent: {
    padding: 12,
  },
  errorText: {
    fontSize: 12,
    color: THEME.colors.error,
    fontFamily: 'monospace',
  },
  stackText: {
    fontSize: 10,
    color: THEME.colors.textTertiary,
    fontFamily: 'monospace',
    marginTop: 8,
  },
  button: {
    backgroundColor: THEME.colors.brand,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: THEME.colors.textInverse,
    fontSize: 16,
    fontWeight: '600',
  },
});
