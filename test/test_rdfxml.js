const tape = require('tape')
const fs = require('fs')

require('../lib/setup')
const rdfxmlParser = require('../lib/rdfxml/parser')

let datadir = __dirname + '/data'

tape.test('parse rdfxml', t => {
  let xmlStr = fs.readFileSync(datadir + '/misc.rdf', 'utf-8')
  let result = rdfxmlParser.parse(xmlStr)
  let expected = JSON.parse(fs.readFileSync(datadir + '/rdfxml-1-out.jsonld', 'utf-8'))
  t.deepEqual(result, expected)
  t.end()
})
