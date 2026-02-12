// Casa Haptic Feedback Utility
// Provides consistent tactile feedback for meaningful actions.
// See CASA-VISUAL-STANDARD.md Part IX, Detail #1.

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Light tap — for button presses, tab switches, toggles.
 * The everyday feedback that makes every interaction feel physical.
 */
export function lightTap() {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

/**
 * Medium tap — for confirming significant actions.
 * Rent paid, tenant approved, property added.
 */
export function mediumTap() {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
}

/**
 * Heavy tap — for destructive or irreversible actions.
 * Delete confirmation, lease termination.
 */
export function heavyTap() {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }
}

/**
 * Success — for positive completions.
 * Payment received, inspection passed, all rent collected.
 */
export function successFeedback() {
  if (Platform.OS !== 'web') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
}

/**
 * Warning — for attention-needed moments.
 * Overdue rent detected, lease expiring soon.
 */
export function warningFeedback() {
  if (Platform.OS !== 'web') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }
}

/**
 * Error — for failed actions.
 * Payment failed, network error, validation error.
 */
export function errorFeedback() {
  if (Platform.OS !== 'web') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
}

/**
 * Selection — for scroll pickers, pull-to-refresh threshold.
 * The lightest possible feedback.
 */
export function selectionFeedback() {
  if (Platform.OS !== 'web') {
    Haptics.selectionAsync();
  }
}
