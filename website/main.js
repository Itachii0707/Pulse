/* global THREE */
/** @typedef {import('three')} THREE */
// ==========================================================================
// PULSE WEBSITE — INTERACTIVE LOGIC & THREE.JS 3D BACKGROUND
// Security: Anti-Clickjacking Framebuster
// ==========================================================================

if (window.top !== window.self) {
  try {
    window.top.location = window.self.location
  } catch {
    // Cross-origin ancestor detected, prevent display
    document.documentElement.style.display = 'none'
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav()
  initThreeJsBackground()
  initFaqAccordion()
  initDownloadHandlers()
  initStickyDownloadBar()
  initMockupSpeedTicker()
  initOpenInPulseHandlers()
})

/* ==========================================================================
   0. MOBILE NAVIGATION DRAWER
   ========================================================================== */
function initMobileNav() {
  const toggleBtn = document.getElementById('nav-toggle-btn')
  const navLinks = document.getElementById('primary-nav-links')
  const body = document.body
  if (!toggleBtn || !navLinks) return

  const closeNav = () => {
    body.classList.remove('nav-open')
    toggleBtn.setAttribute('aria-expanded', 'false')
  }

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    const isOpen = body.classList.toggle('nav-open')
    toggleBtn.setAttribute('aria-expanded', String(isOpen))
  })

  // Close when clicking any nav link
  navLinks.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', closeNav)
  })

  // Close when clicking outside navbar
  document.addEventListener('click', (e) => {
    if (body.classList.contains('nav-open') && !e.target.closest('.navbar')) {
      closeNav()
    }
  })

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && body.classList.contains('nav-open')) {
      closeNav()
      toggleBtn.focus()
    }
  })
}

/* ==========================================================================
   1. THREE.JS INTERACTIVE 3D NEUBRUTALIST BACKGROUND
   ========================================================================== */
