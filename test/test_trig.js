const fs = require('fs')
const tape = require('tape')
const trigParser = require('../lib/trig/parser')

let datadir = __dirname + '/data'

tape.test('', t => {
  let expected = JSON.parse(fs.readFileSync(datadir + '/misc-out.jsonld', 'utf-8'))
  let result = trigParser.parse(fs.readFileSync(datadir + '/misc.trig', 'utf-8'))
  t.deepEqual(result, expected)
  t.end()
})
