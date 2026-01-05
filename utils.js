require("dotenv").config();
const fetch = require("node-fetch");
const {
  fileMustInclude,
  SERVERS,
  sliceLngText,
  timeSince,
} = require("./helper");
const config = require("./config");

// ============================================================================
// EPISODE MATCHING FUNCTIONS
// ============================================================================

let containEandS = (name = "", s, e, abs, abs_season, abs_episode) =>
  name?.includes(`s${s?.padStart(2, "0")}e${e?.padStart(2, "0")} `) ||
  name?.includes(`s${s?.padStart(2, "0")}e${e?.padStart(2, "0")}.`) ||
  name?.includes(`s${s?.padStart(2, "0")}e${e?.padStart(2, "0")}-`) ||
  name?.includes(`s${s}e${e?.padStart(2, "0")} `) ||
  name?.includes(`s${s}e${e?.padStart(2, "0")}.`) ||
  name?.includes(`s${s}e${e?.padStart(2, "0")}-`) ||
  name?.includes(`${s}x${e}`) ||
  name?.includes(`s${s?.padStart(2, "0")} - e${e?.padStart(2, "0")}`) ||
  name?.includes(`s${s?.padStart(2, "0")}.e${e?.padStart(2, "0")}`) ||
  name?.includes(`s${s}e${e?.padStart(2, "0")} `) ||
  name?.includes(`s${s}e${e?.padStart(2, "0")}.`) ||
  name?.includes(`s${s}e${e?.padStart(2, "0")}-`) ||
  name?.includes(`s${s?.padStart(2, "0")}e${e} `) ||
  name?.includes(`s${s?.padStart(2, "0")}e${e}.`) ||
  name?.includes(`s${s?.padStart(2, "0")}e${e}-`) ||
  name?.includes(`season ${s} e${e}`) ||
  (!!abs &&
    (name?.includes(
      `s${abs_season?.padStart(2, "0")}e${abs_episode?.padStart(2, "0")}`
    ) ||
      name?.includes(
        `s${s?.padStart(2, "0")}e${abs_episode?.padStart(2, "0")}`
      ) ||
      name?.includes(
        `s${s?.padStart(2, "0")}e${abs_episode?.padStart(3, "0")}`
      ) ||
      name?.includes(
        `s${abs_season?.padStart(2, "0")}e${abs_episode?.padStart(3, "0")}`
      ) ||
      name?.includes(
        `s${abs_season?.padStart(2, "0")}e${abs_episode?.padStart(4, "0")}`
      )));

let containE_S = (name = "", s, e, abs, abs_season, abs_episode) =>
  name?.includes(`s${s?.padStart(2, "0")} - ${e?.padStart(2, "0")}`) ||
  name?.includes(`s${s} - ${e?.padStart(2, "0")}`) ||
  name?.includes(`season ${s} - ${e?.padStart(2, "0")}`) ||
  name?.includes(`season ${s} - ${e?.padStart(2, "0")}`);

let containsAbsoluteE = (name = "", s, e, abs, abs_season, abs_episode) =>
  name?.includes(` ${abs_episode?.padStart(2, "0")} `) ||
  name?.includes(` ${abs_episode?.padStart(3, "0")} `) ||
  name?.includes(` 0${abs_episode} `) ||
  name?.includes(` ${abs_episode?.padStart(4, "0")} `);

let containsAbsoluteE_ = (name = "", s, e, abs, abs_season, abs_episode) =>
  name?.includes(` ${abs_episode?.padStart(2, "0")}.`) ||
  name?.includes(` ${abs_episode?.padStart(3, "0")}.`) ||
  name?.includes(` 0${abs_episode}.`) ||
  name?.includes(` ${abs_episode?.padStart(4, "0")}.`);