function initThreeJsBackground() {
  const canvas = document.getElementById('bg-canvas')
  if (!canvas || typeof THREE === 'undefined') return

  const scene = new THREE.Scene()

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
  camera.position.z = 24

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  // Neubrutalist Palette Colors
  const colors = [
    0xffeb3b, // Yellow
    0xff5252, // Coral
    0x2196f3, // Blue
    0x4caf50, // Green
    0xff9800 // Orange
  ]

  // Lighting setup for clean graphic shading
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.85)
  scene.add(ambientLight)

  const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8)
  dirLight1.position.set(20, 30, 20)
  scene.add(dirLight1)

  const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4)
  dirLight2.position.set(-20, -20, 10)
  scene.add(dirLight2)

  // Helper to create a Neubrutalist mesh: solid colored face + bold black edges
  function createNeubrutalObject(geometry, color) {
    const group = new THREE.Group()

    // Solid face
    const material = new THREE.MeshPhongMaterial({
      color,
      flatShading: true,
      shininess: 30
    })
    const mesh = new THREE.Mesh(geometry, material)
    group.add(mesh)

    // Thick black outline edges
    const edges = new THREE.EdgesGeometry(geometry)
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x000000,
      linewidth: 3
    })
    const wireframe = new THREE.LineSegments(edges, lineMaterial)
    group.add(wireframe)

    return group
  }

  const objects = []
  const geometries = [
    new THREE.BoxGeometry(2.4, 2.4, 2.4),
    new THREE.OctahedronGeometry(1.8),
    new THREE.TorusGeometry(1.5, 0.65, 12, 24),
    new THREE.ConeGeometry(1.7, 3, 5),
    new THREE.DodecahedronGeometry(1.6),
    new THREE.CylinderGeometry(1.3, 1.3, 2.4, 6)
  ]

  // Spawn floating 3D objects across the screen viewport with adaptive resource scaling
  const isSaveData = Boolean(navigator.connection && navigator.connection.saveData === true)
  const isLowHardware = Boolean(navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
  const isMobile = window.innerWidth < 768 || ('ontouchstart' in window && window.innerWidth < 1024)
  const count = isSaveData || isLowHardware ? 4 : isMobile ? 5 : 14
  for (let i = 0; i < count; i++) {
    const geo = geometries[i % geometries.length]
    const color = colors[i % colors.length]
    const obj = createNeubrutalObject(geo, color)

    // Spread in 3D volume
    obj.position.x = (Math.random() - 0.5) * 36
    obj.position.y = (Math.random() - 0.5) * 26
    obj.position.z = (Math.random() - 0.5) * 16

    // Random initial rotation
    obj.rotation.x = Math.random() * Math.PI
    obj.rotation.y = Math.random() * Math.PI

    // Movement speeds
    const rotSpeedX = (Math.random() - 0.5) * 0.015 + 0.006
    const rotSpeedY = (Math.random() - 0.5) * 0.015 + 0.008
    const floatSpeed = 0.0008 + Math.random() * 0.0012
    const floatAmplitude = 0.4 + Math.random() * 0.6
    const floatOffset = Math.random() * Math.PI * 2
    const baseY = obj.position.y

    objects.push({
      group: obj,
      rotSpeedX,
      rotSpeedY,
      floatSpeed,
      floatAmplitude,
      floatOffset,
      baseY
    })

    scene.add(obj)
  }

  // Accessibility: Dynamic prefers-reduced-motion support
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  let prefersReducedMotion = motionQuery.matches

  const handleReducedMotionChange = () => {
    prefersReducedMotion = motionQuery.matches
    renderer.render(scene, camera)
    if (!prefersReducedMotion && isTabVisible) {
      animate(performance.now())
    }
  }

  if (typeof motionQuery.addEventListener === 'function') {
    motionQuery.addEventListener('change', handleReducedMotionChange)
  } else if (typeof motionQuery.addListener === 'function') {
    motionQuery.addListener(handleReducedMotionChange)
  }

  // Initial render frame
  renderer.render(scene, camera)

  // Mouse Parallax
  let targetMouseX = 0
  let targetMouseY = 0
  let mouseX = 0
  let mouseY = 0

  window.addEventListener(
    'mousemove',
    (e) => {
      targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2
      targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2
    },
    { passive: true }
  )

  // Render loop with tab visibility pausing and blurred 30fps throttling
  let isTabVisible = true
  let isWindowFocused = document.hasFocus()

  window.addEventListener('focus', () => {
    isWindowFocused = true
  })
  window.addEventListener('blur', () => {
    isWindowFocused = false
  })

  document.addEventListener('visibilitychange', () => {
    isTabVisible = !document.hidden
    if (isTabVisible && !prefersReducedMotion) {
      animate(performance.now())
    }
  })

  let lastFrameTime = 0
  const fpsLimitBlurred = 30
  const frameIntervalBlurred = 1000 / fpsLimitBlurred

  function animate(now) {
    if (!isTabVisible || prefersReducedMotion) return
    requestAnimationFrame(animate)

    // Throttle to 30fps when tab/window is blurred to preserve CPU and battery
    if (!isWindowFocused) {
      if (now - lastFrameTime < frameIntervalBlurred) {
        return
      }
    }
    lastFrameTime = now

    // Smooth mouse parallax easing
    mouseX += (targetMouseX - mouseX) * 0.05
    mouseY += (targetMouseY - mouseY) * 0.05

    camera.position.x = mouseX * 2.5
    camera.position.y = -mouseY * 2.5
    camera.lookAt(0, 0, 0)

    // Animate each floating object
    for (let i = 0; i < objects.length; i++) {
      const item = objects[i]
      item.group.rotation.x += item.rotSpeedX
      item.group.rotation.y += item.rotSpeedY
      item.group.position.y =
        item.baseY + Math.sin(now * item.floatSpeed + item.floatOffset) * item.floatAmplitude
    }

    renderer.render(scene, camera)
  }

  if (!prefersReducedMotion) {
    animate(performance.now())
  }

  // Window resize handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    if (prefersReducedMotion) {
      renderer.render(scene, camera)
    }
  })
}

/* ==========================================================================
   2. FAQ ACCORDION INTERACTION
   ========================================================================== */
function initFaqAccordion() {
  const faqCards = document.querySelectorAll('.faq-card')
  if (!faqCards.length) return

  faqCards.forEach((card) => {
    card.addEventListener('toggle', () => {
      if (card.open) {
        // Optional: Close other cards if desired, or keep open for comparison
        faqCards.forEach((otherCard) => {
          if (otherCard !== card && otherCard.open) {
            otherCard.removeAttribute('open')
          }
        })
      }
    })
  })
}

/* ==========================================================================
   3. DOWNLOAD HANDLERS & LIVE 247 MB PROGRESS NOTIFICATION
   ========================================================================== */
