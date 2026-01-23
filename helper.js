const parseTorrentFilename = require("parse-torrent-filename");

const removeDuplicate = (data = [], key = "name") => {
  let response = [];
  data.forEach((one, i) => {
    let index_ = response.findIndex((el) => el[key] == one[key]);
    index_ == -1 ? response.push(one) : null;
  });
  return response;
};

const streamFromProxy = (url) => {
  return `https://cdpproxy.stuff2-stuff216.workers.dev?url=${encodeURIComponent(
    url
  )}`;
};

const filter = (results = [], rName = "", alts = []) => {
  alts = Array.isArray(alts) ? alts : !!alts ? [alts] : [];
  if (!results) return [];
  if (!rName || rName?.length === 0) return results;

  // if (rName.split(" ").length <= 2) {
  results = results.filter((el) => {
    if (!el) return false;
    if (!("Title" in el)) return false;
    const parsed = parseTorrentFilename(el.Title);

    if (!!!parsed) return false;
    if (!!!parsed?.title) return false;

    return [...alts, rName].some((alt) =>
      cleanName(parsed.title.toLowerCase()).includes(
        cleanName(alt.toLowerCase())
      )
    );
  });
  // }

  return results;
};

const fileMustInclude =
  "/.mkv$|.mp4$|.avi$|.ts$|.mov$|.wmv$|.flv$|.webm$|.mpg$|.mpeg$|.m4v$|.3gp$|.vob$|.ogv$/i";