const getFittedFile = (
  name = "",
  s,
  e,
  abs = false,
  abs_season,
  abs_episode
) => {
  name = name.toLowerCase();
  return (
    containEandS(name, s, e, abs, abs_season, abs_episode) ||
    containE_S(name, s, e, abs, abs_season, abs_episode) ||
    (s == 1 &&
      (containsAbsoluteE(name, s, e, true, s, e) ||
        containsAbsoluteE_(name, s, e, true, s, e))) ||
    (((abs && containsAbsoluteE(name, s, e, abs, abs_season, abs_episode)) ||
      (abs && containsAbsoluteE_(name, s, e, abs, abs_season, abs_episode))) &&
      !(
        name?.includes("s0") ||
        name?.includes(`s${abs_season}`) ||
        name?.includes("e0") ||
        name?.includes(`e${abs_episode}`) ||
        name?.includes("season")
      ))
  );
};

let isVideo = (element) => {
  return (
    element["name"]?.toLowerCase()?.includes(`.mkv`) ||
    element["name"]?.toLowerCase()?.includes(`.mp4`) ||
    element["name"]?.toLowerCase()?.includes(`.avi`) ||
    element["name"]?.toLowerCase()?.includes(`.flv`)
  );
};

// ============================================================================
// QUALITY & METADATA DETECTION (IMPROVED)
// ============================================================================

function getQuality(name) {
  if (!name) return 'SD';
  name = name.toLowerCase();
  
  // Detect HDR/DV (what users actually care about)
  let hdr = '';
  if (/(dolby.?vision|\.dv\.|dv\.|\bdv\b)/i.test(name)) {
    hdr = ' DV';
  } else if (/hdr10\+|hdr10plus/i.test(name)) {
    hdr = ' HDR10+';
  } else if (/\bhdr\b/i.test(name)) {
    hdr = ' HDR';
  } else if (/\bsdr\b/i.test(name)) {
    hdr = ' SDR';
  }
  
  // Resolution detection
  if (['2160', '4k', 'uhd'].some(x => name.includes(x))) return `2160p${hdr}`;
  if (['1080', 'fhd'].some(x => name.includes(x))) return `1080p${hdr}`;
  if (['720', 'hd'].some(x => name.includes(x))) return `720p${hdr}`;
  if (['480p', '380p', 'sd'].some(x => name.includes(x))) return `480p`;
  return 'SD';
}

function getSize(size) {
  var gb = 1024 * 1024 * 1024;
  var mb = 1024 * 1024;

  return (
    size / gb > 1
      ? `${(size / gb).toFixed(2)} GB`
      : `${(size / mb).toFixed(2)} MB`
  );
}

// ============================================================================
// LANGUAGE DETECTION (ENGLISH-FIRST)
// ============================================================================

const isEnglish = (fileName) => {
  if (!fileName) return true; // Default to English
  fileName = fileName.toLowerCase();
  
  // Check for foreign language indicators
  const foreignPatterns = /(german|french|spanish|italian|dutch|japanese|chinese|korean|russian|polish|portuguese|swedish|norwegian|danish|turkish|arabic|hindi|multi|dubbed|subbed|vostfr|\.ger\.|\.fre\.|\.spa\.|\.ita\.|\.dut\.|\.jap\.|\.kor\.|\.rus\.|\.pol\.|\.por\.|\.swe\.|\.nor\.|\.dan\.|\.tur\.|\.ara\.|\.hin\.)/i;
  
  return !foreignPatterns.test(fileName);
};

const getFlagFromName = (fileName) => {
  if (!fileName) return '🇬🇧';
  fileName = fileName.toLowerCase();
  
  if (isEnglish(fileName)) return '🇬🇧';
  if (/multi/i.test(fileName)) return '🌐';
  if (/(french|vf|vff|vostfr)/i.test(fileName)) return '🇫🇷';
  if (/german|\.ger\./i.test(fileName)) return '🇩🇪';
  if (/spanish|\.spa\./i.test(fileName)) return '🇪🇸';
  if (/italian|\.ita\./i.test(fileName)) return '🇮🇹';
  
  return '🌐'; // Multi-language default
};

// ============================================================================
// SORTING (ENGLISH-FIRST, QUALITY, HDR, SIZE)
// ============================================================================

