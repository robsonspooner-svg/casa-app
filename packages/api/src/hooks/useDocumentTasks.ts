// useDocumentTasks — Smart document upload task detection
// Checks what key documents are missing per property and generates
// actionable upload tasks for the Activity feed

import { useState, useEffect, useMemo } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';

export interface DocumentTask {
  id: string;
  property_id: string;
  property_address: string;
  task_type: DocumentTaskType;
  title: string;
  description: string;
  priority: 'high' | 'normal';
  icon: 'shield' | 'file' | 'dollar' | 'home' | 'key';
  route: string; // Deep link route for navigation
  category: string;
}

export type DocumentTaskType =
  | 'upload_insurance'
  | 'upload_council_rates'
  | 'upload_strata_levy'
  | 'upload_water_rates'
  | 'upload_land_tax'
  | 'upload_lease'
  | 'renew_insurance'
  | 'update_rates';

const TASK_CONFIG: Record<DocumentTaskType, {
  title: string;
  description: string;
  icon: DocumentTask['icon'];
  category: string;
  priority: DocumentTask['priority'];
}> = {
  upload_insurance: {
    title: 'Upload insurance certificate',
    description: 'Snap a photo of your landlord insurance policy. Casa will track the expiry and remind you before renewal.',
    icon: 'shield',
    category: 'Insurance',
    priority: 'high',
  },
  upload_council_rates: {
    title: 'Upload council rate notice',
    description: 'Take a photo of your latest rates notice. Casa will track due dates and record the expense for tax.',
    icon: 'dollar',
    category: 'Council Rates',
    priority: 'normal',
  },
  upload_strata_levy: {
    title: 'Upload strata levy notice',
    description: 'Snap your latest strata/body corporate levy notice. Casa will track quarterly payments and due dates.',
    icon: 'home',
    category: 'Strata',
    priority: 'normal',
  },
  upload_water_rates: {
    title: 'Upload water rates notice',
    description: 'Photo your water bill. Casa will track usage, amounts, and due dates for each billing period.',
    icon: 'dollar',
    category: 'Water Rates',
    priority: 'normal',
  },
  upload_land_tax: {
    title: 'Upload land tax assessment',
    description: 'Photo your land tax assessment. Casa will track the amount and due date for tax planning.',
    icon: 'dollar',
    category: 'Land Tax',
    priority: 'normal',
  },
  upload_lease: {
    title: 'Upload existing lease',
    description: 'Snap a photo of your current lease agreement. Casa will extract the key terms and track important dates.',
    icon: 'key',
    category: 'Lease',
    priority: 'high',
  },
  renew_insurance: {
    title: 'Insurance expiring soon',
    description: 'Your landlord insurance is expiring. Upload the renewal certificate when ready.',
    icon: 'shield',
    category: 'Insurance',
    priority: 'high',
  },
  update_rates: {
    title: 'New rates notice due',
    description: 'Your council rates period is ending. Upload the new notice when it arrives.',
    icon: 'dollar',
    category: 'Council Rates',
    priority: 'normal',
  },
};

export interface UseDocumentTasksReturn {
  tasks: DocumentTask[];
  loading: boolean;
  dismissTask: (taskId: string) => void;
  completedCount: number;
  totalCount: number;
}

