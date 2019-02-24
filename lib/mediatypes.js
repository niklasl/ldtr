const suffixMediaTypeMap = {
  'ttl': 'text/turtle',
  'trig': 'text/trig',
  'jsonld': 'application/ld+json',
  'xml': 'application/rdf+xml',
  'rdf': 'application/rdf+xml',
  'rdfs': 'application/rdf+xml',
  'owl': 'application/rdf+xml',
  'html': 'text/html'
}

function guessMediaType (source) {
  let m = source ? source.match(/\.(\w+)$/) : null
  let suffix = m ? m[1] : 'ttl'
  return suffixMediaTypeMap[suffix]
}

module.exports = {
  suffixMediaTypeMap,
  guessMediaType
}