const sortStreams = (streams = []) => {
  const qualityOrder = { '2160p': 1, '1080p': 2, '720p': 3, '480p': 4, 'SD': 5 };
  const hdrOrder = { 'DV': 5, 'HDR10+': 4, 'HDR': 3, 'SDR': 2, '': 1 };
  
  streams.sort((a, b) => {
    const aTitle = (a?.Title || a?.Desc || '').toLowerCase();
    const bTitle = (b?.Title || b?.Desc || '').toLowerCase();
    
    // 1. ENGLISH FIRST
    const aEng = isEnglish(aTitle);
    const bEng = isEnglish(bTitle);
    if (aEng !== bEng) return aEng ? -1 : 1;
    
    // 2. Quality (2160p > 1080p > 720p > 480p > SD)
    const aQualityFull = getQuality(aTitle);
    const bQualityFull = getQuality(bTitle);
    const aQuality = aQualityFull.split(' ')[0];
    const bQuality = bQualityFull.split(' ')[0];
    const aRank = qualityOrder[aQuality] || 999;
    const bRank = qualityOrder[bQuality] || 999;
    if (aRank !== bRank) return aRank - bRank;
    
    // 3. HDR Type (DV > HDR10+ > HDR > SDR > none)
    const aHDR = aQualityFull.split(' ')[1] || '';
    const bHDR = bQualityFull.split(' ')[1] || '';
    const aHDRRank = hdrOrder[aHDR] || 0;
    const bHDRRank = hdrOrder[bHDR] || 0;
    if (aHDRRank !== bHDRRank) return bHDRRank - aHDRRank;
    
    // 4. Size (largest first)
    return (b?.Size || 0) - (a?.Size || 0);
  });
  
  return streams;
};

// Legacy support - keep old function name but use new sorting
const bringFrenchVideoToTheTopOfList = (streams = []) => {
  console.warn('⚠️  Using deprecated bringFrenchVideoToTheTopOfList - now sorts English-first');
  return sortStreams(streams);
};

const filterBasedOnQuality = (streams = [], quality = "") => {
  if (!quality) return sortStreams(streams);
  
  // Convert old emoji-based quality to new format
  const qualityMap = {
    '🌟4k': '2160p',
    '🎥FHD': '1080p',
    '📺HD': '720p',
    '📱SD': '480p',
  };
  
  const normalizedQuality = qualityMap[quality] || quality;
  
  const filtered = streams.filter((el) => {
    const elQuality = getQuality(el?.Title || el?.Desc || '');
    return elQuality.startsWith(normalizedQuality);
  });

  console.log({ filterBasedOnQuality: filtered.length, quality: normalizedQuality });
  return sortStreams(filtered);
};

// ============================================================================
// STREAM OUTPUT (CLEANER METADATA)
// ============================================================================

const itemToStream = (el, total = 1) => {
  const title = el?.Title || el?.Desc || 'No title';
  const quality = getQuality(title);
  const flag = getFlagFromName(title);
  const size = getSize(el?.Size || 0);
  const tracker = el?.Tracker || 'NZB';
  
  return {
    nzbUrl: el?.Link,
    name: `${flag} ${quality} [${tracker}]`,
    title: `${sliceLngText(title, 40)}\n${size} • ${tracker}\n${timeSince(el?.Date)}`,
    fileMustInclude,
    servers: SERVERS,
    behaviorHints: {
      filename: title,
      notWebReady: true,
      videoSize: el?.Size || undefined,
      bingeGroup: `${config.id}|${quality}|${flag}`,
    }
  };
};

// ============================================================================
// METADATA FETCHING
// ============================================================================