function initDownloadHandlers() {
  const downloadButtons = document.querySelectorAll('.download-trigger')
  const toast = document.getElementById('download-toast')
  const closeBtn = document.getElementById('toast-close-btn')
  const badgeEl = document.getElementById('toast-badge')
  const progressBarEl = document.getElementById('toast-progress-bar')
  const statBytesEl = document.getElementById('toast-stat-bytes')
  const statPctEl = document.getElementById('toast-stat-pct')
  const statSpeedEl = document.getElementById('toast-stat-speed')
  const statusMsgEl = document.getElementById('toast-status-msg')

  let toastTimeout
  let progressInterval
  const TOTAL_SIZE_MB = 247

  function runDownloadSimulation() {
    if (!toast) return

    // Reset UI state
    toast.classList.add('show')
    clearTimeout(toastTimeout)
    clearInterval(progressInterval)

    if (badgeEl) {
      badgeEl.textContent = '⚡ DEMO PREVIEW (SIMULATOR)'
      badgeEl.classList.remove('completed')
    }
    if (progressBarEl) progressBarEl.style.width = '0%'
    if (statBytesEl) statBytesEl.textContent = `0 MB / ${TOTAL_SIZE_MB} MB`
    if (statPctEl) statPctEl.textContent = '0%'
    if (statSpeedEl) statSpeedEl.textContent = '⚡ Initializing multi-pipe...'
    if (statusMsgEl)
      statusMsgEl.textContent = `Interactive Preview: Simulating multi-adapter bonding download (${TOTAL_SIZE_MB} MB)...`

    let currentMb = 0
    const durationMs = 3200 // 3.2 seconds smooth simulation
    const intervalMs = 50
    const totalSteps = durationMs / intervalMs
    const mbPerStep = TOTAL_SIZE_MB / totalSteps

    progressInterval = setInterval(() => {
      // Add slight jitter for realistic multi-pipe bonding rate
      const jitter = (Math.random() - 0.45) * 1.5
      currentMb = Math.min(TOTAL_SIZE_MB, currentMb + mbPerStep + jitter)
      const pct = Math.min(100, Math.round((currentMb / TOTAL_SIZE_MB) * 100))

      if (progressBarEl) progressBarEl.style.width = `${pct}%`
      if (statBytesEl) statBytesEl.textContent = `${Math.round(currentMb)} MB / ${TOTAL_SIZE_MB} MB`
      if (statPctEl) statPctEl.textContent = `${pct}%`

      // Live speed fluctuations
      if (statSpeedEl) {
        const liveSpeed = (68 + (Math.random() - 0.5) * 14).toFixed(1)
        statSpeedEl.textContent = `⚡ ~${liveSpeed} MB/s (Simulated)`
      }

      if (currentMb >= TOTAL_SIZE_MB) {
        clearInterval(progressInterval)
        if (progressBarEl) progressBarEl.style.width = '100%'
        if (statBytesEl) statBytesEl.textContent = `${TOTAL_SIZE_MB} MB / ${TOTAL_SIZE_MB} MB`
        if (statPctEl) statPctEl.textContent = '100%'
        if (statSpeedEl) statSpeedEl.textContent = '✓ Simulation Complete'

        if (badgeEl) {
          badgeEl.textContent = '✓ SIMULATION COMPLETE'
          badgeEl.classList.add('completed')
        }
        if (statusMsgEl) {
          statusMsgEl.textContent = `Interactive preview complete! Demonstrating multi-connection bonding for Pulse-Setup.exe (${TOTAL_SIZE_MB} MB).`
        }

        // Auto hide after completion (30 seconds so user can review, or closed via X)
        toastTimeout = setTimeout(() => {
          toast.classList.remove('show')
        }, 30000)
      }
    }, intervalMs)
  }

  if (closeBtn && toast) {
    closeBtn.addEventListener('click', () => {
      toast.classList.remove('show')
      clearTimeout(toastTimeout)
      clearInterval(progressInterval)
    })
  }

  downloadButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      // Create celebration ripple / burst effect
      createClickBurst(e.clientX, e.clientY)
      runDownloadSimulation()
    })
  })

  // Neubrutalist click confetti burst
  function createClickBurst(x, y) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const burstCount = 12
    const colors = ['#FFEB3B', '#FF5252', '#2196F3', '#4CAF50', '#FF9800', '#000000']

    for (let i = 0; i < burstCount; i++) {
      const particle = document.createElement('div')
      particle.style.position = 'fixed'
      particle.style.left = `${x}px`
      particle.style.top = `${y}px`
      particle.style.width = `${Math.floor(Math.random() * 8 + 6)}px`
      particle.style.height = `${Math.floor(Math.random() * 8 + 6)}px`
      particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]
      particle.style.border = '1.5px solid #000000'
      particle.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px'
      particle.style.pointerEvents = 'none'
      particle.style.zIndex = '9999'
      document.body.appendChild(particle)

      const angle = (Math.PI * 2 * i) / burstCount + (Math.random() - 0.5)
      const velocity = Math.random() * 90 + 50
      const destX = Math.cos(angle) * velocity
      const destY = Math.sin(angle) * velocity

      const animation = particle.animate(
        [
          { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
          {
            transform: `translate(${destX}px, ${destY}px) rotate(${Math.random() * 360}deg) scale(0)`,
            opacity: 0
          }
        ],
        {
          duration: 650,
          easing: 'cubic-bezier(0, .9, .57, 1)',
          fill: 'forwards'
        }
      )

      animation.onfinish = () => particle.remove()
    }
  }
}

