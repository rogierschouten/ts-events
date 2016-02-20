
# Building

Ensure typescript is installed globally, at least version 1.7.5

* Clean: ./node_modules/.bin/rimraf ./dist
* Lint: ./node_modules/.bin/tslint -c ./tslint.json src/**/*.ts
* Build: ./node_modules/.bin/tsc
* Test: npm test

# Releasing

* Increment version number in package.json
* Add changelog entry to README.md
* Commit
* Sync with Github
* Draft a new Github release
* npm publish in repo root

