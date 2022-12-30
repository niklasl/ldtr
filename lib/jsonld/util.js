'use strict'

export class BNodes {

  constructor () {
    this.i = 0
    this.idMap = {}
  }

  makeBnodeId (identifier = null) {
    if (Object.hasOwnProperty.call(this.idMap, identifier)) {
      return this.idMap[identifier]
    }
    let bnodeId = "_:b" + this.i.toString()
    this.i += 1
    if (identifier != null) {
      this.idMap[identifier] = bnodeId
    }
    return bnodeId
  }
}