function getMeta(id, type) {
  var [tt, s, e] = id.split(":");

  return fetch(`https://v3-cinemeta.strem.io/meta/${type}/${tt}.json`)
    .then((res) => res.json())
    .then((json) => {
      return {
        name: json.meta["name"],
        year: json.meta["releaseInfo"]?.substring(0, 4) ?? 0,
      };
    })
    .catch((err) =>
      fetch(`https://v2.sg.media-imdb.com/suggestion/t/${tt}.json`)
        .then((res) => res.json())
        .then((json) => {
          return json.d[0];
        })
        .then(({ l, y }) => ({ name: l, year: y }))
    );
}

async function getImdbFromKitsu(id) {
  var [kitsu, _id, e] = id.split(":");

  return fetch(
    `https://vproxy-one.vercel.app/s/MTI0UjMyMzQyM1IyM0YzMjQ=/kitsu/meta/anime/${kitsu}:${_id}.json`
  )
    .then((_res) => _res.json())
    .then((json) => {
      return json["meta"];
    })
    .then((json) => {
      try {
        let imdb = json["imdb_id"];
        let meta = json["videos"].find((el) => el.id == id);
        return [
          imdb,
          (meta["imdbSeason"] ?? 1).toString(),
          (meta["imdbEpisode"] ?? 1).toString(),
          (meta["season"] ?? 1).toString(),
          (meta["imdbSeason"] ?? 1).toString() == 1
            ? (meta["imdbEpisode"] ?? 1).toString()
            : (meta["episode"] ?? 1).toString(),
          meta["imdbEpisode"] != meta["episode"] || meta["imdbSeason"] == 1,
          "aliases" in json ? json["aliases"] : [],
        ];
      } catch (error) {
        return null;
      }
    })
    .catch((err) => null);
}

// ============================================================================
// NZB INDEXER FETCHERS
// ============================================================================

const fetchNZBGeek = async (query, type = "series") => {
  await new Promise((r) =>
    setTimeout(r, Math.floor(Math.random() * 1000 + 1000))
  );

  query = decodeURIComponent(query);

  const api =
    "https://api.nzbgeek.info/api?apikey=VHzV1yQlIOPYDuwE5uQZCp5W0giNM957&t=search&o=json&q=" +
    query +
    `&cat=${type == "movie" ? "2000" : "5000"}&max=100`;

  const controller = new AbortController();
  const TIMEOUT = +process.env.TIMEOUT ?? 15000;
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  let headersList = {
    Accept: "*/*",
    "Content-Type": "application/json",
  };

  try {
    return await fetch(api, {
      method: "GET",
      headers: headersList,
    })
      .then((res) => res.json())
      .then(async (results) => {
        const isValidNzbResponse =
          !!results &&
          "channel" in results &&
          !!results["channel"] &&
          "item" in results["channel"] &&
          Array.isArray(results["channel"]["item"]);

        if (!isValidNzbResponse) return [];

        console.log({ Initial: results["channel"]["item"]?.length });
        if (results["channel"]["item"].length != 0) {
          torrent_results = await Promise.all(
            results["channel"]["item"].map((result) => {
              return new Promise((resolve, reject) => {
                resolve({
                  Tracker: "nzbgeek",
                  id: result["id"],
                  Size: result["enclosure"]["@attributes"]["length"],
                  Category: type,
                  Title: result["title"],
                  Desc: result["description"],
                  Date: result["pubDate"],
                  Link: result["link"],
                  MagnetUri: result["link"],
                });
              });
            })
          );
          clearTimeout(timeoutId);
          return torrent_results;
        } else {
          clearTimeout(timeoutId);
          return [];
        }
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        return [];
      });
  } catch (error) {
    clearTimeout(timeoutId);
    return [];
  }
};

