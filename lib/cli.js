'use(strict)'

import {parse} from '.'
import * as argsParser from './util/args'

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
    .option('--result', '-r', null)
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

    if (opts.result) {
      let rtype = opts.result
      const {suffixMediaTypeMap} = require('./mediatypes')
      let mediaType = suffixMediaTypeMap[rtype] || rtype
      if (mediaType === suffixMediaTypeMap.ttl ||
          mediaType === suffixMediaTypeMap.trig) {
        const serializer = require('./trig/serializer')
        serializer.serialize(result, process.stdout)
        return
      }
    }
    console.log(JSON.stringify(result, null, 2))
  })
}

module.exports = main
