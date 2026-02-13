-- Platform-wide cost intelligence: aggregate completed work order costs
-- by category, state, and postcode for data-driven cost estimates.

-- RPC function that returns cost statistics for a given category and location.
-- Falls back gracefully: tries postcode match first, then state, then category-wide.
CREATE OR REPLACE FUNCTION get_cost_intelligence(
  p_category maintenance_category,
  p_postcode TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  postcode_stats JSON;
  state_stats JSON;
  national_stats JSON;
BEGIN
  -- Level 1: Postcode-level stats (most specific)
  IF p_postcode IS NOT NULL THEN
    SELECT json_build_object(
      'level', 'postcode',
      'postcode', p_postcode,
      'sample_size', COUNT(*),
      'low', PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY wo.final_amount),
      'mid', PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY wo.final_amount),
      'high', PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY wo.final_amount),
      'min', MIN(wo.final_amount),
      'max', MAX(wo.final_amount),
      'avg', ROUND(AVG(wo.final_amount), 2)
    ) INTO postcode_stats
    FROM work_orders wo
    JOIN properties p ON p.id = wo.property_id
    WHERE wo.category = p_category
      AND wo.status = 'completed'
      AND wo.final_amount IS NOT NULL
      AND wo.final_amount > 0
      AND p.postcode = p_postcode;

    IF (postcode_stats->>'sample_size')::int >= 3 THEN
      RETURN postcode_stats;
    END IF;
  END IF;

  -- Level 2: State-level stats
  IF p_state IS NOT NULL THEN
    SELECT json_build_object(
      'level', 'state',
      'state', p_state,
      'sample_size', COUNT(*),
      'low', PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY wo.final_amount),
      'mid', PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY wo.final_amount),
      'high', PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY wo.final_amount),
      'min', MIN(wo.final_amount),
      'max', MAX(wo.final_amount),
      'avg', ROUND(AVG(wo.final_amount), 2)
    ) INTO state_stats
    FROM work_orders wo
    JOIN properties p ON p.id = wo.property_id
    WHERE wo.category = p_category
      AND wo.status = 'completed'
      AND wo.final_amount IS NOT NULL
      AND wo.final_amount > 0
      AND p.state = p_state;

    IF (state_stats->>'sample_size')::int >= 3 THEN
      RETURN state_stats;
    END IF;
  END IF;

  -- Level 3: National stats (least specific)
  SELECT json_build_object(
    'level', 'national',
    'sample_size', COUNT(*),
    'low', PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY wo.final_amount),
    'mid', PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY wo.final_amount),
    'high', PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY wo.final_amount),
    'min', MIN(wo.final_amount),
    'max', MAX(wo.final_amount),
    'avg', ROUND(AVG(wo.final_amount), 2)
  ) INTO national_stats
  FROM work_orders wo
  WHERE wo.category = p_category
    AND wo.status = 'completed'
    AND wo.final_amount IS NOT NULL
    AND wo.final_amount > 0;

  IF (national_stats->>'sample_size')::int >= 1 THEN
    RETURN national_stats;
  END IF;

  -- No data at all
  RETURN json_build_object(
    'level', 'none',
    'sample_size', 0,
    'message', 'No completed work orders found for this category'
  );
END;
$$;

-- Grant access to authenticated users (called via Edge Function with service role)
GRANT EXECUTE ON FUNCTION get_cost_intelligence TO authenticated;
GRANT EXECUTE ON FUNCTION get_cost_intelligence TO service_role;
