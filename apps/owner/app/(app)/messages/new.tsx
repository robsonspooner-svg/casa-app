// New Conversation - Owner View
// Mission 12: In-App Communications
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { THEME } from '@casa/config';
import { useAuth, useTenancies, useMessageMutations } from '@casa/api';
import type { Profile } from '@casa/api';

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

interface TenantOption {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  property_address: string;
  property_id: string;
  tenancy_id: string;
}

export default function NewConversation() {
  const { user } = useAuth();
  const { tenancies, loading: loadingTenancies } = useTenancies({ status: 'active' });
  const { createConversation } = useMessageMutations();

  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  // Build tenant options from tenancies
  const tenantOptions: TenantOption[] = [];
  tenancies.forEach(tenancy => {
    if (tenancy.tenants) {
      tenancy.tenants.forEach((t: any) => {
        if (t.tenant) {
          tenantOptions.push({
            id: t.tenant.id,
            full_name: t.tenant.full_name,
            avatar_url: t.tenant.avatar_url,
            property_address: tenancy.property
              ? `${tenancy.property.address_line_1}, ${tenancy.property.suburb}`
              : 'Unknown property',
            property_id: tenancy.property_id,
            tenancy_id: tenancy.id,
          });
        }
      });
    }
  });

  // Filter by search
  const filtered = search.trim()
    ? tenantOptions.filter(t =>
        (t.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
        t.property_address.toLowerCase().includes(search.toLowerCase())
      )
    : tenantOptions;

  const handleSelectTenant = async (tenant: TenantOption) => {
    if (creating) return;
    setCreating(true);

    try {
      const conversationId = await createConversation({
        participant_ids: [tenant.id],
        conversation_type: 'direct',
        property_id: tenant.property_id,
        tenancy_id: tenant.tenancy_id,
      });

      router.replace(`/(app)/messages/${conversationId}` as any);
    } catch (err) {
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

      <View style={styles.searchContainer}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" style={styles.searchIcon}>
          <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <TextInput
          style={styles.searchInput}
          placeholder="Search tenants..."
          placeholderTextColor={THEME.colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loadingTenancies ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={THEME.colors.brand} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            {tenantOptions.length === 0
              ? 'No active tenants found. Add a tenant to a tenancy first.'
              : 'No tenants match your search.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => `${item.id}-${item.tenancy_id}`}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.tenantRow}
              onPress={() => handleSelectTenant(item)}
              disabled={creating}
              activeOpacity={0.7}
            >
              <View style={styles.tenantAvatar}>
                <Text style={styles.tenantAvatarText}>{getInitials(item.full_name)}</Text>
              </View>
              <View style={styles.tenantInfo}>
                <Text style={styles.tenantName}>{item.full_name || 'Unknown'}</Text>
                <Text style={styles.tenantProperty}>{item.property_address}</Text>
              </View>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M9 18l6-6-6-6" stroke={THEME.colors.textTertiary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: THEME.spacing.base,
    marginBottom: THEME.spacing.md,
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingHorizontal: THEME.spacing.sm,
  },
  searchIcon: {
    marginRight: THEME.spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: THEME.fontSize.body,
    color: THEME.colors.textPrimary,
    paddingVertical: THEME.spacing.sm,
  },
  listContent: {
    paddingHorizontal: THEME.spacing.base,
  },
  tenantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: THEME.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  tenantAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: THEME.spacing.sm,
  },
  tenantAvatarText: {
    fontSize: THEME.fontSize.bodySmall,
    fontWeight: THEME.fontWeight.semibold as any,
    color: '#FFFFFF',
  },
  tenantInfo: {
    flex: 1,
  },
  tenantName: {
    fontSize: THEME.fontSize.body,
    fontWeight: THEME.fontWeight.medium as any,
    color: THEME.colors.textPrimary,
  },
  tenantProperty: {
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
