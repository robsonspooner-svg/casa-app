import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { THEME } from '@casa/config';

export interface TimelineEvent {
  label: string;
  date?: string;
  status: 'completed' | 'current' | 'pending';
}

export interface StatusTimelineProps {
  events: TimelineEvent[];
  containerStyle?: ViewStyle;
}

export function StatusTimeline({ events, containerStyle }: StatusTimelineProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      {events.map((event, index) => {
        const isLast = index === events.length - 1;

        return (
          <View key={index} style={styles.eventRow}>
            {/* Dot and line */}
            <View style={styles.dotColumn}>
              <View style={[
                styles.dot,
                event.status === 'completed' && styles.dotCompleted,
                event.status === 'current' && styles.dotCurrent,
              ]} />
              {!isLast && (
                <View style={[
                  styles.line,
                  event.status === 'completed' && styles.lineCompleted,
                ]} />
              )}
            </View>

            {/* Content */}
            <View style={styles.eventContent}>
              <Text style={[
                styles.eventLabel,
                event.status === 'current' && styles.eventLabelCurrent,
                event.status === 'pending' && styles.eventLabelPending,
              ]}>
                {event.label}
              </Text>
              {event.date && (
                <Text style={styles.eventDate}>{event.date}</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: THEME.spacing.sm,
  },
  eventRow: {
    flexDirection: 'row',
    minHeight: 40,
  },
  dotColumn: {
    width: 24,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: THEME.colors.border,
    marginTop: 4,
  },
  dotCompleted: {
    backgroundColor: THEME.colors.success,
  },
  dotCurrent: {
    backgroundColor: THEME.colors.brand,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: THEME.colors.border,
    marginVertical: 2,
  },
  lineCompleted: {
    backgroundColor: THEME.colors.success,
  },
  eventContent: {
    flex: 1,
    paddingLeft: THEME.spacing.sm,
    paddingBottom: THEME.spacing.md,
  },
  eventLabel: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
  },
  eventLabelCurrent: {
    color: THEME.colors.brand,
    fontWeight: THEME.fontWeight.semibold,
  },
  eventLabelPending: {
    color: THEME.colors.textTertiary,
  },
  eventDate: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textTertiary,
    marginTop: 2,
  },
});
