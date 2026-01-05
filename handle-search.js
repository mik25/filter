const { removeDuplicate, queue, simplifiedName } = require("./helper");
const handleSearch = async (
  fn = () => {},
  query,
  s,
  e,
  abs_season,
  abs_episode,
  abs,
  anime = false
) => {
  let promises = [
    () => fn(`${simplifiedName(query)} S${(s ?? "1").padStart(2, "0")}`),
    () =>
      fn(
        `${simplifiedName(query)} S${s?.padStart(2, "0")}E${e?.padStart(
          2,
          "0"
        )}`
      ),
  ];

  if (+s == 1 && anime) {
    promises.push(() => fn(`${simplifiedName(query)} E${e?.padStart(2, "0")}`));
  }

  if (abs) {
    promises.push(() =>
      fn(`${simplifiedName(query)} ${abs_episode?.padStart(2, "0")}`)
    );

    console.log({ abs_season, anime });

    if (+abs_season == 1 && anime) {
      promises.push(() => fn(`${simplifiedName(query)}`));
    }
  }

  let r = await queue(promises, 3);

  r = r.filter((x) => !!x);

  r = removeDuplicate(r, "Title");

  return r;
};

module.exports = {
  handleSearch,
};
