// New Conversation - Tenant View
// Mission 12: In-App Communications
// Tenant picks which property/landlord to message
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { useAuth, useMyTenancy, useMessageMutations } from '@casa/api';
import { getSupabaseClient } from '@casa/api/src/client';

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

interface OwnerOption {
  id: string;
  full_name: string | null;
  property_address: string;
  property_id: string;
  tenancy_id: string;
}

export default function TenantNewConversation() {
  const { user } = useAuth();
  const { tenancy, loading: loadingTenancy } = useMyTenancy();
  const { createConversation } = useMessageMutations();
  const [owners, setOwners] = useState<OwnerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Fetch owners from the tenant's tenancies
  useEffect(() => {
    if (!user || !tenancy) {
      setLoading(false);
      return;
    }

    const fetchOwners = async () => {
      try {
        const supabase = getSupabaseClient();

        // Get property details
        const { data: property } = await supabase
          .from('properties')
          .select('id, owner_id, address_line_1, suburb')
          .eq('id', tenancy.property_id)
          .single();

        if (!property) {
          setLoading(false);
          return;
        }

        // Get owner profile
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('id', (property as any).owner_id)
          .single();

        if (ownerProfile) {
          setOwners([{
            id: (ownerProfile as any).id,
            full_name: (ownerProfile as any).full_name,
            property_address: `${(property as any).address_line_1}, ${(property as any).suburb}`,
            property_id: (property as any).id,
            tenancy_id: tenancy.id,
          }]);
        }
      } catch {
        // Silently handle errors
      } finally {
        setLoading(false);
      }
    };

    fetchOwners();
  }, [user, tenancy]);

  const handleSelectOwner = async (owner: OwnerOption) => {
    if (creating) return;
    setCreating(true);

    try {
      const conversationId = await createConversation({
        participant_ids: [owner.id],
        conversation_type: 'direct',
        property_id: owner.property_id,
        tenancy_id: owner.tenancy_id,
      });

      router.replace(`/(app)/messages/${conversationId}` as any);
    } catch {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={THEME.colors.textPrimary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Message</Text>
        <View style={styles.headerRight} />
      </View>

      {loading || loadingTenancy ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      ) : owners.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            No landlords found. You need an active tenancy to start a conversation.
          </Text>
        </View>
      ) : (
        <FlatList
          data={owners}
          keyExtractor={item => `${item.id}-${item.tenancy_id}`}
          ListHeaderComponent={
            <Text style={styles.sectionLabel}>Your Landlord</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.ownerRow}
              onPress={() => handleSelectOwner(item)}
              disabled={creating}
              activeOpacity={0.7}
            >
              <View style={styles.ownerAvatar}>
                <Text style={styles.ownerAvatarText}>{getInitials(item.full_name)}</Text>
              </View>
              <View style={styles.ownerInfo}>
                <Text style={styles.ownerName}>{item.full_name || 'Your Landlord'}</Text>
                <Text style={styles.ownerProperty}>{item.property_address}</Text>
              </View>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M9 18l6-6-6-6" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}

      {creating && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
          <Text style={styles.overlayText}>Starting conversation...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.base,
    paddingVertical: THEME.spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: THEME.fontSize.h2,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  headerRight: {
    width: 44,
  },
  sectionLabel: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: THEME.spacing.sm,
  },
  listContent: {
    paddingHorizontal: THEME.spacing.base,
    paddingTop: THEME.spacing.md,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.base,
    ...THEME.shadow.sm,
  },
  ownerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: THEME.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: THEME.spacing.sm,
  },
  ownerAvatarText: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: '#FFFFFF',
  },
  ownerInfo: {
    flex: 1,
  },
  ownerName: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.semibold as any,
    color: THEME.colors.textPrimary,
  },
  ownerProperty: {
    fontSize: THEME.fontSize.caption,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.xl,
  },
  emptyText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: THEME.spacing.md,
  },
  overlayText: {
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textSecondary,
  },
});
