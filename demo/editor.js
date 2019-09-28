import {readSource} from '../lib/xhtreqreader.js'
import * as transcribers from '../lib/transcribers.js'
import {visualize} from './visualizer.js'
import {renderArrows} from './arrows.js'

var ldtrEditor = {

  init: function () {
    this.viewDiv = document.querySelector('#view')
    this.editorArea = document.querySelector('#editor')
    this.statusDiv = document.querySelector('#status')
    this.urlInput = document.querySelector('#url')
    this.typeSelect = document.querySelector('select#typesel')
    let reload = document.querySelector('#reload')
    this.toggleedit = document.querySelector('#toggleedit')

    this.params = this.parseParams(
        window.location.search.substring(1))

    if (!this.params.url || this.params.edit) {
      document.body.classList.add('edit')
    }

    this.editorArea.onkeyup = function () {
      this.parseAndProcess()
    }.bind(this)

    const toggleEditLabel = on => {
      this.toggleedit.textContent = on ? '»' : '«'
    }
    toggleEditLabel(document.body.classList.contains('edit'))
    this.toggleedit.addEventListener('click', evt => {
      toggleEditLabel(document.body.classList.toggle('edit'))
    })

    reload.addEventListener('click', async evt => {
      this.loadData(this.urlInput.value)
    })

    for (let type in transcribers.transcribers) {
      this.typeSelect.add(new Option(type, type))
      this.typeSelect.selectedOptions[0].value
    }

    this.typeSelect.addEventListener('change', async evt => {
      let type = this.typeSelect.options[this.typeSelect.selectedIndex].value
      if (type === 'application/ld+json') {
        this.setData(JSON.stringify(this.currentData, null, 2), type)
      } else if (type === 'text/turtle' || type === 'text/trig') {
        const serializer = await import('../lib/trig/serializer.js')
        let chunks = []
        serializer.serialize(this.currentData, {write (chunk) {chunks.push(chunk)}})
        this.setData(chunks.join(''), type)
      }
    })

    this.loadData(decodeURIComponent(this.params.url))
  },

  parseParams: function (query) {
    return query.split(/\&/).reduce(function (map, pair) {
      var tuple = pair.split(/=/)
      map[tuple[0]] = tuple[1] || true
      return map
    }, {})
  },

  loadData: async function (url) {
    if (!url) return

    let headers = transcribers.requestHeaders()
    let { data, type } = await readSource(url, headers)

    if (data.nodeType === 9) {
      data = data.documentElement.outerHTML
    }
    this.urlInput.value = url
    this.setData(data, type)

    await this.parseAndProcess()

    // force browser to recognize dynamically generated :target
    if (window.location.hash) {
      window.location = window.location.hash
    }
  },

  setData: function (data, type) {
    this.editorArea.value = data
    this.typeSelect.selectedIndex = Array.prototype.findIndex.call(
        this.typeSelect.options, it => it.value === type)
  },

  parseData: async function () {
    let data = this.editorArea.value
    let type = this.typeSelect.options[this.typeSelect.selectedIndex].value
    let url = this.urlInput.value
    let transcribe = transcribers.transcribers[type]
    return await transcribe({data, type, base: url})
  },

  parseAndProcess: async function () {
    let data = this.editorArea.value
    var pos = this.editorArea.selectionStart
    var row = 1
    var col = 1
    for (var i=0; i < pos; i++) {
      if (data[i] === '\n') {
        row += 1
        col = 1
      } else {
        col++
      }
    }
    this.statusDiv.innerText = 'Line: '+ row +' Col: '+ col +' \n'

    let result
    try {
      result = await this.parseData()
    } catch (e) {
      if (!e.location)
        throw e
      this.statusDiv.classList.add('error')
      this.statusDiv.innerText += e.name +' at Line: '+ e.location.start.line
        +' Col: '+ e.location.start.column +'\n'+ e.message
      return
    }
    this.currentData = result

    this.statusDiv.classList.remove('error')
    this.statusDiv.innerText += "OK"

    if (this.params.indexed) {
      const indexer = await import('../lib/util/indexer.js')
      result = indexer.index(result)
    }
    visualize(this.viewDiv, result, this.params)
    renderArrows(this.viewDiv)
  }

}

window.onload = ldtrEditor.init()
