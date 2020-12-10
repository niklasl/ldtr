'use(strict)'

export function readSource (url, headers, realUrl = void 0,
  corsResolver = 'http://cors-anywhere.herokuapp.com/'
) {
  if (!url) return
  return new Promise((resolve, reject) => {
    var xhtreq = new XMLHttpRequest()
    xhtreq.open('GET', url)
    xhtreq.setRequestHeader('Accept', headers.accept)
    xhtreq.onreadystatechange = async () => {
      let contentType = xhtreq.getResponseHeader('Content-Type') || ''
      if (xhtreq.readyState !== XMLHttpRequest.DONE) {
        if (xhtreq.readyState === XMLHttpRequest.LOADING) return
        if (contentType.match(/\/(\w+\+)?(x|x?ht)ml/)) {
          xhtreq.responseType = 'document'
        }
        return
      }

      if (xhtreq.status === 0 && !realUrl) {
        var corsUrl = corsResolver + url
        console.log("Failed CORS, retrying with " + corsUrl)
        readSource(corsUrl, headers, url).then(resolve, reject)
        return
      }

      if (xhtreq.status !== 200) {
        console.log("Failed HTTP request:", xhtreq)
        reject({xhtreq})
        return
      }

      let type = contentType.replace(/;.*/, '')
      let data
      if (xhtreq.responseType === 'document') {
        data = xhtreq.responseXML
      } else {
        data = xhtreq.responseText
      }

      try {
        resolve({data, type})
      } catch (e) {
        reject(e)
      }
    }

    xhtreq.send('')
  })
}
