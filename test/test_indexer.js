const tape = require('tape')
const main = require('../lib/main')
const ldcx = require('../lib/jsonld/algorithm')
const {ID, TYPE, VALUE, REVERSE} = require('../lib/jsonld/keywords')
const indexer = require('../lib/util/indexer')

let SCHEMA = (t = '') => 'http://schema.org/' + t

tape.test('index data', t => {
  main.parse(__dirname + '/data/lotr.ttl').then(data => {
    let index = indexer.index(ldcx.expand({}, data))

    let item = index.byId['http://dbpedia.org/resource/The_Fellowship_of_the_Ring']
    t.equal(item[TYPE][0], 'http://schema.org/CreativeWork')
    t.equal(item[SCHEMA('name')][0][VALUE], 'Fellowship of the Ring')
    let example = index.byId[item[REVERSE][SCHEMA('exampleOfWork')][0][ID]]
    t.equal(example[TYPE][0], 'http://schema.org/Book')
    t.equal(example[SCHEMA('datePublished')][0][VALUE], '1956')

    t.end()
  })
})
