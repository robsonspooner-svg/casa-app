import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Card, Button, Badge } from '@casa/ui';
import { usePaymentMethods, usePaymentMutations } from '@casa/api';

export default function PaymentMethodsScreen() {
  const { methods, loading, refreshMethods } = usePaymentMethods();
  const { setDefaultMethod, removeMethod, loading: mutating } = usePaymentMutations();

  const handleSetDefault = async (methodId: string) => {
    try {
      await setDefaultMethod(methodId);
      await refreshMethods();
    } catch {
      Alert.alert('Error', 'Failed to set default payment method.');
    }
  };

  const handleRemove = (methodId: string) => {
    Alert.alert(
      'Remove Payment Method',
      'Are you sure you want to remove this payment method?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMethod(methodId);
              await refreshMethods();
            } catch {
              Alert.alert('Error', 'Failed to remove payment method.');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {methods.length === 0 && !loading ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
              <Path d="M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2z" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M1 10h22" stroke={THEME.colors.textTertiary} strokeWidth={1.5} />
            </Svg>
          </View>
          <Text style={styles.emptyTitle}>No payment methods</Text>
          <Text style={styles.emptyText}>Add a card or bank account to make payments.</Text>
        </View>
      ) : (
        methods.map(method => (
          <Card key={method.id} style={styles.methodCard}>
            <View style={styles.methodHeader}>
              <View style={styles.methodIcon}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  {method.type === 'au_becs_debit' ? (
                    <Path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  ) : (
                    <>
                      <Path d="M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2z" stroke={THEME.colors.brand} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                      <Path d="M1 10h22" stroke={THEME.colors.brand} strokeWidth={1.5} />
                    </>
                  )}
                </Svg>
              </View>
              <View style={styles.methodDetails}>
                <Text style={styles.methodName}>
                  {method.type === 'au_becs_debit'
                    ? (method.bank_name || 'Bank Account')
                    : (method.brand || 'Card')
                  }
                </Text>
                <Text style={styles.methodNumber}>
                  {method.type === 'au_becs_debit'
                    ? `Account ending in ${method.last_four}`
                    : `**** **** **** ${method.last_four}`
                  }
                </Text>
              </View>
              {method.is_default && (
                <Badge label="Default" variant="success" />
              )}
            </View>
            <View style={styles.methodActions}>
              {!method.is_default && (
                <TouchableOpacity
                  style={styles.actionLink}
                  onPress={() => handleSetDefault(method.id)}
                  disabled={mutating}
                >
                  <Text style={styles.actionText}>Set as default</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.actionLink}
                onPress={() => handleRemove(method.id)}
                disabled={mutating}
              >
                <Text style={[styles.actionText, styles.removeText]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ))
      )}

      <Button
        title="Add Payment Method"
        onPress={() => router.push('/(app)/payments/methods/add' as any)}
        style={styles.addButton}
      />
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: THEME.spacing['2xl'],
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: THEME.spacing.base,
  },
  emptyTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  emptyText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
  },
  methodCard: {
    marginBottom: THEME.spacing.md,
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: THEME.spacing.md,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: THEME.radius.sm,
    backgroundColor: THEME.colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodDetails: {
    flex: 1,
  },
  methodName: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
  },
  methodNumber: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  methodActions: {
    flexDirection: 'row',
    gap: THEME.spacing.lg,
    marginTop: THEME.spacing.md,
    paddingTop: THEME.spacing.md,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
  },
  actionLink: {
    paddingVertical: THEME.spacing.xs,
  },
  actionText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.brand,
    fontWeight: THEME.fontWeight.medium,
  },
  removeText: {
    color: THEME.colors.error,
  },
  addButton: {
    marginTop: THEME.spacing.lg,
  },
});
