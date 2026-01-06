const config = {
  id: "hy.nzbdon.stream",
  version: "1.0.1",
  name: "HY NZBDon",
  description: "Movie & TV Streams from Nzb ",
  logo: "https://t4.ftcdn.net/jpg/05/00/82/95/360_F_500829584_ckkeC4QRiQLhvxSc6ZakqGVQszFkBW7C.jpg",
  resources: [
    {
      name: "stream",
      types: ["movie", "series", "anime"],
      idPrefixes: ["tt", "kitsu"],
    },
  ],
  types: ["movie", "series", "anime", "other"],
  catalogs: [],
};

module.exports = config;
