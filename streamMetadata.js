// ============================================================================
// streamMetadata.js - Enhanced language and metadata detection for NZB streams
// ============================================================================

// Trusted release groups known for preserving all audio tracks
const TRUSTED_MULTI_AUDIO_GROUPS = [
  // High-quality REMUX/BluRay groups (preserve all audio)
  'BLURANiUM', 'FraMeSToR', 'HQMUX', 'REMUX', 'BluRayDesuYo',
  'iFPD', 'ZQ', 'DON', 'HONE', 'NOGRP', 'CTFOH',
  
  // Trusted multi-audio scene groups
  'GUACAMOLE', 'NTb', 'FLAME', 'TayTO', 'HiFi', 'SPHD',
  'KRaLiMaRKo', 'BHDStudio', 'Geek', 'NCmt', 'TDD',
  
  // Anime multi-audio specialists
  'Kametsu', 'EMBER', 'Judas', 'SubsPlease', 'Erai-raws',
  
  // Add more as needed
].map(g => g.toLowerCase());

/**
 * Check if release group is known for multi-audio releases
 * @param {string} title - Release title/filename
 * @returns {boolean} - true if from trusted multi-audio group
 */
function isTrustedMultiAudioGroup(title) {
  const titleLower = title.toLowerCase();
  return TRUSTED_MULTI_AUDIO_GROUPS.some(group => {
    // Match group in various positions: -GROUP, [GROUP], {GROUP}, .GROUP.
    return new RegExp(`[-\\[\\{.]${group}[-\\]\\}.]|[-\\[\\{.]${group}$`, 'i').test(titleLower);
  });
}

/**
 * Detect if content has English dubbed audio track
 * @param {string} title - Release title/filename
 * @returns {Object} - { isDubbed: boolean, confidence: string, reason: string }
 */