/* ==========================================================================
   4. STICKY DOWNLOAD BAR ON SCROLL
   ========================================================================== */
function initStickyDownloadBar() {
  const bar = document.getElementById('sticky-download-bar')
  const heroSection = document.getElementById('hero')
  if (!bar || !heroSection) return

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        // Show bar once hero section is scrolled past
        if (!entry.isIntersecting) {
          bar.classList.add('visible')
        } else {
          bar.classList.remove('visible')
        }
      })
    },
    { threshold: 0.15 }
  )

  observer.observe(heroSection)
}

/* ==========================================================================
   5. DASHBOARD MOCKUP LIVE SPEED FLICKER
   ========================================================================== */
function initMockupSpeedTicker() {
  const speedEl = document.getElementById('mockup-combined-speed')
  if (!speedEl) return

  const baseSpeed = 312.4
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    speedEl.textContent = `${baseSpeed} MB/s`
    return
  }

  setInterval(() => {
    // Subtle realistic network variation +/- 4 MB/s
    const jitter = (Math.random() - 0.5) * 6
    const current = (baseSpeed + jitter).toFixed(1)
    speedEl.textContent = `${current} MB/s`
  }, 1400)
}

/* ==========================================================================
   6. DEEP-LINK "OPEN IN PULSE" PROTOCOL HANDLER & FALLBACK
   ========================================================================== */
function initOpenInPulseHandlers() {
  const openPulseButtons = document.querySelectorAll('.open-in-pulse-btn')
  const modal = document.getElementById('pulse-modal')
  const closeBtn = document.getElementById('modal-close-btn')
  const cancelBtn = document.getElementById('modal-cancel-btn')
  const backdrop = document.getElementById('modal-backdrop')

  function closeModal() {
    if (modal) modal.style.display = 'none'
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal)
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal)
  if (backdrop) backdrop.addEventListener('click', closeModal)

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.style.display !== 'none') {
      closeModal()
    }
  })

  openPulseButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      const targetUrl =
        btn.getAttribute('data-url') || 'https://speed.cloudflare.com/__down?bytes=104857600'
      const deepLink = `pulse://download?url=${encodeURIComponent(targetUrl)}`

      let appOpened = false

      const onBlur = () => {
        appOpened = true
        window.removeEventListener('blur', onBlur)
        document.removeEventListener('visibilitychange', onVisibilityChange)
      }

      const onVisibilityChange = () => {
        if (document.hidden) {
          appOpened = true
          window.removeEventListener('blur', onBlur)
          document.removeEventListener('visibilitychange', onVisibilityChange)
        }
      }

      window.addEventListener('blur', onBlur)
      document.addEventListener('visibilitychange', onVisibilityChange)

      // Use hidden iframe to trigger protocol handler without navigating away
      const iframe = document.createElement('iframe')
      iframe.style.display = 'none'
      iframe.src = deepLink
      document.body.appendChild(iframe)

      // Check after 1800ms: if the window never lost focus or became hidden, Pulse is likely not installed
      setTimeout(() => {
        iframe.remove()
        window.removeEventListener('blur', onBlur)
        document.removeEventListener('visibilitychange', onVisibilityChange)

        if (!appOpened) {
          if (modal) modal.style.display = 'flex'
        }
      }, 1800)
    })
  })
}
