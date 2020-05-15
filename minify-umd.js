const fs = require("fs");
const UglifyJS = require("uglify-js");
const util = require("util");
const packageJson = require("./package.json");

const distInFile = "./dist/ts-events.js";
const distOutFileVersioned = util.format("./temp/ts-events.%s.min.js", packageJson.version);
const distOutFileUnversioned = "./dist/ts-events.min.js";

const input = fs.readFileSync(distInFile, "utf8");
const result = UglifyJS.minify(input, { mangle: false });

if (result.error) {
    throw result.error;
}

fs.writeFileSync(distOutFileVersioned, result.code, { encoding: "utf8"});
fs.writeFileSync(distOutFileUnversioned, result.code, { encoding: "utf8"});
