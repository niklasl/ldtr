// @flow
import { uuid4 } from './uuid4'

/*::
type FlatJSONLDGraph = Object
type GraphIndex = Object
type IndexOpts = Object
*/

export function index (
  data/*: FlatJSONLDGraph */,
  { reverses = true, byType = false }/*: IndexOpts */ = {}
)/*: GraphIndex */ {
  let context = data['@context'] || {}
  /* TODO: handle variations, e.g. Array.isArray, or
  if (typeof context === 'string') {
    context = [context, {}]
  }
  */
  let index = {}
  let typeIndex = {}
  for (let item of data['@graph']) {
    if (item['@id'] === void 0) item['@id'] = '_:uuid-' + uuid4()
    let existingItem = index[item['@id']]
    if (existingItem) {
      for (let key in item) {
        let value = item[key]
        let existingValue = existingItem[key]
        if (existingValue && existingValue !== value) {
          if (!Array.isArray(existingValue)) {
            existingValue = existingItem[key] = [existingValue]
          }
          existingValue.push(value)
        } else {
          existingItem[key] = value
        }
      }
    } else {
      index[item['@id']] = item
    }
    if (byType) {
      let itemTypes = item['@type']
      if (itemTypes) {
        if (!Array.isArray(itemTypes)) itemTypes = [itemTypes]
        for (let type of itemTypes) {
          let typeArray = typeIndex[type]
          if (typeArray === void 0) typeArray = typeIndex[type] = []
          /*
          let typeEntry = typeIndex[type]
          if (typeEntry === void 0) typeEntry = typeIndex[type] = {}
          let typeRevs = typeEntry['@reverse']
          if (typeRevs === void 0) typeEntry['@reverse'] = typeRevs = {}
          let typeArray = typeRevs['@type']
          if (typeArray === void 0) typeRevs['@type'] = typeArray = []
          */
          typeArray.push({ '@id': item['@id'] })
        }
      }
    }
  }
  for (let item of data['@graph']) {
    for (let link in item) {
      let linkeds = item[link]
      if (!Array.isArray(linkeds)) linkeds = [linkeds]
      for (let ref of linkeds) {
        let linked = index[ref['@id']]
        if (typeof linked !== 'object') continue
        if (reverses) {
          let revmap = linked['@reverse']
          if (revmap === void 0) revmap = linked['@reverse'] = {}
          let revs = revmap[link]
          if (revs === void 0) revs = revmap[link] = []
          if (!revs.find(it => it['@id'] === item['@id'])) {
            revs.push({ '@id': item['@id'] })
          }
        }
      }
    }
  }
  let byIdKey = 'byId'
  let byTypeKey = typeof byType === 'string' ? byType : 'byType'
  context = {
    [byIdKey]: { '@id': '@graph', '@type': '@index' },
    [byTypeKey]: void 0
  }
  let result = {
    '@context': context,
    [byIdKey]: index,
    [byTypeKey]: void 0
  }
  if (byType) {
    context[byTypeKey] = null
    result[byTypeKey] = typeIndex
  }
  return result
}
