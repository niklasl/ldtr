var fs = require('fs');
var rdfxmlParser = require('../lib/rdfxml/parser');
var xmldom = require('xmldom'),
  DOMParser = xmldom.DOMParser,
  XMLSerializer = xmldom.XMLSerializer;
var serializer = new XMLSerializer();
rdfxmlParser.serialize = serializer.serializeToString.bind(serializer);

var rdfStr = fs.readFileSync(__dirname + '/misc.rdf', 'utf-8');

var doc = new DOMParser().parseFromString(rdfStr, 'text/xml');

var result = rdfxmlParser.parse(doc);

console.log(JSON.stringify(result, null, 2));
