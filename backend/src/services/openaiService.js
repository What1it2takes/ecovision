import OpenAI from 'openai';

// Lazy-load OpenAI client (only create when needed, not at startup)
let openaiClient = null;

function getOpenAIClient() {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

/**
 * System prompt for waste detection and guidance
 */
const WASTE_DETECTION_PROMPT = `You are an expert waste management AI assistant called EcoVision. Your task is to analyze images and identify waste items, then provide detailed reduce, reuse, and recycle guidance.

RESPONSE FORMAT (JSON):
{
  "success": true,
  "insights": [
    {
      "detected_item": "Item name (e.g., Plastic Bottle, Cardboard Box)",
      "type": "Category (Plastic, Paper, Glass, Metal, Organic, E-Waste, Textile, Hazardous)",
      "confidence": 0.95,
      "dispose": "Brief disposal instruction",
      "reduce": ["Tip 1 to reduce usage", "Tip 2", "Tip 3"],
      "reuse": ["Creative reuse idea 1", "Reuse idea 2", "Reuse idea 3"],
      "recycle": ["Recycling instruction 1", "Instruction 2", "Instruction 3"]
    }
  ]
}

GUIDELINES:
1. Identify ALL waste items visible in the image
2. Be specific about the item (not just "plastic" but "plastic water bottle")
3. Provide practical, actionable tips for reduce/reuse/recycle
4. Consider local recycling capabilities - some plastics aren't recyclable everywhere
5. For hazardous items (batteries, electronics, chemicals), emphasize proper disposal
6. Include creative upcycling ideas in reuse section
7. Set confidence based on image clarity and item visibility (0.0-1.0)

If no waste items are detected, return:
{
  "success": true,
  "insights": [{
    "detected_item": "No waste detected",
    "type": "None",
    "confidence": 0,
    "dispose": "No waste items were identified in this image.",
    "reduce": [],
    "reuse": [],
    "recycle": [],
    "fallback": true
  }]
}

Always respond with valid JSON only, no markdown or explanation.`;

/**
 * Run high-accuracy waste detection using GPT-4 Vision
 * @param {string} base64Image - Base64 encoded image (with or without data URL prefix)
 * @returns {Promise<Object>} Detection results with insights
 */
export async function runHighAccuracyDetection(base64Image) {
  try {
    // Ensure we have the API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('[OpenAI] API key not configured');
      return {
        success: false,
        error: 'OpenAI API key not configured. Please set OPENAI_API_KEY in environment.',
        insights: [{
          detected_item: 'Configuration Error',
          type: 'Error',
          confidence: 0,
          dispose: 'OpenAI API key is not configured on the server.',
          reduce: [],
          reuse: [],
          recycle: [],
          fallback: true,
          error: 'API key not configured',
        }],
      };
    }

    // Clean up base64 string - ensure proper format
    let imageUrl = base64Image;
    if (!base64Image.startsWith('data:')) {
      // Assume JPEG if no prefix
      imageUrl = `data:image/jpeg;base64,${base64Image}`;
    }

    console.log('[OpenAI] Sending image for high-accuracy detection...');

    // Get OpenAI client (lazy loaded)
    const client = getOpenAIClient();
    
    if (!client) {
      return {
        success: false,
        error: 'Failed to initialize OpenAI client.',
        insights: [{
          detected_item: 'Configuration Error',
          type: 'Error',
          confidence: 0,
          dispose: 'Could not connect to OpenAI. Please check your API key.',
          reduce: [],
          reuse: [],
          recycle: [],
          fallback: true,
          error: 'Client initialization failed',
        }],
      };
    }

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: WASTE_DETECTION_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this image and identify any waste items. Provide detailed reduce, reuse, and recycle guidance for each item found.',
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from GPT-4 Vision');
    }

    console.log('[OpenAI] Raw response:', content.substring(0, 200) + '...');

    // Parse JSON response
    let result;
    try {
      // Handle potential markdown code blocks
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.slice(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.slice(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.slice(0, -3);
      }
      
      result = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('[OpenAI] Failed to parse response:', parseError);
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from GPT-4');
      }
    }

    console.log(`[OpenAI] Detected ${result.insights?.length || 0} items`);

    // Ensure proper structure
    if (!result.insights || !Array.isArray(result.insights)) {
      result.insights = [{
        detected_item: 'Unknown',
        type: 'Unknown',
        confidence: 0,
        dispose: 'Unable to analyze image.',
        reduce: [],
        reuse: [],
        recycle: [],
        fallback: true,
      }];
    }

    // Add bbox placeholder (GPT doesn't provide coordinates)
    result.insights = result.insights.map((insight) => ({
      ...insight,
      bbox: insight.bbox || [],
      confidence: Math.min(1, Math.max(0, insight.confidence || 0.9)),
    }));

    return {
      success: true,
      insights: result.insights,
      model: 'gpt-4o-vision',
    };

  } catch (error) {
    console.error('[OpenAI] Detection error:', error);
    
    // Handle rate limiting
    if (error.status === 429) {
      return {
        success: false,
        error: 'API rate limit exceeded. Please try again later.',
        insights: [{
          detected_item: 'Rate Limited',
          type: 'Error',
          confidence: 0,
          dispose: 'Too many requests. Please wait a moment and try again.',
          reduce: [],
          reuse: [],
          recycle: [],
          fallback: true,
          error: 'Rate limit exceeded',
        }],
      };
    }

    // Handle invalid API key
    if (error.status === 401) {
      return {
        success: false,
        error: 'Invalid OpenAI API key.',
        insights: [{
          detected_item: 'Authentication Error',
          type: 'Error',
          confidence: 0,
          dispose: 'Invalid API key. Please check your OpenAI configuration.',
          reduce: [],
          reuse: [],
          recycle: [],
          fallback: true,
          error: 'Invalid API key',
        }],
      };
    }

    return {
      success: false,
      error: error.message || 'High accuracy detection failed',
      insights: [{
        detected_item: 'Detection Error',
        type: 'Error',
        confidence: 0,
        dispose: 'An error occurred during detection. Please try again.',
        reduce: [],
        reuse: [],
        recycle: [],
        fallback: true,
        error: error.message,
      }],
    };
  }
}

/**
 * Check if OpenAI service is configured
 */
export function isOpenAIConfigured() {
  return !!process.env.OPENAI_API_KEY;
}

