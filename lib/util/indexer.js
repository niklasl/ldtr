// @flow
let {uuid4} = require('./uuid4')

/*::
type ExpandedJSONLDGraph = Object
type GraphIndex = Object
*/

function index (data/*: ExpandedJSONLDGraph */)/*: GraphIndex */ {
  let index = {}
  for (let item of data['@graph']) {
    if (item['@id'] === void 0) item['@id'] = '_:uuid-' + uuid4()
    index[item['@id']] = item
  }
  for (let item of data['@graph']) {
    for (let link in item) {
      let linkeds = item[link]
      if (!Array.isArray(linkeds)) linkeds = [linkeds]
      for (let ref of linkeds) {
        let linked = index[ref['@id']]
        if (typeof linked !== 'object') continue
        let revmap = linked['@reverse']
        if (revmap === void 0) revmap = linked['@reverse'] = {}
        let revs = revmap[link]
        if (revs === void 0) revs = revmap[link] = []
        revs.push({'@id': item['@id']})
      }
    }
  }
  return index
}

module.exports = {index}
