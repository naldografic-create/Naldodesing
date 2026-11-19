const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const artboardWrapper = document.getElementById('artboardWrapper');
const canvasStatus = document.getElementById('canvasStatus');

// Estado de la aplicación
let originalImage = null;
let workingCanvas = document.createElement('canvas');
let workingCtx = workingCanvas.getContext('2d', { willReadFrequently: true });

let imgX = 0;
let imgY = 0;
let imgScale = 1;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let halftoneActive = false;
let currentSVGData = null;

// Conversión CM a Píxeles de trabajo (base 300 DPI escalada para fluidez)
const PX_PER_CM_EXPORT = 118.11; // 300 DPI reales
const PREVIEW_RATIO = 15; // Escala visual en pantalla

function updateArtboardSize() {
  const wCm = parseFloat(document.getElementById('canvasWidthCm').value) || 28;
  const hCm = parseFloat(document.getElementById('canvasHeightCm').value) || 40;

  // Tamaño interno de alta resolución (hasta 300 DPI)
  canvas.width = Math.round(wCm * PX_PER_CM_EXPORT);
  canvas.height = Math.round(hCm * PX_PER_CM_EXPORT);

  // Tamaño visual ajustado a la pantalla manteniendo proporción exacta en cm
  const maxVisualW = window.innerWidth * 0.6;
  const maxVisualH = window.innerHeight * 0.78;
  let visualW = wCm * PREVIEW_RATIO;
  let visualH = hCm * PREVIEW_RATIO;

  const scaleFit = Math.min(maxVisualW / visualW, maxVisualH / visualH, 1.5);
  artboardWrapper.style.width = `${Math.round(visualW * scaleFit)}px`;
  artboardWrapper.style.height = `${Math.round(visualH * scaleFit)}px`;

  canvasStatus.textContent = `Lienzo: ${wCm} cm × ${hCm} cm (${canvas.width} × ${canvas.height} px @ 300 DPI)`;
  renderCanvas();
}

// Inicializar lienzo
updateArtboardSize();

document.getElementById('btnApplyCanvas').addEventListener('click', updateArtboardSize);

// Importar cualquier formato de imagen
document.getElementById('imageInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    const img = new Image();
    img.onload = function () {
      originalImage = img;
      resetWorkingImage();
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

function resetWorkingImage() {
  if (!originalImage) return;
  workingCanvas.width = originalImage.width;
  workingCanvas.height = originalImage.height;
  workingCtx.clearRect(0, 0, workingCanvas.width, workingCanvas.height);
  workingCtx.drawImage(originalImage, 0, 0);

  // Centrar y ajustar imagen al lienzo libre
  const fitRatio = Math.min(
    (canvas.width * 0.8) / workingCanvas.width,
    (canvas.height * 0.8) / workingCanvas.height
  );
  imgScale = fitRatio;
  document.getElementById('imgScale').value = 100;
  document.getElementById('scaleVal').textContent = '100%';

  imgX = (canvas.width - workingCanvas.width * imgScale) / 2;
  imgY = (canvas.height - workingCanvas.height * imgScale) / 2;

  halftoneActive = false;
  document.getElementById('btnHalftone').classList.remove('active-tool');
  currentSVGData = null;
  renderCanvas();
}

document.getElementById('btnReset').addEventListener('click', resetWorkingImage);

// Renderizar en el lienzo libre
function renderCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!originalImage) return;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    workingCanvas,
    imgX,
    imgY,
    workingCanvas.width * imgScale,
    workingCanvas.height * imgScale
  );
  ctx.restore();
}

// Escala de imagen en el lienzo
document.getElementById('imgScale').addEventListener('input', (e) => {
  if (!originalImage) return;
  const pct = parseInt(e.target.value, 10);
  document.getElementById('scaleVal').textContent = `${pct}%`;

  const baseFit = Math.min(
    (canvas.width * 0.8) / workingCanvas.width,
    (canvas.height * 0.8) / workingCanvas.height
  );
  const centerX = imgX + (workingCanvas.width * imgScale) / 2;
  const centerY = imgY + (workingCanvas.height * imgScale) / 2;

  imgScale = baseFit * (pct / 100);
  imgX = centerX - (workingCanvas.width * imgScale) / 2;
  imgY = centerY - (workingCanvas.height * imgScale) / 2;
  renderCanvas();
});

