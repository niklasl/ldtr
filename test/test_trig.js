var fs = require('fs')
var trigParser = require('../lib/parsers/trig')

try {
  var result = trigParser.parse(fs.readFileSync(__dirname + '/misc.trig', 'utf-8'))
  console.log(JSON.stringify(result, null, 2))
} catch (e) {
  console.error(e.name, 'at', 'line:', e.line, 'column:', e.column, e.message)
  throw e;
}
