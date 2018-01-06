'use(strict)'

const reader = require('./reader')
const argsParser = require('./util/args')

function main () {
  var args = process.argv.slice(2)

  let opts = argsParser
    .option('--type', '-t', null)
    .option('--base', '-b', null)
    .option('--expand', '-e', false)
    .option('--index', '-i', false)
    .parse(args)

  reader.read(opts.args[0], opts).then(result => {
    if (opts.expand) {
      const cx = require('./jsonld/algorithm')
      result = cx.expand({}, result)
    }
    if (opts.index) {
      const indexer = require('./util/indexer')
      result = indexer.index(result)
    }
    console.log(JSON.stringify(result, null, 2))
  })
}

module.exports = main
