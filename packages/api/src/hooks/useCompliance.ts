// Mission 15: Compliance Tracking Hook
// Manages property compliance status, reminders, and compliance calendar

import { useState, useCallback, useEffect } from 'react';
import { getSupabaseClient } from '../client';
import type {
  PropertyCompliance,
  PropertyComplianceUpdate,
  ComplianceRequirement,
  ComplianceStatus,
} from '../types/database';

export interface ComplianceState {
  items: PropertyCompliance[];
  requirements: ComplianceRequirement[];
  loading: boolean;
  error: string | null;
}

export interface ComplianceSummary {
  total: number;
  compliant: number;
  overdue: number;
  upcoming: number;
  pending: number;
}

export interface UseComplianceReturn extends ComplianceState {
  refetch: () => Promise<void>;
  summary: ComplianceSummary;
  overdueItems: PropertyCompliance[];
  upcomingItems: PropertyCompliance[];
  initializePropertyCompliance: (propertyId: string, state: string) => Promise<void>;
  recordCompletion: (complianceId: string, data: {
    certificate_url?: string;
    completed_by?: string;
    evidence_urls?: string[];
    notes?: string;
  }) => Promise<void>;
  markExempt: (complianceId: string, notes: string) => Promise<void>;
  uploadEvidencePhotos: (localUris: string[]) => Promise<string[]>;
}

export function useCompliance(propertyId?: string): UseComplianceReturn {
  const [items, setItems] = useState<PropertyCompliance[]>([]);
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompliance = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const supabase = getSupabaseClient();

      // Fetch requirements
      const { data: reqData } = await supabase
        .from('compliance_requirements' as any)
        .select('*')
        .order('state', { ascending: true });

      setRequirements((reqData as ComplianceRequirement[]) || []);

      // Fetch compliance items with requirement and property details
      let query = supabase
        .from('property_compliance' as any)
        .select(`
          *,
          requirement:compliance_requirements(*),
          property:properties!inner(id, address_line_1, suburb, state, owner_id)
        `)
        .order('next_due_date', { ascending: true });

      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      const { data, error: fetchErr } = await query;

      if (fetchErr) throw fetchErr;
      setItems((data as PropertyCompliance[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch compliance');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchCompliance();
  }, [fetchCompliance]);

  const summary: ComplianceSummary = {
    total: items.length,
    compliant: items.filter(i => i.status === 'compliant').length,
    overdue: items.filter(i => i.status === 'overdue').length,
    upcoming: items.filter(i => i.status === 'upcoming').length,
    pending: items.filter(i => i.status === 'pending').length,
  };

  const overdueItems = items.filter(i => i.status === 'overdue');
  const upcomingItems = items.filter(i => {
    if (!i.next_due_date) return false;
    const daysUntil = Math.ceil(
      (new Date(i.next_due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return daysUntil > 0 && daysUntil <= 90;
  });

  const initializePropertyCompliance = useCallback(async (propId: string, state: string) => {
    const supabase = getSupabaseClient();

    // Get requirements for this state
    const { data: rawReqs } = await supabase
      .from('compliance_requirements' as any)
      .select('*')
      .eq('state', state);

    const reqs = (rawReqs as ComplianceRequirement[]) || [];
    if (reqs.length === 0) return;

    // Create compliance records for mandatory requirements
    const inserts = reqs
      .filter(r => r.is_mandatory)
      .map(r => {
        let nextDue: string | null = null;
        if (r.frequency_months != null && r.frequency_months > 0) {
          const d = new Date();
          d.setMonth(d.getMonth() + r.frequency_months);
          nextDue = d.toISOString();
        }
        return {
          property_id: propId,
          requirement_id: r.id,
          status: 'pending' as ComplianceStatus,
          next_due_date: nextDue,
        };
      });

    if (inserts.length > 0) {
      const compTable = supabase.from('property_compliance' as any) as any;
      await compTable.upsert(inserts, { onConflict: 'property_id,requirement_id' });
    }

    await fetchCompliance();
  }, [fetchCompliance]);

  const recordCompletion = useCallback(async (complianceId: string, data: {
    certificate_url?: string;
    completed_by?: string;
    evidence_urls?: string[];
    notes?: string;
  }) => {
    const supabase = getSupabaseClient();
    const item = items.find(i => i.id === complianceId);
    if (!item) return;

    // Calculate next due date using proper month arithmetic
    const req = item.requirement;
    let nextDue: string | null = null;
    if (req && req.frequency_months != null && req.frequency_months > 0) {
      const d = new Date();
      d.setMonth(d.getMonth() + req.frequency_months);
      nextDue = d.toISOString();
    }

    const update: PropertyComplianceUpdate = {
      status: 'compliant',
      last_completed_at: new Date().toISOString(),
      next_due_date: nextDue,
      certificate_url: data.certificate_url,
      completed_by: data.completed_by,
      evidence_urls: data.evidence_urls,
      notes: data.notes,
    };

    const complianceTable = supabase.from('property_compliance' as any) as any;
    const { error: err } = await complianceTable
      .update(update)
      .eq('id', complianceId);

    if (err) throw err;

    setItems(prev => prev.map(i =>
      i.id === complianceId ? { ...i, ...update } : i
    ));
  }, [items]);

  const markExempt = useCallback(async (complianceId: string, notes: string) => {
    const supabase = getSupabaseClient();
    const complianceTable2 = supabase.from('property_compliance' as any) as any;
    const { error: err } = await complianceTable2
      .update({ status: 'exempt' as ComplianceStatus, notes })
      .eq('id', complianceId);

    if (err) throw err;

    setItems(prev => prev.map(i =>
      i.id === complianceId ? { ...i, status: 'exempt' as ComplianceStatus, notes } : i
    ));
  }, []);

  const uploadEvidencePhotos = useCallback(async (localUris: string[]): Promise<string[]> => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const uploadedUrls: string[] = [];
    for (const uri of localUris) {
      const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;

      // Fetch local file as blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Max 10MB per photo
      if (blob.size > 10 * 1024 * 1024) {
        throw new Error('Photo exceeds 10MB limit. Please use a smaller image.');
      }

      const { error: uploadError } = await supabase.storage
        .from('compliance-evidence')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('compliance-evidence')
        .getPublicUrl(fileName);

      uploadedUrls.push(urlData.publicUrl);
    }

    return uploadedUrls;
  }, []);

  return {
    items,
    requirements,
    loading,
    error,
    summary,
    overdueItems,
    upcomingItems,
    refetch: fetchCompliance,
    initializePropertyCompliance,
    recordCompletion,
    markExempt,
    uploadEvidencePhotos,
  };
}
