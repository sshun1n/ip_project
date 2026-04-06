(function () {
  'use strict';

  // только на главной
  const isHomePage = !!document.getElementById('phase-upload');
  if (!isHomePage) return;

  // dom
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const selectedFileEl = document.getElementById('selected-file');
  const fileNameEl = document.getElementById('file-name');
  const fileSizeEl = document.getElementById('file-size');
  const fileRemoveBtn = document.getElementById('file-remove');
  const tradeBtn = document.getElementById('trade-btn');
  const btnText = tradeBtn.querySelector('.btn-text');
  const btnLoading = tradeBtn.querySelector('.btn-loading');

  // обмен
  const phaseUpload = document.getElementById('phase-upload');
  const phaseTransform = document.getElementById('phase-transform');
  const phaseResult = document.getElementById('phase-result');
  const phaseEmpty = document.getElementById('phase-empty');

  // трансформация
  const transformText = document.getElementById('transform-text');
  const progressFill = document.getElementById('progress-fill');

  // результат
  const lightBurst = document.getElementById('light-burst');
  const particleField = document.getElementById('particle-field');
  const artifactPreview = document.getElementById('artifact-preview');
  const artifactName = document.getElementById('artifact-name');
  const artifactSize = document.getElementById('artifact-size');
  const artifactType = document.getElementById('artifact-type');
  const downloadBtn = document.getElementById('download-btn');
  const resetBtn = document.getElementById('reset-btn');
  const resetBtnEmpty = document.getElementById('reset-btn-empty');

  const dynamicFlash = document.getElementById('dynamic-flash');
  const inventoryBadge = document.getElementById('inventory-badge');

  let selectedFile = null;

  // Форматирование размера файла
  function formatSize(bytes) {
    if (bytes === 0) return '0 Б';
    const units = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
  }

  // формат MIME
  function formatMime(mime) {
    const map = {
      'image/jpeg': 'JPEG Изображение', 'image/png': 'PNG Изображение',
      'image/gif': 'GIF Анимация', 'image/webp': 'WebP Изображение',
      'text/plain': 'Текстовый файл', 'application/pdf': 'PDF Документ',
      'application/json': 'JSON Данные', 'application/zip': 'ZIP Архив',
    };
    return map[mime] || mime || 'Неизвестный тип';
  }

  function isImageMime(mime) { return mime && mime.startsWith('image/'); }
  function isTextMime(mime) { return mime && (mime.startsWith('text/') || mime === 'application/json'); }

  // Flash-уведомления
  function showFlash(type, message) {
    const icons = { signal: '⚡', warning: '⚠', static: '📡' };
    const flash = document.createElement('div');
    flash.className = `flash-signal flash-${type}`;
    flash.innerHTML = `
      <span class="flash-icon">${icons[type] || '◈'}</span>
      <span class="flash-text">${message}</span>
      <button class="flash-dismiss" onclick="this.parentElement.remove()">✕</button>
    `;
    dynamicFlash.appendChild(flash);
    setTimeout(() => {
      if (flash.parentElement) {
        flash.style.transition = 'opacity 0.4s, transform 0.4s';
        flash.style.opacity = '0';
        flash.style.transform = 'translateX(20px)';
        setTimeout(() => flash.remove(), 400);
      }
    }, 8000);
  }

  // Переключение фаз UI
  function showPhase(phase) {
    [phaseUpload, phaseTransform, phaseResult, phaseEmpty].forEach(p => {
      p.style.display = 'none';
    });
    phase.style.display = 'block';
  }

  // Выбор файла
  function selectFile(file) {
    if (!file) return;
    if (file.type.startsWith('video/')) {
      showFlash('warning', '⚠ Видеосигналы запрещены на этой станции.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showFlash('warning', '⚠ Груз слишком тяжёл. Максимум 10 МБ.');
      return;
    }
    selectedFile = file;
    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = formatSize(file.size);
    selectedFileEl.style.display = 'block';
    dropZone.style.display = 'none';
    tradeBtn.disabled = false;
  }

  // Сброс выбранного файла
  function clearFile() {
    selectedFile = null;
    fileInput.value = '';
    selectedFileEl.style.display = 'none';
    dropZone.style.display = 'block';
    tradeBtn.disabled = true;
  }

  // Обработчики событий файлового ввода
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) selectFile(e.target.files[0]);
  });
  fileRemoveBtn.addEventListener('click', clearFile);

  // drag and drop
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('drag-over'); });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) selectFile(e.dataTransfer.files[0]);
  });

  // Сообщения во время трансформации
  const transformMessages = [
    'Сканирование артефакта...',
    'Анализ структуры данных...',
    'Поиск в хранилище...',
    'Инициализация квантового обмена...',
    'Трансмутация сигнала...',
    'Обмен завершается...'
  ];

  // Генерация частиц при получении артефакта
  function spawnParticles() {
    particleField.innerHTML = '';
    const colors = ['#00f0ff', '#ff00aa', '#ffaa00', '#00ff88', '#ffffff'];
    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const angle = (Math.random() * 360) * (Math.PI / 180);
      const distance = 100 + Math.random() * 200;
      p.style.setProperty('--px', `${Math.cos(angle) * distance}px`);
      p.style.setProperty('--py', `${Math.sin(angle) * distance}px`);
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.width = (2 + Math.random() * 4) + 'px';
      p.style.height = p.style.width;
      p.style.animationDuration = (0.6 + Math.random() * 0.8) + 's';
      p.style.animationDelay = (Math.random() * 0.3) + 's';
      particleField.appendChild(p);
    }
  }

  // Основной поток обмена
  tradeBtn.addEventListener('click', async () => {
    if (!selectedFile || tradeBtn.disabled) return;

    // Фаза трансформации
    showPhase(phaseTransform);
    progressFill.style.width = '0%';

    let msgIndex = 0;
    let progress = 0;

    const msgInterval = setInterval(() => {
      if (msgIndex < transformMessages.length) {
        transformText.textContent = transformMessages[msgIndex];
        msgIndex++;
      }
    }, 500);

    const progressInterval = setInterval(() => {
      progress = Math.min(progress + Math.random() * 12, 85);
      progressFill.style.width = progress + '%';
    }, 250);

    try {
      const formData = new FormData();
      formData.append('artifact', selectedFile);

      const response = await fetch('/api/trade', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      clearInterval(progressInterval);
      clearInterval(msgInterval);
      transformText.textContent = 'Обмен завершён!';
      progressFill.style.width = '100%';

      await new Promise(r => setTimeout(r, 800));

      if (data.success && data.received) {
        // Фаза результата: вспышка + частицы + артефакт
        showPhase(phaseResult);

        lightBurst.classList.remove('active');
        void lightBurst.offsetWidth;
        lightBurst.classList.add('active');

        spawnParticles();
        displayArtifact(data.received);
        updateBadge();
        showFlash('signal', data.message);
      } else if (data.success && !data.received) {
        // Хранилище пустое
        showPhase(phaseEmpty);
        showFlash('static', data.message);
      } else {
        showPhase(phaseUpload);
        showFlash('warning', data.message);
      }

      clearFile();
    } catch (err) {
      clearInterval(progressInterval);
      clearInterval(msgInterval);
      showPhase(phaseUpload);
      showFlash('warning', '⚠ Потеря связи со станцией. Повторите попытку.');
      console.error('Ошибка обмена:', err);
    }
  });

  // Отображение полученного артефакта
  async function displayArtifact(artifact) {
    if (isImageMime(artifact.mimeType)) {
      artifactPreview.innerHTML = `<img src="${artifact.url}" alt="${artifact.name}">`;
    } else if (isTextMime(artifact.mimeType)) {
      // Предпросмотр текстового файла
      artifactPreview.innerHTML = `<div class="text-preview-loading"><span class="spinner"></span> Загрузка превью...</div>`;
      try {
        const previewRes = await fetch(`/api/preview/${artifact.id}`);
        const previewData = await previewRes.json();
        if (previewData.success) {
          const escaped = previewData.content
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const truncMsg = previewData.truncated
            ? `<div class="text-preview-truncated">... показано ${previewData.content.length} из ${previewData.totalLength} символов</div>`
            : '';
          artifactPreview.innerHTML = `<div class="text-preview"><pre class="text-preview-content">${escaped}</pre>${truncMsg}</div>`;
        } else {
          artifactPreview.innerHTML = `<span class="preview-icon">📄</span>`;
        }
      } catch (e) {
        artifactPreview.innerHTML = `<span class="preview-icon">📄</span>`;
      }
    } else {
      artifactPreview.innerHTML = `<span class="preview-icon">📦</span>`;
    }

    artifactName.textContent = artifact.name;
    artifactSize.textContent = `Размер: ${formatSize(artifact.size)}`;
    artifactType.textContent = `Тип: ${formatMime(artifact.mimeType)}`;

    // Скачивание через серверный роут
    downloadBtn.href = `/api/download/${artifact.id}`;
    downloadBtn.removeAttribute('download');
  }

  // Обновление бейджа инвентаря в шапке
  async function updateBadge() {
    try {
      const res = await fetch('/api/inventory');
      const data = await res.json();
      if (inventoryBadge) {
        inventoryBadge.textContent = data.count;
        inventoryBadge.style.transform = 'scale(1.4)';
        setTimeout(() => { inventoryBadge.style.transform = 'scale(1)'; }, 300);
      }
    } catch (e) { }
  }

  // Кнопки Новый обмен
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      showPhase(phaseUpload);
      lightBurst.classList.remove('active');
      particleField.innerHTML = '';
    });
  }
  if (resetBtnEmpty) {
    resetBtnEmpty.addEventListener('click', () => {
      showPhase(phaseUpload);
    });
  }

  document.querySelectorAll('.flash-signal[data-flash-id]').forEach((flash) => {
    setTimeout(() => {
      if (flash.parentElement) {
        flash.style.transition = 'opacity 0.4s, transform 0.4s';
        flash.style.opacity = '0';
        flash.style.transform = 'translateX(20px)';
        setTimeout(() => flash.remove(), 400);
      }
    }, 8000);
  });

})();