// Mover imagen libremente dentro del lienzo
canvas.addEventListener('mousedown', (e) => {
  if (!originalImage) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  // Cuentagotas si se presiona Alt o clic derecho
  if (e.altKey || e.button === 2) {
    const clickX = Math.floor((e.clientX - rect.left) * scaleX);
    const clickY = Math.floor((e.clientY - rect.top) * scaleY);
    const pixel = ctx.getImageData(clickX, clickY, 1, 1).data;
    if (pixel[3] > 0) {
      const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
      document.getElementById('targetColor').value = hex;
    }
    return;
  }

  isDragging = true;
  dragStartX = (e.clientX - rect.left) * scaleX - imgX;
  dragStartY = (e.clientY - rect.top) * scaleY - imgY;
});

canvas.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  imgX = (e.clientX - rect.left) * scaleX - dragStartX;
  imgY = (e.clientY - rect.top) * scaleY - dragStartY;
  renderCanvas();
});

window.addEventListener('mouseup', () => {
  isDragging = false;
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Actualizar etiquetas de sliders
document.getElementById('colorTolerance').addEventListener('input', (e) => {
  document.getElementById('tolVal').textContent = e.target.value;
});
document.getElementById('alphaThreshold').addEventListener('input', (e) => {
  document.getElementById('alphaVal').textContent = e.target.value;
});
document.getElementById('halftoneSize').addEventListener('input', (e) => {
  document.getElementById('dotSizeVal').textContent = e.target.value;
});
document.getElementById('halftoneContrast').addEventListener('input', (e) => {
  document.getElementById('contrastVal').textContent = e.target.value;
});
document.getElementById('vecPrecision').addEventListener('input', (e) => {
  document.getElementById('vecDetailVal').textContent = e.target.value;
});

// Convertir HEX a RGB
function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

// 1. Quitar color específico y dejar fondo transparente
function removeSelectedColor(rgbTarget, tolerance) {
  if (!originalImage) return;
  const imgData = workingCtx.getImageData(0, 0, workingCanvas.width, workingCanvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const dr = data[i] - rgbTarget.r;
    const dg = data[i + 1] - rgbTarget.g;
    const db = data[i + 2] - rgbTarget.b;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);

    if (distance <= tolerance) {
      data[i + 3] = 0; // Transparente total
    }
  }
  workingCtx.putImageData(imgData, 0, 0);
  renderCanvas();
}

document.getElementById('btnRemoveColor').addEventListener('click', () => {
  const hex = document.getElementById('targetColor').value;
  const tol = parseInt(document.getElementById('colorTolerance').value, 10);
  removeSelectedColor(hexToRgb(hex), tol);
});

// Auto-detectar color de esquina superior izquierda para quitar fondo rápido
document.getElementById('btnAutoBg').addEventListener('click', () => {
  if (!originalImage) return;
  const corner = workingCtx.getImageData(0, 0, 1, 1).data;
  const tol = parseInt(document.getElementById('colorTolerance').value, 10);
  removeSelectedColor({ r: corner[0], g: corner[1], b: corner[2] }, tol);
});

// 2. Eliminar Semitransparencias (Bordes limpios para DTF)
document.getElementById('btnCleanAlpha').addEventListener('click', () => {
  if (!originalImage) return;
  const threshold = parseInt(document.getElementById('alphaThreshold').value, 10);
  const imgData = workingCtx.getImageData(0, 0, workingCanvas.width, workingCanvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < threshold) {
      data[i + 3] = 0; // Elimina píxeles semitransparentes
    } else {
      data[i + 3] = 255; // Solidifica al 100%
    }
  }
  workingCtx.putImageData(imgData, 0, 0);
  renderCanvas();
});

// 3. Botón Activo de Semitonos Redondos
document.getElementById('btnHalftone').addEventListener('click', () => {
  if (!originalImage) return;
  const btn = document.getElementById('btnHalftone');
  halftoneActive = !halftoneActive;

  if (!halftoneActive) {
    btn.classList.remove('active-tool');
    resetWorkingImage();
    return;
  }

  btn.classList.add('active-tool');
  const step = parseInt(document.getElementById('halftoneSize').value, 10);
  const contrast = parseFloat(document.getElementById('halftoneContrast').value);

  const w = workingCanvas.width;
  const h = workingCanvas.height;
  const srcData = workingCtx.getImageData(0, 0, w, h).data;

  // Limpiar workingCanvas para dibujar puntos redondos sobre fondo 100% transparente
  workingCtx.clearRect(0, 0, w, h);

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const px = Math.min(x + Math.floor(step / 2), w - 1);
      const py = Math.min(y + Math.floor(step / 2), h - 1);
      const idx = (py * w + px) * 4;

      const r = srcData[idx];
      const g = srcData[idx + 1];
      const b = srcData[idx + 2];
      const a = srcData[idx + 3];

      if (a < 30) continue; // Respetar transparencia

      // Luminosidad para calcular el radio del punto redondo
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      let intensity = (1 - lum * 0.75) * contrast;
      intensity = Math.max(0.15, Math.min(1, intensity));

      const radius = (step / 2) * intensity;

      workingCtx.beginPath();
      workingCtx.arc(x + step / 2, y + step / 2, radius, 0, Math.PI * 2);
      workingCtx.fillStyle = `rgb(${r},${g},${b})`;
      workingCtx.fill();
    }
  }
  renderCanvas();
});

