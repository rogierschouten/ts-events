#!/bin/bash -e

echo cleaning...
rm -Rf lib/**/*.d.ts
rm -Rf lib/**/*.js
rm -Rf lib/**/*.map
rm -Rf doc/
rm -Rf coverage/
echo linting...
for i in ./lib/*.ts ./index.ts; do
	if [[ $i != *.d.ts ]]; then
		echo linting $i
		tslint -t verbose -f $i
	fi
done
echo building...
tsc
echo making d.ts...
node make-bundle.js
echo generating docs...
./node_modules/.bin/typedoc --out ./doc  -m commonjs --target es5 index.ts ./lib/*.ts
echo testing...
npm test
echo done!
