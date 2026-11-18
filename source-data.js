(() => {
  'use strict';
  const categories = window.SOURCE_DATA;
  const total = categories.reduce((sum, item) => sum + item.count, 0);
  const app = document.getElementById('source-app');
  let selected = 'all';
  let query = '';
  const make = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const button = (className, text, action) => {
    const el = make('button', className, text);
    el.type = 'button'; el.addEventListener('click', action); return el;
  };
  const percent = item => `${new Intl.NumberFormat('en', {maximumFractionDigits: 1}).format(total ? item.count / total * 100 : 0)}%`;
  const pagePath = (item, page) => `assets/source-data/${item.id}/page-${String(page).padStart(2, '0')}.jpg`;
  const pdfPath = item => `assets/source-data/${item.id}/manual.pdf`;
  const dot = item => {
    const el = make('span', 'source-dot'); el.style.background = item.color;
    el.setAttribute('aria-hidden', 'true'); return el;
  };

  const hero = make('header', 'source-hero');
  hero.append(make('h1', '', 'Source Data'));
  const stats = make('dl', 'source-stats');
  [[total, 'Total cases'], [categories.length, 'Categories']].forEach(([value, label]) => {
    const stat = make('div'); stat.append(make('dt', '', label), make('dd', '', String(value))); stats.append(stat);
  });
  hero.append(stats);

  const distribution = make('section', 'distribution');
  distribution.setAttribute('aria-labelledby', 'distribution-title');
  const heading = make('div', 'source-section-heading');
  const headingText = make('div');
  const title = make('h2', '', '数据分布'); title.id = 'distribution-title';
  headingText.append(make('p', 'eyebrow', '01 / DISTRIBUTION'), title);
  heading.append(headingText);
  const chartBody = make('div', 'distribution-body');
  const chartWrap = make('div', 'chart-wrap');
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 320 320');
  svg.setAttribute('class', 'distribution-chart');
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', '数据分布环形饼图，点击扇区筛选类别');
  const segments = [];
  let angle = -90;
  categories.forEach(item => {
    if (item.count <= 0 || total <= 0) return;
    const sweep = item.count / total * 360;
    const point = (radius, degrees) => {
      const radians = degrees * Math.PI / 180;
      return `${160 + radius * Math.cos(radians)} ${160 + radius * Math.sin(radians)}`;
    };
    const gap = Math.min(1.6, sweep * 0.12);
    const start = angle + gap;
    const end = angle + sweep - gap;
    const large = end - start > 180 ? 1 : 0;
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', `M ${point(140, start)} A 140 140 0 ${large} 1 ${point(140, end)} L ${point(103, end)} A 103 103 0 ${large} 0 ${point(103, start)} Z`);
    path.setAttribute('fill', item.color);
    path.setAttribute('role', 'button'); path.setAttribute('tabindex', '0');
    path.setAttribute('aria-label', `${item.name}：${item.count} cases，占 ${percent(item)}，筛选此类别`);
    path.dataset.category = item.id;
    const tooltip = document.createElementNS(svgNS, 'title');
    tooltip.textContent = `${item.name} · ${item.count} cases · ${percent(item)}`; path.append(tooltip);
    path.addEventListener('click', () => selectCategory(item.id));
    path.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectCategory(item.id); }
    });
    svg.append(path); segments.push(path); angle += sweep;
  });
  const center = make('div', 'chart-center');
  center.append(make('strong', '', String(total)), make('span', '', 'TOTAL CASES'));
  chartWrap.append(svg, center);
  const legend = make('div', 'chart-legend');
  const legendButtons = categories.map(item => {
    const entry = button('legend-row', undefined, () => selectCategory(item.id));
    entry.dataset.category = item.id;
    entry.setAttribute('aria-label', `筛选${item.name}，${item.count} cases，${percent(item)}`);
    const label = make('span', 'legend-name'); label.append(make('strong', '', item.name), make('small', '', item.english));
    const count = make('span', 'legend-count'); count.append(make('strong', '', `${item.count}`), make('small', '', 'cases'));
    entry.append(dot(item), label, count, make('span', 'legend-percent', percent(item)));
    legend.append(entry); return entry;
  });
  chartBody.append(chartWrap, legend);
  distribution.append(heading, chartBody);

  const previews = make('section', 'source-previews');
  previews.setAttribute('aria-labelledby', 'preview-title');
  const previewHeading = make('div', 'source-section-heading');
  const previewText = make('div');
  const previewTitle = make('h2', '', '源数据预览'); previewTitle.id = 'preview-title';
  previewText.append(make('p', 'eyebrow', '02 / SOURCE PREVIEW'), previewTitle);
  const resultCount = make('p', 'result-count'); resultCount.setAttribute('role', 'status');
  previewHeading.append(previewText, resultCount);
  const toolbar = make('div', 'source-toolbar');
  const filters = make('div', 'source-filters'); filters.setAttribute('role', 'group'); filters.setAttribute('aria-label', '按类别筛选');
  const filterButtons = [{id: 'all', name: '全部', count: total}, ...categories].map(item => {
    const el = button('source-filter', undefined, () => selectCategory(item.id));
    el.dataset.category = item.id;
    el.append(make('span', '', item.name), make('span', 'filter-count', String(item.count)));
    filters.append(el); return el;
  });
  const searchLabel = make('label', 'source-search');
  searchLabel.append(make('span', 'sr-only', '搜索类别或型号'));
  const search = make('input'); search.type = 'search'; search.placeholder = '搜索类别或型号…';
  search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); renderList(); });
  searchLabel.append(search); toolbar.append(filters, searchLabel);
  const list = make('div', 'source-list');
  const empty = make('div', 'source-empty'); empty.hidden = true;
  empty.append(make('h3', '', '没有找到匹配的说明书'), make('p', '', '试试其他类别或型号关键词。'),
    button('preview-button', '清除筛选', () => { search.value = ''; query = ''; selectCategory('all'); }));
  previews.append(previewHeading, toolbar, list, empty);
  const footer = make('footer', 'page-footer');
  footer.append(make('span', '', 'Articulated Assets / Source Data'), make('span', '', `${categories.length} categories · ${total} cases`));
  app.append(hero, distribution, previews, footer);

  const dialog = make('dialog', 'manual-dialog');
  dialog.setAttribute('aria-labelledby', 'manual-title');
  const dialogHead = make('div', 'manual-head');
  const dialogText = make('div');
  const dialogTitle = make('h2'); dialogTitle.id = 'manual-title';
  const dialogMeta = make('p'); dialogText.append(dialogTitle, dialogMeta);
  const close = button('manual-close', '×', () => dialog.close()); close.setAttribute('aria-label', '关闭预览');
  dialogHead.append(dialogText, close);
  const pageFrame = make('div', 'manual-page');
  const pageImage = make('img');
  const pageError = make('p', 'manual-error', '此页暂时无法加载，请打开原始 PDF 查看。'); pageError.hidden = true;
  pageFrame.append(pageImage, pageError);
  const controls = make('div', 'manual-controls');
  let currentManual; let currentPage;
  const previous = button('page-button', '← 上一页', () => showPage(currentPage - 1));
  const next = button('page-button', '下一页 →', () => showPage(currentPage + 1));
  const pageLabel = make('label', 'page-label', '页码 ');
  const pageSelect = make('select'); pageSelect.setAttribute('aria-label', '选择说明书页码');
  pageSelect.addEventListener('change', () => showPage(Number(pageSelect.value)));
  const pageTotal = make('span'); pageLabel.append(pageSelect, pageTotal);
  const pdfLink = make('a', 'manual-pdf', '打开原始 PDF ↗'); pdfLink.target = '_blank'; pdfLink.rel = 'noopener noreferrer';
  controls.append(previous, pageLabel, next, pdfLink);
  dialog.append(dialogHead, pageFrame, controls); document.body.append(dialog);
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { document.body.classList.remove('manual-open'); });
  pageImage.addEventListener('error', () => { pageImage.hidden = true; pageError.hidden = false; });
  function showPage(page) {
    currentPage = Math.max(1, Math.min(currentManual.pages, page));
    pageError.hidden = true; pageImage.hidden = false;
    pageImage.src = pagePath(currentManual, currentPage);
    pageImage.alt = `${currentManual.model} 说明书，第 ${currentPage} 页，共 ${currentManual.pages} 页`;
    pageSelect.value = String(currentPage);
    previous.disabled = currentPage === 1; next.disabled = currentPage === currentManual.pages;
    pageFrame.scrollTop = 0;
  }
  function openPreview(item) {
    currentManual = item;
    dialogTitle.textContent = item.model;
    dialogMeta.textContent = `${item.name} · ${item.description} · ${item.filename}`;
    pageSelect.replaceChildren(...Array.from({length: item.pages}, (_, index) => {
      const option = make('option', '', String(index + 1)); option.value = String(index + 1); return option;
    }));
    pageTotal.textContent = ` / ${item.pages}`;
    pdfLink.href = pdfPath(item);
    showPage(item.previewPage);
    document.body.classList.add('manual-open'); dialog.showModal();
  }
  function selectCategory(id) {
    selected = id;
    [...filterButtons, ...legendButtons, ...segments].forEach(el => {
      el.setAttribute('aria-pressed', String(el.dataset.category === selected));
    });
    segments.forEach(el => el.classList.toggle('is-muted', selected !== 'all' && el.dataset.category !== selected));
    renderList();
  }
  function renderList() {
    const visible = categories.filter(item => (selected === 'all' || selected === item.id) &&
      `${item.name} ${item.english} ${item.model} ${item.description} ${item.filename}`.toLowerCase().includes(query));
    resultCount.textContent = `${visible.length} / ${categories.length} 份代表说明书`;
    list.replaceChildren(...visible.map((item, index) => {
      const row = make('article', 'source-row'); row.style.setProperty('--category-color', item.color);
      const thumbnail = button('source-thumbnail', undefined, () => openPreview(item));
      thumbnail.setAttribute('aria-label', `预览${item.name}说明书：${item.model}`);
      const img = make('img'); img.src = pagePath(item, item.previewPage); img.alt = `${item.name}说明书预览`;
      img.loading = index < 2 ? 'eager' : 'lazy'; img.width = 110; img.height = 130;
      thumbnail.append(img);
      const details = make('div', 'source-row-details');
      const category = make('p', 'source-category'); category.append(dot(item), make('span', '', `${item.name} / ${item.english}`));
      details.append(category, make('h3', '', item.model), make('p', 'source-document-meta', `${item.description} · PDF · ${item.pages} 页`));
      const count = make('div', 'source-row-count'); count.append(make('strong', '', String(item.count)), make('span', '', 'cases'), make('small', '', `占总数据 ${percent(item)}`));
      const actions = make('div', 'source-row-actions');
      const original = make('a', 'source-original', '原始 PDF ↗'); original.href = pdfPath(item); original.target = '_blank'; original.rel = 'noopener noreferrer';
      original.setAttribute('aria-label', `打开${item.name}原始 PDF（新窗口）`);
      actions.append(button('preview-button', '预览说明书 ↗', () => openPreview(item)), original);
      row.append(thumbnail, details, count, actions); return row;
    }));
    empty.hidden = visible.length !== 0;
  }
  selectCategory('all');
})();
