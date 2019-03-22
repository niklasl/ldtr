'use(strict)'

import {read, write} from '.'
import * as argsParser from './util/args'

export default async function () {
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

  let data = await read(opts.args[0], opts)
  data = await postProcess(data, opts)

  if (opts.output === 'NONE') {
    return
  } else {
    await write(data, {type: opts.output})
  }
}

async function postProcess (data, opts) {
  if (opts.expand || opts.pattern) {
    const cx = await import('./jsonld/algorithm')
    data = cx.expand({}, data)
  }

  if (opts.index || opts.pattern) {
    const indexer = await import('./util/indexer')
    data = indexer.index(data, opts.pattern === void 0)
  }

  if (opts.pattern) {
    const {expandPatterns} = await import('./rdfa/copypattern')
    expandPatterns(data.byId)
    data = {
      '@context': data['@context'],
      '@graph': Object.values(data.byId)
    }
  }

  return data
}
