import GUI from "https://cdn.jsdelivr.net/npm/lil-gui@0.18.2/+esm";
// Based on code by Ksenia Kondrashova (https://codepen.io/ksenia-k/pen/MWMObrY)
// Licensed under the MIT License.

// ===================================================
// 기본 캔버스 셋업
// ===================================================
const canvasEl  = document.querySelector("canvas");
const textureEl = document.createElement("canvas");
const textureCtx = textureEl.getContext("2d");

// ===================================================
// 프리뷰(자동 잉크) 관련 상태
// ===================================================
let isPreview = true;                // 처음엔 자동 프리뷰 모드
let previewStartTime = null;         // 프리뷰 시작 시점
const PREVIEW_DURATION = 4000;       // ⏱ 프리뷰가 혼자 도는 시간(ms)

// ===================================================
// 폰트 옵션
// ===================================================
const fontOptions = {
  "Arial": "Arial, sans-serif",
  "newyork": "newyork, serif",
  "Verdana": "Verdana, sans-serif",
  "Tahoma": "Tahoma, sans-serif",
  "Times New Roman": "Times New Roman, serif",
  "Georgia": "Georgia, serif",
  "Garamond": "Garamond, serif",
  "Courier New": "Courier New, monospace",
  "Brush Script MT": "Brush Script MT, cursive",
  "zal": "zal, serif"
};

// ===================================================
// 파라미터
// ===================================================
const params = {
  fontName: "zal",
  isBold: false,
  fontSize: 300,
  text: "Ink",
  pointerSize: null, // resize에서 세팅

  color: { r: 0.40, g: 0.75, b: 1.0 },

  // 반응형 폰트
  responsive: true,
  minFont: 70,
  maxFont: 300,
  fromWidth: 360,
  toWidth: 1440
};

// ===================================================
// 포인터 상태
// ===================================================
const pointer = {
  x: 0,
  y: 0,
  dx: 0,
  dy: 0,
  moved: false
};

// ===================================================
// WebGL State
// ===================================================
let outputColor, velocity, divergence, pressure, canvasTexture;

const gl = canvasEl.getContext("webgl");
gl.getExtension("OES_texture_float");

const vertexShader = createShader(
  document.getElementById("vertShader").innerHTML,
  gl.VERTEX_SHADER
);

const splatProgram             = createProgram("fragShaderPoint");
const divergenceProgram        = createProgram("fragShaderDivergence");
const pressureProgram          = createProgram("fragShaderPressure");
const gradientSubtractProgram  = createProgram("fragShaderGradientSubtract");
const advectionProgram         = createProgram("fragShaderAdvection");
const outputShaderProgram      = createProgram("fragShaderOutputShader");

// 풀스크린 정점 버퍼
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]),
  gl.STATIC_DRAW
);

gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(
  gl.ELEMENT_ARRAY_BUFFER,
  new Uint16Array([0, 1, 2, 0, 2, 3]),
  gl.STATIC_DRAW
);

gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(0);

// ===================================================
// 유틸 함수
// ===================================================
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const mapRange = (x, inMin, inMax, outMin, outMax) => {
  const t = clamp((x - inMin) / (inMax - inMin), 0, 1);
  return outMin + (outMax - outMin) * t;
};

// ===================================================
// 부팅
// ===================================================
createTextCanvasTexture();
initFBOs();
createControls();
setupEvents();
resizeCanvas();
window.addEventListener("resize", resizeCanvas);
requestAnimationFrame(render);

// ===================================================
// 텍스트 → 텍스처
// ===================================================
function createTextCanvasTexture() {
  canvasTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, canvasTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

function updateTextCanvas() {
  textureCtx.fillStyle = "black";
  textureCtx.fillRect(0, 0, textureEl.width, textureEl.height);

  textureCtx.font =
    (params.isBold ? "bold " : "normal ") +
    (params.fontSize * devicePixelRatio) +
    "px " +
    fontOptions[params.fontName];

  textureCtx.fillStyle = "#fff";
  textureCtx.textAlign = "center";
  textureCtx.filter = "blur(3px)";

  const textBox = textureCtx.measureText(params.text);

  textureCtx.fillText(
    params.text,
    textureEl.width * 0.5,
    textureEl.height * 0.5 + textBox.actualBoundingBoxAscent * 0.5
  );

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, canvasTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureEl);
}

