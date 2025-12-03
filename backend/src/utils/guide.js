// WasteNet class labels (6 classes)
const WASTE_CLASSES = [
  'cardboard',
  'glass',
  'metal',
  'paper',
  'plastic',
  'trash',
];

// Disposal guidance for each waste category
const WASTE_GUIDE = {
  cardboard: {
    type: 'Recyclable',
    dustbin: 'Blue Bin',
    dustbinColor: 'blue',
    dispose: 'Flatten boxes and place in recycling bin. Remove any tape or labels if possible.',
    reduce: [
      'Choose products with minimal cardboard packaging',
      'Buy in bulk to reduce individual packaging',
      'Opt for digital subscriptions over physical deliveries',
    ],
    reuse: [
      'Use as packing material for moving or shipping',
      'Create storage boxes or organizers',
      'Use for arts and crafts projects',
      'Create compost bin liners (shredded)',
    ],
    recycle: [
      'Place flattened cardboard in recycling bin',
      'Take large quantities to recycling center',
      'Ensure cardboard is dry and clean',
      'Remove any plastic tape or styrofoam',
    ],
  },
  glass: {
    type: 'Recyclable',
    dustbin: 'Blue Bin',
    dustbinColor: 'blue',
    dispose: 'Rinse and place in glass recycling bin. Remove lids and caps.',
    reduce: [
      'Choose products in recyclable containers',
      'Buy larger sizes to reduce packaging',
      'Use refillable glass containers',
    ],
    reuse: [
      'Use jars for food storage',
      'Create decorative vases or candle holders',
      'Use bottles for homemade sauces or oils',
      'Repurpose as drinking glasses',
    ],
    recycle: [
      'Rinse containers before recycling',
      'Separate by color if required locally',
      'Remove metal lids (recycle separately)',
      'Do NOT include broken glass, mirrors, or ceramics',
    ],
  },
  metal: {
    type: 'Recyclable',
    dustbin: 'Blue Bin',
    dustbinColor: 'blue',
    dispose: 'Rinse cans and place in recycling bin. Crush if possible to save space.',
    reduce: [
      'Choose products with less metal packaging',
      'Buy concentrated products when available',
      'Use reusable metal containers',
    ],
    reuse: [
      'Use cans for storage or organization',
      'Create planters for small plants',
      'Use for DIY crafts and projects',
      'Repurpose as pencil holders or utensil containers',
    ],
    recycle: [
      'Rinse food cans before recycling',
      'Aluminum and steel cans are both recyclable',
      'Crush cans to save space',
      'Include aluminum foil (cleaned)',
    ],
  },
  paper: {
    type: 'Recyclable',
    dustbin: 'Blue Bin',
    dustbinColor: 'blue',
    dispose: 'Place clean, dry paper in recycling bin. Remove any plastic windows from envelopes.',
    reduce: [
      'Go paperless for bills and statements',
      'Print double-sided when possible',
      'Use digital notes instead of paper',
      'Unsubscribe from unwanted mail',
    ],
    reuse: [
      'Use as scratch paper for notes',
      'Shred for packing material',
      'Create arts and crafts projects',
      'Use as fire starters (if not bleached)',
    ],
    recycle: [
      'Most paper products are recyclable',
      'Remove plastic windows from envelopes',
      'Keep paper dry and clean',
      'Do NOT include waxed or food-soiled paper',
    ],
  },
  plastic: {
    type: 'Varies by Type',
    dustbin: 'Blue Bin',
    dustbinColor: 'blue',
    dispose: 'Check recycling number. Rinse and place accepted plastics in recycling bin.',
    reduce: [
      'Bring reusable bags when shopping',
      'Use reusable water bottles and containers',
      'Choose products with minimal plastic packaging',
      'Avoid single-use plastics',
    ],
    reuse: [
      'Repurpose containers for storage',
      'Use bottles for DIY projects',
      'Create organizers from plastic containers',
      'Use sturdy bags multiple times',
    ],
    recycle: [
      'Check local guidelines for accepted plastic types',
      'Rinse containers before recycling',
      'Remove caps/lids if required locally',
      'Types #1 (PET) and #2 (HDPE) are most commonly accepted',
    ],
  },
  trash: {
    type: 'Non-Recyclable',
    dustbin: 'Red Bin',
    dustbinColor: 'red',
    dispose: 'Place in general waste bin. Consider if any components can be separated for recycling.',
    reduce: [
      'Choose products with recyclable packaging',
      'Avoid single-use disposable items',
      'Buy durable products that last longer',
      'Compost food waste when possible',
    ],
    reuse: [
      'Consider if item can be repaired',
      'Donate usable items instead of discarding',
      'Repurpose items for different uses',
      'Check for local reuse programs',
    ],
    recycle: [
      'This item may not be recyclable',
      'Check if any components can be separated',
      'Look for specialized recycling programs',
      'Consider terracycle or similar services',
    ],
  },
};

/**
 * Get class label from index
 */
export function getClassLabel(index) {
  return WASTE_CLASSES[index] ?? 'unknown';
}

/**
 * Get waste guide entry for a class
 */
export function getWasteGuide(className) {
  const normalized = className.toLowerCase().trim();
  return (
    WASTE_GUIDE[normalized] ?? {
      type: 'Unknown',
      dustbin: 'Blue Bin',
      dustbinColor: 'blue',
      dispose: 'Unable to determine disposal method. Check local guidelines.',
      reduce: ['Consider sustainable alternatives'],
      reuse: ['Look for ways to repurpose this item'],
      recycle: ['Check local recycling guidelines'],
    }
  );
}

/**
 * Get guide type for a class
 */
export function getGuideTypeFallback(label) {
  const guide = getWasteGuide(label);
  return guide?.type ?? 'Unknown';
}

/**
 * Legacy function for compatibility
 */
export function getGuideEntry(label) {
  return getWasteGuide(label);
}

/**
 * Legacy function for compatibility
 */
export function mergeDetectionWithGuide(detection) {
  const guide = getWasteGuide(detection.item ?? detection.label);
  
  return {
    detected_item: capitalize(detection.item ?? detection.label),
    type: guide.type ?? detection.type ?? 'Unknown',
    dispose: guide.dispose,
    reduce: guide.reduce,
    reuse: guide.reuse,
    recycle: guide.recycle,
    confidence: detection.confidence,
  };
}

function capitalize(text = '') {
  return text
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim();
}
