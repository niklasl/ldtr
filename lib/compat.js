export let vars = {
  DOMParser: null,
  XMLSerializer: null,
  randomBytes: null,
  createHash: null,
}

if (typeof window === 'object') {
  vars.DOMParser = window.DOMParser
  vars.XMLSerializer = window.XMLSerializer
  vars.randomBytes = function (i) { return window.crypto.getRandomValues(new Uint8Array(i)) }
  vars.createHash = function (algo) { return window.crypto.createHash(algo) }
}
