const tape = require('tape')
const fs = require('fs')
const path = require('path')

const {read} = require('../../ldtr/lib/main')
const {expand} = require('../../ldtr/lib/jsonld/algorithm')
const {index} = require('../../ldtr/lib/util/indexer')
const {expandPatterns} = require('../../ldtr/lib/rdfa/copypattern')

let datafile = pth => path.join(__dirname, 'data', pth)

tape.test('pattern copy', t => {
  read(datafile('copypattern.ttl')).then(data => {
    let graphIndex = index(expand({}, data)).byId
    expandPatterns(graphIndex)
    let result = Object.values(graphIndex)
    for (let item of result) {
      if (item['@id'].startsWith('_:')) delete item['@id']
    }
    let expected = JSON.parse(fs.readFileSync(datafile('copypattern-1-out.jsonld'), 'utf-8'))
    t.deepEqual(result, expected)
  })
  t.end()
})
