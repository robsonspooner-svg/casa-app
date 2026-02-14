// Process Arrears - Supabase Edge Function
// Casa - Mission 08: Arrears & Late Payment Management
//
// Scheduled function to detect overdue payments and create/update arrears records.
// Should be triggered daily via pg_cron or external scheduler (6am AEST recommended).
// Scans rent_schedules for unpaid entries past due date and manages arrears_records.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

interface ArrearsProcessResult {
  tenancyId: string;
  tenantId: string;
  action: 'created' | 'updated' | 'resolved' | 'skipped';
  totalOverdue?: number;
  daysOverdue?: number;
  error?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceClient();

    // Verify authorization (cron secret or admin JWT)
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedSecret = req.headers.get('X-Cron-Secret');

    let isAuthorized = false;

    if (cronSecret && providedSecret === cronSecret) {
      isAuthorized = true;
    } else if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (profile?.role === 'admin') {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: ArrearsProcessResult[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Find all unpaid rent schedules that are past due
    const { data: overdueSchedules, error: scheduleError } = await supabase
      .from('rent_schedules')
      .select(`
        id,
        tenancy_id,
        due_date,
        amount,
        tenancies!inner(
          id,
          status,
          tenancy_tenants(tenant_id)
        )
      `)
      .eq('is_paid', false)
      .lt('due_date', todayStr)
      .eq('tenancies.status', 'active');

    if (scheduleError) {
      console.error('Error fetching overdue schedules:', scheduleError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch overdue schedules' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${overdueSchedules?.length || 0} overdue rent schedules`);

    // Group overdue amounts by tenancy
    const tenancyArrears: Map<string, {
      tenantId: string;
      totalOverdue: number;
      firstOverdueDate: string;
      daysOverdue: number;
    }> = new Map();

    for (const schedule of overdueSchedules || []) {
      const tenancyId = schedule.tenancy_id;
      const tenants = (schedule as any).tenancies?.tenancy_tenants;
      const tenantId = tenants?.[0]?.tenant_id;

      if (!tenantId) {
        console.warn(`No tenant found for tenancy ${tenancyId}`);
        continue;
      }

      const dueDate = new Date(schedule.due_date);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      const existing = tenancyArrears.get(tenancyId);
      if (existing) {
        existing.totalOverdue += schedule.amount;
        if (schedule.due_date < existing.firstOverdueDate) {
          existing.firstOverdueDate = schedule.due_date;
          existing.daysOverdue = daysOverdue;
        }
      } else {
        tenancyArrears.set(tenancyId, {
          tenantId,
          totalOverdue: schedule.amount,
          firstOverdueDate: schedule.due_date,
          daysOverdue,
        });
      }
    }

    console.log(`Processing ${tenancyArrears.size} tenancies with arrears`);

    // Process each tenancy with arrears
    for (const [tenancyId, arrears] of tenancyArrears) {
      try {
        // Check if active arrears record exists
        const { data: existingArrears } = await supabase
          .from('arrears_records')
          .select('id, total_overdue, days_overdue')
          .eq('tenancy_id', tenancyId)
          .eq('is_resolved', false)
          .single();

        if (existingArrears) {
          // Update existing arrears record
          const { error: updateError } = await supabase
            .from('arrears_records')
            .update({
              total_overdue: arrears.totalOverdue / 100, // Convert cents to dollars
              days_overdue: arrears.daysOverdue,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingArrears.id);

          if (updateError) {
            console.error(`Error updating arrears for tenancy ${tenancyId}:`, updateError);
            results.push({
              tenancyId,
              tenantId: arrears.tenantId,
              action: 'skipped',
              error: updateError.message,
            });
          } else {
            results.push({
              tenancyId,
              tenantId: arrears.tenantId,
              action: 'updated',
              totalOverdue: arrears.totalOverdue / 100,
              daysOverdue: arrears.daysOverdue,
            });
          }
        } else {
          // Create new arrears record
          const { error: insertError } = await supabase
            .from('arrears_records')
            .insert({
              tenancy_id: tenancyId,
              tenant_id: arrears.tenantId,
              first_overdue_date: arrears.firstOverdueDate,
              total_overdue: arrears.totalOverdue / 100, // Convert cents to dollars
              days_overdue: arrears.daysOverdue,
              // severity is set automatically by trigger based on days_overdue
            });

          if (insertError) {
            console.error(`Error creating arrears for tenancy ${tenancyId}:`, insertError);
            results.push({
              tenancyId,
              tenantId: arrears.tenantId,
              action: 'skipped',
              error: insertError.message,
            });
          } else {
            results.push({
              tenancyId,
              tenantId: arrears.tenantId,
              action: 'created',
              totalOverdue: arrears.totalOverdue / 100,
              daysOverdue: arrears.daysOverdue,
            });
          }
        }
      } catch (err: any) {
        console.error(`Error processing tenancy ${tenancyId}:`, err);
        results.push({
          tenancyId,
          tenantId: arrears.tenantId,
          action: 'skipped',
          error: err.message,
        });
      }
    }

    // Check for arrears that should be resolved (all payments now made)
    const { data: activeArrears } = await supabase
      .from('arrears_records')
      .select('id, tenancy_id')
      .eq('is_resolved', false);

    for (const record of activeArrears || []) {
      // If tenancy no longer appears in our arrears map, check if all payments are made
      if (!tenancyArrears.has(record.tenancy_id)) {
        // Verify there are no more overdue payments
        const { data: overdueCheck } = await supabase
          .from('rent_schedules')
          .select('id')
          .eq('tenancy_id', record.tenancy_id)
          .eq('is_paid', false)
          .lt('due_date', todayStr)
          .limit(1);

        if (!overdueCheck || overdueCheck.length === 0) {
          // Resolve the arrears record
          const { error: resolveError } = await supabase
            .from('arrears_records')
            .update({
              is_resolved: true,
              resolved_at: new Date().toISOString(),
              resolved_reason: 'All overdue payments received',
            })
            .eq('id', record.id);

          if (!resolveError) {
            // Log the resolution action
            await supabase.from('arrears_actions').insert({
              arrears_record_id: record.id,
              action_type: 'payment_received',
              description: 'Arrears resolved - all overdue payments received',
              is_automated: true,
            });

            // Notify tenant and owner about arrears resolution
            try {
              const { data: arrearsDetail } = await supabase
                .from('arrears_records')
                .select(`
                  tenant_id,
                  total_overdue,
                  tenancies!inner(
                    properties!inner(
                      owner_id,
                      address_line_1,
                      suburb,
                      state,
                      postcode
                    )
                  )
                `)
                .eq('id', record.id)
                .single();

              if (arrearsDetail) {
                const prop = (arrearsDetail as any).tenancies?.properties;
                const propertyAddress = [prop?.address_line_1, prop?.suburb, prop?.state, prop?.postcode].filter(Boolean).join(', ');
                const amount = `$${((arrearsDetail as any).total_overdue || 0).toFixed(2)}`;

                // Notify tenant
                if ((arrearsDetail as any).tenant_id) {
                  await supabase.functions.invoke('dispatch-notification', {
                    body: {
                      user_id: (arrearsDetail as any).tenant_id,
                      type: 'arrears_resolved',
                      title: 'Arrears Resolved',
                      body: `Your arrears for ${propertyAddress} have been cleared. Thank you for your payment.`,
                      data: {
                        tenant_name: '',
                        property_address: propertyAddress,
                        amount,
                      },
                      channels: ['push', 'email'],
                    },
                  });
                }

                // Notify owner
                if (prop?.owner_id) {
                  const tenantName = (arrearsDetail as any).tenant_id
                    ? await supabase.from('profiles').select('full_name').eq('id', (arrearsDetail as any).tenant_id).single().then((r: any) => r.data?.full_name || 'Your tenant')
                    : 'Your tenant';

                  await supabase.functions.invoke('dispatch-notification', {
                    body: {
                      user_id: prop.owner_id,
                      type: 'arrears_resolved',
                      title: 'Arrears Resolved',
                      body: `${tenantName}'s arrears for ${propertyAddress} have been resolved.`,
                      data: {
                        tenant_name: tenantName,
                        property_address: propertyAddress,
                        amount,
                      },
                      channels: ['push', 'email'],
                    },
                  });
                }
              }
            } catch (notifErr) {
              console.error('Error dispatching arrears resolution notification:', notifErr);
            }

            results.push({
              tenancyId: record.tenancy_id,
              tenantId: '',
              action: 'resolved',
            });
          }
        }
      }
    }

    const created = results.filter(r => r.action === 'created').length;
    const updated = results.filter(r => r.action === 'updated').length;
    const resolved = results.filter(r => r.action === 'resolved').length;
    const skipped = results.filter(r => r.action === 'skipped').length;

    console.log(`Arrears processing complete: ${created} created, ${updated} updated, ${resolved} resolved, ${skipped} skipped`);

    return new Response(
      JSON.stringify({
        processed: results.length,
        created,
        updated,
        resolved,
        skipped,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Arrears processing error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
