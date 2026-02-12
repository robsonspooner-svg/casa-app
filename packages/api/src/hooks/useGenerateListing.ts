// useGenerateListing Hook - AI-Powered Listing Generation
// Mission 14: AI Agent — Generate listing title and description using the agent

import { useState, useCallback } from 'react';
import { getSupabaseClient } from '../client';
import { useAuth } from './useAuth';

export interface GenerateListingResult {
  title: string;
  description: string;
}

export interface UseGenerateListingReturn {
  generating: boolean;
  error: string | null;
  generateListing: (propertyId: string, existingTitle?: string) => Promise<GenerateListingResult | null>;
}

export function useGenerateListing(): UseGenerateListingReturn {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateListing = useCallback(async (
    propertyId: string,
    existingTitle?: string,
  ): Promise<GenerateListingResult | null> => {
    if (!user) {
      setError('Not authenticated');
      return null;
    }

    setGenerating(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      const prompt = existingTitle
        ? `Generate a compelling property listing description for my property (ID: ${propertyId}). The title is "${existingTitle}". Use the get_property tool to look up the property details, then write a professional, engaging listing description that highlights the property's best features, location, and lifestyle. Return ONLY the description text, no other commentary.`
        : `Generate a compelling property listing title and description for my property (ID: ${propertyId}). Use the get_property tool to look up the property details, then write a professional title and engaging description. Format your response exactly like this:\nTITLE: [the title]\nDESCRIPTION: [the description]`;

      const { data, error: invokeError } = await supabase.functions.invoke('agent-chat', {
        body: { message: prompt },
      });

      if (invokeError) throw invokeError;

      const responseText = data?.message || '';

      if (existingTitle) {
        return {
          title: existingTitle,
          description: responseText.trim(),
        };
      }

      // Parse TITLE: and DESCRIPTION: from response
      const titleMatch = responseText.match(/TITLE:\s*(.+?)(?:\n|DESCRIPTION:)/s);
      const descMatch = responseText.match(/DESCRIPTION:\s*(.+)/s);

      return {
        title: titleMatch?.[1]?.trim() || `Property in ${propertyId.substring(0, 8)}`,
        description: descMatch?.[1]?.trim() || responseText.trim(),
      };
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : 'Failed to generate listing';
      setError(errorMessage);
      return null;
    } finally {
      setGenerating(false);
    }
  }, [user]);

  return { generating, error, generateListing };
}