export function useDocumentTasks(): UseDocumentTasksReturn {
  const { user } = useAuth();
  const [properties, setProperties] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [compliance, setCompliance] = useState<any[]>([]);
  const [tenancies, setTenancies] = useState<any[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const supabase = getSupabaseClient();

    async function fetchData() {
      setLoading(true);
      try {
        // Fetch properties
        const { data: props } = await supabase
          .from('properties')
          .select('id, address_line_1, property_type, strata_plan_number')
          .eq('owner_id', user!.id);

        // Fetch existing documents by type
        const { data: docs } = await supabase
          .from('documents')
          .select('id, property_id, document_type, created_at')
          .eq('owner_id', user!.id)
          .in('document_type', ['insurance_certificate', 'council_rates', 'strata_levy', 'water_rates', 'land_tax', 'lease']);

        // Fetch compliance items with expiry info
        const { data: comp } = await supabase
          .from('property_compliance')
          .select('id, property_id, requirement_id, status, next_due_date, certificate_url, requirement:compliance_requirements(name, category)')
          .in('property_id', (props || []).map((p: any) => p.id));

        // Fetch active tenancies
        const { data: tens } = await supabase
          .from('tenancies')
          .select('id, property_id, status, lease_start_date, lease_end_date')
          .in('property_id', (props || []).map((p: any) => p.id))
          .in('status', ['active', 'pending']);

        setProperties(props || []);
        setDocuments(docs || []);
        setCompliance(comp || []);
        setTenancies(tens || []);
      } catch (err) {
        console.error('Failed to fetch document tasks data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user?.id]);

  const tasks = useMemo(() => {
    if (!properties.length) return [];

    const result: DocumentTask[] = [];
    const now = new Date();

    for (const property of properties) {
      const propDocs = documents.filter(d => d.property_id === property.id);
      const propComp = compliance.filter(c => c.property_id === property.id);
      const propTenancy = tenancies.find(t => t.property_id === property.id);
      const addr = property.address_line_1 || 'Property';

      // Check for missing insurance
      const hasInsurance = propDocs.some(d => d.document_type === 'insurance_certificate');
      const insuranceComp = propComp.find(c =>
        c.requirement?.category === 'insurance' || c.requirement?.name?.toLowerCase().includes('insurance')
      );
      const insuranceExpiringSoon = insuranceComp?.next_due_date &&
        new Date(insuranceComp.next_due_date) < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      if (!hasInsurance && !insuranceExpiringSoon) {
        const config = TASK_CONFIG.upload_insurance;
        result.push({
          id: `${property.id}_upload_insurance`,
          property_id: property.id,
          property_address: addr,
          task_type: 'upload_insurance',
          title: config.title,
          description: config.description,
          priority: config.priority,
          icon: config.icon,
          route: `/(app)/documents/upload?type=insurance_certificate&property_id=${property.id}`,
          category: config.category,
        });
      } else if (insuranceExpiringSoon) {
        const config = TASK_CONFIG.renew_insurance;
        result.push({
          id: `${property.id}_renew_insurance`,
          property_id: property.id,
          property_address: addr,
          task_type: 'renew_insurance',
          title: config.title,
          description: config.description,
          priority: config.priority,
          icon: config.icon,
          route: `/(app)/documents/upload?type=insurance_certificate&property_id=${property.id}`,
          category: config.category,
        });
      }

      // Check for missing council rates
      const hasRates = propDocs.some(d => d.document_type === 'council_rates');
      if (!hasRates) {
        const config = TASK_CONFIG.upload_council_rates;
        result.push({
          id: `${property.id}_upload_council_rates`,
          property_id: property.id,
          property_address: addr,
          task_type: 'upload_council_rates',
          title: config.title,
          description: config.description,
          priority: config.priority,
          icon: config.icon,
          route: `/(app)/documents/upload?type=council_rates&property_id=${property.id}`,
          category: config.category,
        });
      }

      // Check for missing strata (only if property has strata)
      const isStrata = property.property_type === 'apartment' ||
        property.property_type === 'unit' ||
        property.property_type === 'townhouse' ||
        property.strata_plan_number;
      if (isStrata) {
        const hasStrata = propDocs.some(d => d.document_type === 'strata_levy');
        if (!hasStrata) {
          const config = TASK_CONFIG.upload_strata_levy;
          result.push({
            id: `${property.id}_upload_strata_levy`,
            property_id: property.id,
            property_address: addr,
            task_type: 'upload_strata_levy',
            title: config.title,
            description: config.description,
            priority: config.priority,
            icon: config.icon,
            route: `/(app)/documents/upload?type=strata_levy&property_id=${property.id}`,
            category: config.category,
          });
        }
      }

      // Check for missing lease (only if active tenancy without a lease doc)
      if (propTenancy) {
        const hasLease = propDocs.some(d => d.document_type === 'lease');
        if (!hasLease) {
          const config = TASK_CONFIG.upload_lease;
          result.push({
            id: `${property.id}_upload_lease`,
            property_id: property.id,
            property_address: addr,
            task_type: 'upload_lease',
            title: config.title,
            description: config.description,
            priority: config.priority,
            icon: config.icon,
            route: `/(app)/documents/upload?type=lease_document&property_id=${property.id}`,
            category: config.category,
          });
        }
      }
    }

    // Filter out dismissed tasks and sort by priority
    return result
      .filter(t => !dismissed.has(t.id))
      .sort((a, b) => {
        if (a.priority === 'high' && b.priority !== 'high') return -1;
        if (a.priority !== 'high' && b.priority === 'high') return 1;
        return 0;
      });
  }, [properties, documents, compliance, tenancies, dismissed]);

  const dismissTask = (taskId: string) => {
    setDismissed(prev => new Set([...prev, taskId]));
  };

  const totalCount = properties.length * 3; // Rough count: insurance + rates + lease per property
  const completedCount = totalCount - tasks.length;

  return {
    tasks,
    loading,
    dismissTask,
    completedCount,
    totalCount,
  };
}
