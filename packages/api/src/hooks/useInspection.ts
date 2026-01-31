// useInspection Hook - Single Inspection Detail
// Mission 11: Property Inspections

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  InspectionRow,
  InspectionRoomRow,
  InspectionItemRow,
  InspectionImageRow,
  InspectionWithDetails,
  Property,
  Tenancy,
} from '../types/database';

export interface InspectionState {
  inspection: InspectionWithDetails | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
}

export function useInspection(inspectionId: string | null): InspectionState & {
  refreshInspection: () => Promise<void>;
} {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<InspectionState>({
    inspection: null,
    loading: true,
    error: null,
    refreshing: false,
  });

  const fetchInspection = useCallback(async (isRefresh = false) => {
    if (!user || !inspectionId) {
      setState({ inspection: null, loading: false, error: null, refreshing: false });
      return;
    }

    setState(prev => ({
      ...prev,
      loading: !isRefresh,
      refreshing: isRefresh,
      error: null,
    }));

    try {
      const supabase = getSupabaseClient();

      // Fetch the inspection
      const { data: inspectionData, error: inspectionError } = await (supabase
        .from('inspections') as ReturnType<typeof supabase.from>)
        .select('*')
        .eq('id', inspectionId)
        .single();

      if (inspectionError) throw inspectionError;
      if (!inspectionData) throw new Error('Inspection not found');

      const inspection = inspectionData as InspectionRow;

      // Fetch related data in parallel
      const [roomsResult, imagesResult, propertyResult, tenancyResult] = await Promise.all([
        (supabase
          .from('inspection_rooms') as ReturnType<typeof supabase.from>)
          .select('*')
          .eq('inspection_id', inspectionId)
          .order('display_order', { ascending: true }),

        (supabase
          .from('inspection_images') as ReturnType<typeof supabase.from>)
          .select('*')
          .eq('inspection_id', inspectionId)
          .order('created_at', { ascending: true }),

        supabase
          .from('properties')
          .select('*')
          .eq('id', inspection.property_id)
          .single(),

        inspection.tenancy_id
          ? (supabase
              .from('tenancies') as ReturnType<typeof supabase.from>)
              .select('*')
              .eq('id', inspection.tenancy_id)
              .single()
          : Promise.resolve({ data: null }),
      ]);

      const rooms = (roomsResult.data || []) as InspectionRoomRow[];
      const allImages = (imagesResult.data || []) as InspectionImageRow[];

      // For each room, fetch its items
      const roomIds = rooms.map(r => r.id);
      let items: InspectionItemRow[] = [];
      if (roomIds.length > 0) {
        const { data: itemsData } = await (supabase
          .from('inspection_items') as ReturnType<typeof supabase.from>)
          .select('*')
          .in('room_id', roomIds)
          .order('display_order', { ascending: true });
        items = (itemsData || []) as InspectionItemRow[];
      }

      // Group items and images by room
      const roomsWithDetails = rooms.map(room => ({
        ...room,
        items: items.filter(item => item.room_id === room.id),
        images: allImages.filter(img => img.room_id === room.id),
      }));

      const enriched: InspectionWithDetails = {
        ...inspection,
        rooms: roomsWithDetails,
        images: allImages,
        property: (propertyResult.data ?? undefined) as Property | undefined,
        tenancy: (tenancyResult.data ?? undefined) as Tenancy | undefined,
      };

      setState({
        inspection: enriched,
        loading: false,
        error: null,
        refreshing: false,
      });
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to fetch inspection';
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: errorMessage,
      }));
    }
  }, [user, inspectionId]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchInspection();
    }
  }, [fetchInspection, isAuthenticated]);

  const refreshInspection = useCallback(async () => {
    await fetchInspection(true);
  }, [fetchInspection]);

  return {
    ...state,
    refreshInspection,
  };
}
