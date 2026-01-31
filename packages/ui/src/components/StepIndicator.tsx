// StepIndicator - Multi-step progress indicator
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '@casa/config';

export interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
  style?: object;
}

export function StepIndicator({ steps, currentStep, style }: StepIndicatorProps) {
  return (
    <View style={[styles.container, style]}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <View key={index} style={styles.stepContainer}>
            {/* Step circle */}
            <View
              style={[
                styles.circle,
                isCompleted && styles.circleCompleted,
                isCurrent && styles.circleCurrent,
              ]}
            >
              {isCompleted ? (
                <Text style={styles.checkmark}>✓</Text>
              ) : (
                <Text
                  style={[
                    styles.stepNumber,
                    isCurrent && styles.stepNumberCurrent,
                  ]}
                >
                  {index + 1}
                </Text>
              )}
            </View>

            {/* Step label */}
            <Text
              style={[
                styles.label,
                (isCompleted || isCurrent) && styles.labelActive,
              ]}
              numberOfLines={1}
            >
              {step}
            </Text>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <View
                style={[
                  styles.connector,
                  isCompleted && styles.connectorCompleted,
                ]}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

const CIRCLE_SIZE = 32;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.md,
  },
  stepContainer: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2,
    borderColor: THEME.colors.border,
    backgroundColor: THEME.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  circleCompleted: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  circleCurrent: {
    borderColor: THEME.colors.brand,
    backgroundColor: THEME.colors.surface,
  },
  stepNumber: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textTertiary,
  },
  stepNumberCurrent: {
    color: THEME.colors.brand,
  },
  checkmark: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.textInverse,
  },
  label: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    marginTop: THEME.spacing.xs,
    textAlign: 'center',
    maxWidth: 70,
  },
  labelActive: {
    color: THEME.colors.textPrimary,
    fontWeight: THEME.fontWeight.medium,
  },
  connector: {
    position: 'absolute',
    top: CIRCLE_SIZE / 2 - 1,
    left: '50%',
    right: '-50%',
    height: 2,
    backgroundColor: THEME.colors.border,
    marginLeft: CIRCLE_SIZE / 2 + 4,
    marginRight: CIRCLE_SIZE / 2 + 4,
  },
  connectorCompleted: {
    backgroundColor: THEME.colors.brand,
  },
});
