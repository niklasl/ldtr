let computePaths
let observer

export function renderArrows(container) {
  const SVGNS = 'http://www.w3.org/2000/svg'
  let svg = document.createElementNS(SVGNS, 'svg')
  svg.innerHTML = `
  <defs>
    <marker id="arrowhead" orient="auto" markerWidth="2" markerHeight="4"
            refX="0.1" refY="2">
      <path d="M0,0 V4 L2,2 Z" />
    </marker>
    <marker id="arrowhead-rel" orient="auto" markerWidth="4" markerHeight="8"
            refX="0.1" refY="4">
      <path d="M0,0 V8 L4,4 Z" />
    </marker>
    <marker id="arrowhead-rev" orient="auto" markerWidth="4" markerHeight="8"
            refX="0.1" refY="4">
      <path d="M0,0 V8 L4,4 Z" />
    </marker>
  </defs>
  `
  svg.style.height = 'auto'
  svg.style.height = `${container.scrollHeight}px`
  container.appendChild(svg)

  computePaths = []

  document.querySelectorAll('[id].card').forEach(target => {
    target.addEventListener('click', evt => {
      if (evt.ctrlKey || evt.metaKey) return

      target.classList.toggle('selected')
      evt.preventDefault()
    })
  })

  document.querySelectorAll('.card a.ref').forEach(link => {
    let targetId = link.attributes.href.value
    let target = document.getElementById(targetId)
    if (!target) return

    let card = link.closest('[id].card')

    let arrow = document.createElementNS(SVGNS, 'path')
    arrow.classList.add('arrow')

    let arrowLabel
    let label = link.closest('article > p, div > p, div').querySelector('b')
    if (label) {
      arrowLabel = document.createElement('span')
      arrowLabel.classList.add('arrow')
      arrowLabel.appendChild(label.cloneNode(true))
      let targetRef = card.querySelector('a.id').cloneNode(true)
      arrowLabel.appendChild(targetRef)
      container.appendChild(arrowLabel)
    }

    let computePath = () => {
      let linkX = link.offsetLeft
      let linkY = link.offsetTop + (link.offsetHeight / 2)
      let offsetParent = link.offsetParent
      while (offsetParent) {
        linkX += offsetParent.offsetLeft
        linkY += offsetParent.offsetTop
        offsetParent = offsetParent.offsetParent
      }

      let tgtX = target.offsetLeft
      let tgtY = target.offsetTop
      offsetParent = target.offsetParent
      while (offsetParent) {
        tgtX += offsetParent.offsetLeft
        tgtY += offsetParent.offsetTop
        offsetParent = offsetParent.offsetParent
      }

      let c1, c2

      linkX += link.offsetWidth

      let targetToLeft = linkX > (tgtX + target.offsetWidth)
      let targetToRight = linkX < tgtX
      let targetAbove = linkY > (tgtY + target.offsetHeight)
      let targetBelow = linkY < tgtY

      if (targetToRight) {
        c1 = linkX + ((tgtX-linkX) / 4)
        c2 = linkY + ((tgtY-linkY) / 4)
      } else {
        c1 = linkX + ((linkX-tgtX) / 4)
        c2 = linkY + ((tgtY-linkY) / 4)
      }

      if (targetToLeft) {
        tgtX += target.offsetWidth
      } else if (!targetToRight) {
        tgtX += target.offsetWidth / 2
      }
      if (targetAbove) {
        tgtY += target.offsetHeight
      } else if (!targetBelow) {
        tgtY += target.offsetHeight / 2
      }

      let c = `C${c1},${c2} ${c1},${c2}`

      let d = `M${linkX},${linkY} ${c} ${tgtX},${tgtY}`
      arrow.setAttribute('d', d)

      let labelX = tgtX - ((tgtX-linkX) * 0.1)
      let labelY = tgtY - ((tgtY-linkY) * 0.1)

      if (arrowLabel) {
        arrowLabel.style.left = `${labelX}px`
        arrowLabel.style.top = `${labelY}px`
      }
    }
    computePath()
    computePaths.push(computePath)

    link.addEventListener('click', evt => {
      if (evt.ctrlKey || evt.metaKey) return

      card.classList.remove('selected')
      link.classList.toggle('selected')
      evt.stopPropagation()
      evt.preventDefault()
      container.scrollTo({
        left: target.offsetLeft,
        top: target.offsetTop,
        behavior: 'smooth'
      })
      target.classList.add('selected')
    })

    card.addEventListener('mouseover', evt => {
      arrow.classList.add('rel')
    })
    card.addEventListener('mouseout', evt => {
      if (card.classList.contains('selected')) return
      arrow.classList.remove('rel')
    })

    target.addEventListener('mouseover', evt => {
      arrow.classList.add('rev')
      if (arrowLabel) arrowLabel.classList.add('rev')
    })
    target.addEventListener('mouseout', evt => {
      if (target.classList.contains('selected')) return
      arrow.classList.remove('rev')
      if (arrowLabel) arrowLabel.classList.remove('rev')
    })

    if (arrowLabel) {
      arrowLabel.addEventListener('mouseover', evt => {
        arrow.classList.add('rev')
        arrowLabel.classList.add('rev')
      })
      arrowLabel.addEventListener('mouseout', evt => {
        if (target.classList.contains('selected')) return
        arrow.classList.remove('rev')
        arrowLabel.classList.remove('rev')
      })
      arrowLabel.addEventListener('click', evt => {
        target.classList.remove('selected')
        card.classList.add('selected')
        evt.stopPropagation()
        evt.preventDefault()
        container.scrollTo({
          left: card.offsetLeft,
          top: card.offsetTop,
          behavior: 'smooth'
        })
      })
    }

    svg.appendChild(arrow)
    svg.appendChild(document.createTextNode('\n   '))

  })

  function recomputePaths() {
    if (computePaths) computePaths.forEach(f => { f() })
    svg.style.height = 'auto'
    svg.style.height = `${container.scrollHeight}px`
  }

  if (observer) {
    observer.disconnect()
  }
  observer = new MutationObserver(recomputePaths)
  observer.observe(document.body, {attributes: true})

  window.removeEventListener('resize', recomputePaths)
  window.addEventListener('resize', recomputePaths)
}
