import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { THEME } from '@casa/config';
import { Card, Button } from '@casa/ui';
import { ADD_ON_SERVICES } from '@casa/api';

export default function AddOnsScreen() {
  const handlePurchase = (serviceName: string, price: string) => {
    Alert.alert(
      `Purchase ${serviceName}`,
      `This will charge ${price} to your payment method. Would you like to proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purchase',
          onPress: () => {
            // In production, this creates a Stripe PaymentIntent for the add-on
            Alert.alert(
              'Stripe Integration Required',
              'Add-on purchases require Stripe integration. This will process when Stripe keys are configured.'
            );
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerText}>
        One-off professional services to help manage your properties.
      </Text>

      {ADD_ON_SERVICES.map(service => (
        <Card key={service.type} style={styles.serviceCard}>
          <View style={styles.serviceHeader}>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>{service.name}</Text>
              <Text style={styles.serviceDesc}>{service.description}</Text>
            </View>
            <Text style={styles.servicePrice}>{service.priceFormatted}</Text>
          </View>
          <Button
            title="Purchase"
            onPress={() => handlePurchase(service.name, service.priceFormatted)}
            style={styles.purchaseButton}
          />
        </Card>
      ))}

      <Card style={styles.infoCard}>
        <Text style={styles.infoTitle}>About Add-On Services</Text>
        <Text style={styles.infoText}>
          Add-on services are one-off charges processed separately from your subscription. A receipt will be emailed to you after purchase.
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
  headerText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.lg,
    lineHeight: 22,
  },
  serviceCard: {
    marginBottom: THEME.spacing.md,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: THEME.spacing.md,
  },
  serviceInfo: {
    flex: 1,
    marginRight: THEME.spacing.md,
  },
  serviceName: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
  },
  serviceDesc: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: THEME.spacing.xs,
    lineHeight: 20,
  },
  servicePrice: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.bold,
    color: THEME.colors.brand,
  },
  purchaseButton: {
    marginTop: THEME.spacing.sm,
  },
  infoCard: {
    marginTop: THEME.spacing.lg,
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
  },
});
