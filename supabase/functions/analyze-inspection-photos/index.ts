// Analyze Inspection Photos — AI Auto-tagging via Claude Vision
// Accepts inspection_id, fetches all untagged photos, sends to Claude for description
// Updates inspection_images.caption and annotations with AI analysis

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const VISION_MODEL = 'claude-3-5-haiku-20241022';

interface AnalyzeRequest {
  inspection_id: string;
  image_ids?: string[]; // optional: only analyze specific images
}

interface PhotoAnalysis {
  description: string;
  category: string;
  location_hint: string;
  condition_assessment: string | null;
  notable_issues: string[];
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: AnalyzeRequest = await req.json();
    if (!body.inspection_id) {
      return new Response(JSON.stringify({ error: 'inspection_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getServiceClient();

    // Verify user owns this inspection
    const userClient = (await import('https://esm.sh/@supabase/supabase-js@2.39.0')).createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch images that need analysis (no caption = untagged)
    let query = supabase
      .from('inspection_images')
      .select('id, url, room_id, item_id, caption, is_wide_shot, is_closeup, compass_bearing')
      .eq('inspection_id', body.inspection_id);

    if (body.image_ids && body.image_ids.length > 0) {
      query = query.in('id', body.image_ids);
    } else {
      query = query.is('caption', null);
    }

    const { data: images, error: imagesError } = await query.order('capture_sequence', { ascending: true });

    if (imagesError) throw imagesError;
    if (!images || images.length === 0) {
      return new Response(JSON.stringify({ message: 'No untagged photos found', analyzed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch room names for context
    const { data: rooms } = await supabase
      .from('inspection_rooms')
      .select('id, name')
      .eq('inspection_id', body.inspection_id);
    const roomMap = new Map((rooms || []).map((r: { id: string; name: string }) => [r.id, r.name]));

    // Fetch item names for context
    const roomIds = (rooms || []).map((r: { id: string }) => r.id);
    let itemMap = new Map<string, string>();
    if (roomIds.length > 0) {
      const { data: items } = await supabase
        .from('inspection_items')
        .select('id, name')
        .in('room_id', roomIds);
      itemMap = new Map((items || []).map((it: { id: string; name: string }) => [it.id, it.name]));
    }

    // Analyze photos in batches of 4 (Claude vision can handle multiple images)
    const BATCH_SIZE = 4;
    let analyzed = 0;

    for (let i = 0; i < images.length; i += BATCH_SIZE) {
      const batch = images.slice(i, i + BATCH_SIZE);

      const imageContent = batch.map((img: any, idx: number) => {
        const roomName = img.room_id ? roomMap.get(img.room_id) || 'Unknown Room' : 'General';
        const itemName = img.item_id ? itemMap.get(img.item_id) || null : null;
        const shotType = img.is_wide_shot ? 'wide shot' : img.is_closeup ? 'close-up' : 'photo';
        const bearing = img.compass_bearing !== null ? `${img.compass_bearing}°` : 'unknown';

        return [
          {
            type: 'text',
            text: `Image ${idx + 1}: ${shotType} in ${roomName}${itemName ? ` (item: ${itemName})` : ''}, compass bearing: ${bearing}`,
          },
          {
            type: 'image',
            source: {
              type: 'url',
              url: img.url,
            },
          },
        ];
      }).flat();

      const systemPrompt = `You are a property condition report assistant for Australian real estate. Analyze inspection photos and provide structured descriptions.

For each image, respond with a JSON array where each element has:
- "index": image number (1-based)
- "description": concise 1-2 sentence description of what's visible
- "category": one of: wall, floor, ceiling, fixture, appliance, door, window, bench, cabinet, plumbing, electrical, outdoor, damage, general
- "location_hint": where in the room this appears to be (e.g. "north wall", "near entry", "corner")
- "condition_assessment": brief condition note or null if not applicable
- "notable_issues": array of any damage, wear, or issues visible (empty array if none)

Be factual and concise. Focus on condition-relevant details for a condition report.`;

      try {
        const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: VISION_MODEL,
            max_tokens: 1500,
            system: systemPrompt,
            messages: [
              {
                role: 'user',
                content: imageContent,
              },
            ],
          }),
        });

        if (!claudeResponse.ok) {
          console.error(`Claude vision error: ${claudeResponse.status}`);
          continue;
        }

        const claudeData = await claudeResponse.json();
        const responseText = claudeData.content?.[0]?.text || '';

        // Parse JSON response
        let analyses: PhotoAnalysis[] = [];
        try {
          // Extract JSON from response (may be wrapped in markdown code block)
          const jsonMatch = responseText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            analyses = JSON.parse(jsonMatch[0]);
          }
        } catch {
          console.error('Failed to parse AI analysis response');
          continue;
        }

        // Update each image with AI analysis
        for (const analysis of analyses) {
          const imgIndex = (analysis as any).index - 1;
          if (imgIndex < 0 || imgIndex >= batch.length) continue;

          const img = batch[imgIndex];
          const caption = analysis.description;
          const annotations = {
            ai_category: analysis.category,
            ai_location_hint: analysis.location_hint,
            ai_condition: analysis.condition_assessment,
            ai_issues: analysis.notable_issues,
            ai_analyzed_at: new Date().toISOString(),
          };

          await supabase
            .from('inspection_images')
            .update({ caption, annotations })
            .eq('id', img.id);

          analyzed++;
        }
      } catch (batchError) {
        console.error('Batch analysis error:', batchError);
        continue;
      }
    }

    return new Response(
      JSON.stringify({ message: `Analyzed ${analyzed} photos`, analyzed }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('analyze-inspection-photos error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