function detectEnglishDub(title) {
  const titleLower = title.toLowerCase();
  
  // Check if from trusted multi-audio group
  const isTrustedGroup = isTrustedMultiAudioGroup(title);
  
  // Check for REMUX (full disc rip = all audio tracks)
  const isREMUX = /\bremux\b/i.test(title);
  
  // Check if it's a high-quality BluRay (likely has multiple audio)
  const isHighQualityBluRay = /(bluray|blu[\s._-]?ray)[\s._-]?(remux|1080p|2160p)/i.test(title);
  
  // Check if English is explicitly mentioned
  const hasEnglish = /\b(eng|english)\b/i.test(titleLower);
  
  // Check for non-English language pairs (the RARE case where dual doesn't mean English)
  const hasNonEnglishPair = 
    /\b(mandarin|cantonese)[\s._-]+(mandarin|cantonese)\b/i.test(titleLower) ||
    /\b(hindi|tamil)[\s._-]+(telugu|malayalam)\b/i.test(titleLower) ||
    /\[(kor|jpn|chi|hin|tam)[\s._+-]+(kor|jpn|chi|hin|tam)\]/i.test(titleLower);
  
  // ENHANCED: Patterns that indicate multi-audio (ASSUME English unless proven otherwise)
  const multiAudioPatterns = [
    /\bdual[\s._-]?audio\b/i,
    /\bmulti[\s._-]?audio\b/i,
    /[\s._-](dubbed|dub)[\s._-]/i,
    /[\s._-](dubbed|dub)\d/i,
    // NEW: Standalone MULTI keyword (very common in European releases)
    /\.multi\./i,
    /[\s._-]multi[\s._-]/i,
    /^multi[\s._-]/i,
    /[\s._-]multi$/i
  ];
  
  // STRONG POSITIVE INDICATORS (explicit English mentions)
  const strongDubPatterns = [
    /\b(eng|english)[\s._-]?(dub|dubbed)\b/i,
    /\b(dub|dubbed)[\s._-]?(eng|english)\b/i,
    /\[(eng|english)\+(jpn|jap|kor|chi|spa|ita|fre|ger|hin)\]/i,
    /\[(jpn|jap|kor|chi|spa|ita|fre|ger|hin)\+(eng|english)\]/i,
    /audio[\s._-]?(eng|english)/i,
    /(eng|english)[\s._-]?audio/i,
    
    // Language + English combinations
    /\b(kor|korean)[\s._-]+(eng|english)\b/i,
    /\b(eng|english)[\s._-]+(kor|korean)\b/i,
    /\b(jpn|jap|japanese)[\s._-]+(eng|english)\b/i,
    /\b(eng|english)[\s._-]+(jpn|jap|japanese)\b/i,
    /\b(chi|chinese|mandarin|cantonese)[\s._-]+(eng|english)\b/i,
    /\b(eng|english)[\s._-]+(chi|chinese|mandarin|cantonese)\b/i,
    /\b(hindi|tamil|telugu|malayalam)[\s._-]+(eng|english)\b/i,
    /\b(eng|english)[\s._-]+(hindi|tamil|telugu|malayalam)\b/i,
    /\b(spa|spanish|ger|german|fre|french|ita|italian|rus|russian)[\s._-]+(eng|english)\b/i,
    /\b(eng|english)[\s._-]+(spa|spanish|ger|german|fre|french|ita|italian|rus|russian)\b/i
  ];
  
  // NEGATIVE INDICATORS (definitely NOT dubbed, just subs)
  const subOnlyPatterns = [
    /sub(title)?s?[\s._-]?(eng|english)/i,
    /(eng|english)[\s._-]?sub(title)?s?\b/i,
    /\[(eng|english)[\s._-]?sub\]/i,
    /\(eng[\s._-]?sub(s)?\)/i,
    /(soft|hard)[\s._-]?sub/i,
    /vostfr/i
  ];
  
  // Check for sub-only first (takes priority)
  if (subOnlyPatterns.some(pattern => pattern.test(titleLower))) {
    return {
      isDubbed: false,
      confidence: 'high',
      reason: 'subtitle_keywords'
    };
  }
  
  // Check for strong/explicit English dub indicators
  if (strongDubPatterns.some(pattern => pattern.test(titleLower))) {
    return {
      isDubbed: true,
      confidence: 'high',
      reason: 'explicit_english_dub'
    };
  }
  
  // Check for generic multi-audio patterns FIRST
  // ASSUME English unless it's a rare non-English pair
  const hasMultiAudioKeywords = multiAudioPatterns.some(pattern => pattern.test(titleLower));
  
  if (hasMultiAudioKeywords) {
    if (hasNonEnglishPair) {
      // Rare case: two non-English languages
      return {
        isDubbed: false,
        confidence: 'high',
        reason: 'non_english_multi_audio'
      };
    }
    
    // Common case: assume English is one of the tracks
    // BOOST confidence if it's REMUX or from trusted group
    const confidenceLevel = (isREMUX || isTrustedGroup) ? 'high' : 'medium';
    const reason = (isREMUX || isTrustedGroup) 
      ? 'multi_audio_remux_or_trusted_group'
      : 'generic_multi_audio_assumes_english';
    
    return {
      isDubbed: true,
      confidence: confidenceLevel,
      reason: reason
    };
  }
  
  // Just "eng" or "english" alone (ambiguous - could be subs or original)
  if (hasEnglish) {
    return {
      isDubbed: false,
      confidence: 'low',
      reason: 'ambiguous_english_tag'
    };
  }
  
  return {
    isDubbed: false,
    confidence: 'unknown',
    reason: 'no_dual_audio_indicators'
  };
}

/**
 * Detect if content has multiple audio tracks (non-English dual/multi audio)
 * @param {string} title - Release title/filename
 * @returns {boolean} - true if multi-lingual
 */
function detectMultiLingual(title) {
  const titleLower = title.toLowerCase();
  
  // Patterns that indicate multiple audio tracks (excluding English patterns)
  const multiLingualPatterns = [
    // Non-English dual audio patterns
    /\b(kor|korean)[\s._-]+(jpn|jap|japanese)\b/i,
    /\b(jpn|jap|japanese)[\s._-]+(kor|korean)\b/i,
    /\b(chi|chinese)[\s._-]+(jpn|jap|japanese)\b/i,
    /\b(jpn|jap|japanese)[\s._-]+(chi|chinese)\b/i,
    /\b(hindi|tamil)[\s._-]+(telugu|malayalam)\b/i,
    /\b(spa|spanish)[\s._-]+(fre|french)\b/i,
    
    // Bracketed multi-language [KOR+JPN], [HIN+TAM] (non-English)
    /\[(kor|jpn|chi|hin|spa|fre|ger|ita|rus|tam|tel)[\s._+-]+(kor|jpn|chi|hin|spa|fre|ger|ita|rus|tam|tel)\]/i,
    
    // Plus notation without brackets (non-English)
    /\b(kor|korean|jpn|japanese|chi|chinese|hindi|tamil|spanish|french|german)\+(kor|korean|jpn|japanese|chi|chinese|hindi|tamil|spanish|french|german)\b/i
  ];
  
  return multiLingualPatterns.some(pattern => pattern.test(titleLower));
}

