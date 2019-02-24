const tape = require('tape')
const fs = require('fs')
const rdfxmlParser = require('../lib/rdfxml/parser')
const xmldom = require('xmldom')

global.XMLSerializer = xmldom.XMLSerializer

let datadir = __dirname + '/data'

tape.test('parse rdfxml', t => {
  let xmlStr = fs.readFileSync(datadir + '/misc.rdf', 'utf-8')
  let result = rdfxmlParser.parse(
    new xmldom.DOMParser().parseFromString(xmlStr, 'text/xml'),
    new xmldom.XMLSerializer())
  let expected = JSON.parse(fs.readFileSync(datadir + '/rdfxml-1-out.jsonld', 'utf-8'))
  t.deepEqual(result, expected)
  t.end()
})
