require("dotenv").config();
const fetch = require("node-fetch");
const {
  fileMustInclude,
  SERVERS,
  sliceLngText,
  timeSince,
} = require("./helper");
const config = require("./config");
// At the top of utils.js, add the import:
const streamMetadata = require('./streamMetadata');

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

const deduplicateNZBResults = (results) => {
  if (!results || results.length === 0) return results;
  
  console.log(`\n=== Deduplicating ${results.length} NZB results ===`);
  
  const seen = new Map();
  const deduplicated = [];
  
  for (const result of results) {
    const title = result.Title || result.Desc || '';
    const size = result.Size || 0;
    const date = result.Date || new Date().toISOString();
    
    // Extract release group from title
    const groupMatch = title.match(/-([A-Za-z0-9]+)$/i) || 
                       title.match(/\[([A-Za-z0-9]+)\]/i) ||
                       title.match(/\{([A-Za-z0-9]+)\}/i);
    const releaseGroup = groupMatch ? groupMatch[1].toLowerCase() : 'unknown';
    
    // MUCH STRICTER: Round to nearest 10MB (not 100MB!)
    // True duplicates should be byte-identical or within a few MB
    const sizeMB = Math.round(size / (1024 * 1024) / 10) * 10;
    
    // Create unique key: group + size
    const key = `${releaseGroup}-${sizeMB}`;
    
    if (!seen.has(key)) {
      // First time seeing this release
      seen.set(key, { result, date: new Date(date) });
      deduplicated.push(result);
      console.log(`✓ Keep: ${title.substring(0, 60)}... [${result.Tracker}] (${(size / (1024**3)).toFixed(2)} GB)`);
    } else {
      // Duplicate found - check if this one is newer
      const existing = seen.get(key);
      const existingAge = new Date(existing.date);
      const currentAge = new Date(date);
      
      if (currentAge > existingAge) {
        // This one is newer - replace the old one
        const index = deduplicated.indexOf(existing.result);
        if (index !== -1) {
          deduplicated[index] = result;
          seen.set(key, { result, date: currentAge });
          console.log(`↻ Replace with newer: ${title.substring(0, 60)}... [${result.Tracker}]`);
        }
      } else {
        // Keep existing (it's newer)
        console.log(`✗ Skip duplicate: ${title.substring(0, 60)}... [${result.Tracker}]`);
      }
    }
  }
  
  console.log(`\nDeduplication: ${results.length} → ${deduplicated.length} unique releases`);
  console.log(`Removed ${results.length - deduplicated.length} duplicates\n`);
  
  return deduplicated;
};

const itemToStream = (el, total = 1) => {
  const title = el?.Title || el?.Desc || "No title";
  const tracker = el?.Tracker || "NZB";
  const category = el?.Category || "Unknown";
  
  // Extract all metadata using helper
  const metadata = streamMetadata.extractStreamMetadata(title);
  
  // Format size
  const gb = 1024 * 1024 * 1024;
  const mb = 1024 * 1024;
  const size = el?.Size || 0;
  const sizeStr = size > gb ? 
    `${(size / gb).toFixed(2)} GB` : 
    `${(size / mb).toFixed(2)} MB`;
  
  const timeStr = timeSince(el?.Date);
  
  // Build description lines (right side details)
  const descriptionLines = [];
  
  descriptionLines.push(`📺 ${sliceLngText(title, 40)}`);
  
  // Quality line with HDR
  if (metadata.hdr) {
    descriptionLines.push(`${metadata.quality.emoji} ${metadata.quality.resolution} | ${metadata.hdr}`);
  } else {
    descriptionLines.push(`${metadata.quality.emoji} ${metadata.quality.resolution}`);
  }
  
  // Source and codec
  if (metadata.source && metadata.codec) {
    descriptionLines.push(`${metadata.source} | ${metadata.codec}`);
  } else if (metadata.source) {
    descriptionLines.push(metadata.source);
  } else if (metadata.codec) {
    descriptionLines.push(metadata.codec);
  }
  
  // Audio
  if (metadata.audio) {
    descriptionLines.push(metadata.audio);
  }
  
  // Size and time
  descriptionLines.push(`💾 ${sizeStr} | ⏰ ${timeStr}`);
  
  // Language line with optional release group
  let languageLine = `${metadata.language.flag} ${metadata.language.name}`;
  if (metadata.releaseGroup) {
    languageLine += ` | ${metadata.releaseGroup}`;
  }
  descriptionLines.push(languageLine);
  
  // Category and tracker
  descriptionLines.push(`🎥 ${category} | 📡 ${tracker}`);
  
  // Filename (truncated)
  const shortTitle = title.length > 50 ? title.substring(0, 47) + '...' : title;
  descriptionLines.push(`📄 ${shortTitle}`);
  
  // BUILD ENHANCED STREAM NAME (left side - compact with key info)
  let streamName = `🎬 NZB ${metadata.quality.resolution}`;
  
  // Add HDR info if present (for 4K content especially)
  if (metadata.hdr && metadata.quality.resolution === '2160p') {
    // Shorten HDR labels for stream name
    const shortHDR = metadata.hdr
      .replace('🎨 Dolby Vision', 'Dolby Vision')
      .replace('🌈 HDR10+', 'HDR10+')
      .replace('🌟 HDR10', 'HDR10')
      .replace('✨ HDR', 'HDR')
      .replace('☀️ HLG', 'HLG')
      .replace('🔟 10-bit', '10bit')
      .replace('🎨 8-bit', '8bit');
    streamName += ` ${shortHDR}`;
  }
  
  // Add file size (important for quick scanning)
  streamName += ` ${sizeStr}`;
  
  // Add dub indicator if present
  if (metadata.dubInfo.isDubbed && (metadata.dubInfo.confidence === 'high' || metadata.dubInfo.confidence === 'medium')) {
    streamName += ` 🎙️ DUB`;
  }
  
  // Add tracker/indexer name in brackets
  streamName += ` [${tracker}]`;
  
  return {
    nzbUrl: el?.Link,
    name: streamName,
    title: descriptionLines.join('\n'),
    fileMustInclude,
    servers: SERVERS,
    behaviorHints: {
      filename: title,
      notWebReady: true,
      bingeGroup: `${config.id}|${metadata.quality.resolution}`,
    },
    options: {
      proxyHeaders: {
        request: { "User-Agent": "Stremio" },
      },
    },
  };
};

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
  qualities,
  bringFrenchVideoToTheTopOfList,
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
  deduplicateNZBResults,
  isEnglish,
  sortStreams,
  itemToStream,
};
