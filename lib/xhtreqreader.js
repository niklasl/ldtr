'use(strict)'
if (typeof LDTR === 'undefined') LDTR = { module (factory) { factory(require, exports) } }

LDTR.module('reader', function (require, exports) {

  const reader = require('./reader')

  exports.parse = function (url, realUrl = void 0,
                            corsResolver = 'http://cors.io/?u=') {
    if (!url) return
    return new Promise((resolve, reject) => {
      var xhtreq = new XMLHttpRequest()
      xhtreq.open('GET', url)
      xhtreq.setRequestHeader('Accept', reader.getHeaders().accept)
      xhtreq.onreadystatechange = () => {
        if (xhtreq.readyState !== XMLHttpRequest.DONE) {
          if (xhtreq.readyState === XMLHttpRequest.LOADING) return
          if (xhtreq.getResponseHeader('Content-Type').match(/\/(\w+\+)?(x|x?ht)ml/)) {
            xhtreq.responseType = 'document'
          }
          return
        }

        if (xhtreq.status === 0 && !realUrl) {
          var corsUrl = this.corsResolver + url
          console.log("Failed CORS, retrying with " + corsUrl)
          exports.parse(corsUrl, url).then(resolve, reject)
          return
        }

        if (xhtreq.status !== 200) {
          console.log("Failed HTTP request:", xhtreq);
          reject({xhtreq})
          return
        }

        let contentType = xhtreq.getResponseHeader('Content-Type').replace(/;.*/, '')
        if (xhtreq.responseType === 'document') {
          data = xhtreq.responseXML
        } else {
          data = xhtreq.responseText;
        }

        try {
          let transcriber = reader.transcribers[contentType]
          transcriber(data, realUrl || url, contentType)
          resolve(data, realUrl || url)
        } catch (e) {
          reject(e)
        }
      }
      xhtreq.send('')
    })
  }

})
