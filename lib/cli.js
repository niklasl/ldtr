'use(strict)'

const {parse} = require('./main')
const argsParser = require('./util/args')

function main () {
  var args = process.argv.slice(2)

  let opts = argsParser
    .option('--type', '-t', null)
    .option('--base', '-b', null)
    .option('--expand', '-e', false)
    // .option('--flatten', '-f', false)
    // .option('--compact', '-c', false)
    .option('--index', '-i', false)
    .option('--pattern', '-p', false)
    .parse(args)

  parse(opts.args[0], opts).then(result => {
    if (opts.expand || opts.pattern) {
      const cx = require('./jsonld/algorithm')
      result = cx.expand({}, result)
    }
    if (opts.index || opts.pattern) {
      const indexer = require('./util/indexer')
      result = indexer.index(result, opts.pattern === void 0)
    }
    if (opts.pattern) {
      const {expandPatterns} = require('./rdfa/copypattern')
      expandPatterns(result.byId)
      result = {
        '@context': result['@context'],
        '@graph': Object.values(result.byId)
      }
    }

    console.log(JSON.stringify(result, null, 2))
  })
}

module.exports = main