/**
 * Detect primary language from title with conservative logic
 * @param {string} title - Release title/filename
 * @param {Object} dubInfo - Result from detectEnglishDub()
 * @param {boolean} isMultiLingual - Result from detectMultiLingual()
 * @returns {Object} - { flag: string, name: string }
 */
function detectLanguage(title, dubInfo, isMultiLingual) {
  const titleLower = title.toLowerCase();
  
  // PRIORITY 1: Check for SPECIFIC non-English languages FIRST
  // This prevents false "English" detection
  if (/\b(kor|korean|hangul|[한국어])/i.test(title)) {
    // If Korean + English dub, mark as dubbed
    if (dubInfo.isDubbed && (dubInfo.confidence === 'high' || dubInfo.confidence === 'medium')) {
      return { flag: '🎙️', name: 'Korean + ENG DUB' };
    }
    return { flag: '🇰🇷', name: 'Korean' };
  }
  
  if (/\b(jpn|jap|japanese|nihongo|[あいうえお])/i.test(title)) {
    if (dubInfo.isDubbed && (dubInfo.confidence === 'high' || dubInfo.confidence === 'medium')) {
      return { flag: '🎙️', name: 'Japanese + ENG DUB' };
    }
    return { flag: '🇯🇵', name: 'Japanese' };
  }
  
  if (/\b(chi|chinese|mandarin|cantonese|[人是文国])/i.test(title)) {
    if (dubInfo.isDubbed && (dubInfo.confidence === 'high' || dubInfo.confidence === 'medium')) {
      return { flag: '🎙️', name: 'Chinese + ENG DUB' };
    }
    return { flag: '🇨🇳', name: 'Chinese' };
  }
  
  if (/(german|deutsch)/i.test(title)) {
    if (dubInfo.isDubbed && (dubInfo.confidence === 'high' || dubInfo.confidence === 'medium')) {
      return { flag: '🎙️', name: 'German + ENG DUB' };
    }
    return { flag: '🇩🇪', name: 'German' };
  }
  
  if (/(french|français|vf\b)/i.test(title)) {
    if (dubInfo.isDubbed && (dubInfo.confidence === 'high' || dubInfo.confidence === 'medium')) {
      return { flag: '🎙️', name: 'French + ENG DUB' };
    }
    return { flag: '🇫🇷', name: 'French' };
  }
  
  if (/spanish|español/i.test(title)) {
    if (dubInfo.isDubbed && (dubInfo.confidence === 'high' || dubInfo.confidence === 'medium')) {
      return { flag: '🎙️', name: 'Spanish + ENG DUB' };
    }
    return { flag: '🇪🇸', name: 'Spanish' };
  }
  
  if (/italian|italiano/i.test(title)) {
    if (dubInfo.isDubbed && (dubInfo.confidence === 'high' || dubInfo.confidence === 'medium')) {
      return { flag: '🎙️', name: 'Italian + ENG DUB' };
    }
    return { flag: '🇮🇹', name: 'Italian' };
  }
  
  if (/russian/i.test(title)) {
    if (dubInfo.isDubbed && (dubInfo.confidence === 'high' || dubInfo.confidence === 'medium')) {
      return { flag: '🎙️', name: 'Russian + ENG DUB' };
    }
    return { flag: '🇷🇺', name: 'Russian' };
  }
  
  if (/(hindi|tamil|telugu|malayalam)/i.test(title)) {
    if (dubInfo.isDubbed && (dubInfo.confidence === 'high' || dubInfo.confidence === 'medium')) {
      return { flag: '🎙️', name: 'Indian + ENG DUB' };
    }
    return { flag: '🇮🇳', name: 'Indian' };
  }
  
  if (/(polish|polski)/i.test(title)) {
    return { flag: '🇵🇱', name: 'Polish' };
  }
  
  if (/(dutch|nederlands)/i.test(title)) {
    return { flag: '🇳🇱', name: 'Dutch' };
  }
  
  if (/(portuguese|português)/i.test(title)) {
    return { flag: '🇵🇹', name: 'Portuguese' };
  }
  
  if (/(turkish|türkçe)/i.test(title)) {
    return { flag: '🇹🇷', name: 'Turkish' };
  }
  
  if (/(arabic|عربي)/i.test(title)) {
    return { flag: '🇸🇦', name: 'Arabic' };
  }
  
  // PRIORITY 2: Non-English multi-lingual content
  if (isMultiLingual) {
    return { flag: '🌍', name: 'Multi-Lingual' };
  }
  
  // PRIORITY 3: English dub of unknown language content
  if (dubInfo.isDubbed && (dubInfo.confidence === 'high' || dubInfo.confidence === 'medium')) {
    return { flag: '🎙️', name: 'Multi-Audio (ENG DUB)' };
  }
  
  // PRIORITY 4: Explicit English ONLY if "eng" or "english" in title
  if (/\b(eng|english|en-us)\b/i.test(title)) {
    return { flag: '🇺🇸', name: 'English' };
  }
  
  // PRIORITY 5: No language info = assume original/default language
  return { flag: '🎬', name: 'Original Language' };
}

