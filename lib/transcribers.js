import {DOMParser} from './compat.js'

export var transcribers = {
  'application/trig': trigToJsonLd,
  'text/turtle': trigToJsonLd,
  'application/ld+json': input => JSON.parse(input.data),
  'application/rdf+xml': rdfxmlToJsonLd,
  'text/html': rdfaToJsonLd
}

const USER_AGENT = 'LDTR'

export function requestHeaders () {
  let accepts = Object.keys(transcribers).map((k, i) =>
    k + (i ? ';q=0.' + String(10 - i) : '')
  ).join(', ')
  return {'accept': accepts, 'user-agent': USER_AGENT}
}

async function trigToJsonLd (input) {
  const trigParser = await import('./trig/parser.js')
  try {
    return trigParser.parse(input.data)
  } catch (e) {
      throw e
  }
}

async function rdfxmlToJsonLd (input) {
  const rdfxmlParser = await import('./rdfxml/parser.js')
  let doc = input.document
  if (doc == null) {
    let domParser = new DOMParser()
    doc = domParser.parseFromString(input.data, 'text/xml')
  }
  return rdfxmlParser.parse(doc)
}

async function rdfaToJsonLd (input, source, mediaType) {
  const rdfaParser = await import('./rdfa/parser.js')
  let doc = input.document
  if (doc == null) {
    let domParser = new DOMParser()
    doc = domParser.parseFromString(input.data, 'text/html')
  }
  return rdfaParser.parse(doc, source, {compact: true})
}
