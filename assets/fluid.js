(() => {
  // Theme Presets Configuration
  const THEMES = {
    cosmic: {
      id: 'cosmic',
      name: '星夜极光',
      isDark: true,
      css: {
        '--bg': '#0e1015',
        '--surface': '#161922',
        '--ink': '#f2efe8',
        '--ink-2': '#c8c5be',
        '--muted': '#9a9893',
        '--line': '#252834',
        '--line-strong': '#383c4e',
        '--accent': '#e8452c',
        '--accent-ink': '#f08a74',
        '--btn-bg': '#f2efe8',
        '--btn-ink': '#17191e',
        '--feather-color': '#0e1015'
      },
      shader: {
        vignetteColor: [0.18, 0.22, 0.32],
        vignetteStrength: 0.95,
        causticColor: [0.70, 0.88, 1.0],
        causticIntensity: 0.38,
        lightColor: [0.85, 0.95, 1.0],
        lightIntensity: 1.9,
        grainStrength: 0.065,
        waterWakeIntensity: 1.4
      },
      gradient(ctx, w, h) {
        ctx.fillStyle = '#080a0f';
        ctx.fillRect(0, 0, w, h);
        const rad = ctx.createRadialGradient(w * 0.5, h * 0.45, w * 0.05, w * 0.5, h * 0.5, w * 0.85);
        rad.addColorStop(0, '#1c2842');
        rad.addColorStop(0.35, '#131b2e');
        rad.addColorStop(0.7, '#0b0f18');
        rad.addColorStop(1, '#06080d');
        ctx.fillStyle = rad;
        ctx.fillRect(0, 0, w, h);
        const dust = ctx.createRadialGradient(w * 0.7, h * 0.3, 0, w * 0.7, h * 0.3, w * 0.4);
        dust.addColorStop(0, 'rgba(56, 92, 142, 0.35)');
        dust.addColorStop(0.5, 'rgba(214, 63, 42, 0.06)');
        dust.addColorStop(1, 'transparent');
        ctx.fillStyle = dust;
        ctx.fillRect(0, 0, w, h);
      }
    },
    pearl: {
      id: 'pearl',
      name: '霜白银流',
      isDark: false,
      css: {
        '--bg': '#f8f9fa',
        '--surface': '#ffffff',
        '--ink': '#1b1c1f',
        '--ink-2': '#4a4a4a',
        '--muted': '#6b6b6b',
        '--line': '#e4e6ea',
        '--line-strong': '#d0d3d8',
        '--accent': '#d63f2a',
        '--accent-ink': '#b5341f',
        '--btn-bg': '#1b1c1f',
        '--btn-ink': '#ffffff',
        '--feather-color': '#f8f9fa'
      },
      shader: {
        vignetteColor: [0.72, 0.80, 0.78],
        vignetteStrength: 0.85,
        causticColor: [1.0, 1.0, 1.0],
        causticIntensity: 0.22,
        lightColor: [1.0, 1.0, 1.0],
        lightIntensity: 1.35,
        grainStrength: 0.035,
        waterWakeIntensity: 0.95
      },
      gradient(ctx, w, h) {
        ctx.fillStyle = '#f0f3f5';
        ctx.fillRect(0, 0, w, h);
        const rad = ctx.createRadialGradient(w * 0.5, h * 0.4, w * 0.05, w * 0.5, h * 0.5, w * 0.85);
        rad.addColorStop(0, '#eaf1f3');
        rad.addColorStop(0.4, '#d8e4e6');
        rad.addColorStop(0.75, '#c6d7d5');
        rad.addColorStop(1, '#b0c2be');
        ctx.fillStyle = rad;
        ctx.fillRect(0, 0, w, h);
      }
    },
    sage: {
      id: 'sage',
      name: '鼠尾草绿',
      isDark: false,
      css: {
        '--bg': '#f5f2ef',
        '--surface': '#ffffff',
        '--ink': '#152b2d',
        '--ink-2': '#37484a',
        '--muted': '#6f7e80',
        '--line': '#ded9d2',
        '--line-strong': '#c9c2b8',
        '--accent': '#d63f2a',
        '--accent-ink': '#b5341f',
        '--btn-bg': '#152b2d',
        '--btn-ink': '#ffffff',
        '--feather-color': '#f5f2ef'
      },
      shader: {
        vignetteColor: [0.42, 0.56, 0.50],
        vignetteStrength: 1.0,
        causticColor: [1.0, 1.0, 1.0],
        causticIntensity: 0.28,
        lightColor: [0.92, 0.97, 1.0],
        lightIntensity: 1.6,
        grainStrength: 0.06,
        waterWakeIntensity: 1.1
      },
      gradient(ctx, w, h) {
        ctx.fillStyle = '#8ea79c';
        ctx.fillRect(0, 0, w, h);
        const rad = ctx.createRadialGradient(w * 0.5, h * 0.45, w * 0.05, w * 0.5, h * 0.5, w * 0.85);
        rad.addColorStop(0, '#b6cbbf');
        rad.addColorStop(0.4, '#9fb8ad');
        rad.addColorStop(0.8, '#7b978b');
        rad.addColorStop(1, '#5a7569');
        ctx.fillStyle = rad;
        ctx.fillRect(0, 0, w, h);
      }
    },
    dusk: {
      id: 'dusk',
      name: '落日余晖',
      isDark: true,
      css: {
        '--bg': '#120e18',
        '--surface': '#1c1626',
        '--ink': '#f7edf2',
        '--ink-2': '#cbbec6',
        '--muted': '#9b8b95',
        '--line': '#2d233c',
        '--line-strong': '#45365c',
        '--accent': '#e8452c',
        '--accent-ink': '#f08a74',
        '--btn-bg': '#f7edf2',
        '--btn-ink': '#171220',
        '--feather-color': '#120e18'
      },
      shader: {
        vignetteColor: [0.28, 0.16, 0.30],
        vignetteStrength: 0.92,
        causticColor: [1.0, 0.85, 0.72],
        causticIntensity: 0.34,
        lightColor: [1.0, 0.90, 0.84],
        lightIntensity: 1.75,
        grainStrength: 0.055,
        waterWakeIntensity: 1.35
      },
      gradient(ctx, w, h) {
        ctx.fillStyle = '#0f0a15';
        ctx.fillRect(0, 0, w, h);
        const rad = ctx.createRadialGradient(w * 0.5, h * 0.4, w * 0.05, w * 0.5, h * 0.5, w * 0.85);
        rad.addColorStop(0, '#361d3c');
        rad.addColorStop(0.35, '#28142f');
        rad.addColorStop(0.7, '#180c20');
        rad.addColorStop(1, '#0e0714');
        ctx.fillStyle = rad;
        ctx.fillRect(0, 0, w, h);
        const glow = ctx.createRadialGradient(w * 0.65, h * 0.35, 0, w * 0.65, h * 0.35, w * 0.45);
        glow.addColorStop(0, 'rgba(214, 63, 42, 0.28)');
        glow.addColorStop(0.6, 'rgba(164, 48, 86, 0.12)');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
      }
    }
  };

  const canvas = document.getElementById('fluidCanvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, powerPreference: 'high-performance' })
          || canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'high-performance' });

  if (!gl) {
    console.warn("WebGL fluid canvas unavailable");
    return;
  }

  // Extensions for float textures
  const isWebgl2 = (typeof WebGL2RenderingContext !== 'undefined') && (gl instanceof WebGL2RenderingContext);
  let fboInternalFormat = gl.RGBA;
  let fboFormat = gl.RGBA;
  let fboType = gl.UNSIGNED_BYTE;

  if (isWebgl2) {
    gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('EXT_color_buffer_half_float');
    fboInternalFormat = gl.RGBA16F;
    fboFormat = gl.RGBA;
    fboType = gl.HALF_FLOAT;
  } else {
    const hf = gl.getExtension('OES_texture_half_float');
    gl.getExtension('OES_texture_half_float_linear');
    if (hf) {
      fboInternalFormat = gl.RGBA;
      fboFormat = gl.RGBA;
      fboType = hf.HALF_FLOAT_OES;
    }
  }

  // Quad Vertex Shader
  const vsSource = `
    attribute vec2 position;
    varying vec2 vUv;
    void main() {
      vUv = (position + 1.0) * 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  // Wave Simulation Fragment Shader
  const simFsSource = `
    precision highp float;
    uniform sampler2D tState;
    uniform vec2 uCell;
    uniform vec2 uAspect;
    uniform vec2 uFrom;
    uniform vec2 uTo;
    uniform float uReach;
    uniform float uPress;
    uniform float uDamping;
    varying vec2 vUv;

    float segment(vec2 p, vec2 a, vec2 b) {
      vec2 ab = b - a;
      float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 0.000001), 0.0, 1.0);
      return length(p - a - ab * t);
    }

    void main() {
      vec2 state = texture2D(tState, vUv).rg;
      float average = (
        texture2D(tState, vUv - vec2(uCell.x, 0.0)).r +
        texture2D(tState, vUv + vec2(uCell.x, 0.0)).r +
        texture2D(tState, vUv - vec2(0.0, uCell.y)).r +
        texture2D(tState, vUv + vec2(0.0, uCell.y)).r
      ) * 0.25;
      state.g = (state.g + (average - state.r) * 2.0) * uDamping;
      state.r += state.g;
      state.r = mix(state.r, average, 0.06);
      float away = segment(vUv * uAspect, uFrom * uAspect, uTo * uAspect);
      float press = 1.0 - smoothstep(0.0, uReach, away);
      state.r -= press * press * uPress;
      gl_FragColor = vec4(state, 0.0, 1.0);
    }
  `;

  // Composite Fragment Shader
  const renderFsSource = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tImage;
    uniform sampler2D tWater;
    uniform vec2 uBox;
    uniform vec2 uImageSize;
    uniform vec2 uWaterCell;
    uniform float uWater;
    uniform float uTime;
    uniform float uMotion;
    uniform float uAspect;

    uniform vec3 uVignetteColor;
    uniform float uVignetteStrength;
    uniform vec3 uCausticColor;
    uniform float uCausticIntensity;
    uniform vec3 uLightColor;
    uniform float uLightIntensity;
    uniform float uGrainStrength;

    vec2 cover(vec2 uv, vec2 canvas, vec2 size, vec2 focus) {
      float screen = canvas.x / canvas.y;
      float image = size.x / size.y;
      vec2 scale = screen > image ? vec2(1.0, image / screen) : vec2(screen / image, 1.0);
      return (uv - focus) * scale + focus;
    }

    vec2 swellWave(vec2 p, vec2 direction, float frequency, float speed) {
      return direction * cos(dot(p, direction) * frequency + uTime * speed);
    }
    vec3 swell(vec2 uv, vec2 canvas, float amplitude) {
      vec2 aspect = vec2(canvas.x / canvas.y, 1.0);
      vec2 p = uv * aspect;
      vec2 slope = swellWave(p, vec2(0.832, 0.555), 4.1, 0.9)
        + swellWave(p, vec2(-0.625, 0.781), 6.3, -1.05) * 0.7
        + swellWave(p, vec2(0.196, -0.981), 9.7, 1.3) * 0.5
        + swellWave(p, vec2(-0.949, -0.316), 14.9, -1.6) * 0.35
        + swellWave(p, vec2(0.447, 0.894), 23.0, 2.0) * 0.25
        + swellWave(p, vec2(-0.3, 0.954), 37.0, -2.4) * 0.12;
      return vec3(slope * amplitude / aspect, dot(slope, vec2(-0.5, 0.866)) * 0.045);
    }
    float settle(vec2 uv, vec2 canvas, float edge) {
      vec2 inside = min(uv, 1.0 - uv) * canvas;
      return smoothstep(0.0, edge, min(inside.x, inside.y));
    }

    vec3 wake(vec2 uv) {
      vec2 dx = vec2(uWaterCell.x, 0.0);
      vec2 dy = vec2(0.0, uWaterCell.y);
      vec2 slope = vec2(
        texture2D(tWater, uv + dx).r - texture2D(tWater, uv - dx).r,
        texture2D(tWater, uv + dy).r - texture2D(tWater, uv - dy).r
      ) * uWater;
      return vec3(slope * 0.5, dot(slope, vec2(0.6, -0.8)) * 2.5);
    }

    float lightPlay(vec2 p, float t){
      float w1 = sin(p.x * 4.2 + t * 0.30 + sin(p.y * 3.1 - t * 0.22) * 1.4);
      float w2 = sin(p.y * 5.0 - t * 0.26 + sin(p.x * 2.6 + t * 0.18) * 1.6);
      float w3 = sin((p.x + p.y) * 3.3 + t * 0.21);
      float c = (w1 + w2 + w3) / 3.0;
      return pow(max(0.0, c), 5.0);
    }

    float caustic(vec2 uvRaw, float playhead, float intensity, float scale){
      const float TAU = 6.28318530718;
      vec2 uv = (uvRaw - 0.5) / scale + 0.5;
      float t = playhead * TAU / 100.0 + 23.0;
      vec2 uvPx = uv * vec2(max(uAspect, 1.0), max(1.0 / uAspect, 1.0));
      vec2 p = fract(uvPx) * TAU - 250.0;
      vec2 i = p; float c = 1.0;
      float inten = mix(0.002519, 0.01178, intensity);
      for (int n = 0; n < 5; n++) {
        float nt = t * float(n + 1);
        i = p + vec2(cos(nt - i.x) + sin(nt + i.y), sin(nt - i.y) + cos(nt + i.x));
        c += 1.0 / length(vec2(p.x / (sin(i.x + nt) / inten), p.y / (cos(i.y + nt) / inten)));
      }
      c /= 5.0;
      c = 1.17 - pow(c, 1.4);
      return clamp(pow(abs(c), 8.0), 0.0, 1.0);
    }

    void main() {
      vec3 moving = swell(vUv, uBox, 0.008) * settle(vUv, uBox, 32.0) * uMotion;
      vec3 water = wake(vUv) * uMotion;
      vec2 uv = vUv + moving.xy + water.xy;
      vec3 color = texture2D(tImage, cover(uv, uBox, uImageSize, vec2(0.5))).rgb;
      color *= 1.0 + moving.z;
      color += water.z;

      vec2 cc = (uv - 0.5) * vec2(uAspect, 1.0);
      float mask = 1.0 - smoothstep(0.55, 1.0, length(cc));
      color += uCausticColor * caustic(uv, uTime * 2.0, 0.2, 2.0) * mask * uCausticIntensity;

      vec2 lp = uv * vec2(uAspect, 1.0);
      color += uLightColor * (lightPlay(lp * 1.15, uTime) * 0.11 + lightPlay(lp * 2.3 + 3.7, uTime * 1.3) * 0.05) * uLightIntensity;

      float vig = smoothstep(0.35, 1.05, length((vUv - 0.5) * vec2(uAspect, 1.0)));
      color = mix(color, color * uVignetteColor, vig * uVignetteStrength);

      color += (fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * uGrainStrength;
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function createShader(gl, type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  function createProgram(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(p));
      gl.deleteProgram(p);
      return null;
    }
    return p;
  }

  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const simFs = createShader(gl, gl.FRAGMENT_SHADER, simFsSource);
  const renderFs = createShader(gl, gl.FRAGMENT_SHADER, renderFsSource);

  const simProgram = createProgram(gl, vs, simFs);
  const renderProgram = createProgram(gl, vs, renderFs);

  // Quad Buffer
  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
    -1,  1,
     1, -1,
     1,  1
  ]), gl.STATIC_DRAW);

  function createFBO(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, fboInternalFormat, w, h, 0, fboFormat, fboType, null);

    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, tex, width: w, height: h };
  }

  const simRes = [Math.max(128, Math.round(window.innerWidth / 3)), Math.max(128, Math.round(window.innerHeight / 3))];
  let fboA = createFBO(simRes[0], simRes[1]);
  let fboB = createFBO(simRes[0], simRes[1]);

  const bgTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, bgTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = 1024;
  offscreenCanvas.height = 1024;
  const offCtx = offscreenCanvas.getContext('2d');

  let currentTheme = THEMES.cosmic;

  function updateThemeTexture(theme) {
    theme.gradient(offCtx, 1024, 1024);
    gl.bindTexture(gl.TEXTURE_2D, bgTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, offscreenCanvas);

    for (const [key, val] of Object.entries(theme.css)) {
      document.documentElement.style.setProperty(key, val);
    }
    document.documentElement.setAttribute('data-theme', theme.id);
  }

  // Pointer tracking
  let pointerFrom = [0.5, 0.5];
  let pointerTo = [0.5, 0.5];
  let pointerPress = 0;
  let targetPress = 0;

  window.addEventListener('pointermove', (e) => {
    const nx = e.clientX / window.innerWidth;
    const ny = 1.0 - (e.clientY / window.innerHeight);
    pointerFrom = [pointerTo[0], pointerTo[1]];
    pointerTo = [nx, ny];
    const dist = Math.hypot(pointerTo[0] - pointerFrom[0], pointerTo[1] - pointerFrom[1]);
    targetPress = Math.min(dist * 18.0 * (currentTheme.shader.waterWakeIntensity || 1.0), 1.0);
  }, { passive: true });

  window.addEventListener('pointerdown', (e) => {
    const nx = e.clientX / window.innerWidth;
    const ny = 1.0 - (e.clientY / window.innerHeight);
    pointerFrom = [nx - 0.005, ny - 0.005];
    pointerTo = [nx + 0.005, ny + 0.005];
    targetPress = 1.0;
  }, { passive: true });

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    const sw = Math.max(128, Math.round(w / 3));
    const sh = Math.max(128, Math.round(h / 3));
    if (fboA.width !== sw || fboA.height !== sh) {
      gl.deleteTexture(fboA.tex); gl.deleteFramebuffer(fboA.fb);
      gl.deleteTexture(fboB.tex); gl.deleteFramebuffer(fboB.fb);
      fboA = createFBO(sw, sh);
      fboB = createFBO(sw, sh);
    }
  }
  window.addEventListener('resize', resize);
  resize();

  // Topbar Segmented Appearance Control (Auto, Light, Dark)
  let mode = localStorage.getItem('flowwish_theme_mode') || 'auto';
  const sysDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  function getEffectiveTheme(m) {
    if (m === 'dark') return THEMES.cosmic;
    if (m === 'light') return THEMES.pearl;
    return sysDarkQuery.matches ? THEMES.cosmic : THEMES.pearl;
  }

  function setMode(newMode, triggerWave = false) {
    mode = newMode;
    if (mode === 'auto' || mode === 'light' || mode === 'dark') {
      localStorage.setItem('flowwish_theme_mode', mode);
    }

    document.querySelectorAll('.theme-seg-btn').forEach(btn => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
    });

    const targetTheme = getEffectiveTheme(mode);
    currentTheme = targetTheme;
    updateThemeTexture(currentTheme);

    document.querySelectorAll('.theme-btn').forEach(b => {
      b.classList.toggle('is-active', b.dataset.theme === targetTheme.id);
    });

    if (triggerWave) {
      pointerFrom = [0.46, 0.5];
      pointerTo = [0.54, 0.5];
      targetPress = 0.85;
    }
  }

  document.querySelectorAll('.theme-seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setMode(btn.dataset.mode, true);
    });
  });

  sysDarkQuery.addEventListener('change', () => {
    if (mode === 'auto') {
      setMode('auto', false);
    }
  });

  // Bottom Theme Bar buttons integration
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tid = btn.dataset.theme;
      if (!THEMES[tid]) return;
      currentTheme = THEMES[tid];
      document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('is-active', b === btn));
      updateThemeTexture(currentTheme);

      if (tid === 'cosmic') {
        mode = 'dark';
      } else if (tid === 'pearl') {
        mode = 'light';
      } else {
        mode = 'custom';
      }
      localStorage.setItem('flowwish_theme_mode', mode);
      document.querySelectorAll('.theme-seg-btn').forEach(b => {
        b.classList.toggle('is-active', b.dataset.mode === mode);
      });

      pointerFrom = [0.48, 0.5];
      pointerTo = [0.52, 0.5];
      targetPress = 0.8;
    });
  });

  // Initialize
  setMode(mode, false);

  // Animation Loop
  let startTime = performance.now();
  let prevTime = startTime;
  let animTime = 0;

  function render(now) {
    requestAnimationFrame(render);

    const dt = Math.min((now - prevTime) / 1000, 0.05);
    prevTime = now;
    animTime += dt;

    pointerPress += (targetPress - pointerPress) * 0.25;
    targetPress *= 0.88;

    const w = canvas.width;
    const h = canvas.height;
    const aspect = w / h;

    // Fluid simulation pass (Ping-Pong)
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboB.fb);
    gl.viewport(0, 0, fboA.width, fboA.height);
    gl.useProgram(simProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fboA.tex);
    gl.uniform1i(gl.getUniformLocation(simProgram, 'tState'), 0);

    gl.uniform2f(gl.getUniformLocation(simProgram, 'uCell'), 1.0 / fboA.width, 1.0 / fboA.height);
    gl.uniform2f(gl.getUniformLocation(simProgram, 'uAspect'), aspect, 1.0);
    gl.uniform2f(gl.getUniformLocation(simProgram, 'uFrom'), pointerFrom[0], pointerFrom[1]);
    gl.uniform2f(gl.getUniformLocation(simProgram, 'uTo'), pointerTo[0], pointerTo[1]);
    gl.uniform1f(gl.getUniformLocation(simProgram, 'uReach'), 0.035);
    gl.uniform1f(gl.getUniformLocation(simProgram, 'uPress'), pointerPress * 0.08);
    gl.uniform1f(gl.getUniformLocation(simProgram, 'uDamping'), 0.984);

    const posLocSim = gl.getAttribLocation(simProgram, 'position');
    gl.enableVertexAttribArray(posLocSim);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.vertexAttribPointer(posLocSim, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    const tmp = fboA;
    fboA = fboB;
    fboB = tmp;

    // Main composition pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(renderProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bgTexture);
    gl.uniform1i(gl.getUniformLocation(renderProgram, 'tImage'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, fboA.tex);
    gl.uniform1i(gl.getUniformLocation(renderProgram, 'tWater'), 1);

    gl.uniform2f(gl.getUniformLocation(renderProgram, 'uBox'), w, h);
    gl.uniform2f(gl.getUniformLocation(renderProgram, 'uImageSize'), 1024, 1024);
    gl.uniform2f(gl.getUniformLocation(renderProgram, 'uWaterCell'), 1.0 / fboA.width, 1.0 / fboA.height);
    gl.uniform1f(gl.getUniformLocation(renderProgram, 'uWater'), 1.0);
    gl.uniform1f(gl.getUniformLocation(renderProgram, 'uTime'), animTime);
    gl.uniform1f(gl.getUniformLocation(renderProgram, 'uMotion'), 1.0);
    gl.uniform1f(gl.getUniformLocation(renderProgram, 'uAspect'), aspect);

    const s = currentTheme.shader;
    gl.uniform3fv(gl.getUniformLocation(renderProgram, 'uVignetteColor'), s.vignetteColor);
    gl.uniform1f(gl.getUniformLocation(renderProgram, 'uVignetteStrength'), s.vignetteStrength);
    gl.uniform3fv(gl.getUniformLocation(renderProgram, 'uCausticColor'), s.causticColor);
    gl.uniform1f(gl.getUniformLocation(renderProgram, 'uCausticIntensity'), s.causticIntensity);
    gl.uniform3fv(gl.getUniformLocation(renderProgram, 'uLightColor'), s.lightColor);
    gl.uniform1f(gl.getUniformLocation(renderProgram, 'uLightIntensity'), s.lightIntensity);
    gl.uniform1f(gl.getUniformLocation(renderProgram, 'uGrainStrength'), s.grainStrength);

    const posLocRender = gl.getAttribLocation(renderProgram, 'position');
    gl.enableVertexAttribArray(posLocRender);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.vertexAttribPointer(posLocRender, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    canvas.classList.add('is-ready');
  }

  requestAnimationFrame(render);
})();
