import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { Card, Button, Input } from '@casa/ui';

type MethodType = 'card' | 'becs';

export default function AddPaymentMethodScreen() {
  const [selectedType, setSelectedType] = useState<MethodType>('card');

  const handleAddMethod = () => {
    // In production, this would open the Stripe payment sheet
    // or collect card/BECS details via Stripe Elements
    Alert.alert(
      'Stripe Integration Required',
      'Payment method collection requires Stripe SDK integration. This will open the Stripe payment sheet when Stripe keys are configured.',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Choose method type</Text>

      <View style={styles.typeOptions}>
        <TouchableOpacity
          style={[styles.typeCard, selectedType === 'card' && styles.typeCardSelected]}
          onPress={() => setSelectedType('card')}
        >
          <View style={styles.typeIcon}>
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
              <Path d="M21 4H3a2 2 0 00-2 2v12a2 2 0 002 2h18a2 2 0 002-2V6a2 2 0 00-2-2z" stroke={selectedType === 'card' ? THEME.colors.brand : THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M1 10h22" stroke={selectedType === 'card' ? THEME.colors.brand : THEME.colors.textSecondary} strokeWidth={1.5} />
            </Svg>
          </View>
          <Text style={[styles.typeName, selectedType === 'card' && styles.typeNameSelected]}>
            Credit/Debit Card
          </Text>
          <Text style={styles.typeDesc}>Visa, Mastercard, Amex</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.typeCard, selectedType === 'becs' && styles.typeCardSelected]}
          onPress={() => setSelectedType('becs')}
        >
          <View style={styles.typeIcon}>
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
              <Path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4" stroke={selectedType === 'becs' ? THEME.colors.brand : THEME.colors.textSecondary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <Text style={[styles.typeName, selectedType === 'becs' && styles.typeNameSelected]}>
            Bank Account (BECS)
          </Text>
          <Text style={styles.typeDesc}>AU Direct Debit</Text>
        </TouchableOpacity>
      </View>

      {selectedType === 'becs' && (
        <Card style={styles.becsInfo}>
          <Text style={styles.becsTitle}>About BECS Direct Debit</Text>
          <Text style={styles.becsText}>
            BECS Direct Debit allows automatic payments from your Australian bank account. Lower fees than card payments (capped at $3.50). Processing takes 3-4 business days.
          </Text>
          <View style={styles.becsDetail}>
            <Text style={styles.becsLabel}>You will need:</Text>
            <Text style={styles.becsItem}>BSB number (6 digits)</Text>
            <Text style={styles.becsItem}>Account number</Text>
            <Text style={styles.becsItem}>Account holder name</Text>
          </View>
        </Card>
      )}

      <Button
        title={selectedType === 'card' ? 'Add Card' : 'Add Bank Account'}
        onPress={handleAddMethod}
        style={styles.addButton}
      />

      <Text style={styles.securityNote}>
        Your payment details are securely handled by Stripe. Casa never stores your full card number or bank details.
      </Text>
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
  sectionTitle: {
    fontSize: THEME.fontSize.h3,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.base,
  },
  typeOptions: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
    marginBottom: THEME.spacing.lg,
  },
  typeCard: {
    flex: 1,
    alignItems: 'center',
    padding: THEME.spacing.base,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  typeCardSelected: {
    borderColor: THEME.colors.brand,
    backgroundColor: '#F5F3FF',
  },
  typeIcon: {
    marginBottom: THEME.spacing.sm,
  },
  typeName: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
    textAlign: 'center',
  },
  typeNameSelected: {
    color: THEME.colors.brand,
  },
  typeDesc: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  becsInfo: {
    marginBottom: THEME.spacing.lg,
    backgroundColor: THEME.colors.infoBg,
  },
  becsTitle: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold,
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.sm,
  },
  becsText: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    lineHeight: 20,
    marginBottom: THEME.spacing.md,
  },
  becsDetail: {
    gap: THEME.spacing.xs,
  },
  becsLabel: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.medium,
    color: THEME.colors.textPrimary,
    marginBottom: 2,
  },
  becsItem: {
    fontSize: THEME.fontSize.bodySmall,
    color: THEME.colors.textSecondary,
    paddingLeft: THEME.spacing.md,
  },
  addButton: {
    marginBottom: THEME.spacing.base,
  },
  securityNote: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textTertiary,
    textAlign: 'center',
    lineHeight: 16,
  },
});
