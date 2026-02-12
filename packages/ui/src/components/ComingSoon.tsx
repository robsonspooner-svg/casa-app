import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { CasaLogo } from './CasaLogo';

export interface ComingSoonProps {
  /** Feature name displayed as the heading */
  featureName?: string;
  /** Customisable subtitle explaining what the feature will do */
  subtitle?: string;
  /** Whether to show the "Notify Me" button */
  showNotifyMe?: boolean;
  /** Called when user taps back/dismiss */
  onBack?: () => void;
}

/**
 * ComingSoon — Premium "coming soon" gate component.
 *
 * Displayed when a feature is not yet ready for launch.
 * Feels intentional and polished — like a feature preview, not an error page.
 */
export function ComingSoon({
  featureName = 'Coming Soon',
  subtitle = 'This feature is being built with care and will be available in a future update.',
  showNotifyMe = true,
  onBack,
}: ComingSoonProps) {
  const [notified, setNotified] = useState(false);

  return (
    <View style={styles.container}>
      {onBack && (
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 18l-6-6 6-6"
              stroke={THEME.colors.textSecondary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      )}

      <View style={styles.content}>
        {/* Brand icon */}
        <View style={styles.iconContainer}>
          <CasaLogo size="lg" color="light" />
        </View>

        {/* Heading */}
        <Text style={styles.title}>{featureName}</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>{subtitle}</Text>

        {/* Notify Me button */}
        {showNotifyMe && (
          <TouchableOpacity
            style={[styles.notifyButton, notified && styles.notifyButtonActive]}
            onPress={() => setNotified(true)}
            activeOpacity={0.8}
            disabled={notified}
          >
            {notified ? (
              <>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M20 6L9 17l-5-5"
                    stroke={THEME.colors.success}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={styles.notifyButtonTextActive}>We'll let you know</Text>
              </>
            ) : (
              <>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M18 8A6 6 0 106 8c0 7-3 9-3 9h18s-3-2-3-9zM13.73 21a2 2 0 01-3.46 0"
                    stroke={THEME.colors.brand}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={styles.notifyButtonText}>Notify Me</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backText: {
    fontSize: 15,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 12,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    maxWidth: 300,
  },
  notifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: THEME.colors.brand,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  notifyButtonActive: {
    borderColor: THEME.colors.success,
    backgroundColor: THEME.colors.successBg,
  },
  notifyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.brand,
  },
  notifyButtonTextActive: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.success,
  },
});