/**
 * Extract quality information from title
 * @param {string} title - Release title/filename
 * @returns {Object} - { resolution: string, emoji: string }
 */
function extractQuality(title) {
  const titleLower = title.toLowerCase();
  
  if (titleLower.includes('2160p') || titleLower.includes('4k') || titleLower.includes('uhd')) {
    return { resolution: '2160p', emoji: '🌟' };
  }
  if (titleLower.includes('1080p') || titleLower.includes('fhd')) {
    return { resolution: '1080p', emoji: '🎥' };
  }
  if (titleLower.includes('720p') || titleLower.includes('hd')) {
    return { resolution: '720p', emoji: '📺' };
  }
  if (titleLower.includes('480p') || titleLower.includes('sd')) {
    return { resolution: '480p', emoji: '📱' };
  }
  
  return { resolution: 'SD', emoji: '📱' };
}

/**
 * Extract HDR information from title
 * FIXED: Added word boundaries to prevent false matches
 * @param {string} title - Release title/filename
 * @returns {string} - HDR info string or empty
 */
function extractHDR(title) {
  const titleLower = title.toLowerCase();
  
  // FIXED: Use word boundaries to avoid matching "dv" in "dvdrip"
  if (/(dolby[\s._-]?vision|dovi\b|\.dv\b|[\s._-]dv[\s._-]|[\s._-]dv\.)/i.test(title)) {
    return '🎨 Dolby Vision';
  }
  if (/hdr10\+/i.test(titleLower)) {
    return '🌈 HDR10+';
  }
  if (/\bhdr10\b/i.test(titleLower)) {
    return '🌟 HDR10';
  }
  if (/\bhlg\b/i.test(titleLower)) {
    return '☀️ HLG';
  }
  if (/\bhdr\b/i.test(titleLower)) {
    return '✨ HDR';
  }
  if (/\bsdr\b/i.test(titleLower)) {
    return '💿 SDR';
  }
  
  // Check for bit-depth if no HDR found
  if (/(10[\s._-]?bit|10bit|hi10p)/i.test(titleLower)) {
    return '🔟 10-bit';
  }
  if (/(8[\s._-]?bit|8bit)/i.test(titleLower)) {
    return '🎨 8-bit';
  }
  
  return '';
}

/**
 * Extract source information from title
 * @param {string} title - Release title/filename
 * @returns {string} - Source info string or empty
 */
function extractSource(title) {
  const titleLower = title.toLowerCase();
  
  if (/remux/i.test(titleLower)) {
    return '💿 REMUX';
  }
  if (/(bluray|blu[\s._-]?ray)/i.test(titleLower)) {
    return '💿 BluRay';
  }
  if (/(web[\s._-]?dl|webrip)/i.test(titleLower)) {
    return '🌐 WEB-DL';
  }
  if (/hdtv/i.test(titleLower)) {
    return '📡 HDTV';
  }
  
  return '';
}

/**
 * Extract codec information from title
 * @param {string} title - Release title/filename
 * @returns {string} - Codec info string or empty
 */
function extractCodec(title) {
  const titleLower = title.toLowerCase();
  
  if (/(hevc|x265|h\.?265)/i.test(titleLower)) {
    return '🔢 HEVC/x265';
  }
  if (/(h\.?264|x264|avc)/i.test(titleLower)) {
    return '🔢 AVC/x264';
  }
  if (/\bav1\b/i.test(titleLower)) {
    return '🔢 AV1';
  }
  
  return '';
}