const fetchToshoNZB = async (query, type = "series") => {
  await new Promise((r) =>
    setTimeout(r, Math.floor(Math.random() * 1000 + 1000))
  );

  query = query.replaceAll(" ", "+");

  const api =
    "https://feed.animetosho.org/json?t=search&q=" +
    query +
    `&cat=${type == "movie" ? "2000" : "5000"}&max=100`;

  const controller = new AbortController();
  const TIMEOUT = +process.env.TIMEOUT ?? 15000;
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  let headersList = {
    Accept: "*/*",
    "Content-Type": "application/json",
  };

  try {
    return await fetch(api, {
      method: "GET",
      headers: headersList,
    })
      .then((res) => res.json())
      .then(async (results) => {
        const isValidNzbResponse = Array.isArray(results);

        if (!isValidNzbResponse) return [];

        console.log({ Initial: results?.length });
        if (results.length != 0) {
          torrent_results = await Promise.all(
            results.map((result) => {
              return new Promise((resolve, reject) => {
                if (!result) resolve(null);
                if (!result?.nzb_url) resolve(null);

                resolve({
                  Tracker: "animetosho",
                  id: result["id"],
                  Size: result["total_size"],
                  Category: type,
                  Title: result["title"],
                  Desc: result["title"],
                  Date: isNaN(result["timestamp"])
                    ? null
                    : new Date(result["timestamp"] * 1000).toISOString(),
                  Link: result["nzb_url"],
                  MagnetUri: result["nzb_url"],
                });
              });
            })
          );
          clearTimeout(timeoutId);
          return torrent_results;
        } else {
          clearTimeout(timeoutId);
          return [];
        }
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        return [];
      });
  } catch (error) {
    clearTimeout(timeoutId);
    return [];
  }
};

const fetchNZBSu = async (query, type = "series") => {
  await new Promise((r) =>
    setTimeout(r, Math.floor(Math.random() * 1000 + 1000))
  );

  query = decodeURIComponent(query);

  const api =
    "https://api.nzb.su/api?apikey=a245337a333d4d5019a336f9fa1c6ccb&t=search&o=json&q=" +
    query +
    `&cat=${type == "movie" ? "2000" : "5000"}&max=100`;

  const controller = new AbortController();
  const TIMEOUT = +process.env.TIMEOUT ?? 15000;
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  let headersList = {
    Accept: "*/*",
    "Content-Type": "application/json",
  };

  try {
    return await fetch(api, {
      method: "GET",
      headers: headersList,
    })
      .then((res) => res.json())
      .then(async (results) => {
        const isValidNzbResponse =
          !!results &&
          "channel" in results &&
          !!results["channel"] &&
          "item" in results["channel"] &&
          Array.isArray(results["channel"]["item"]);

        if (!isValidNzbResponse) return [];

        console.log({ Initial: results["channel"]["item"]?.length });
        if (results["channel"]["item"].length != 0) {
          torrent_results = await Promise.all(
            results["channel"]["item"].map((result) => {
              return new Promise((resolve, reject) => {
                resolve({
                  Tracker: "nzb.su",
                  id: result["id"],
                  Size: result["enclosure"]["@attributes"]["length"],
                  Category: type,
                  Title: result["title"],
                  Desc: result["description"],
                  Date: result["pubDate"],
                  Link: result["link"],
                  MagnetUri: result["link"],
                });
              });
            })
          );
          clearTimeout(timeoutId);
          return torrent_results;
        } else {
          clearTimeout(timeoutId);
          return [];
        }
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        return [];
      });
  } catch (error) {
    clearTimeout(timeoutId);
    return [];
  }
};