const SERVERS = [
  // OK ZONE =======================================================================
  // "nntps://987c0dc54b9a6824@eweka.nl:C8dHotTQ@secure.news.easynews.com:563/50",
  "nntps://medialibrary:PumpkinPie9292@news.newshosting.com:563/100",
  // "nntps://amarill4711:ydme8sc3@news.newshosting.com:563/100",
  // // TESTING ZONE ====================================================================
  // "nntps://5xi52prey9:Pl27umoO7b0O@uswest.newsdemon.com:563/50",
  // "nntps://aiv575755466:287962398@news.newsgroupdirect.com:563/15",
  // "nntps://psyon00191128:Labyrinth13!@secure.news.thecubenet.com:563/20",
  // // NO ZONE =========================================================================
  // "nntps://5xi52prey9:Pl27umoO7b0O@uswest.newsdemon.com:563/50",
  // "nntps://5xi52prey9:Pl27umoO7b0O@uswest.newsdemon.com:563/50",
  // // REMAINING ZONE ==================================================================
  // "nntp://okamiotoko_youkai@hotmail.com:pSbM8tlhGq9wIf1LsKmp@news.eweka.nl:119/45",
  // "nntps://hockeyfreak:susieq123@ssl-eu.astraweb.com:563/1",
  // "nntps://8d813b6ac3f76283:Winnie01!@news.eweka.nl:563/50",
  // "nntps://uf2bcd47415c28035462:778a7249cccf175fb5d114@news.usenet.farm:563/45",
  // "nntps://poltergeist97:qyrinynih4xo@usnewswest.blocknews.net:563/50",
  // "nntp://iecus@rcn.com:Redmond1!@news.newshosting.com:119/10",
  // "nntps://UQ1QOVP8NE0A:3KVXY5BW8562@news.newsgroup.ninja:563/24",
  // "nntps://jared.samson@gmail.com:SwoleMushr00m@news.vipernews.com:443/38",
  // "nntps://987c0dc54b9a6824@eweka.nl:C8dHotTQ@secure-us.news.easynews.com:563/60",
  // "nntps://987c0dc54b9a6824:AH64apache@news.eweka.nl:563/50",
  // "nntps://raymond.de.vos@icloud.com:Vos3470058@news.eweka.nl:563/40",
  // "nntps://jonas_iliiaens@icloud.com:Hayabus@84@news.sunnyusenet.com:443/10",
  // "nntps://mikepb1234:Manutd123@news.giganews.com:563/35",
  // "nntp://erosthor:Dragons1@us.news.astraweb.com:119/25",
  // "nntps://poltergeist97:qyrinynih4xo@eunews-v6.blocknews.net:563/50",
  // "nntp://Ptownjbo06:fatboy06@news.newshosting.com:119/27",
  // "nntps://uf19e250c9a87c061e7e:48493ff7a57f4178c64f90@news.usenet.farm:563/5",
  // "nntps://uffec73a7c40bf49d828:47a2fd672c065035cd560c@news.usenet.farm:563/17",
  // "nntps://dnr120:CSTrg6052@news.newshosting.com:563/30",
  // "nntps://57306d2ec7466bb2:miskaz-Wabfox-8gyqxo@news.eweka.nl:563/5",
  // "nntps://srj7q98sur:n3009a52@us.newsdemon.com:563/50",
  // "nntp://iecus88790:Philly0128!@news.thecubenet.com:119/7",
  // "nntp://ttj821452655: 1dj2j9ik@news.newsgroupdirect.com:119/100",
  // "nntps://Margixs:Virabismillah61@news.newshosting.com:563/20",
  // "nntps://une9342686:kaheriwox8b@news.usenetexpress.com:443/50",
  // "nntps://tw3939124:djmurray@news.tweaknews.eu:563/60",
  // "nntps://poltergeist97:diciqobaz0h@eunews.frugalusenet.com:563/70",
  // "nntps://uodmfd1gw:1of@Kind@news.newshosting.com:563/10",
  // "nntps://poltergeist97:diciqobaz0h@bonus.frugalusenet.com:563/70",
  // "nntp://Osiris:P&Dc0415@news.eweka.nl:119/20",
  // "nntps://dmpauv22tx:i59m31u9@eu.newsdemon.com:563/40",
  // "nntps://282137:Sonam7519!@news.eweka.nl:563/50",
  // "nntps://poltergeist97:qyrinynih4xo@eunews.blocknews.net:563/50",
  // "nntps://schm1547:Zpr5kbxqMAcVZq@usnewswest.blocknews.net:563/12",
  // "nntps://7b556e9dea40929b:v3jRQvKuy89URx3qD3@news.eweka.nl:563/10",
  // "nntps://o5e594jd:mya@key@bud2tbm0ZYC@news.newshosting.com:563/4",
  // "nntps://ywxhgggzxs:7576za62@us.newsdemon.com:563/40",
  // "nntps://unp8736765:Br1lliant!P00p@news.usenetprime.com:563/16",
  // "nntps://xma851291173:7ba1i1b52@us.newsgroupdirect.com:80/25",
  // "nntps://poltergeist97:qyrinynih4xo@usnews.blocknews.net:563/50",
  // "nntps://poltergeist97:qyrinynih4xo@usnewswest-v6.blocknews.net:563/50",
  // "nntps://9ljh26no:GAB5uky!gfu-dqa@pqn@news.usenetserver.com:563/10",
  // "nntps://g8nimshcvd:bigb2347@uswest.newsdemon.com:563/40",
  // "nntp://Xombyphish:2312892176384q@news.newsgroup.ninja:119/50",
  // "nntps://wizapk:Cupoftea1234$@news.giganews.com:563/30",
  // "nntps://unp8736765:Br1lliant!P00p@eu.usenetprime.com:563/16",
  // "nntps://aiv575755466:287962398@europe.newsgroupdirect.com:563/20",
  // "nntps://greg@pavlik.us:MNshdw1!@news.vipernews.com:443/2",
  // "nntps://poltergeist97:qyrinynih4xo@aunews.blocknews.net:563/50",
  // "nntps://poltergeist97:diciqobaz0h@news.frugalusenet.com:563/70",
  // "nntp://f89e391c77f858db:Bakadev06!@news.eweka.nl:119/50",
  // "nntps://apar89:qBJKrxVjL2Ek@news.newshosting.com:563/30",
  // "nntps://medkow74:@ZVWweda4j@a9u#@secure.news.easynews.com:563/5",
  // "nntps://une8081733:zejokykojed6@news.usenetexpress.com:563/50",
  // "nntp://tw3815145:nizcuV-0zatva-faqwiw@news.tweaknews.eu:119/30",
  // "nntps://poltergeist97:qyrinynih4xo@usnews-v6.blocknews.net:563/50",
  // "nntps://tw1692317:8p$CFS97jTMzIz@news.tweaknews.eu:563/4",
  // "nntps://TorresA06:Nyknicks1@news.newsgroup.ninja:563/40",
  // "nntp://walljordan@gmail.com:byjomT3N39s601@news.newshosting.com:119/50",
  // "nntp://leftpad00:SwoleMushr00m@usnews.blocknews.net:119/40",
  // "nntps://itsdvw:Dagototh1@us.astraweb.com:563/13",
];

