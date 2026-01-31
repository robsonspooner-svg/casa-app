// Mission 11: AI Entry/Exit Inspection Comparison
// Compares entry and exit inspection data using Claude Vision API
// Generates bond deduction recommendations based on condition changes

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

interface ComparisonRequest {
  entry_inspection_id: string;
  exit_inspection_id: string;
}

interface AIIssue {
  room_name: string;
  item_name: string;
  entry_condition: string;
  exit_condition: string;
  change_type: 'wear_and_tear' | 'tenant_damage' | 'improvement' | 'unchanged';
  description: string;
  estimated_cost: number;
  confidence: number;
  requires_manual_review: boolean;
}

interface ComparisonResult {
  total_issues: number;
  tenant_responsible: number;
  wear_and_tear: number;
  improvements: number;
  estimated_total_cost: number;
  bond_deduction_recommended: number;
  issues: AIIssue[];
  summary: string;
  tenancy_duration_months: number;
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getServiceClient();

    // Authenticate
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ComparisonRequest = await req.json();
    const { entry_inspection_id, exit_inspection_id } = body;

    if (!entry_inspection_id || !exit_inspection_id) {
      return new Response(
        JSON.stringify({ error: 'Both entry_inspection_id and exit_inspection_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch both inspections with rooms, items, images
    const [entryResult, exitResult] = await Promise.all([
      supabase
        .from('inspections')
        .select(`
          *,
          properties!inner(address_line_1, suburb, state, owner_id, rent_amount),
          inspection_rooms(*, inspection_items(*)),
          inspection_images(*)
        `)
        .eq('id', entry_inspection_id)
        .eq('properties.owner_id', user.id)
        .single(),
      supabase
        .from('inspections')
        .select(`
          *,
          properties!inner(address_line_1, suburb, state, owner_id),
          inspection_rooms(*, inspection_items(*)),
          inspection_images(*)
        `)
        .eq('id', exit_inspection_id)
        .eq('properties.owner_id', user.id)
        .single(),
    ]);

    if (entryResult.error || !entryResult.data) {
      return new Response(
        JSON.stringify({ error: 'Entry inspection not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (exitResult.error || !exitResult.data) {
      return new Response(
        JSON.stringify({ error: 'Exit inspection not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const entryInspection = entryResult.data;
    const exitInspection = exitResult.data;

    // Calculate tenancy duration
    const entryDate = new Date(entryInspection.scheduled_date);
    const exitDate = new Date(exitInspection.scheduled_date);
    const tenancyDurationMonths = Math.round(
      (exitDate.getTime() - entryDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000)
    );

    // Build room-by-room comparison data
    const comparisonData = buildComparisonData(entryInspection, exitInspection);

    // Call Claude API for analysis
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: 'AI comparison service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResult = await analyseWithClaude(
      anthropicApiKey,
      comparisonData,
      tenancyDurationMonths,
      entryInspection.properties.state,
      entryInspection.properties.rent_amount
    );

    // Store comparison result in database
    const { data: comparison, error: insertError } = await supabase
      .from('inspection_ai_comparisons')
      .insert({
        entry_inspection_id,
        exit_inspection_id,
        property_id: entryInspection.property_id,
        comparison_date: new Date().toISOString(),
        total_issues: aiResult.total_issues,
        tenant_responsible_count: aiResult.tenant_responsible,
        wear_and_tear_count: aiResult.wear_and_tear,
        estimated_total_cost: aiResult.estimated_total_cost,
        bond_deduction_recommended: aiResult.bond_deduction_recommended,
        summary: aiResult.summary,
        ai_model: 'claude-sonnet-4-20250514',
        raw_response: JSON.stringify(aiResult),
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Failed to store comparison:', insertError);
    }

    // Store individual issues
    if (comparison && aiResult.issues.length > 0) {
      const issueInserts = aiResult.issues.map((issue: AIIssue, idx: number) => ({
        comparison_id: comparison.id,
        room_name: issue.room_name,
        item_name: issue.item_name,
        entry_condition: issue.entry_condition,
        exit_condition: issue.exit_condition,
        change_type: issue.change_type,
        description: issue.description,
        estimated_cost: issue.estimated_cost,
        confidence: issue.confidence,
        requires_manual_review: issue.requires_manual_review,
        display_order: idx,
      }));

      const { error: issuesError } = await supabase
        .from('inspection_ai_issues')
        .insert(issueInserts);

      if (issuesError) {
        console.error('Failed to store issues:', issuesError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          comparison_id: comparison?.id,
          ...aiResult,
          tenancy_duration_months: tenancyDurationMonths,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Comparison error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildComparisonData(entry: any, exit: any): string {
  let report = `PROPERTY: ${entry.properties.address_line_1}, ${entry.properties.suburb}, ${entry.properties.state}\n`;
  report += `ENTRY DATE: ${entry.scheduled_date}\n`;
  report += `EXIT DATE: ${exit.scheduled_date}\n\n`;

  // Build room comparisons
  for (const exitRoom of exit.inspection_rooms || []) {
    const entryRoom = (entry.inspection_rooms || []).find(
      (r: any) => r.name.toLowerCase() === exitRoom.name.toLowerCase()
    );

    report += `=== ROOM: ${exitRoom.name} ===\n`;
    report += `Entry Overall: ${entryRoom?.overall_condition || 'not inspected'}\n`;
    report += `Exit Overall: ${exitRoom?.overall_condition || 'not inspected'}\n\n`;

    for (const exitItem of exitRoom.inspection_items || []) {
      const entryItem = entryRoom?.inspection_items?.find(
        (i: any) => i.name.toLowerCase() === exitItem.name.toLowerCase()
      );

      const entryCondition = entryItem?.condition || 'not checked';
      const exitCondition = exitItem?.condition || 'not checked';
      const changed = entryCondition !== exitCondition;

      report += `  ${exitItem.name}: ${entryCondition} -> ${exitCondition}`;
      if (changed) report += ' [CHANGED]';
      report += '\n';

      if (entryItem?.notes) report += `    Entry notes: ${entryItem.notes}\n`;
      if (exitItem?.notes) report += `    Exit notes: ${exitItem.notes}\n`;
    }

    // Count photos
    const entryPhotos = (entry.inspection_images || []).filter(
      (img: any) => img.room_id === (entryRoom?.id || '')
    ).length;
    const exitPhotos = (exit.inspection_images || []).filter(
      (img: any) => img.room_id === exitRoom.id
    ).length;

    report += `  Photos: ${entryPhotos} entry, ${exitPhotos} exit\n\n`;
  }

  return report;
}

async function analyseWithClaude(
  apiKey: string,
  comparisonData: string,
  tenancyMonths: number,
  state: string,
  rentAmount: number
): Promise<ComparisonResult> {
  const systemPrompt = `You are an Australian property inspection analyst. Compare entry and exit inspection data and determine:
1. Which changes are normal "fair wear and tear" (expected degradation from normal use)
2. Which changes indicate tenant-caused damage (beyond normal use)
3. Estimated remediation cost for each issue (AUD)
4. Recommended bond deduction amount

IMPORTANT CONTEXT:
- Tenancy duration: ${tenancyMonths} months
- State: ${state} (apply ${state} residential tenancy law for wear and tear assessment)
- Weekly rent: $${rentAmount}
- Longer tenancies = more expected wear and tear
- Fair wear and tear examples: faded paint, minor scuffs, worn carpet in traffic areas, small nail holes
- Tenant damage examples: large holes, burns, broken fixtures, pet damage, mould from inadequate ventilation

Return ONLY valid JSON matching this structure:
{
  "total_issues": number,
  "tenant_responsible": number,
  "wear_and_tear": number,
  "improvements": number,
  "estimated_total_cost": number,
  "bond_deduction_recommended": number,
  "summary": "Brief overall assessment",
  "issues": [
    {
      "room_name": "string",
      "item_name": "string",
      "entry_condition": "string",
      "exit_condition": "string",
      "change_type": "wear_and_tear" | "tenant_damage" | "improvement" | "unchanged",
      "description": "What changed and why this classification",
      "estimated_cost": number,
      "confidence": number between 0 and 1,
      "requires_manual_review": boolean
    }
  ]
}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: Deno.env.get('AGENT_MODEL') || 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Please analyse this inspection comparison data and provide your assessment:\n\n${comparisonData}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Claude API error:', response.status, errorText);
    throw new Error(`AI analysis failed: ${response.status}`);
  }

  const claudeData = await response.json();
  const textContent = claudeData.content?.find((c: any) => c.type === 'text')?.text;

  if (!textContent) {
    throw new Error('No response from AI analysis');
  }

  // Parse JSON from response (handle potential markdown code blocks)
  let jsonStr = textContent;
  const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const result: ComparisonResult = JSON.parse(jsonStr);
    // Flag low-confidence items for manual review
    result.issues = result.issues.map(issue => ({
      ...issue,
      requires_manual_review: issue.confidence < 0.7 || issue.requires_manual_review,
    }));
    result.tenancy_duration_months = tenancyMonths;
    return result;
  } catch (parseError) {
    console.error('Failed to parse AI response:', textContent);
    throw new Error('Failed to parse AI analysis result');
  }
}
