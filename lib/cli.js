var fs = require('fs');
var trigParser = require('./parsers/trig');

function streamToString(stream, encoding, callback) {
  var bufs = [];
  stream.on('data', function(d){ bufs.push(d); });
  stream.on('end', function() {
    var buf = Buffer.concat(bufs);
    callback(buf.toString(encoding));
  });
}

function toJsonLd(trigString) {
  try {
    var result = trigParser.parse(trigString);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(e.name, 'at', 'line:', e.line, 'column:', e.column, e.message);
  }
}

module.exports = function () {
  var args = process.argv.slice(2);
  var filepath = args[0];
  var stream = (!filepath || filepath === '-')? process.stdin :
    fs.createReadStream(filepath);
  streamToString(stream, 'utf-8', toJsonLd);
}