const REGEX = {
  season_range:
    /S(?:(eason )|(easons )|(eason )|(easons )|(aisons )|(aison ))?(?<start>\d{1,2})\s*?(?:-|&|à|et)\s*?(?<end>\d{1,2})/, //start and end Sxx-xx|Season(s) xx-xx|Sxx à xx
  ep_range: /((?:e)|(?:ep))?(?: )?(?<start>\d{1,4})\s?(-|~)\s?(?<end>\d{1,4})/, //xxx-xxx
  ep_rangewithS:
    /((?:e)|(?:pisode))\s*(?<start>\d{1,3}(?!\d)|\d\d\d??)(?:-?e?(?<end>\d{1,3}))?(?!\d)/, //Exxx-xxx
};

let cleanName = (name = "") => {
  return name
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/['<>:]/g, "")
    .replace(/\s{2,}/g, " ");
};

let simplifiedName = (name = "") => {
  let splitName = name.includes("-") ? name.split("-")[0] : name;
  splitName = splitName.trim();
  name = name.replace(/[-_]/g, " ");

  let splitNameArr = splitName.split(" ");
  name =
    splitNameArr.length > 2 && splitNameArr.every((x) => x.length > 2)
      ? splitName
      : name;
  name = name.trim();
  return cleanName(name);
};

const queue = async (queue = [], nbreConcurrent = 1) => {
  let result = [];
  let totalQ = [...queue].length;
  let run = Math.ceil([...queue].length / nbreConcurrent);

  for (let i = 0; i < run; i++) {
    const range = {
      start: i * nbreConcurrent,
      end:
        i * nbreConcurrent + nbreConcurrent > totalQ
          ? totalQ
          : i * nbreConcurrent + nbreConcurrent,
    };
    let sQueue =
      [...queue].length > nbreConcurrent
        ? [...queue].slice(range.start, range.end)
        : [...queue];

    console.log(
      `TQueue: ${totalQ} | Run: ${i + 1}/${run} | CQueue: ${
        sQueue.length
      } | from ${range.start} to ${range.end}`
    );
    const temp = await Promise.all(sQueue.map((el) => el()));
    result = [...result, ...(temp ? temp.flat() : [])];
  }

  console.log(`[*] To Return: ${result.length} | Total: ${totalQ}`);

  return result;
};

const sliceLngText = (text = "", maxSize = 20) => {
  if (text.length <= maxSize) return text;

  let w = [];

  for (let i = 0; i < text.length; i += maxSize) {
    w.push(text.slice(i, i + maxSize));
  }
  return w.join("\n");
};

function timeSince(dateString = "") {
  if (!dateString) return "";

  const pastDate = new Date(dateString);
  const today = new Date();

  const diffInMs = today - pastDate;
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  return formatTimeSince(diffInDays);
}

function formatTimeSince(days) {
  if (days < 7) {
    return ` \n ⏰ ${days} day${days !== 1 ? "s" : ""}`;
  } else if (days < 30) {
    const weeks = Math.floor(days / 7);
    return ` \n ⏰ ${weeks} week${weeks !== 1 ? "s" : ""}`;
  } else if (days < 365) {
    const months = Math.floor(days / 30.44);
    return ` \n ⏰ ${months} month${months !== 1 ? "s" : ""}`;
  } else {
    const years = Math.floor(days / 365.25);
    return ` \n ⏰ ${years} year${years !== 1 ? "s" : ""}`;
  }
}

let getAvatarName = (name = "") => {
  let avatar = name.split(" ");
  avatar = avatar.map((el) => el.charAt(0));
  return avatar.join("").toUpperCase();
};

let cleanKitsuName = (name = "") => {
  return name
    .replace(/(S|s)eason\s\d{1,3}/gim, "")
    .replace(/(\(\d{1,}\))/gim, "")
    .replace(/\s\d{1,3}/gim, "")
    .trim();
};

function isLatinValid(str) {
  // Regex pattern for Latin alphabet, numbers and special characters
  const latinPattern = /^[a-zA-ZÀ-ÿ0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?\s]+$/;
  return latinPattern.test(str);
}

module.exports = {
  removeDuplicate,
  streamFromProxy,
  filter,
  SERVERS,
  fileMustInclude,
  queue,
  cleanName,
  simplifiedName,
  REGEX,
  sliceLngText,
  timeSince,
  getAvatarName,
  cleanKitsuName,
  isLatinValid,
};
