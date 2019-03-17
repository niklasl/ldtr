'use(strict)'

import {DOMParser} from './compat.js'

export var transcribers = {
  'text/trig': trigToJsonLd,
  'text/turtle': trigToJsonLd,
  'application/ld+json': JSON.parse.bind(JSON),
  'application/rdf+xml': rdfxmlToJsonLd,
  'text/html': rdfaToJsonLd
}

const USER_AGENT = 'LDTR'

export function getHeaders () {
  let accepts = Object.keys(transcribers).map((k, i) =>
    k + (i ? ';q=0.' + String(10 - i) : '')
  ).join(', ')
  return {'accept': accepts, 'user-agent': USER_AGENT}
}

async function trigToJsonLd (trigString) {
  const trigParser = await import('./trig/parser.js')
  try {
    return trigParser.parse(trigString)
  } catch (e) {
    if (e.location) {
      let start = e.location.start
      console.error(e.name, 'at', 'line:', start.line, 'column:', start.column, e.message)
    } else {
      throw e
    }
  }
}

async function rdfxmlToJsonLd (xmlStr) {
  const rdfxmlParser = await import('./rdfxml/parser.js')
  let domParser = new DOMParser()
  let doc = domParser.parseFromString(xmlStr, 'text/xml')
  return rdfxmlParser.parse(doc)
}

async function rdfaToJsonLd (xmlStr, source, mediaType) {
  const rdfaParser = await import('./rdfa/parser.js')
  let domParser = new DOMParser()
  let doc = domParser.parseFromString(xmlStr, 'text/html')
  return rdfaParser.parse(doc, source, {compact: true})
}
