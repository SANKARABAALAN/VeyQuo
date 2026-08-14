export interface NormalizedSpec {
  key: string;
  originalValue: string;
  normalizedValue: string;
}

export function normalizeSpec(key: string, value: string): string {
  const cleanKey = key.trim().toLowerCase();
  const cleanVal = value.trim();
  const lowerVal = cleanVal.toLowerCase();

  // RAM Normalization
  if (cleanKey === 'ram' || cleanKey === 'memory') {
    const mbMatch = lowerVal.match(/(\d+)\s*mb/);
    if (mbMatch) {
      const mb = parseInt(mbMatch[1]);
      return `${Math.round(mb / 1024)} GB`;
    }
    const gbMatch = lowerVal.match(/(\d+)\s*(?:gb|g)(?!\w)/);
    if (gbMatch) {
      return `${gbMatch[1]} GB`;
    }
  }

  // Storage Normalization
  if (cleanKey === 'storage' || cleanKey === 'rom' || cleanKey === 'ssd' || cleanKey === 'hdd') {
    if (lowerVal.includes('tb') || lowerVal.includes('1t') || lowerVal.includes('2t')) {
      const tbMatch = lowerVal.match(/(\d+)\s*tb/);
      if (tbMatch) {
        return `${parseInt(tbMatch[1]) * 1024} GB`;
      }
      return '1024 GB';
    }
    const gbMatch = lowerVal.match(/(\d+)\s*(?:gb|g)(?!\w)/);
    if (gbMatch) {
      return `${gbMatch[1]} GB`;
    }
  }

  // Display / Screen Size Normalization
  if (cleanKey === 'display' || cleanKey === 'screen' || cleanKey === 'screen size' || cleanKey === 'display size') {
    const sizeMatch = lowerVal.match(/(\d+(?:\.\d+)?)\s*(?:inch|\"|-inch|in|cm)(?!\w)/);
    if (sizeMatch) {
      return `${sizeMatch[1]} inch`;
    }
  }

  // Battery / Battery Life Normalization
  if (cleanKey === 'battery life' || cleanKey === 'battery' || cleanKey === 'battery capacity') {
    if (lowerVal.includes('mah')) {
      const mahMatch = lowerVal.match(/(\d+)\s*mah/);
      if (mahMatch) return `${mahMatch[1]} mAh`;
    }
    const hrMatch = lowerVal.match(/(\d+)\s*(?:hours|hour|hrs|hr|h)(?!\w)/);
    if (hrMatch) {
      return `${hrMatch[1]} Hours`;
    }
  }

  // Refrigerator/Washing Machine Capacity
  if (cleanKey === 'capacity' || cleanKey === 'load capacity') {
    const litersMatch = lowerVal.match(/(\d+)\s*(?:liters|liter|ltrs|ltr|l)(?!\w)/);
    if (litersMatch) return `${litersMatch[1]} Liters`;
    const kgMatch = lowerVal.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilogram|kilograms)(?!\w)/);
    if (kgMatch) return `${kgMatch[1]} kg`;
  }

  // Energy Star Rating
  if (cleanKey === 'energy rating' || cleanKey === 'star rating' || cleanKey === 'efficiency') {
    const starMatch = lowerVal.match(/(\d+)\s*(?:star|stars)/) || lowerVal.match(/(?:star|stars)\s*(\d+)/);
    if (starMatch) return `${starMatch[1]} Star`;
  }

  return cleanVal;
}

export function normalizeSpecsList(specs: { key: string; value: string }[]): NormalizedSpec[] {
  return specs.map(spec => ({
    key: spec.key,
    originalValue: spec.value,
    normalizedValue: normalizeSpec(spec.key, spec.value)
  }));
}