const fetchNZBaltHUB = async (query, type = "series") => {
  await new Promise((r) =>
    setTimeout(r, Math.floor(Math.random() * 1000 + 1000))
  );

  query = decodeURIComponent(query);

  const api =
    "https://api.althub.co.za/api?apikey=52a2eff3cf80777e7b1f202cb4d15822&t=search&o=json&q=" +
    query +
    `&cat=${type == "movie" ? "2000" : "5000"}&max=100`;

  const controller = new AbortController();
  const TIMEOUT = +process.env.TIMEOUT ?? 15000;
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  let headersList = {
    Accept: "*/*",
    "Content-Type": "application/json",
  };

  try {
    return await fetch(api, {
      method: "GET",
      headers: headersList,
    })
      .then((res) => res.json())
      .then(async (results) => {
        const isValidNzbResponse =
          !!results &&
          "channel" in results &&
          !!results["channel"] &&
          "item" in results["channel"] &&
          Array.isArray(results["channel"]["item"]);

        if (!isValidNzbResponse) return [];

        console.log({ Initial: results["channel"]["item"]?.length });
        if (results["channel"]["item"].length != 0) {
          torrent_results = await Promise.all(
            results["channel"]["item"].map((result) => {
              return new Promise((resolve, reject) => {
                resolve({
                  Tracker: "altHUB",
                  id: result["id"],
                  Size: result["enclosure"]["@attributes"]["length"],
                  Category: type,
                  Title: result["title"],
                  Desc: result["description"],
                  Date: result["pubDate"],
                  Link: result["link"],
                  MagnetUri: result["link"],
                });
              });
            })
          );
          clearTimeout(timeoutId);
          return torrent_results;
        } else {
          clearTimeout(timeoutId);
          return [];
        }
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        return [];
      });
  } catch (error) {
    clearTimeout(timeoutId);
    return [];
  }
};

const fetchNZBNinjaCentral = async (query, type = "series") => {
  await new Promise((r) =>
    setTimeout(r, Math.floor(Math.random() * 1000 + 1000))
  );

  query = decodeURIComponent(query);

  const api =
    "https://ninjacentral.co.za/api?apikey=e02419ea32dafd314f93ff1895f44087&t=search&o=json&q=" +
    query +
    `&cat=${type == "movie" ? "2000" : "5000"}&max=100`;

  const controller = new AbortController();
  const TIMEOUT = +process.env.TIMEOUT ?? 15000;
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  let headersList = {
    Accept: "*/*",
    "Content-Type": "application/json",
  };

  try {
    return await fetch(api, {
      method: "GET",
      headers: headersList,
    })
      .then((res) => res.json())
      .then(async (results) => {
        const isValidNzbResponse =
          !!results &&
          "channel" in results &&
          !!results["channel"] &&
          "item" in results["channel"] &&
          Array.isArray(results["channel"]["item"]);

        if (!isValidNzbResponse) return [];

        console.log({ Initial: results["channel"]["item"]?.length });
        if (results["channel"]["item"].length != 0) {
          torrent_results = await Promise.all(
            results["channel"]["item"].map((result) => {
              return new Promise((resolve, reject) => {
                resolve({
                  Tracker: "NinjaCentral",
                  id: result["id"],
                  Size: result["enclosure"]["@attributes"]["length"],
                  Category: type,
                  Title: result["title"],
                  Desc: result["description"],
                  Date: result["pubDate"],
                  Link: result["link"],
                  MagnetUri: result["link"],
                });
              });
            })
          );
          clearTimeout(timeoutId);
          return torrent_results;
        } else {
          clearTimeout(timeoutId);
          return [];
        }
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        return [];
      });
  } catch (error) {
    clearTimeout(timeoutId);
    return [];
  }
};

const fetchNZBDrunkenSlug = async (query, type = "series") => {
  await new Promise((r) =>
    setTimeout(r, Math.floor(Math.random() * 1000 + 1000))
  );

  query = decodeURIComponent(query);

  const api =
    "https://api.drunkenslug.com/api?apikey=b02389cee5fabdf95db889db6a75846e&t=search&o=json&q=" +
    query +
    `&cat=${type == "movie" ? "2000" : "5000"}&max=100`;

  const controller = new AbortController();
  const TIMEOUT = +process.env.TIMEOUT ?? 15000;
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  let headersList = {
    Accept: "*/*",
    "Content-Type": "application/json",
  };

  try {
    return await fetch(api, {
      method: "GET",
      headers: headersList,
    })
      .then((res) => res.json())
      .then(async (results) => {
        const isValidNzbResponse =
          !!results && "item" in results && Array.isArray(results["item"]);

        if (!isValidNzbResponse) return [];

        console.log({ Initial: results["item"]?.length });
        if (results["item"].length != 0) {
          torrent_results = await Promise.all(
            results["item"].map((result) => {
              return new Promise((resolve, reject) => {
                resolve({
                  Tracker: "Drunken Slug",
                  id: result["id"],
                  Size: result["enclosure"]["_length"],
                  Category: type,
                  Title: result["title"],
                  Desc: result["description"],
                  Date: result["pubDate"],
                  Link: result["link"],
                  MagnetUri: result["link"],
                });
              });
            })
          );
          clearTimeout(timeoutId);
          return torrent_results;
        } else {
          clearTimeout(timeoutId);
          return [];
        }
      })
      .catch((err) => {
        console.log(err);
        clearTimeout(timeoutId);
        return [];
      });
  } catch (error) {
    clearTimeout(timeoutId);
    return [];
  }
};

