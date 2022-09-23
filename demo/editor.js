import {readSource} from '../lib/xhtreqreader.js'
import * as transcribers from '../lib/transcribers.js'
import {
  suffixMediaTypeMap as mediaTypes,
  guessMediaType,
}  from '../lib/mediatypes.js'
import { CONTEXT, GRAPH, ID } from '../lib/jsonld/keywords.js'
import {visualize} from './visualizer.js'
import {renderArrows} from './arrows.js'
import {toggleTheme} from './theme.js'

export const ldtrEditor = {

  async init (window) {
    this.params = this.parseParams(window.location.search.substring(1))
    this.window = window

    window.addEventListener('load', () => {
      this.setupWidgetsAndHandlers()
      if (this.params.url) {
        this.loadData(decodeURIComponent(this.params.url), true)
      }
    })
  },

  parseParams (query) {
    return query.split(/\&/).reduce(function (map, pair) {
      var tuple = pair.split(/=/)
      map[tuple[0]] = tuple[1] || true
      return map
    }, {})
  },

  setupWidgetsAndHandlers () {
    let document = this.window.document
    this.body = document.body
    this.viewDiv = document.querySelector('#view')
    this.editorArea = document.querySelector('#editor')
    this.statusDiv = document.querySelector('#status')
    this.urlInput = document.querySelector('#url')
    this.typeSelect = document.querySelector('select#typesel')
    let reload = document.querySelector('#reload')
    this.toggleedit = document.querySelector('#toggleedit')

    if (!this.params.url || this.params.edit) {
      this.body.classList.add('edit')
    }

    let darktoggle = document.querySelector('#darktoggle')
    darktoggle.addEventListener('click', toggleTheme)
    toggleTheme()

    this.editorArea.onkeyup = function () {
      this.onEdit()
    }.bind(this)

    const toggleEditLabel = on => {
      this.toggleedit.textContent = on ? '»' : '«'
    }
    toggleEditLabel(this.body.classList.contains('edit'))
    const toggleEdit = () => {
      toggleEditLabel(this.body.classList.toggle('edit'))
    }
    this.toggleedit.addEventListener('click', toggleEdit)

    reload.addEventListener('click', async evt => {
      this.loadData(this.urlInput.value)
    })

    document.addEventListener('dblclick', async evt => {
      let link = evt.target.closest('a:link')
      if (link) {
        evt.stopPropagation()
        evt.preventDefault()

        let href = link.attributes.href.value
        href = this.expandCurie(href)

        console.log(`Loading ${href}...`)
        await this.loadData(href)

        this.viewDiv.scrollTo({
          left: this.body.offsetLeft,
          top: this.body.offsetTop,
          behavior: 'smooth'
        })
      }
    })

    this.window.addEventListener('popstate', evt => {
      this.currentData = evt.state
      this.setDataJson(this.currentData)
      this.process(this.currentData)
    })

    for (let type in transcribers.transcribers) {
      this.typeSelect.add(new Option(type, type))
      this.typeSelect.selectedOptions[0].value
    }

    this.typeSelect.addEventListener('change', async evt => {
      // convertEditorData
      let type = this.typeSelect.options[this.typeSelect.selectedIndex].value
      if (type === mediaTypes.jsonld) {
        this.setDataJson(this.currentData)
      } else {
        let modulepromise
        switch (type) {
          case 'text/turtle':
          case mediaTypes.trig:
          modulepromise = await import('../lib/trig/serializer.js')
          break
          case 'application/rdf+xml':
          modulepromise = await import('../lib/rdfxml/serializer.js')
          break
        }
        if (modulepromise) {
          const {serialize} = await modulepromise
          let chunks = []
          serialize(this.currentData, {write (chunk) {chunks.push(chunk)}})
          this.setDataText(chunks.join(''), type)
        }
      }
    })

    document.addEventListener('keydown', evt => {
      if (evt.target.closest('input, textarea, select')) {
        return
      }
      if (!evt.shiftKey) {
        return
      }
      switch (evt.key) {
        case 'E':
          toggleEdit()
          break
        case 'D':
          toggleTheme()
          break
      }
    })
  },

  async loadData (url, initial = false) {
    if (!url) return

    this.body.classList.add('loading')

    let headers = transcribers.requestHeaders()
    let result
    try {
      result = await readSource(url, headers)
    } catch (e) {
      this.body.classList.remove('loading')
      console.error(e)
      return
    }

    let { data, type } = result
    if (data.nodeType === 9) {
      data = data.documentElement.outerHTML
    }
    this.urlInput.value = url
    if (!(type in transcribers.transcribers)) {
      type = guessMediaType(url)
    }

    this.setDataText(data, type)

    await this.parseAndProcess()

    this.body.classList.remove('loading')

    // force browser to recognize dynamically generated :target
    if (this.window.location.hash) {
      this.window.location = this.window.location.hash
    }

    let urlParam = `url=${escape(url)}`
    let editParam = this.params.edit ? '&edit=true' : ''
    let appUrl = this.window.location.toString().replace(/([?&])url=.+&?/,
                                                    `$1${urlParam}${editParam}`)
    if (appUrl.indexOf(urlParam) === -1) {
      let delim = appUrl.indexOf('?') === -1 ? '?' : '&'
      appUrl = `${appUrl}${delim}${urlParam}`
    }

    let title = this.window.document.title
    if (initial) {
      this.window.history.replaceState(this.currentData, title, appUrl)
    } else {
      this.window.history.pushState(this.currentData, title, appUrl)
    }
  },

  async onEdit () {
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

    this.parseAndProcess()
  },

  setDataText (data, type) {
    this.editorArea.value = data
    this.typeSelect.selectedIndex = Array.prototype.findIndex.call(
        this.typeSelect.options, it => it.value === type)
  },

  setDataJson (data) {
    this.setDataText(JSON.stringify(data, null, 2), mediaTypes.jsonld)
  },

  async parseAndProcess () {
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
    this.process(result)
  },

  async process (result) {
    this.currentData = result

    this.statusDiv.classList.remove('error')
    this.statusDiv.innerText += "OK"

    if (this.params.indexed) {
      const indexer = await import('../lib/util/indexer.js')
      result = indexer.index(result)
    }

    visualize(this.viewDiv, result, this.params)
    renderArrows(this.viewDiv)
  },

  async parseData () {
    let data = this.editorArea.value
    let index = this.typeSelect.selectedIndex
    let type = this.typeSelect.options[index > -1 ? index : 0].value
    let url = this.urlInput.value
    let transcribe = transcribers.transcribers[type]

    return await transcribe({data, type, base: url})
  },

  expandCurie (href) {
    let ctx = this.currentData[CONTEXT]
    let pfx = href.split(':', 1)
    if (ctx && pfx in ctx) {
      href = `${ctx[pfx]}${href.substring(pfx.length + 2)}`
    }
    return href
  }

}
