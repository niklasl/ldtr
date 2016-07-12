var fs = require('fs');

function trigToJsonLd(trigString) {
  var trigParser = require('./trig/parser');
  try {
    return trigParser.parse(trigString);
  } catch (e) {
    if (e.location) {
      var start = e.location.start;
      console.error(e.name, 'at', 'line:', start.line, 'column:', start.column, e.message);
    } else {
      throw e;
    }
  }
}

function rdfxmlToJsonLd(xmlStr) {
  var rdfxmlParser = require('./rdfxml/parser');
  var xmldom = require('xmldom');
  return rdfxmlParser.parse(
    new xmldom.DOMParser().parseFromString(xmlStr, 'text/xml'),
    new xmldom.XMLSerializer());
}

var transcribers = {
  'text/turtle': trigToJsonLd,
  'text/trig': trigToJsonLd,
  'application/rdf+xml': rdfxmlToJsonLd
};

var suffixMediaTypeMap = {
  'ttl': 'text/turtle',
  'trig': 'text/trig',
  'jsonld': 'application/ld+json',
  'xml' : 'application/rdf+xml',
  'rdf' : 'application/rdf+xml',
  'rdfs' : 'application/rdf+xml',
  'owl' : 'application/rdf+xml'
};

function getMediaType(source) {
  var m = source? source.match(/\.(\w+)$/) : null;
  var suffix = m? m[1] : 'ttl';
  return suffixMediaTypeMap[suffix];
}

function transcribe(source, encoding) {
  var mediaType = getMediaType(source);
  var stream = (!source || source === '-')?
    process.stdin : fs.createReadStream(source);
  var transcriber = transcribers[mediaType];

  var bufs = [];
  stream.on('data', function(d){ bufs.push(d); });
  stream.on('end', function() {
    var buf = Buffer.concat(bufs);
    var str = buf.toString(encoding);
    var result = transcriber(str);
    console.log(JSON.stringify(result, null, 2));
  });
}

module.exports = function () {
  var args = process.argv.slice(2);
  var filepath = args[0];
  transcribe(filepath, 'utf-8');
};
