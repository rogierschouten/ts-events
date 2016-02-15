#!/bin/bash -e

tslint='./node_modules/.bin/tslint'

echo cleaning...
rm -Rf lib/**/*.d.ts
rm -Rf lib/**/*.js
rm -Rf lib/**/*.map
rm -Rf examples/**/*.d.ts
rm -Rf examples/**/*.js
rm -Rf examples/**/*.map
rm -Rf test/**/*.d.ts
rm -Rf test/**/*.js
rm -Rf test/**/*.map
rm -f index.d.ts
rm -f index.js
rm -f index.js.map
rm -Rf doc/
rm -Rf coverage/

echo 'linting...'
for i in ./lib/*.ts ./index.ts; do
	if [[ $i != *.d.ts ]]; then
		echo linting $i
		$tslint -t verbose $i
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
