'use(strict)'

var transcribers = {
  'text/trig': trigToJsonLd,
  'text/turtle': trigToJsonLd,
  'application/ld+json': JSON.parse.bind(JSON),
  'application/rdf+xml': rdfxmlToJsonLd,
  'text/html': rdfaToJsonLd
}

const USER_AGENT = 'LDTR'

function getHeaders () {
  let accepts = Object.keys(transcribers).map((k, i) =>
    k + (i ? ';q=0.' + String(10 - i) : '')
  ).join(', ')
  return {'accept': accepts, 'user-agent': USER_AGENT}
}

function trigToJsonLd (trigString) {
  const trigParser = require('./trig/parser')
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

function rdfxmlToJsonLd (xmlStr) {
  const rdfxmlParser = require('./rdfxml/parser')
  let domParser = new DOMParser()
  let doc = domParser.parseFromString(xmlStr, 'text/xml')
  return rdfxmlParser.parse(doc)
}

function rdfaToJsonLd (xmlStr, source, mediaType) {
  const rdfaParser = require('./rdfa/parser')
  let domParser = new DOMParser()
  let doc = domParser.parseFromString(xmlStr, 'text/html')
  return rdfaParser.parse(doc, source, {compact: true})
}

module.exports = {
  transcribers,
  getHeaders
}
