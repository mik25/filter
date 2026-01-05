require("dotenv").config({
  path: "../.env",
});
const express = require("express");
const app = express();
const {
  filter,
  simplifiedName,
  getAvatarName,
  cleanKitsuName,
  isLatinValid,
} = require("../helper");
const UTILS = require("../utils");
const config = require("../config");
const ptt = require("parse-torrent-title");
const { handleSearch } = require("../handle-search");
const cache = require("../storage/cache");

// ----------------------------------------------
app
  .get("/", (req, res) => {
    return res.status(200).send("okok");
  })
  .get("/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Content-Type", "application/json");

    // console.log({ headers: req.headers });

    //
    var json = { ...config };

    return res.send(json);
  })
  .get("/stream/:type/:id", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Content-Type", "application/json");

    console.log(req.params);

    let media = req.params.type;
    let id = req.params.id;
    id = id.replace(".json", "");

    const cacheKey = `${config.id}|${id}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(`Returning results from cache: ${cached.length} found`);
      return res.send({ streams: cached });
    }

    let tmp = [];

    if (id.includes("kitsu")) {
      tmp = await UTILS.getImdbFromKitsu(id);
      if (!tmp) {
        return res.send({ stream: {} });
      }
    } else {
      tmp = id.split(":");
    }

    let [tt, s, e, abs_season, abs_episode, abs, aliases] = tmp;

    console.log(tmp);

    let meta = await UTILS.getMeta(tt, media);

    console.log({ meta: id });
    console.log({ name: meta?.name, year: meta?.year });

    aliases = (aliases || []).map((e) => cleanKitsuName(e));
    aliases = aliases.filter((e) => isLatinValid(e) && e != meta.name);

    console.log({ aliases });

    let altName = aliases && aliases.length > 0 ? aliases[0] : null;
    altName = getAvatarName(meta?.name) == altName ? meta.name : altName;

    let query = "";
    query = meta?.name ?? "";

    let result = [];

    if (media === "movie") {
      result = await UTILS.fetchAllNZB(
        simplifiedName(query) + " " + meta?.year,
        "movie"
      );
    } else if (media === "series" || media === "anime") {
      result = await handleSearch(
        UTILS.fetchAllNZB,
        query,
        s,
        e,
        abs_season,
        abs_episode,
        abs
      );
    }

    console.log({ "Total results": result.length });

    result = filter(result, meta?.name || "", aliases);

    if (media !== "movie") {
      result = result
        .map((el) =>
          UTILS.getFittedFile(
            el?.Title || el?.Desc || "No title",
            s,
            e,
            abs,
            abs_season,
            abs_episode
          )
            ? el
            : null
        )
        .filter((el) => el != null);

      console.log({ "Fitted results": result.length });
    }

    let stream_results = result
      .map((el) => UTILS.itemToStream(el, result.length))
      .filter((el) => el != null && el.nzbUrl != undefined);

    stream_results = [
      ...UTILS.filterBasedOnQuality(stream_results, UTILS.qualities["4k"]),
      ...UTILS.filterBasedOnQuality(stream_results, UTILS.qualities.fhd),
      ...UTILS.filterBasedOnQuality(stream_results, UTILS.qualities.hd),
      ...UTILS.filterBasedOnQuality(stream_results, UTILS.qualities.sd),
      ...UTILS.filterBasedOnQuality(stream_results, UTILS.qualities.unknown),
    ];

    cache.set(cacheKey, stream_results);

    console.log({ "Final results": stream_results.length });

    return res.send({ streams: stream_results });
  })
  .listen(process.env.PORT || 80, () => {
    console.log("The server is working on " + process.env.PORT || 80);
  });
