pwd

ls -al

sed -i 's/if (cb) cb(err, results)/if (cb \&\& typeof cd === "function") cb(err, results)/g' ./node_modules/run-parallel/index.js

sed -i 's/console.log/\/\/console.log/g' ./node_modules/parse-torrent-filename/parts/common.js
