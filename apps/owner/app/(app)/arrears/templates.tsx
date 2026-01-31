// Reminder Templates Screen
// Mission 08: Arrears & Late Payment Management

import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { THEME } from '@casa/config';
import { Card, Chip } from '@casa/ui';
import { useReminderTemplates } from '@casa/api';
import type { ReminderTemplate } from '@casa/api';

function TemplateCard({
  template,
  isSystem,
  onDelete,
}: {
  template: ReminderTemplate;
  isSystem: boolean;
  onDelete?: (id: string) => void;
}) {
  const channelLabels: Record<string, string> = {
    email: 'Email',
    sms: 'SMS',
    both: 'Email & SMS',
  };

  return (
    <Card style={styles.templateCard}>
      <View style={styles.templateHeader}>
        <View style={styles.templateHeaderLeft}>
          <Text style={styles.templateName}>{template.name}</Text>
          <View style={styles.templateMeta}>
            <Chip
              label={`Day ${template.days_overdue}+`}
              selected={false}
            />
            <Chip
              label={channelLabels[template.channel] || template.channel}
              selected={false}
            />
            {template.is_breach_notice && (
              <Chip
                label="Legal Notice"
                selected
              />
            )}
          </View>
        </View>
        {isSystem ? (
          <View style={styles.systemBadge}>
            <Text style={styles.systemBadgeText}>System</Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                'Delete Template',
                'Are you sure you want to delete this template?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => onDelete?.(template.id),
                  },
                ]
              );
            }}
          >
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.templateContent}>
        <Text style={styles.subjectLabel}>Subject:</Text>
        <Text style={styles.subjectText}>{template.subject}</Text>

        <Text style={styles.bodyLabel}>Preview:</Text>
        <Text style={styles.bodyPreview} numberOfLines={4}>
          {template.body}
        </Text>
      </View>

      {template.applicable_states && template.applicable_states.length > 0 && (
        <View style={styles.statesContainer}>
          <Text style={styles.statesLabel}>Applicable to:</Text>
          <View style={styles.statesChips}>
            {template.applicable_states.map(state => (
              <Chip key={state} label={state} selected={false} />
            ))}
          </View>
        </View>
      )}
    </Card>
  );
}

export default function ReminderTemplatesScreen() {
  const {
    templates,
    systemTemplates,
    customTemplates,
    loading,
    refreshTemplates,
    deleteTemplate,
  } = useReminderTemplates();

  const handleDelete = async (id: string) => {
    const success = await deleteTemplate(id);
    if (success) {
      Alert.alert('Success', 'Template deleted');
    } else {
      Alert.alert('Error', 'Failed to delete template');
    }
  };

  const renderSection = (
    title: string,
    data: ReminderTemplate[],
    isSystem: boolean
  ) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {data.length === 0 ? (
        <Text style={styles.emptyText}>
          {isSystem ? 'No system templates available' : 'No custom templates yet'}
        </Text>
      ) : (
        data.map(template => (
          <TemplateCard
            key={template.id}
            template={template}
            isSystem={isSystem}
            onDelete={!isSystem ? handleDelete : undefined}
          />
        ))
      )}
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      data={[{ key: 'content' }]}
      renderItem={() => (
        <>
          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Text style={styles.infoText}>
              Reminder templates are automatically sent to tenants when they reach the specified
              number of days overdue. System templates cannot be edited but you can create your own.
            </Text>
          </View>

          {/* Custom Templates */}
          {renderSection('Your Custom Templates', customTemplates, false)}

          {/* System Templates */}
          {renderSection('System Templates', systemTemplates, true)}

          <View style={styles.bottomSpacer} />
        </>
      )}
      keyExtractor={() => 'content'}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refreshTemplates} />
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  infoBanner: {
    backgroundColor: THEME.colors.subtle,
    padding: THEME.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  infoText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
  },
  section: {
    padding: THEME.spacing.base,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  emptyText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    fontStyle: 'italic',
  },
  templateCard: {
    marginBottom: THEME.spacing.md,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: THEME.spacing.md,
  },
  templateHeaderLeft: {
    flex: 1,
  },
  templateName: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  templateMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: THEME.spacing.xs,
  },
  systemBadge: {
    backgroundColor: THEME.colors.subtle,
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: THEME.spacing.xs,
    borderRadius: THEME.radius.sm,
  },
  systemBadgeText: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
  },
  deleteText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.error,
  },
  templateContent: {
    paddingTop: THEME.spacing.md,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  subjectLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: THEME.spacing.xs,
  },
  subjectText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  bodyLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: THEME.spacing.xs,
  },
  bodyPreview: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
  },
  statesContainer: {
    marginTop: THEME.spacing.md,
    paddingTop: THEME.spacing.md,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  statesLabel: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    marginBottom: THEME.spacing.xs,
  },
  statesChips: {
    flexDirection: 'row',
    gap: THEME.spacing.xs,
  },
  bottomSpacer: {
    height: THEME.spacing['2xl'],
  },
});