const fetchNZBFinder = async (query, type = "series") => {
  await new Promise((r) =>
    setTimeout(r, Math.floor(Math.random() * 1000 + 1000))
  );

  query = decodeURIComponent(query);

  const api =
    "https://nzbfinder.ws/api?apikey=d8bc97a73d696cb084966e3c4f9b42f4&t=search&o=json&q=" +
    query +
    `&cat=${type == "movie" ? "2000" : "5000"}&max=100`;

  const controller = new AbortController();
  const TIMEOUT = +process.env.TIMEOUT ?? 15000;
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  let headersList = {
    Accept: "*/*",
    "Content-Type": "application/json",
  };

  try {
    return await fetch(api, {
      method: "GET",
      headers: headersList,
    })
      .then((res) => res.json())
      .then(async (results) => {
        const isValidNzbResponse =
          !!results &&
          "channel" in results &&
          !!results["channel"] &&
          "item" in results["channel"] &&
          Array.isArray(results["channel"]["item"]);

        if (!isValidNzbResponse) return [];

        console.log({ Initial: results["channel"]["item"]?.length });
        if (results["channel"]["item"].length != 0) {
          torrent_results = await Promise.all(
            results["channel"]["item"].map((result) => {
              return new Promise((resolve, reject) => {
                resolve({
                  Tracker: "Finder",
                  id: result["title"],
                  Size: result["enclosure"]["@attributes"]["length"],
                  Category: type,
                  Title: result["title"],
                  Desc: result["description"],
                  Date: result["pubDate"],
                  Link: result["link"],
                  MagnetUri: result["link"],
                });
              });
            })
          );
          clearTimeout(timeoutId);
          return torrent_results;
        } else {
          clearTimeout(timeoutId);
          return [];
        }
      })
      .catch((err) => {
        console.log(err);
        clearTimeout(timeoutId);
        return [];
      });
  } catch (error) {
    clearTimeout(timeoutId);
    return [];
  }
};

const fetchUsenetCrawler = async (query, type = "series") => {
  await new Promise((r) =>
    setTimeout(r, Math.floor(Math.random() * 1000 + 1000))
  );

  query = decodeURIComponent(query);

  const api =
    "https://www.usenet-crawler.com/api?apikey=c7ab91538e72ba267f161b55121c8f74&t=search&o=json&q=" +
    query +
    `&cat=${type == "movie" ? "2000" : "5000"}&max=100`;

  const controller = new AbortController();
  const TIMEOUT = +process.env.TIMEOUT ?? 15000;
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  let headersList = {
    Accept: "*/*",
    "Content-Type": "application/json",
  };

  try {
    return await fetch(api, {
      method: "GET",
      headers: headersList,
    })
      .then((res) => res.json())
      .then(async (results) => {
        const isValidNzbResponse =
          !!results &&
          "channel" in results &&
          !!results["channel"] &&
          "item" in results["channel"] &&
          Array.isArray(results["channel"]["item"]);

        if (!isValidNzbResponse) return [];

        console.log({ Initial: results["channel"]["item"]?.length });
        if (results["channel"]["item"].length != 0) {
          torrent_results = await Promise.all(
            results["channel"]["item"].map((result) => {
              return new Promise((resolve, reject) => {
                resolve({
                  Tracker: "UsenetCrawler",
                  id: result["guid"],
                  Size: result["enclosure"]["@attributes"]["length"],
                  Category: type,
                  Title: result["title"],
                  Desc: result["description"],
                  Date: result["pubDate"],
                  Link: result["link"],
                  MagnetUri: result["link"],
                });
              });
            })
          );
          clearTimeout(timeoutId);
          return torrent_results;
        } else {
          clearTimeout(timeoutId);
          return [];
        }
      })
      .catch((err) => {
        console.log(err);
        clearTimeout(timeoutId);
        return [];
      });
  } catch (error) {
    clearTimeout(timeoutId);
    return [];
  }
};

