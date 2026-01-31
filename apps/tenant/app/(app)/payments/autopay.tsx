import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert } from 'react-native';
import { router } from 'expo-router';
import { THEME } from '@casa/config';
import { Card, Button, Input } from '@casa/ui';
import {
  useMyTenancy,
  usePaymentMethods,
  useAutoPay,
  usePaymentMutations,
} from '@casa/api';

export default function AutoPayScreen() {
  const { tenancy } = useMyTenancy();
  const { methods, defaultMethod } = usePaymentMethods();
  const { settings, loading: settingsLoading } = useAutoPay(tenancy?.id);
  const { updateAutoPay, loading: mutating } = usePaymentMutations();

  const [isEnabled, setIsEnabled] = useState(false);
  const [daysBeforeDue, setDaysBeforeDue] = useState('0');
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setIsEnabled(settings.is_enabled);
      setDaysBeforeDue(String(settings.days_before_due));
      setSelectedMethodId(settings.payment_method_id);
    } else if (defaultMethod) {
      setSelectedMethodId(defaultMethod.id);
    }
  }, [settings, defaultMethod]);

  const activeMethod = selectedMethodId
    ? methods.find(m => m.id === selectedMethodId)
    : defaultMethod;

  const handleSave = async () => {
    if (!tenancy || !activeMethod) {
      Alert.alert('Error', 'Please select a payment method.');
      return;
    }

    try {
      await updateAutoPay(tenancy.id, {
        paymentMethodId: activeMethod.id,
        isEnabled,
        daysBeforeDue: parseInt(daysBeforeDue) || 0,
      });
      Alert.alert('Saved', 'Auto-pay settings updated successfully.');
    } catch {
      Alert.alert('Error', 'Failed to update auto-pay settings.');
    }
  };

  if (!tenancy) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No active tenancy found.</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card variant="elevated" style={styles.toggleCard}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleTitle}>Auto-Pay</Text>
            <Text style={styles.toggleDesc}>
              Automatically pay rent when due
            </Text>
          </View>
          <Switch
            value={isEnabled}
            onValueChange={setIsEnabled}
            trackColor={{ false: THEME.colors.border, true: THEME.colors.brand }}
            thumbColor={THEME.colors.surface}
          />
        </View>
      </Card>

      {isEnabled && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            {methods.length === 0 ? (
              <Card style={styles.noMethodCard}>
                <Text style={styles.noMethodText}>Add a payment method first</Text>
                <Button
                  title="Add Method"
                  onPress={() => router.push('/(app)/payments/methods/add' as any)}
                />
              </Card>
            ) : (
              methods.map(method => (
                <Card
                  key={method.id}
                  style={{
                    ...styles.methodCard,
                    ...(activeMethod?.id === method.id ? styles.methodCardSelected : {}),
                  }}
                  onPress={() => setSelectedMethodId(method.id)}
                >
                  <View style={styles.methodRow}>
                    <View>
                      <Text style={styles.methodName}>
                        {method.type === 'au_becs_debit'
                          ? (method.bank_name || 'Bank Account')
                          : (method.brand || 'Card')
                        }
                      </Text>
                      <Text style={styles.methodLast4}>
                        ****{method.last_four}
                      </Text>
                    </View>
                    <View style={[
                      styles.radio,
                      activeMethod?.id === method.id && styles.radioSelected,
                    ]} />
                  </View>
                </Card>
              ))
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Timing</Text>
            <Card style={styles.timingCard}>
              <Input
                label="Days before due date"
                value={daysBeforeDue}
                onChangeText={setDaysBeforeDue}
                keyboardType="number-pad"
                containerStyle={styles.timingInput}
              />
              <Text style={styles.timingHint}>
                Set to 0 to pay on the due date. Set higher to pay earlier.
              </Text>
            </Card>
          </View>
        </>
      )}

      <Button
        title="Save Settings"
        onPress={handleSave}
        loading={mutating}
        disabled={mutating}
        style={styles.saveButton}
      />

      <Card style={styles.infoCard}>
        <Text style={styles.infoTitle}>How Auto-Pay Works</Text>
        <Text style={styles.infoText}>
          When enabled, your rent will be automatically charged to your selected payment method before each due date. You will receive a notification before each charge.
        </Text>
        <Text style={styles.infoText}>
          You can cancel auto-pay at any time. Payments already scheduled will still be processed.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  content: {
    padding: THEME.spacing.base,
    paddingBottom: THEME.spacing['2xl'],
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
  },
  toggleCard: {
    marginBottom: THEME.spacing.lg,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleInfo: {
    flex: 1,
    marginRight: THEME.spacing.base,
  },
  toggleTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  toggleDesc: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  section: {
    marginBottom: THEME.spacing.lg,
  },
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  noMethodCard: {
    alignItems: 'center',
    paddingVertical: THEME.spacing.lg,
  },
  noMethodText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.md,
  },
  methodCard: {
    marginBottom: THEME.spacing.sm,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  methodCardSelected: {
    borderColor: THEME.colors.brand,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  methodName: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
  },
  methodLast4: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: THEME.colors.border,
  },
  radioSelected: {
    borderColor: THEME.colors.brand,
    backgroundColor: THEME.colors.brand,
  },
  timingCard: {},
  timingInput: {
    marginBottom: THEME.spacing.sm,
  },
  timingHint: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
  },
  saveButton: {
    marginBottom: THEME.spacing.lg,
  },
  infoCard: {
    backgroundColor: THEME.colors.subtle,
  },
  infoTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  infoText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
    marginBottom: THEME.spacing.sm,
  },
});
