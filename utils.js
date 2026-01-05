require("dotenv").config();
const fetch = require("node-fetch");
const {
  fileMustInclude,
  SERVERS,
  sliceLngText,
  timeSince,
} = require("./helper");
const config = require("./config");
const streamMetadata = require('./streamMetadata');

// ============================================================================
// INDEXER CONFIGURATION - Easy enable/disable
// ============================================================================
const ENABLED_INDEXERS = {
  nzbgeek: true,           // ✅ Core - Best overall coverage
  drunkenslug: true,       // ✅ Core - Quality releases, multi-audio
  finder: true,            // ✅ Core - Good for older/rare content
  tosho: true,             // ✅ Specialist - Foreign cinema, varied sources
  usenetcrawler: true,     // ⚠️  Often dupes NZBGeek (disable to speed up)
  althub: false,           // ❌ Regional SA - disable unless needed
  ninjacentral: false,     // ❌ Low unique content - disable to speed up
  nzbsu: false,            // ❌ High dupe rate - disable to speed up
  planet: false,           // ❌ High dupe rate - disable to speed up
};

// Note: With deduplication enabled, 4-5 indexers gives 95% coverage at 2x speed
// Recommended: Keep first 5 enabled, disable rest unless you need regional content
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
          const torrent_results = await Promise.all(
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
          const torrent_results = await Promise.all(
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
          const torrent_results = await Promise.all(
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
          const torrent_results = await Promise.all(
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
          const torrent_results = await Promise.all(
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
          const torrent_results = await Promise.all(
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
          const torrent_results = await Promise.all(
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
          const torrent_results = await Promise.all(
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
          const torrent_results = await Promise.all(
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

const fetchAllNZB = async (query, type = "series") => {
  try {
    const indexers = [];
    
    // Only call enabled indexers
    if (ENABLED_INDEXERS.nzbgeek) indexers.push(fetchNZBGeek(query, type));
    if (ENABLED_INDEXERS.usenetcrawler) indexers.push(fetchUsenetCrawler(query, type));
    if (ENABLED_INDEXERS.althub) indexers.push(fetchNZBaltHUB(query, type));
    if (ENABLED_INDEXERS.finder) indexers.push(fetchNZBFinder(query, type));
    if (ENABLED_INDEXERS.drunkenslug) indexers.push(fetchNZBDrunkenSlug(query, type));
    if (ENABLED_INDEXERS.planet) indexers.push(fetchNZBPlanet(query, type));
    if (ENABLED_INDEXERS.ninjacentral) indexers.push(fetchNZBNinjaCentral(query, type));
    if (ENABLED_INDEXERS.nzbsu) indexers.push(fetchNZBSu(query, type));
    if (ENABLED_INDEXERS.tosho) indexers.push(fetchToshoNZB(query, type));
    
    const enabledCount = Object.values(ENABLED_INDEXERS).filter(Boolean).length;
    console.log(`Querying ${enabledCount} enabled indexers...`);
    
    const results = await Promise.all(indexers);
    return results.flat();
  } catch (error) {
    console.error("fetchAllNZB error:", error);
    return [];
  }
};

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

const qualities = {
  "4k": "🌟4k",
  fhd: "🎥FHD",
  hd: "📺HD",
  sd: "📱SD",
  unknown: "none",
};

const vf = ["vf", "vff", "french", "frn"];
const multi = ["multi"];
const vostfr = ["vostfr", "english", "eng"];

let isVideo = (element) => {
  return (
    element["name"]?.toLowerCase()?.includes(`.mkv`) ||
    element["name"]?.toLowerCase()?.includes(`.mp4`) ||
    element["name"]?.toLowerCase()?.includes(`.avi`) ||
    element["name"]?.toLowerCase()?.includes(`.flv`)
  );
};

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

function getSize(size) {
  var gb = 1024 * 1024 * 1024;
  var mb = 1024 * 1024;

  return (
    "💾 " +
    (size / gb > 1
      ? `${(size / gb).toFixed(2)} GB`
      : `${(size / mb).toFixed(2)} MB`)
  );
}

function getQuality(name) {
  if (!name) {
    return name;
  }
  name = name.toLowerCase();

  if (["2160", "4k", "uhd"].some((x) => name.includes(x)))
    return " " + qualities["4k"];
  if (["1080", "fhd"].some((x) => name.includes(x))) return " " + qualities.fhd;
  if (["720", "hd"].some((x) => name.includes(x))) return " " + qualities.hd;
  if (["480p", "380p", "sd"].some((x) => name.includes(x)))
    return " " + qualities.sd;
  return "";
}

const isSomeContent = (file_name = "", langKeywordsArray = []) => {
  file_name = file_name.toLowerCase();
  return langKeywordsArray.some((word) => file_name.includes(word));
};

const isVfContent = (file_name) => isSomeContent(file_name, vf);
const isMultiContent = (file_name) => isSomeContent(file_name, multi);
const isVostfrContent = (file_name) => isSomeContent(file_name, vostfr);

const bringFrenchVideoToTheTopOfList = (streams = []) => {
  streams.sort((a, b) => {
    let a_lower = (a?.description || a?.title || "").toLowerCase();
    let b_lower = (b?.description || b?.title || "").toLowerCase();
    return isVfContent(a_lower) ||
      isVostfrContent(a_lower) ||
      isMultiContent(a_lower)
      ? -1
      : isVfContent(b_lower) ||
        isVostfrContent(b_lower) ||
        isMultiContent(a_lower)
      ? 1
      : 0;
  });
  return streams;
};

const filterBasedOnQuality = (streams = [], quality = "") => {
  if (!quality) return [];
  if (!Object.values(qualities).includes(quality)) return [];

  if (quality == qualities.unknown) {
    streams = streams.filter((el) => {
      const l = `${el?.name}`;
      return (
        !l.includes(qualities["4k"]) &&
        !l.includes(qualities.fhd) &&
        !l.includes(qualities.hd) &&
        !l.includes(qualities.sd)
      );
    });
  } else {
    streams = streams.filter((el) => el.name.includes(quality));
  }

  console.log({ filterBasedOnQuality: streams.length, quality });
  return bringFrenchVideoToTheTopOfList(streams);
};

const getFlagFromName = (file_name) => {
  switch (true) {
    case isVfContent(file_name):
      return "| 🇫🇷";
    case isMultiContent(file_name):
      return "| 🌍";
    case isVostfrContent(file_name):
      return "| 🇬🇧";
    default:
      return "";
  }
};

const isEnglish = (fileName) => {
  if (!fileName) return true;
  fileName = fileName.toLowerCase();
  
  const foreignPatterns = /(german|french|spanish|italian|dutch|japanese|chinese|korean|russian|polish|portuguese|swedish|norwegian|danish|turkish|arabic|hindi|multi|dubbed|subbed|vostfr|\.ger\.|\.fre\.|\.spa\.|\.ita\.|\.dut\.|\.jap\.|\.kor\.|\.rus\.|\.pol\.|\.por\.|\.swe\.|\.nor\.|\.dan\.|\.tur\.|\.ara\.|\.hin\.)/i;
  
  return !foreignPatterns.test(fileName);
};

const sortStreams = (streams = []) => {
  if (!streams || streams.length === 0) return streams;
  
  console.log(`\n=== SORTING ${streams.length} STREAMS ===`);
  
  streams.sort((a, b) => {
    // Extract quality from stream name (e.g., "🎬 NZB 1080p 3.52 GB [NinjaCentral]")
    const get
