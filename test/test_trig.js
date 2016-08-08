var fs = require('fs');
var trigParser = require('../lib/trig/parser');

try {
  var result = trigParser.parse(fs.readFileSync(__dirname + '/misc.trig', 'utf-8'));
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error(JSON.stringify(e));
  throw e;
}