// ===================================================
// Render Loop
// ===================================================
function render(t) {
  const dt = 1 / 60;

  // ----------------------------
  // 1. 프리뷰(자동 잉크) 모드
  // ----------------------------
  if (isPreview) {
    if (previewStartTime === null) {
      previewStartTime = t ?? performance.now();
    }
    const elapsed = t - previewStartTime;

    // 자동 포인터 궤적 (한 번에 자연스럽게 돌도록)
    const autoX =
      (0.5 - 0.45 * Math.sin(0.0015 * t - 2)) * window.innerWidth;
    const autoY =
      (0.5 +
        0.1 * Math.sin(0.0012 * t) +
        0.1 * Math.cos(0.001 * t)) * window.innerHeight;

    updateMousePosition(autoX, autoY); // 👉 pointer.moved = true

    // 일정 시간 지난 뒤 프리뷰 종료
    if (elapsed > PREVIEW_DURATION) {
      isPreview = false;
      pointer.moved = false; // 다음 프레임에는 마우스 움직일 때까지 대기
    }
  }

  // ----------------------------
  // 2. 포인터가 움직였을 때 잉크 뿌리기
  // ----------------------------
  if (pointer.moved) {
    // 프리뷰가 아닐 때는 한 번 쓰고 플래그 리셋
    if (!isPreview) pointer.moved = false;

    gl.useProgram(splatProgram.program);
    gl.uniform1i(
      splatProgram.uniforms.u_input_texture,
      velocity.read().attach(1)
    );
    gl.uniform1f(
      splatProgram.uniforms.u_ratio,
      canvasEl.width / canvasEl.height
    );
    gl.uniform2f(
      splatProgram.uniforms.u_point,
      pointer.x / canvasEl.width,
      1 - pointer.y / canvasEl.height
    );

    // 프리뷰 때 브러시 살짝 더 크게
    const brushSize = isPreview ? params.pointerSize * 1.4 : params.pointerSize;
    gl.uniform1f(splatProgram.uniforms.u_point_size, brushSize);
    gl.uniform3f(
      splatProgram.uniforms.u_point_value,
      pointer.dx,
      -pointer.dy,
      1
    );
    blit(velocity.write());
    velocity.swap();

    gl.uniform1i(
      splatProgram.uniforms.u_input_texture,
      outputColor.read().attach(1)
    );

    // 프리뷰 때 색 농도도 다르게
    const intensity = isPreview ? 0.6 : 0.3;
    gl.uniform3f(
      splatProgram.uniforms.u_point_value,
      (1 - params.color.r) * intensity,
      (1 - params.color.g) * intensity,
      (1 - params.color.b) * intensity
    );
    blit(outputColor.write());
    outputColor.swap();
  }

  // ----------------------------
  // 3. 유체 시뮬레이션 단계들
  // ----------------------------
  gl.useProgram(divergenceProgram.program);
  gl.uniform2f(
    divergenceProgram.uniforms.u_texel,
    velocity.texelSizeX,
    velocity.texelSizeY
  );
  gl.uniform1i(
    divergenceProgram.uniforms.u_velocity_texture,
    velocity.read().attach(1)
  );
  blit(divergence);

  gl.useProgram(pressureProgram.program);
  gl.uniform2f(
    pressureProgram.uniforms.u_texel,
    velocity.texelSizeX,
    velocity.texelSizeY
  );
  gl.uniform1i(
    pressureProgram.uniforms.u_divergence_texture,
    divergence.attach(1)
  );
  for (let i = 0; i < 10; i++) {
    gl.uniform1i(
      pressureProgram.uniforms.u_pressure_texture,
      pressure.read().attach(2)
    );
    blit(pressure.write());
    pressure.swap();
  }

  gl.useProgram(gradientSubtractProgram.program);
  gl.uniform2f(
    gradientSubtractProgram.uniforms.u_texel,
    velocity.texelSizeX,
    velocity.texelSizeY
  );
  gl.uniform1i(
    gradientSubtractProgram.uniforms.u_pressure_texture,
    pressure.read().attach(1)
  );
  gl.uniform1i(
    gradientSubtractProgram.uniforms.u_velocity_texture,
    velocity.read().attach(2)
  );
  blit(velocity.write());
  velocity.swap();

  gl.useProgram(advectionProgram.program);
  gl.uniform1f(advectionProgram.uniforms.u_use_text, 0);
  gl.uniform2f(
    advectionProgram.uniforms.u_texel,
    velocity.texelSizeX,
    velocity.texelSizeY
  );
  gl.uniform1i(
    advectionProgram.uniforms.u_velocity_texture,
    velocity.read().attach(1)
  );
  gl.uniform1i(
    advectionProgram.uniforms.u_input_texture,
    velocity.read().attach(1)
  );
  gl.uniform1f(advectionProgram.uniforms.u_dt, dt);
  blit(velocity.write());
  velocity.swap();

  gl.useProgram(advectionProgram.program);
  gl.uniform1f(advectionProgram.uniforms.u_use_text, 1);
  gl.uniform2f(
    advectionProgram.uniforms.u_texel,
    outputColor.texelSizeX,
    outputColor.texelSizeY
  );
  gl.uniform1i(
    advectionProgram.uniforms.u_input_texture,
    outputColor.read().attach(2)
  );
  blit(outputColor.write());
  outputColor.swap();

  gl.useProgram(outputShaderProgram.program);
  gl.uniform1i(
    outputShaderProgram.uniforms.u_output_texture,
    outputColor.read().attach(1)
  );

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

  requestAnimationFrame(render);
}

