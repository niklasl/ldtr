let ID = '@id'
let TYPE = '@type'
let REVERSE = '@reverse'
//let RDF_type = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
let RDFA = 'http://www.w3.org/ns/rdfa#'
let RDFA_Pattern = RDFA + 'Pattern'
let RDFA_copy = RDFA + 'copy'

module.exports = {expandPatterns}

function expandPatterns (graphIndex, keepPattern = false) {
  let usedPatterns = []

  for (let id in graphIndex) {
    let node = graphIndex[id]

    for (let ref of node[RDFA_copy] || []) {
      let pattern = graphIndex[ref[ID]]
      if (pattern === void 0) continue

      let types = pattern[TYPE]
      if (!types || !types.find(s => s === RDFA_Pattern)) continue

      delete node[RDFA_copy]

      usedPatterns.push(ref[ID])

      for (let p in pattern) {
        let values = pattern[p]
        if (p === ID) continue
        if (p === REVERSE) continue
        if (p === TYPE) {
          values = values.filter(v => v !== RDFA_Pattern)
        }
        let existing = node[p]
        if (existing) values = existing.concat(values)
        node[p] = values
        // TODO: if p === RDFA_copy, recurse...
      }
    }
  }

  if (keepPattern) return

  for (let patternId of usedPatterns) {
    delete graphIndex[patternId]
  }
}
