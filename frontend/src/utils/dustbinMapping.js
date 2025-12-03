/**
 * Dustbin color mapping for waste disposal
 * Based on standard waste segregation practices
 */

export const DUSTBIN_TYPES = {
  BLUE: {
    name: 'Blue Bin',
    color: '#3b82f6',
    colorClass: 'text-blue-400',
    bgClass: 'bg-blue-500/20',
    borderClass: 'border-blue-500/30',
    description: 'Recyclable Waste',
    icon: '♻️',
  },
  GREEN: {
    name: 'Green Bin',
    color: '#10b981',
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/20',
    borderClass: 'border-emerald-500/30',
    description: 'Organic/Compostable Waste',
    icon: '🌱',
  },
  RED: {
    name: 'Red Bin',
    color: '#ef4444',
    colorClass: 'text-red-400',
    bgClass: 'bg-red-500/20',
    borderClass: 'border-red-500/30',
    description: 'Non-Recyclable/General Waste',
    icon: '🗑️',
  },
  YELLOW: {
    name: 'Yellow Bin',
    color: '#eab308',
    colorClass: 'text-yellow-400',
    bgClass: 'bg-yellow-500/20',
    borderClass: 'border-yellow-500/30',
    description: 'Hazardous Waste',
    icon: '⚠️',
  },
  BROWN: {
    name: 'Brown Bin',
    color: '#a16207',
    colorClass: 'text-amber-600',
    bgClass: 'bg-amber-500/20',
    borderClass: 'border-amber-500/30',
    description: 'Biodegradable Waste',
    icon: '🍂',
  },
};

/**
 * Maps waste type to appropriate dustbin
 * @param {string} wasteType - The type of waste (e.g., 'plastic', 'paper', 'organic')
 * @param {string} detectedItem - The specific detected item name
 * @returns {Object} Dustbin type information
 */
export function getDustbinForWaste(wasteType, detectedItem = '') {
  const type = wasteType?.toLowerCase().trim() || '';
  const item = detectedItem?.toLowerCase().trim() || '';

  // Organic/Biodegradable waste
  if (type === 'organic' || type === 'biodegradable' || item.includes('organic') || item.includes('food') || item.includes('compost')) {
    return {
      ...DUSTBIN_TYPES.GREEN,
      reason: 'Organic waste decomposes naturally and should be composted.',
    };
  }

  // E-waste and hazardous materials
  if (type === 'electronics' || type === 'e-waste' || item.includes('battery') || item.includes('electronic') || item.includes('hazardous')) {
    return {
      ...DUSTBIN_TYPES.YELLOW,
      reason: 'Electronic waste contains hazardous materials and requires special handling.',
    };
  }

  // Recyclable materials
  if (type === 'plastic' || type === 'paper' || type === 'cardboard' || type === 'paperboard' || 
      type === 'metal' || type === 'glass' || type === 'recyclable') {
    return {
      ...DUSTBIN_TYPES.BLUE,
      reason: 'This item is recyclable and should be placed in the recycling bin.',
    };
  }

  // Non-recyclable/General waste
  if (type === 'trash' || type === 'non-recyclable' || type === 'general waste') {
    return {
      ...DUSTBIN_TYPES.RED,
      reason: 'This item cannot be recycled and should go in general waste.',
    };
  }

  // Default to recyclable if uncertain
  return {
    ...DUSTBIN_TYPES.BLUE,
    reason: 'When in doubt, check local recycling guidelines. This item may be recyclable.',
  };
}

/**
 * Get multiple dustbin suggestions for multiple waste items
 * @param {Array} insights - Array of waste detection insights
 * @returns {Array} Array of dustbin suggestions with waste items
 */
export function getDustbinSuggestions(insights) {
  const dustbinMap = new Map();

  insights.forEach((insight) => {
    const dustbin = getDustbinForWaste(insight.type, insight.detected_item);
    const key = dustbin.name;

    if (!dustbinMap.has(key)) {
      dustbinMap.set(key, {
        ...dustbin,
        items: [],
      });
    }

    dustbinMap.get(key).items.push({
      name: insight.detected_item,
      type: insight.type,
      confidence: insight.confidence,
    });
  });

  return Array.from(dustbinMap.values());
}


