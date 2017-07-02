'use(strict)';

const reader = require('./reader');

function main() {
  var args = process.argv.slice(2);
  let opts = parseArgs(args);
  reader.read(opts.args[0], opts).then(result => {
    console.log(JSON.stringify(result, null, 2));
  });
}

function parseArgs(args) {
  let alias = {t: 'type'};
  let opts = {
    type: null,
    args: []
  };
  let j = -1;
  for (let i=0; i < args.length; i++) {
    if (i === j) continue;
    let arg = args[i];
    if (arg[0] === '-') {
      let key, rest;
      if (arg[1] === '-') {
        key = arg.substring(2);
      } else {
        key = alias[arg.substring(1, 2)];
        rest = arg.substring(2);
      }
      if (typeof opts[key] === 'boolean') {
        opts[key] = true
        if (rest) {
          for (let c of rest) {
            let key = alias[c];
            if (key && typeof opts[key] === 'boolean') {
              opts[key] = true;
            }
          }
        }
      } else if (opts[key] === null) {
        opts[key] = rest || args[(j = i + 1)];
      }
    } else {
      opts.args.push(arg);
    }
  }
  return opts;
}

module.exports = main;
