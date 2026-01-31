import { View, Text, StyleSheet, FlatList } from 'react-native';
import { THEME } from '@casa/config';
import { Card, Badge } from '@casa/ui';
import { useAuth, formatDollars } from '@casa/api';

interface InvoiceItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
}

export default function BillingHistoryScreen() {
  const { user } = useAuth();

  // In production, this would fetch from Stripe via Edge Function
  // using the user's stripe_customer_id
  const invoices: InvoiceItem[] = [];

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'paid': return 'success' as const;
      case 'pending': return 'warning' as const;
      case 'failed': return 'error' as const;
      default: return 'neutral' as const;
    }
  };

  const renderInvoice = ({ item }: { item: InvoiceItem }) => (
    <Card style={styles.invoiceCard}>
      <View style={styles.invoiceRow}>
        <View style={styles.invoiceInfo}>
          <Text style={styles.invoiceDate}>
            {new Date(item.date).toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </Text>
          <Text style={styles.invoiceDesc}>{item.description}</Text>
        </View>
        <View style={styles.invoiceRight}>
          <Text style={styles.invoiceAmount}>{formatDollars(item.amount)}</Text>
          <Badge label={item.status} variant={getStatusVariant(item.status)} />
        </View>
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={invoices}
        renderItem={renderInvoice}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No billing history</Text>
            <Text style={styles.emptyText}>
              Your subscription invoices will appear here once your first billing cycle completes.
            </Text>
          </View>
        }
      />
    </View>
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
  invoiceCard: {
    marginBottom: THEME.spacing.md,
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  invoiceInfo: {
    flex: 1,
    marginRight: THEME.spacing.md,
  },
  invoiceDate: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
  },
  invoiceDesc: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  invoiceRight: {
    alignItems: 'flex-end',
    gap: THEME.spacing.xs,
  },
  invoiceAmount: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: THEME.spacing['2xl'],
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
    textAlign: 'center',
    lineHeight: 22,
  },
});
