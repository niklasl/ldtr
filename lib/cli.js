'use(strict)';

var fs = require('fs');
var url = require('url');

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

function rdfaToJsonLd(xmlStr, source, mediaType) {
  var rdfaParser = require('./rdfa/parser');
  var xmldom = require('xmldom');
  var doc = new xmldom.DOMParser().parseFromString(xmlStr, 'text/html');
  return rdfaParser.parse(doc, source, {compact: true});
}

var transcribers = {
  'text/trig': trigToJsonLd,
  'text/turtle': trigToJsonLd,
  'application/ld+json': JSON.parse.bind(JSON),
  'application/rdf+xml': rdfxmlToJsonLd,
  'text/html': rdfaToJsonLd
};

var suffixMediaTypeMap = {
  'ttl': 'text/turtle',
  'trig': 'text/trig',
  'jsonld': 'application/ld+json',
  'xml' : 'application/rdf+xml',
  'rdf' : 'application/rdf+xml',
  'rdfs' : 'application/rdf+xml',
  'owl' : 'application/rdf+xml',
  'html': 'text/html'
};

function guessMediaType(source) {
  var m = source? source.match(/\.(\w+)$/) : null;
  var suffix = m? m[1] : 'ttl';
  return suffixMediaTypeMap[suffix];
}

function readSource(source, callback) {

  function handleStream(stream) {
    var encoding, mediaType;
    if (String(stream.statusCode).match(/^30[123578]$/)) {
      var location = stream.headers['location'];
      //console.log('Following ' + stream.statusCode +  ' redirect', location);
      getUrl(url.parse(location), handleStream);
      return
    }
    if (stream.headers != null) {
      var ctype = stream.headers['content-type'];
      var match = ctype.match(/([^;]+)(?:\s*;\s*charset=([^,;]+))?/);
      mediaType = match[1];
      encoding = match[2];
    } else {
      mediaType = guessMediaType(source);
      encoding = 'utf-8';
    }

    var transcriber = transcribers[mediaType];

    var bufs = [];
    stream.on('data', function(d){ bufs.push(d); });
    stream.on('end', function() {
      var buf = Buffer.concat(bufs);
      var str
      try {
        // Two problems may occur: unknown or wrong encoding
        str = buf.toString(encoding);
      } catch (e) {
        str = buf.toString('utf-8');
      }
      var result = transcriber(str, source, mediaType);
      callback(result);
    });
  }

  var urlObj = url.parse(source);
  if (urlObj.protocol != null) {
    getUrl(urlObj, handleStream);
  } else {
    var stream = (!source || source === '-')? process.stdin :
      fs.createReadStream(source);
    handleStream(stream);
  }
}

function getUrl(urlObj, handleStream) {
  var module = require(urlObj.protocol.replace(/:/, ''));
  var accepts = Object.keys(transcribers).map(function (k, i) {
    return k + (i? ';q=0.' + String(10 - i) : '');
  }).join(', ');

  var headers = {'accept': accepts, 'user-agent': "LDTR"};
  var options = Object.assign({headers: headers}, urlObj);
  module.get(options, handleStream);
}

function main(source) {
  readSource(source, function (result) {
    console.log(JSON.stringify(result, null, 2));
  });
}

module.exports = function () {
  var args = process.argv.slice(2);
  var filepath = args[0];
  main(filepath);
};
