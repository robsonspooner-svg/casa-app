-- =============================================================================
-- Mission 10 Fix: Tenant work order visibility and review capability
-- Tenants should be able to see work orders for their property and leave reviews
-- =============================================================================

-- Tenants can view work orders for properties they're tenants of
CREATE POLICY "Tenants can view work orders for their properties"
  ON work_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancy_tenants tt
      JOIN tenancies t ON tt.tenancy_id = t.id
      WHERE tt.tenant_id = auth.uid()
      AND t.property_id = work_orders.property_id
      AND t.status IN ('active', 'pending')
    )
  );
