
# Building

npm run clean
npm run lint
npm run build
npm run test
npm run browserify
npm run karma
npm run cover

browserify + karma:  npm run browma
clean ... karma all at once: npm run prepublish


# Releasing

* npm run prepublish
* Increment version number in package.json
* Add changelog entry to README.md
* Commit
* Sync with Github
* Draft a new Github release
* npm publish in repo root