/**
 * Extract audio information from title
 * @param {string} title - Release title/filename
 * @returns {string} - Audio info string or empty
 */
function extractAudio(title) {
  const titleLower = title.toLowerCase();
  
  if (/atmos/i.test(titleLower)) {
    return '🔊 Dolby Atmos';
  }
  if (/truehd/i.test(titleLower)) {
    return '🔊 TrueHD';
  }
  if (/dts[\s._-]?hd|dts\.?hd/i.test(titleLower)) {
    return '🔊 DTS-HD MA';
  }
  if (/\bdts\b/i.test(titleLower)) {
    return '🔊 DTS';
  }
  if (/dd\+|ddp|eac3/i.test(titleLower)) {
    return '🔊 DD+';
  }
  if (/\bac3\b|dd[\s._-]?5\.1/i.test(titleLower)) {
    return '🔊 DD 5.1';
  }
  if (/\baac\b/i.test(titleLower)) {
    return '🔊 AAC';
  }
  
  return '';
}

/**
 * Extract release group from title
 * FIXED: More specific patterns to avoid matching movie titles
 * @param {string} title - Release title/filename
 * @returns {string} - Release group string or empty
 */
function extractReleaseGroup(title) {
  // Common release patterns (more specific to avoid false matches):
  // 1. After a dash at the very end: "Movie.Name.2024.1080p.WEB-DL-GROUPNAME"
  // 2. In brackets at the end: "Movie.Name.2024.1080p.WEB-DL[GROUPNAME]"
  // 3. After quality info with dash: "Movie.Name.2024.1080p-GROUPNAME"
  
  // First try: dash followed by group at the very end (most common)
  // Must be after quality/source keywords to avoid matching title parts
  const afterQualityMatch = title.match(/(?:1080p|720p|2160p|480p|web-?dl|webrip|bluray|hdtv|remux)[\s._-]+(?:x264|x265|hevc|h264|h265)?[\s._-]*-([A-Za-z0-9]+)$/i);
  if (afterQualityMatch && afterQualityMatch[1]) {
    return `🏷️ ${afterQualityMatch[1]}`;
  }
  
  // Second try: Bracketed group at end [GROUP] or {GROUP}
  const bracketMatch = title.match(/\[([A-Za-z0-9]+)\]$/) || title.match(/\{([A-Za-z0-9]+)\}$/);
  if (bracketMatch && bracketMatch[1]) {
    return `🏷️ ${bracketMatch[1]}`;
  }
  
  // Third try: Last word after final dash (only if it looks like a group name)
  // Group names are usually short (3-15 chars) and uppercase or mixed case
  const finalDashMatch = title.match(/-([A-Z][A-Za-z0-9]{2,14})$/);
  if (finalDashMatch && finalDashMatch[1]) {
    // Exclude common false positives (movie title words)
    const excludeWords = ['REPACK', 'PROPER', 'EXTENDED', 'UNRATED', 'DC', 'DIRECTORS', 'CUT', 
                          'THEATRICAL', 'IMAX', 'DUBBED', 'SUBBED', 'RETAIL', 'LIMITED'];
    if (!excludeWords.includes(finalDashMatch[1].toUpperCase())) {
      return `🏷️ ${finalDashMatch[1]}`;
    }
  }
  
  return '';
}

/**
 * Main function to extract all metadata from NZB title
 * @param {string} title - Release title/filename
 * @returns {Object} - Complete metadata object
 */
function extractStreamMetadata(title) {
  const dubInfo = detectEnglishDub(title);
  const isMultiLingual = detectMultiLingual(title);
  const language = detectLanguage(title, dubInfo, isMultiLingual);
  const quality = extractQuality(title);
  const hdr = extractHDR(title);
  const source = extractSource(title);
  const codec = extractCodec(title);
  const audio = extractAudio(title);
  const releaseGroup = extractReleaseGroup(title);
  
  return {
    dubInfo,
    isMultiLingual,
    language,
    quality,
    hdr,
    source,
    codec,
    audio,
    releaseGroup
  };
}

module.exports = {
  detectEnglishDub,
  detectMultiLingual,
  detectLanguage,
  extractQuality,
  extractHDR,
  extractSource,
  extractCodec,
  extractAudio,
  extractReleaseGroup,
  extractStreamMetadata,
  TRUSTED_MULTI_AUDIO_GROUPS,
  isTrustedMultiAudioGroup
};
