'use(strict)'

import {read, write} from '.'
import * as argsParser from './util/args'

export default function () {
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

  read(opts.args[0], opts).then(async result => {
    if (opts.expand || opts.pattern) {
      const cx = await import('./jsonld/algorithm')
      result = cx.expand({}, result)
    }
    if (opts.index || opts.pattern) {
      const indexer = await import('./util/indexer')
      result = indexer.index(result, opts.pattern === void 0)
    }
    if (opts.pattern) {
      const {expandPatterns} = await import('./rdfa/copypattern')
      expandPatterns(result.byId)
      result = {
        '@context': result['@context'],
        '@graph': Object.values(result.byId)
      }
    }

    if (opts.result) {
      let rtype = opts.result
      await write(result, {type: rtype})
      return
    }

    console.log(JSON.stringify(result, null, 2))
  })
}
