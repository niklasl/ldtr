var LDTR = {
  modules: {},
  module (path, factory) {
    let module = {}
    factory(path => this.modules[path], module)
    this.modules[path] = module
    let nsKeys = path.split('/').map(it =>
      it[0].toUpperCase() + it.substring(1))
    let owner = this
    for (let key of nsKeys.slice(0, -1)) {
      let part = owner[key]
      if (part === void 0) part = owner[key] = {}
    }
    owner[nsKeys[nsKeys.length - 1]] = module
  }
}
