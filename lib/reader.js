'use(strict)';

const fs = require('fs');
const url = require('url');

function read(source, {base = null, type = null, encoding = 'utf-8'} = {}) {
  return new Promise(function (resolve, reject) {

    function handleStream(stream) {
      if (String(stream.statusCode).match(/^30[123578]$/)) {
        var location = stream.headers['location'];
        //console.log('Following ' + stream.statusCode +  ' redirect', location);
        getUrl(url.parse(location), handleStream);
        return
      }
      let mediaType = suffixMediaTypeMap[type] || type;
      if (stream.headers != null) {
        var ctype = stream.headers['content-type'];
        var match = ctype.match(/([^;]+)(?:\s*;\s*charset=([^,;]+))?/);
        mediaType = mediaType || match[1];
        encoding = encoding || match[2];
      } else {
        mediaType = mediaType || guessMediaType(source);
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

        var result = transcriber(str, base || source, mediaType);
        resolve(result);
      });
    }

    var urlObj = source ? url.parse(source) : null;
    if (urlObj && urlObj.protocol != null) {
      getUrl(urlObj, handleStream);
    } else {
      var stream = (!source || source === '-')? process.stdin :
        fs.createReadStream(source);
      handleStream(stream);
    }
  });
}

function getUrl(urlObj, handleStream) {
  const module = require(urlObj.protocol.replace(/:/, ''));
  var accepts = Object.keys(transcribers).map(function (k, i) {
    return k + (i? ';q=0.' + String(10 - i) : '');
  }).join(', ');

  var headers = {'accept': accepts, 'user-agent': "LDTR"};
  var options = Object.assign({headers: headers}, urlObj);
  module.get(options, handleStream);
}

function guessMediaType(source) {
  var m = source? source.match(/\.(\w+)$/) : null;
  var suffix = m? m[1] : 'ttl';
  return suffixMediaTypeMap[suffix];
}

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

var transcribers = {
  'text/trig': trigToJsonLd,
  'text/turtle': trigToJsonLd,
  'application/ld+json': JSON.parse.bind(JSON),
  'application/rdf+xml': rdfxmlToJsonLd,
  'text/html': rdfaToJsonLd
};

function trigToJsonLd(trigString) {
  const trigParser = require('./trig/parser');
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
  const rdfxmlParser = require('./rdfxml/parser');
  let domParser = newDomParser();
  let doc = domParser.parseFromString(xmlStr, 'text/xml');
  return rdfxmlParser.parse(doc);
}

function rdfaToJsonLd(xmlStr, source, mediaType) {
  const rdfaParser = require('./rdfa/parser');
  let domParser = newDomParser();
  var doc = domParser.parseFromString(xmlStr, 'text/html');
  return rdfaParser.parse(doc, source, {compact: true});
}

function newDomParser() {
  const xmlapi = typeof window !== 'undefined' ? window : require('xmldom');
  return new xmlapi.DOMParser();
}

module.exports = {
  read,
  getUrl,
  guessMediaType,
  transcribers,
  suffixMediaTypeMap
};
