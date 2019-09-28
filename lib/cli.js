'use(strict)'

import {read, write} from '.'
import * as argsParser from './util/args'

export default async function () {
  var args = process.argv.slice(2)

  let argp = argsParser
    .option('--type', '-t', {help: 'Media type or file suffix'})
    .option('--base', '-b', {help: 'Base URL if different from input URL'})

    .flag('--expand', '-e', {help: 'Expand JSON-LD'})
    // .option('--flatten', '-f', false)
    // .option('--compact', '-c', false)

    .flag('--index', '-i', {help: 'Index on keys, types and reverses'})
    .flag('--pattern', '-p', {help: 'Use RDFa pattern copying'})

    .option('--output', '-o', {help: 'Media type or file suffix'})

    .option('--max-redirects', {symbol: 'NUMBER'})
    .flag('--verbose', '-v')
    .flag('--help', '-h')

  let opts = argp.parse(args)

  if (opts.help) {
    console.log('Usage: ldtr [options] [arguments]')
    console.log()
    console.log('Options:')
    argp.logOptions()
    return
  }

  let data
  try {
    data = await read(opts.args[0], opts)
  } catch (e) {
    if (e.location) {
      let start = e.location.start
      console.error(e.name, 'at', 'line:', start.line, 'column:', start.column, e.message)
      return
    } else {
      throw e
    }
  }
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
    data = indexer.index(data, {
      reverses: true,
      byType: true
    })
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
