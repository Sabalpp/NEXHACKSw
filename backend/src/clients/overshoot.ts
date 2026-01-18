import axios from 'axios';
import { config } from '../config.js';

const OVERSHOOT_BASE = 'https://api.overshoot.ai/v1';

interface OvershootAnalysisResult {
  description: string;
  elements: Array<{
    type: string;
    text?: string;
    bounds?: { x: number; y: number; width: number; height: number };
  }>;
  insights: string[];
}

/**
 * Overshoot AI client for visual analysis
 * Used for analyzing dashboards, screenshots, and visual data
 */
export async function analyzeImage(
  imageUrl: string,
  prompt?: string
): Promise<OvershootAnalysisResult> {
  if (!config.OVERSHOOT_KEY) {
    throw new Error('Overshoot API key not configured');
  }

  const response = await axios.post(
    `${OVERSHOOT_BASE}/analyze`,
    {
      image_url: imageUrl,
      prompt: prompt || 'Analyze this image and describe what you see, focusing on data, charts, and key information.',
    },
    {
      headers: {
        'Authorization': `Bearer ${config.OVERSHOOT_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  return response.data;
}

/**
 * Analyze image from base64 data
 */
export async function analyzeImageBase64(
  base64Data: string,
  mimeType: string = 'image/png',
  prompt?: string
): Promise<OvershootAnalysisResult> {
  if (!config.OVERSHOOT_KEY) {
    throw new Error('Overshoot API key not configured');
  }

  const response = await axios.post(
    `${OVERSHOOT_BASE}/analyze`,
    {
      image_data: base64Data,
      mime_type: mimeType,
      prompt: prompt || 'Analyze this image and describe what you see, focusing on data, charts, and key information.',
    },
    {
      headers: {
        'Authorization': `Bearer ${config.OVERSHOOT_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  return response.data;
}

/**
 * Extract structured data from dashboard screenshot
 */
export async function extractDashboardData(
  imageUrl: string
): Promise<Record<string, unknown>> {
  const analysis = await analyzeImage(
    imageUrl,
    'Extract all numerical data, metrics, KPIs, and chart values from this dashboard. Return structured data.'
  );

  return {
    description: analysis.description,
    metrics: analysis.elements.filter(e => e.type === 'metric' || e.type === 'number'),
    charts: analysis.elements.filter(e => e.type === 'chart'),
    insights: analysis.insights,
  };
}

/**
 * Check if Overshoot is available
 */
export function isOvershootAvailable(): boolean {
  return !!config.OVERSHOOT_KEY;
}

