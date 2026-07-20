/*
 * Lazy-loads complement.css and proves that adding it causes no relayout:
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

  function snapshot() {
    var out = []
    document.querySelectorAll(SAMPLE).forEach(function (el) {
      var r = el.getBoundingClientRect()
      out.push([r.left, r.top, r.width, r.height])
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

  var loaded = false
  function loadComplement() {
    if (loaded) return
    loaded = true

    var before = snapshot()
    var t0 = performance.now()

    var link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'complement.css'
    link.addEventListener('load', function () {
      // let layout/paint settle over two frames before re-measuring
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          var shift = maxDelta(before, snapshot())
          document.body.classList.add('is-painted')
          set('m-status', 'Complement loaded in ' + Math.round(performance.now() - t0) + ' ms')
          set('m-shift', shift.toFixed(2) + ' px', shift < 0.5)
          set('m-cls', cls.toFixed(4), cls < 0.01)
          var btn = document.getElementById('load-btn')
          if (btn) {
            btn.textContent = '✓ Painted'
            btn.disabled = true
          }
        })
      })
    })
    document.head.appendChild(link)
  }

  window.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('load-btn')
    if (btn) btn.addEventListener('click', loadComplement)
  })
})()