// 4. Vectorizar automáticamente (Suavizado sin píxeles + generación de trazos SVG)
document.getElementById('btnVectorize').addEventListener('click', () => {
  if (!originalImage) return;
  const detail = parseInt(document.getElementById('vecPrecision').value, 10);

  // Escalar al doble con interpolación bicúbica y cuantización limpia de bordes
  const scaleUp = 2;
  const w = workingCanvas.width * scaleUp;
  const h = workingCanvas.height * scaleUp;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext('2d');

  tempCtx.imageSmoothingEnabled = true;
  tempCtx.imageSmoothingQuality = 'high';
  tempCtx.drawImage(workingCanvas, 0, 0, w, h);

  const imgData = tempCtx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Posterización suave para eliminar ruido de píxeles manteniendo colores intactos
  const levels = Math.max(8, 32 - detail * 2);
  const factor = 255 / (levels - 1);

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) {
      data[i + 3] = 0;
    } else {
      data[i + 3] = 255;
      data[i] = Math.round(Math.round(data[i] / factor) * factor);
      data[i + 1] = Math.round(Math.round(data[i + 1] / factor) * factor);
      data[i + 2] = Math.round(Math.round(data[i + 2] / factor) * factor);
    }
  }

  tempCtx.putImageData(imgData, 0, 0);

  // Actualizar imagen de trabajo libre de píxeles
  workingCanvas.width = w;
  workingCanvas.height = h;
  workingCtx.clearRect(0, 0, w, h);
  workingCtx.drawImage(tempCanvas, 0, 0);
  imgScale = imgScale / scaleUp;
  renderCanvas();

  // Generar archivo vectorial SVG limpio por bloques de color
  generateSVGFromCanvas(tempCanvas, detail);
  canvasStatus.textContent = '✅ Imagen vectorizada sin píxeles. Lista para descargar en PNG o SVG.';
});

function generateSVGFromCanvas(sourceCanvas, stepSize) {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const data = sourceCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const step = Math.max(2, Math.floor(stepSize / 2));

  let paths = '';
  for (let y = 0; y < h; y += step) {
    let runColor = null;
    let runStart = 0;
    let runLen = 0;

    for (let x = 0; x < w; x += step) {
      const idx = (y * w + x) * 4;
      const a = data[idx + 3];
      const hex = a > 128
        ? `#${((1 << 24) + (data[idx] << 16) + (data[idx + 1] << 8) + data[idx + 2]).toString(16).slice(1)}`
        : null;

      if (hex === runColor && hex !== null) {
        runLen += step;
      } else {
        if (runColor !== null) {
          paths += `<rect x="${runStart}" y="${y}" width="${runLen}" height="${step}" fill="${runColor}" shape-rendering="geometricPrecision"/>`;
        }
        runColor = hex;
        runStart = x;
        runLen = step;
      }
    }
    if (runColor !== null) {
      paths += `<rect x="${runStart}" y="${y}" width="${runLen}" height="${step}" fill="${runColor}" shape-rendering="geometricPrecision"/>`;
    }
  }

  currentSVGData = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${paths}</svg>`;
}

// Descargar PNG Transparente del Lienzo Completo en Centímetros (300 DPI)
document.getElementById('btnDownloadPNG').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'NALDO_GRAFIC_DESING_DTF.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

// Descargar Vector SVG
document.getElementById('btnDownloadSVG').addEventListener('click', () => {
  if (!currentSVGData) {
    document.getElementById('btnVectorize').click();
  }
  const blob = new Blob([currentSVGData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = 'NALDO_GRAFIC_DESING_VECTOR.svg';
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
});
