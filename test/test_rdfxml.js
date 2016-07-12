var fs = require('fs');
var rdfxmlParser = require('../lib/rdfxml/parser');
var xmldom = require('xmldom');

var xmlStr = fs.readFileSync(__dirname + '/misc.rdf', 'utf-8');

var result = rdfxmlParser.parse(
  new xmldom.DOMParser().parseFromString(xmlStr, 'text/xml'),
  new xmldom.XMLSerializer());

console.log(JSON.stringify(result, null, 2));
