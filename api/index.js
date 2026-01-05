const sortStreams = (streams = []) => {
  if (!streams || streams.length === 0) return streams;
  
  console.log(`Sorting ${streams.length} streams...`);
  
  streams.sort((a, b) => {
    const aFilename = (a?.behaviorHints?.filename || '').toLowerCase();
    const bFilename = (b?.behaviorHints?.filename || '').toLowerCase();
    
    // 1. QUALITY: Best quality first (2160p > 1080p > 720p > 480p > SD)
    const getQualityRank = (filename) => {
      if (filename.includes('2160p') || filename.includes('4k') || filename.includes('uhd')) return 1;
      if (filename.includes('1080p') || filename.includes('fhd')) return 2;
      if (filename.includes('720p') || filename.includes('hd')) return 3;
      if (filename.includes('480p') || filename.includes('sd')) return 4;
      return 5; // SD or unknown
    };
    
    const aQualityRank = getQualityRank(aFilename);
    const bQualityRank = getQualityRank(bFilename);
    
    // Primary sort: Quality (best first)
    if (aQualityRank !== bQualityRank) {
      return aQualityRank - bQualityRank;
    }
    
    // 2. SIZE: Larger files first (within same quality)
    const extractSizeMB = (stream) => {
      // Try to get from title first
      if (stream?.title) {
        const sizeMatch = stream.title.match(/💾\s*([\d.]+)\s*(GB|MB)/i);
        if (sizeMatch) {
          const value = parseFloat(sizeMatch[1]);
          return sizeMatch[2].toUpperCase() === 'GB' ? value * 1024 : value;
        }
      }
      
      // Fallback: Extract from filename or use 0
      const filename = stream?.behaviorHints?.filename || '';
      const sizeMatch = filename.match(/(\d+(\.\d+)?)\s*(GB|MB|GiB|MiB)/i);
      if (sizeMatch) {
        const value = parseFloat(sizeMatch[1]);
        const unit = sizeMatch[3].toUpperCase();
        return unit.startsWith('G') ? value * 1024 : value;
      }
      
      return 0;
    };
    
    const aSize = extractSizeMB(a);
    const bSize = extractSizeMB(b);
    
    // Secondary sort: Size (larger first)
    if (aSize !== bSize) {
      return bSize - aSize; // Descending order
    }
    
    // 3. AGE PENALTY: Penalize releases older than 1 year
    const getAgePenalty = (stream) => {
      // Extract age from title (format: "⏰ X days/months/years")
      const ageMatch = stream?.title?.match(/⏰\s*(\d+)\s*(day|month|year)s?/i);
      if (!ageMatch) return 0; // No age info = no penalty
      
      const value = parseInt(ageMatch[1]);
      const unit = ageMatch[2].toLowerCase();
      
      // Convert to days for comparison
      let ageDays = 0;
      if (unit.startsWith('day')) {
        ageDays = value;
      } else if (unit.startsWith('month')) {
        ageDays = value * 30;
      } else if (unit.startsWith('year')) {
        ageDays = value * 365;
      }
      
      // Penalty tiers:
      // 0-365 days (1 year): No penalty (0)
      // 366-730 days (1-2 years): Small penalty (1)
      // 731-1095 days (2-3 years): Medium penalty (2)
      // 1096+ days (3+ years): Large penalty (3)
      if (ageDays <= 365) return 0;
      if (ageDays <= 730) return 1;
      if (ageDays <= 1095) return 2;
      return 3;
    };
    
    const aAgePenalty = getAgePenalty(a);
    const bAgePenalty = getAgePenalty(b);
    
    // Tertiary sort: Age (newer first = lower penalty first)
    if (aAgePenalty !== bAgePenalty) {
      return aAgePenalty - bAgePenalty; // Lower penalty = better
    }
    
    // 4. HDR quality if same quality, size, and age
    const getHDRRank = (filename) => {
      if (/(dolby.?vision|dovi)/i.test(filename)) return 3;
      if (/hdr10\+/i.test(filename)) return 2;
      if (/\bhdr10\b/i.test(filename) || /\bhdr\b/i.test(filename)) return 1;
      return 0;
    };
    
    const aHDRRank = getHDRRank(aFilename);
    const bHDRRank = getHDRRank(bFilename);
    
    return bHDRRank - aHDRRank; // Better HDR first
  });
  
  // Log first few results to verify sorting
  console.log("First 5 sorted streams:");
  streams.slice(0, 5).forEach((s, i) => {
    const sizeMatch = s?.title?.match(/💾\s*([\d.]+)\s*(GB|MB)/i);
    const ageMatch = s?.title?.match(/⏰\s*(\d+)\s*(day|month|year)s?/i);
    console.log(`${i + 1}. ${s.name} - ${sizeMatch ? sizeMatch[0] : 'Unknown size'} - ${ageMatch ? ageMatch[0] : 'Unknown age'}`);
  });
  
  return streams;
};
