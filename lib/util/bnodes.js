'use strict'

export class BNodes {

  constructor (pfx = 'b', startAt = 0) {
    this.pfx = pfx
    this.i = startAt
    this.idMap = {}
  }

  makeBnodeId (identifier = null) {
    if (Object.hasOwnProperty.call(this.idMap, identifier)) {
      return this.idMap[identifier]
    }
    let bnodeId = "_:" + this.pfx + this.i.toString()
    this.i += 1
    if (identifier != null) {
      this.idMap[identifier] = bnodeId
    }
    return bnodeId
  }
}
