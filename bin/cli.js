const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const parseArgs = require('minimist');
const uuid = require('uuid');

const getDirName = path.dirname;
const appVersion = uuid.v4();

const jsonData = {
  version: appVersion
};

const jsonContent = JSON.stringify(jsonData);

const args = parseArgs(process.argv.slice(2));

const destination = args.destination || './public/meta.json';

const filename = destination.match(/[^\\/]+$/)[0];

writeFile(destination, jsonContent, (err) => {
  if (err) {
    console.log(`An error occured while writing JSON Object to ${filename}`);
    return console.log(err);
  }
  console.log(`${filename} file has been saved with latest version number`);
  return null;
});

function writeFile(path, contents, cb) {
  mkdirp(getDirName(path))
    .then(() => {
        fs.writeFile(path, contents, cb);
    })
    .catch(err => {
        return cb(err);
    });
}