// ===================================================
// Resize (반응형)
// ===================================================
function resizeCanvas() {
  params.pointerSize = 4 / window.innerHeight;

  canvasEl.width = textureEl.width = window.innerWidth;
  canvasEl.height = textureEl.height = window.innerHeight;

  if (params.responsive) {
    const w = window.innerWidth;
    params.fontSize = Math.round(
      mapRange(w, params.fromWidth, params.toWidth, params.minFont, params.maxFont)
    );
  }

  initFBOs();
  updateTextCanvas();
}

// ===================================================
// Events
// ===================================================
function setupEvents() {
  // 👉 프리뷰 중에는 마우스/터치 입력 완전 무시
  window.addEventListener("mousemove", (e) => {
    if (isPreview) return; // 프리뷰 끝나기 전까지는 무반응
    updateMousePosition(e.clientX, e.clientY);
  });

  window.addEventListener(
    "touchmove",
    (e) => {
      if (isPreview) return;
      const t = e.touches[0] || e.targetTouches[0];
      if (!t) return;
      updateMousePosition(t.clientX, t.clientY);
    },
    { passive: true }
  );
}

function updateMousePosition(x, y) {
  pointer.moved = true;
  pointer.dx = 5 * (x - pointer.x);
  pointer.dy = 5 * (y - pointer.y);
  pointer.x = x;
  pointer.y = y;
}

// ===================================================
// FBOs
// ===================================================
function initFBOs() {
  const fboW = Math.floor(0.5 * window.innerWidth);
  const fboH = Math.floor(0.5 * window.innerHeight);

  outputColor = createDoubleFBO(fboW, fboH);
  velocity    = createDoubleFBO(fboW, fboH, gl.RG);
  divergence  = createFBO(fboW, fboH, gl.RGB);
  pressure    = createDoubleFBO(fboW, fboH, gl.RGB);
}

function createFBO(w, h, type = gl.RGBA) {
  gl.activeTexture(gl.TEXTURE0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, type, w, h, 0, type, gl.FLOAT, null);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0
  );
  gl.viewport(0, 0, w, h);
  gl.clear(gl.COLOR_BUFFER_BIT);

  return {
    fbo,
    width: w,
    height: h,
    attach(id) {
      gl.activeTexture(gl.TEXTURE0 + id);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      return id;
    }
  };
}

function createDoubleFBO(w, h, type) {
  let fbo1 = createFBO(w, h, type);
  let fbo2 = createFBO(w, h, type);

  return {
    width: w,
    height: h,
    texelSizeX: 1 / w,
    texelSizeY: 1 / h,
    read: () => fbo1,
    write: () => fbo2,
    swap() {
      const tmp = fbo1;
      fbo1 = fbo2;
      fbo2 = tmp;
    }
  };
}

// ===================================================
// Shader / Program helpers
// ===================================================
function createProgram(elId) {
  const shader = createShader(
    document.getElementById(elId).innerHTML,
    gl.FRAGMENT_SHADER
  );
  const program = createShaderProgram(vertexShader, shader);
  const uniforms = getUniforms(program);
  return { program, uniforms };
}

function createShaderProgram(vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(
      "Unable to initialize the shader program: " +
        gl.getProgramInfoLog(program)
    );
    return null;
  }
  return program;
}

function getUniforms(program) {
  const uniforms = [];
  const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < uniformCount; i++) {
    const uniformName = gl.getActiveUniform(program, i).name;
    uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
  }
  return uniforms;
}

function createShader(sourceCode, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, sourceCode);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(
      "An error occurred compiling the shaders: " +
        gl.getShaderInfoLog(shader)
    );
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function blit(target) {
  if (target == null) {
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  } else {
    gl.viewport(0, 0, target.width, target.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
  }
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

// ===================================================
// GUI
// ===================================================
function createControls() {
  const gui = new GUI();
  gui.close();

  const gTxt = gui.addFolder("Text");
  gTxt.add(params, "text").onChange(updateTextCanvas);
  gTxt.add(params, "isBold").name("bold").onChange(updateTextCanvas);
  gTxt.add(params, "fontName", Object.keys(fontOptions))
    .name("font")
    .onChange(updateTextCanvas);

  const gResp = gui.addFolder("Responsive Font");
  gResp
    .add(params, "responsive")
    .name("enable")
    .onChange(() => params.responsive && resizeCanvas());
  gResp
    .add(params, "minFont", 12, 200, 1)
    .name("min px")
    .onChange(() => params.responsive && resizeCanvas());
  gResp
    .add(params, "maxFont", 40, 400, 1)
    .name("max px")
    .onChange(() => params.responsive && resizeCanvas());
  gResp
    .add(params, "fromWidth", 280, 1024, 1)
    .name("from width")
    .onChange(() => params.responsive && resizeCanvas());
  gResp
    .add(params, "toWidth", 800, 1920, 1)
    .name("to width")
    .onChange(() => params.responsive && resizeCanvas());
}
