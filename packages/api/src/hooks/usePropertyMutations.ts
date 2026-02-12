// usePropertyMutations Hook - Casa Property CRUD Operations
// Mission 03: Properties CRUD

import { useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';
import type {
  Property,
  PropertyInsert,
  PropertyUpdate,
  PropertyImage,
  PropertyImageInsert,
} from '../types/database';

export interface PropertyMutations {
  createProperty: (property: Omit<PropertyInsert, 'owner_id'>) => Promise<Property>;
  updateProperty: (id: string, updates: PropertyUpdate) => Promise<Property>;
  deleteProperty: (id: string) => Promise<void>;
  uploadPropertyImage: (
    propertyId: string,
    file: Blob,
    fileName: string,
    options?: { isPrimary?: boolean; displayOrder?: number }
  ) => Promise<PropertyImage>;
  deletePropertyImage: (imageId: string) => Promise<void>;
  setPrimaryImage: (propertyId: string, imageId: string) => Promise<void>;
}

export function usePropertyMutations(): PropertyMutations {
  const { user } = useAuth();

  const createProperty = useCallback(
    async (propertyData: Omit<PropertyInsert, 'owner_id'>): Promise<Property> => {
      if (!user) {
        throw new Error('Not authenticated');
      }

      const supabase = getSupabaseClient();

      const insertData: PropertyInsert = {
        ...propertyData,
        owner_id: user.id,
      };

      // Use type assertion to work around Supabase generic inference
      const { data, error } = await (supabase
        .from('properties') as ReturnType<typeof supabase.from>)
        .insert(insertData)
        .select()
        .single();

      if (error) throw new Error(error.message);

      // Auto-initialize compliance requirements for the property based on state
      const property = data as Property;
      if (property.id && property.state) {
        try {
          const { data: requirements } = await supabase
            .from('compliance_requirements')
            .select('id, frequency_months')
            .eq('state', property.state);

          if (requirements && requirements.length > 0) {
            const now = new Date();
            const complianceRecords = requirements.map((req: any) => {
              const nextDue = new Date(now);
              if (req.frequency_months > 0) {
                nextDue.setMonth(nextDue.getMonth() + req.frequency_months);
              }
              return {
                property_id: property.id,
                requirement_id: req.id,
                status: 'pending',
                next_due_date: req.frequency_months > 0 ? nextDue.toISOString().split('T')[0] : null,
              };
            });
            await (supabase.from('property_compliance') as ReturnType<typeof supabase.from>).insert(complianceRecords);
          }
        } catch { /* compliance init is best-effort — don't block property creation */ }
      }

      return property;
    },
    [user]
  );

  const updateProperty = useCallback(
    async (id: string, updates: PropertyUpdate): Promise<Property> => {
      if (!user) {
        throw new Error('Not authenticated');
      }

      const supabase = getSupabaseClient();

      const { data, error } = await (supabase
        .from('properties') as ReturnType<typeof supabase.from>)
        .update(updates)
        .eq('id', id)
        .eq('owner_id', user.id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as Property;
    },
    [user]
  );

  const deleteProperty = useCallback(
    async (id: string): Promise<void> => {
      if (!user) {
        throw new Error('Not authenticated');
      }

      const supabase = getSupabaseClient();

      // Soft delete - set deleted_at timestamp
      const { error } = await (supabase
        .from('properties') as ReturnType<typeof supabase.from>)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('owner_id', user.id);

      if (error) throw new Error(error.message);
    },
    [user]
  );

  const uploadPropertyImage = useCallback(
    async (
      propertyId: string,
      file: Blob,
      fileName: string,
      options?: { isPrimary?: boolean; displayOrder?: number }
    ): Promise<PropertyImage> => {
      if (!user) {
        throw new Error('Not authenticated');
      }

      const supabase = getSupabaseClient();

      // Generate unique file path
      const fileExt = fileName.split('.').pop() || 'jpg';
      const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const storagePath = `${user.id}/${propertyId}/${uniqueName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('property-images')
        .upload(storagePath, file, {
          contentType: file.type || 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw new Error(uploadError.message);

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('property-images').getPublicUrl(storagePath);

      // If setting as primary, unset existing primary
      if (options?.isPrimary) {
        await (supabase
          .from('property_images') as ReturnType<typeof supabase.from>)
          .update({ is_primary: false })
          .eq('property_id', propertyId);
      }

      // Insert image record
      const imageInsert: PropertyImageInsert = {
        property_id: propertyId,
        storage_path: storagePath,
        url: publicUrl,
        is_primary: options?.isPrimary ?? false,
        display_order: options?.displayOrder ?? 0,
      };

      const { data, error } = await (supabase
        .from('property_images') as ReturnType<typeof supabase.from>)
        .insert(imageInsert)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as PropertyImage;
    },
    [user]
  );

  const deletePropertyImage = useCallback(
    async (imageId: string): Promise<void> => {
      if (!user) {
        throw new Error('Not authenticated');
      }

      const supabase = getSupabaseClient();

      // Get image record first to get storage path
      const { data: image, error: fetchError } = await (supabase
        .from('property_images') as ReturnType<typeof supabase.from>)
        .select('storage_path, property_id')
        .eq('id', imageId)
        .single();

      if (fetchError) throw new Error(fetchError.message);

      const imageData = image as { storage_path: string; property_id: string };

      // Verify ownership via property
      const { data: property, error: propertyError } = await (supabase
        .from('properties') as ReturnType<typeof supabase.from>)
        .select('owner_id')
        .eq('id', imageData.property_id)
        .single();

      if (propertyError) throw new Error(propertyError.message);
      if ((property as { owner_id: string }).owner_id !== user.id) {
        throw new Error('Unauthorized');
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('property-images')
        .remove([imageData.storage_path]);

      if (storageError) throw new Error(storageError.message);

      // Delete record
      const { error: deleteError } = await (supabase
        .from('property_images') as ReturnType<typeof supabase.from>)
        .delete()
        .eq('id', imageId);

      if (deleteError) throw new Error(deleteError.message);
    },
    [user]
  );

  const setPrimaryImage = useCallback(
    async (propertyId: string, imageId: string): Promise<void> => {
      if (!user) {
        throw new Error('Not authenticated');
      }

      const supabase = getSupabaseClient();

      // Unset all primary images for this property
      await (supabase
        .from('property_images') as ReturnType<typeof supabase.from>)
        .update({ is_primary: false })
        .eq('property_id', propertyId);

      // Set the new primary
      const { error } = await (supabase
        .from('property_images') as ReturnType<typeof supabase.from>)
        .update({ is_primary: true })
        .eq('id', imageId)
        .eq('property_id', propertyId);

      if (error) throw new Error(error.message);
    },
    [user]
  );

  return {
    createProperty,
    updateProperty,
    deleteProperty,
    uploadPropertyImage,
    deletePropertyImage,
    setPrimaryImage,
  };
}
