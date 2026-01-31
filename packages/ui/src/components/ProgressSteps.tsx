import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { THEME } from '@casa/config';

export interface ProgressStepsProps {
  steps: string[];
  currentStep: number;
  containerStyle?: ViewStyle;
}

export function ProgressSteps({ steps, currentStep, containerStyle }: ProgressStepsProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.stepsRow}>
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <React.Fragment key={index}>
              {/* Step indicator */}
              <View style={styles.stepItem}>
                <View style={[
                  styles.stepCircle,
                  isCompleted && styles.stepCompleted,
                  isCurrent && styles.stepCurrent,
                ]}>
                  {isCompleted ? (
                    <Text style={styles.stepCheckmark}>✓</Text>
                  ) : (
                    <Text style={[
                      styles.stepNumber,
                      (isCompleted || isCurrent) && styles.stepNumberActive,
                    ]}>
                      {index + 1}
                    </Text>
                  )}
                </View>
                <Text style={[
                  styles.stepLabel,
                  isCurrent && styles.stepLabelActive,
                  isCompleted && styles.stepLabelCompleted,
                ]} numberOfLines={1}>
                  {step}
                </Text>
              </View>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <View style={[
                  styles.connector,
                  isCompleted && styles.connectorCompleted,
                ]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: THEME.spacing.md,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  stepItem: {
    alignItems: 'center',
    minWidth: 48,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.surface,
  },
  stepCompleted: {
    backgroundColor: THEME.colors.brand,
    borderColor: THEME.colors.brand,
  },
  stepCurrent: {
    borderColor: THEME.colors.brand,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: THEME.colors.textTertiary,
  },
  stepNumberActive: {
    color: THEME.colors.brand,
  },
  stepCheckmark: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 10,
    color: THEME.colors.textTertiary,
    marginTop: 4,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: THEME.colors.brand,
    fontWeight: '600' as const,
  },
  stepLabelCompleted: {
    color: THEME.colors.textSecondary,
  },
  connector: {
    height: 2,
    flex: 1,
    backgroundColor: THEME.colors.border,
    marginTop: 13,
    marginHorizontal: 4,
  },
  connectorCompleted: {
    backgroundColor: THEME.colors.brand,
  },
});
