'use(strict)'

import {read, write} from '.'
import * as argsParser from './util/args'

export default function () {
  var args = process.argv.slice(2)

  let argp = argsParser
    .option('--type', '-t', null)
    .option('--base', '-b', null)

    .option('--expand', '-e', false)
    // .option('--flatten', '-f', false)
    // .option('--compact', '-c', false)
    .option('--index', '-i', false)
    .option('--pattern', '-p', false)
    .option('--output', '-o', null)

    .option('--max-redirects', null, null)
    .option('--verbose', '-v', false)
    .option('--help', '-h', false)

  let opts = argp.parse(args)

  if (opts.help) {
    console.log('Usage: ldtr [options] [arguments]')
    console.log()
    console.log('Options:')
    argp.logOptions('')
    return
  }

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

    if (opts.output === 'NONE') {
      return
    }

    if (opts.output) {
      let rtype = opts.output
      await write(result, {type: rtype})
      return
    }

    console.log(JSON.stringify(result, null, 2))
  })
}
