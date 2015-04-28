#!/bin/sh -e

echo cleaning...
rm -Rf lib/**/*.d.ts
rm -Rf lib/**/*.js
rm -Rf lib/**/*.map
rm -Rf doc/
rm -Rf coverage/
echo building...
tsc
echo making d.ts...
node make-bundle.js
echo generating docs...
./node_modules/.bin/typedoc --out ./doc  -m commonjs --target es5 index.ts ./lib/*.ts
echo testing...
npm test
echo done!
