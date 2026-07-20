/*
 * Toggles complement.css on and off at runtime (no page reload) and proves
 * that both adding and removing it cause no relayout:
 *   - measures the bounding box of a sample of elements before/after, and
 *   - reads the browser's own Cumulative Layout Shift score.
 * Both should stay at (near) zero because the spine already locked in geometry.
 */
(function () {
  var SAMPLE = [
    '.nav__inner', '.hero__inner', '.hero__title', '.hero__art', '.window',
    '.stats__grid', '.section__title', '.features__grid', '.card',
    '.pricing__grid', '.plan', '.plan--featured', '.cta__inner', '.footer__grid',
  ].join(',')

  var cls = 0
  try {
    new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (e) {
        if (!e.hadRecentInput) cls += e.value
      })
    }).observe({ type: 'layout-shift', buffered: true })
  } catch {
    /* layout-shift API unavailable */
  }

  // Transform-independent layout box: offset dimensions + position accumulated
  // through the offsetParent chain. Unlike getBoundingClientRect() this ignores
  // transforms/animations (scale, translate, the float keyframes), so it
  // measures true reflow — exactly what the spine is supposed to prevent.
  function snapshot() {
    var out = []
    document.querySelectorAll(SAMPLE).forEach(function (el) {
      var x = 0
      var y = 0
      var n = el
      while (n) {
        x += n.offsetLeft
        y += n.offsetTop
        n = n.offsetParent
      }
      out.push([x, y, el.offsetWidth, el.offsetHeight])
    })
    return out
  }

  function maxDelta(before, after) {
    var max = 0
    for (var i = 0; i < before.length && i < after.length; i++) {
      for (var k = 0; k < 4; k++) {
        max = Math.max(max, Math.abs(before[i][k] - after[i][k]))
      }
    }
    return max
  }

  function set(id, text, ok) {
    var el = document.getElementById(id)
    if (!el) return
    el.textContent = text
    if (ok !== undefined) el.className = 'metric__val ' + (ok ? 'is-ok' : 'is-bad')
  }

  function afterLayout(fn) {
    requestAnimationFrame(function () {
      requestAnimationFrame(fn)
    })
  }

  function updateButton(painted) {
    var btn = document.getElementById('load-btn')
    if (!btn) return
    btn.textContent = painted ? 'Remove complement.css' : 'Load complement.css'
    btn.className = painted ? 'is-painted' : ''
  }

  var link = null

  function addComplement() {
    var before = snapshot()
    var t0 = performance.now()

    link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'complement.css'
    link.id = 'complement-css'
    link.addEventListener('load', function () {
      document.body.classList.add('is-painted')
      afterLayout(function () {
        var shift = maxDelta(before, snapshot())
        set('m-status', 'Complement loaded in ' + Math.round(performance.now() - t0) + ' ms')
        set('m-shift', shift.toFixed(2) + ' px', shift < 0.5)
        set('m-cls', cls.toFixed(4), cls < 0.01)
      })
    })
    document.head.appendChild(link)
    updateButton(true)
  }

  function removeComplement() {
    var before = snapshot()
    if (link) {
      link.remove()
      link = null
    }
    document.body.classList.remove('is-painted')
    afterLayout(function () {
      var shift = maxDelta(before, snapshot())
      set('m-status', 'Complement removed — back to spine only')
      set('m-shift', shift.toFixed(2) + ' px', shift < 0.5)
      set('m-cls', cls.toFixed(4), cls < 0.01)
    })
    updateButton(false)
  }

  window.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('load-btn')
    if (!btn) return
    btn.addEventListener('click', function () {
      if (link) removeComplement()
      else addComplement()
    })
  })
})()