const fetchNZBPlanet = async (query, type = "series") => {
  await new Promise((r) =>
    setTimeout(r, Math.floor(Math.random() * 1000 + 1000))
  );

  query = decodeURIComponent(query);

  const api =
    "https://nzbplanet.net/api?apikey=d99cbff7fb412b52a2b815ecf7dfbe4c&t=search&o=json&q=" +
    query +
    `&cat=${type == "movie" ? "2000" : "5000"}&max=100`;

  const controller = new AbortController();
  const TIMEOUT = +process.env.TIMEOUT ?? 15000;
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  let headersList = {
    Accept: "*/*",
    "Content-Type": "application/json",
  };

  try {
    return await fetch(api, {
      method: "GET",
      headers: headersList,
    })
      .then((res) => res.json())
      .then(async (results) => {
        const isValidNzbResponse =
          !!results &&
          "channel" in results &&
          !!results["channel"] &&
          "item" in results["channel"] &&
          Array.isArray(results["channel"]["item"]);

        if (!isValidNzbResponse) return [];

        console.log({ Initial: results["channel"]["item"]?.length });
        if (results["channel"]["item"].length != 0) {
          torrent_results = await Promise.all(
            results["channel"]["item"].map((result) => {
              return new Promise((resolve, reject) => {
                resolve({
                  Tracker: "Planet",
                  id: result["guid"],
                  Size: result["enclosure"]["@attributes"]["length"],
                  Category: type,
                  Title: result["title"],
                  Desc: result["description"],
                  Date: result["pubDate"],
                  Link: result["link"],
                  MagnetUri: result["link"],
                });
              });
            })
          );
          clearTimeout(timeoutId);
          return torrent_results;
        } else {
          clearTimeout(timeoutId);
          return [];
        }
      })
      .catch((err) => {
        console.log(err);
        clearTimeout(timeoutId);
        return [];
      });
  } catch (error) {
    clearTimeout(timeoutId);
    return [];
  }
};

// ============================================================================
// AGGREGATE FETCHER
// ============================================================================

const fetchAllNZB = async (query, type = "series") => {
  try {
    const results = await Promise.all([
      fetchNZBGeek(query, type),
      fetchUsenetCrawler(query, type),
      fetchNZBaltHUB(query, type),
      fetchNZBFinder(query, type),
      fetchNZBDrunkenSlug(query, type),
      fetchNZBPlanet(query, type),
      fetchNZBNinjaCentral(query, type),
      fetchNZBSu(query, type),
      fetchToshoNZB(query, type),
    ]);

    return results.flat();
  } catch (error) {
    return [];
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  containEandS,
  containE_S,
  containsAbsoluteE,
  containsAbsoluteE_,
  getMeta,
  getImdbFromKitsu,
  isVideo,
  getSize,
  getQuality,
  filterBasedOnQuality,
  sortStreams,
  bringFrenchVideoToTheTopOfList, // Legacy support
  getFlagFromName,
  getFittedFile,
  fetchNZBGeek,
  fetchNZBSu,
  fetchAllNZB,
  fetchNZBDrunkenSlug,
  fetchNZBaltHUB,
  fetchNZBNinjaCentral,
  fetchNZBFinder,
  fetchToshoNZB,
  fetchUsenetCrawler,
  fetchNZBPlanet,
  itemToStream,
  isEnglish,
};
