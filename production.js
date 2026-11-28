(() => {
  'use strict';
  const C = window.ProductionCore;
  const KEY = 'articulated-assets-production-v1';
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const number = n => n.toLocaleString('en-US');
  let data, base, mode = 'day', period, category = 'all', page = 0, storageMessage = '';
  const pageSize = 24;
  try {
    base = C.validate(window.PRODUCTION_DATA); data = base;
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) { data = C.merge(base, JSON.parse(saved)); storageMessage = '已加载当前浏览器保存的日报。更新后的数据可导出发布。'; }
    } catch { storageMessage = '无法读取本地备份，当前显示网站归档数据。可导入 JSON 备份恢复。'; }
  } catch (error) {
    $('production-app').replaceChildren(el('h1', '', '生产数据暂不可用'), el('p', 'error', error.message)); return;
  }
  period = data.records.at(-1)?.date || base.baseline.date;
  function save(next) {
    const validated = C.validate(next);
    // Commit to durable browser storage before replacing the visible ledger.
    try { localStorage.setItem(KEY, JSON.stringify(validated)); }
    catch { throw new Error('浏览器存储不可用或空间不足，尚未保存。请减少图片数量，或导出当前备份后重试。'); }
    data = validated;
    storageMessage = '日报已保存到当前浏览器；导出网站数据后可同步到网站。';
  }
  function statCard(name, cls, value, total, count, all) {
    const box = el('article', 'metric ' + cls);
    const head = el('div', 'metric-head'); head.append(el('h3', '', name), el('span', 'metric-tag', all ? '累计资产' : mode === 'day' ? '当日新增' : '本月已记录新增'));
    const main = el('div', 'metric-value');
    if (!all && count) main.append(el('span', 'plus', '+'));
    main.append(document.createTextNode(count || all ? number(value) : '—'), el('span', 'unit', '个'));
    const bottom = el('div', 'metric-bottom');
    const a = el('span', '', all ? '归档日报新增' : '截至期末累计'); a.append(el('strong', '', all ? '+' + number(total) : number(total)));
    bottom.append(a, el('span', '', '独立统计')); box.append(head, main, bottom); return box;
  }
  function costCard(name, currency, places, value, total, count) {
    const box = el('article', 'cost');
    const head = el('div', 'cost-head'); head.append(el('h3', '', name), el('span', 'currency-chip', currency));
    const val = el('p', 'cost-value'); val.append(el('span', 'currency-symbol', currency === 'USD' ? '$' : '¥'), document.createTextNode(count || mode === 'all' ? C.money(value, places) : '—'));
    const foot = el('div', 'cost-total'); foot.append(el('span', '', mode === 'all' ? '全部历史累计消耗' : '截至期末累计'), el('strong', '', (currency === 'USD' ? '$ ' : '¥ ') + C.money(total, places)));
    box.append(head, val, foot); return box;
  }
  function render() {
    const s = C.select(data, mode, period), all = mode === 'all';
    const count = s.records.length, closing = s.closing;
    $('latest-date').textContent = '最新日报 · ' + s.latest.replaceAll('-', '.');
    $('account-count').textContent = closing.accountCount === null ? '—' : number(closing.accountCount);
    document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    $('period-label').hidden = all;
    $('period-input').type = mode === 'month' ? 'month' : 'date';
    const minimumDay = new Date(new Date(data.baseline.date + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10);
    $('period-input').min = mode === 'month' ? minimumDay.slice(0, 7) : minimumDay;
    $('period-input').setAttribute('aria-label', mode === 'month' ? '统计月份' : '统计日期');
    $('period-label').firstElementChild.textContent = mode === 'month' ? '月份' : '日期';
    if (!all) $('period-input').value = period;
    $('range-title').textContent = all ? '累计生产概览' : mode === 'month' ? period.replace('-', ' 年 ') + ' 月' : period.replace('-', ' 年 ').replace('-', ' 月 ') + ' 日';
    $('production-summary').textContent = count ? (all ? '已归档日报' : mode === 'month' ? '本月已录入' : '当日新增生产') + (mode === 'day' ? ' · 代码资产 ' + number(s.added.codeAdded) + ' 个' : ' ' + count + ' 天') : '该范围尚未录入日报';
    $('metrics').replaceChildren(statCard('高标准资产', 'high', all ? closing.highStandard : s.added.highStandardAdded, all ? s.added.highStandardAdded : closing.highStandard, count, all), statCard('代码资产', 'code', all ? closing.code : s.added.codeAdded, all ? s.added.codeAdded : closing.code, count, all));
    $('costs').replaceChildren(costCard('GPT（自有号池）', 'USD', 4, all ? closing.gptUsdUnits : s.added.gptUsdUnits, closing.gptUsdUnits, count), costCard('4router（Claude）', 'CNY', 2, all ? closing.claudeCnyFen : s.added.claudeCnyFen, closing.claudeCnyFen, count));
    $('scope-note').textContent = (all ? '累计包含历史初始余额与全部日报。' : mode === 'month' ? '月度新增与消耗只汇总本月已录入的 ' + count + ' 天，不把历史初始余额计入本月。' : count ? '当天新增与截至当天的累计分别展示。' : '这一天尚未记录，新增与消耗暂不显示。') + ' 期末累计及号池数量取截至 ' + closing.asOf + ' 的记录；两类资产独立统计，USD / CNY 分币种保留。';
    renderGallery(s); renderHistory(s);
    const b = data.baseline;
    $('baseline-note').textContent = '日报自 2026-11-28 开始归档。截至 ' + b.date + ' 的初始余额：高标准资产 ' + number(b.highStandard) + ' 个，代码资产 ' + number(b.code) + ' 个，GPT $' + C.money(b.gptUsdUnits, 4) + '，4router ¥' + C.money(b.claudeCnyFen, 2) + '。这些余额由首次提供的累计数扣除当日新增得出，未分摊到更早的具体日期或月份。';
    $('storage-status').textContent = storageMessage || '当前显示网站已发布数据。';
  }
  function openImage(src, name) {
    $('image-title').textContent = name; $('large-image').src = src; $('large-image').alt = name; $('open-original').href = src; $('image-dialog').classList.remove('original-size'); $('zoom-image').textContent = '原始尺寸'; $('image-dialog').showModal();
  }
  function renderGallery(s) {
    const allItems = s.records.flatMap(r => r.thumbnails.map(t => ({...t, date: r.date})));
    const counts = {code: allItems.filter(t => t.category === 'code').length, high: allItems.filter(t => t.category === 'high').length};
    $('code-image-count').textContent = counts.code; $('high-image-count').textContent = counts.high;
    $('all-image-count').textContent = allItems.length;
    document.querySelectorAll('[data-category]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.category === category)));
    const items = allItems.filter(t => category === 'all' || t.category === category);
    const name = category === 'all' ? '全部资产' : category === 'code' ? '代码资产' : '高标准资产';
    $('gallery-heading').textContent = mode === 'day' ? '当日资产缩略图' : mode === 'month' ? '本月资产缩略图' : '归档资产缩略图';
    $('gallery-note').textContent = name + ' · ' + number(items.length) + ' 张图片，按生产日期归档。总览图可包含多件资产，点击放大查看原图。';
    const pages = Math.max(1, Math.ceil(items.length / pageSize)); page = Math.min(page, pages - 1);
    const cards = items.slice(page * pageSize, (page + 1) * pageSize).map((t, index) => {
      const fig = el('figure', 'asset-thumb' + (t.kind === 'overview' ? ' overview-card' + (t.width / t.height > 1.2 ? ' overview-wide' : ' overview-portrait') : '')), button = el('button', 'thumb-button'); button.type = 'button'; button.setAttribute('aria-label', '放大查看：' + t.name);
      const img = el('img'); img.src = t.src; img.alt = t.name; img.width = t.width || 400; img.height = t.height || 300; img.loading = index < 3 ? 'eager' : 'lazy'; img.decoding = 'async';
      img.addEventListener('error', () => { button.replaceChildren(el('span', '', '图片暂不可用')); button.disabled = true; });
      button.append(img); button.addEventListener('click', () => openImage(t.src, t.name));
      const caption = el('figcaption'); const title = el('strong', '', t.name); title.title = t.name; caption.append(title, el('small', '', t.date + ' · ' + (t.category === 'code' ? '代码资产' : '高标准资产') + (t.kind === 'overview' ? ' · 原始总览图' : ''))); fig.append(button, caption); return fig;
    });
    $('thumbnail-grid').replaceChildren(...(cards.length ? cards : [el('div', 'empty-state', s.records.length ? '该类别的缩略图尚未上传，数量已计入统计。' : '这个时间范围还没有生产记录。')]));
    const prev = el('button', 'quiet-button', '上一页'), next = el('button', 'quiet-button', '下一页'); prev.type = next.type = 'button'; prev.disabled = page === 0; next.disabled = page >= pages - 1;
    const flip = n => { page += n; renderGallery(s); $('gallery-heading').scrollIntoView({block:'start'}); };
    prev.addEventListener('click', () => flip(-1)); next.addEventListener('click', () => flip(1));
    $('gallery-pagination').replaceChildren(...(items.length ? [prev, el('span', '', (page + 1) + ' / ' + pages), next] : []));
    const sheets = s.records.flatMap(r => r.sheets.filter(t => t.category === category).map(t => ({...t, date: r.date})));
    $('sheet-list').replaceChildren(...sheets.map(t => {const b = el('button', 'quiet-button', t.date + ' · ' + t.name); b.type = 'button'; b.addEventListener('click', () => openImage(t.src, t.name)); return b; }));
    document.querySelector('.original-sheets').hidden = !sheets.length;
  }
  function renderHistory(s) {
    const rows = [...s.records].reverse().map(r => {
      const closing = C.totals(data, r.date), row = el('tr'), date = el('td'), button = el('button', 'date-button', r.date);
      button.type = 'button'; button.addEventListener('click', () => {mode = 'day'; period = r.date; page = 0; render(); $('range-title').scrollIntoView({block:'start'});}); date.append(button); row.append(date);
      for (const [added, total] of [[r.highStandardAdded, closing.highStandard], [r.codeAdded, closing.code]]) {const cell = el('td'); cell.append(el('span', 'added', '+' + number(added)), el('span', 'total', '/ ' + number(total))); row.append(cell);}
      row.append(el('td', '', '$ ' + C.money(r.gptUsdUnits, 4)), el('td', '', '¥ ' + C.money(r.claudeCnyFen, 2)), el('td', '', r.accountCount + ' 个')); return row;
    });
    if (!rows.length) {const row = el('tr'), td = el('td', '', '该范围暂无日报'); td.colSpan = 6; row.append(td); rows.push(row);}
    $('history-body').replaceChildren(...rows);
  }
  function switchMode(next) {
    let anchor = mode === 'month' ? data.records.filter(r => r.date.startsWith(period + '-')).at(-1)?.date || period + '-01' : mode === 'all' ? data.records.at(-1)?.date || data.baseline.date : period;
    const minimumDay = new Date(new Date(data.baseline.date + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10);
    if (anchor < minimumDay) anchor = minimumDay;
    mode = next; period = next === 'month' ? anchor.slice(0, 7) : anchor; page = 0; render();
  }
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => switchMode(b.dataset.mode)));
  document.querySelectorAll('[data-category]').forEach(b => b.addEventListener('click', () => {category = b.dataset.category; page = 0; renderGallery(C.select(data, mode, period));}));
  $('period-input').addEventListener('change', e => {if (e.target.value && e.target.checkValidity()) {period = e.target.value; page = 0; render();} else e.target.reportValidity();});
  $('latest-button').addEventListener('click', () => {mode = 'day'; period = data.records.at(-1)?.date || data.baseline.date; page = 0; render();});
  $('all-history').addEventListener('click', () => switchMode('all'));
  $('close-image').addEventListener('click', () => $('image-dialog').close());
  $('zoom-image').addEventListener('click', () => {const original = $('image-dialog').classList.toggle('original-size'); $('zoom-image').textContent = original ? '适应窗口' : '原始尺寸';});
  $('image-dialog').addEventListener('close', () => {$('large-image').removeAttribute('src');});
  const form = $('record-form'), field = name => form.elements.namedItem(name);
  const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  function fillForm(date) {
    const row = data.records.find(r => r.date === date);
    field('date').value = date;
    field('accountCount').value = row?.accountCount ?? C.totals(data, data.records.at(-1)?.date || data.baseline.date).accountCount ?? 0;
    field('highStandardAdded').value = row?.highStandardAdded ?? 0; field('codeAdded').value = row?.codeAdded ?? 0;
    field('gptUsd').value = C.money(row?.gptUsdUnits ?? 0, 4, false); field('claudeCny').value = C.money(row?.claudeCnyFen ?? 0, 2, false); field('note').value = row?.note || '';
    field('highImages').value = ''; field('codeImages').value = '';
    $('record-existing').textContent = row ? '这一天已有日报。保存将更新当天数据并重新计算后续累计，已有缩略图和其他日期的记录保留。' : '新日报会按日期加入历史，累计数自动更新。';
    $('record-error').textContent = '';
  }
  $('add-record').addEventListener('click', () => {fillForm(mode === 'day' ? period : today()); $('record-dialog').showModal();});
  field('date').addEventListener('change', e => {if (e.target.value) fillForm(e.target.value);});
  ['close-record','cancel-record'].forEach(id => $(id).addEventListener('click', () => $('record-dialog').close()));
  function shrinkImage(file) {
    return new Promise((resolve, reject) => {
      if (!['image/png','image/jpeg','image/webp'].includes(file.type)) {reject(new Error('缩略图仅支持 PNG、JPEG、WebP。')); return;}
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, 800 / img.width, 800 / img.height), canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d'); ctx.fillStyle = '#eef0f2'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height); resolve(canvas.toDataURL('image/jpeg',.86));
        } catch {reject(new Error('图片处理失败，请尝试其他图片。'));} finally {URL.revokeObjectURL(url);}
      };
      img.onerror = () => {URL.revokeObjectURL(url); reject(new Error('无法读取图片：' + file.name));}; img.src = url;
    });
  }
  form.addEventListener('submit', async e => {
    e.preventDefault(); const saveButton = $('save-record'); saveButton.disabled = true; saveButton.textContent = '保存中…'; $('record-error').textContent = '';
    try {
      const date = field('date').value, existing = data.records.find(r => r.date === date);
      const record = {date, highStandardAdded:Number(field('highStandardAdded').value),codeAdded:Number(field('codeAdded').value),gptUsdUnits:C.decimalUnits(field('gptUsd').value,4),claudeCnyFen:C.decimalUnits(field('claudeCny').value,2),accountCount:Number(field('accountCount').value),note:field('note').value.trim(),thumbnails:[...(existing?.thumbnails || [])],sheets:[...(existing?.sheets || [])]};
      C.upsert(data, record);
      for (const [name, cat] of [['highImages','high'],['codeImages','code']]) for (const file of field(name).files) {
        const src = await shrinkImage(file); record.thumbnails.push({id:date + '-' + cat + '-' + Date.now() + '-' + record.thumbnails.length,category:cat,kind:field('imageKind').value,name:file.name.replace(/\.[^.]+$/,''),src});
      }
      save(C.upsert(data, record)); mode = 'day'; period = date; page = 0; render(); $('record-dialog').close();
    } catch (error) {$('record-error').textContent = error.message;}
    finally {saveButton.disabled = false; saveButton.textContent = '保存日报';}
  });
  function download(name, text, type) {
    const blob = new Blob([text], {type}), url = URL.createObjectURL(blob), a = el('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  $('export-site').addEventListener('click', () => {download('data.js','window.PRODUCTION_DATA = ' + JSON.stringify(data,null,2) + ';\n','text/javascript;charset=utf-8'); storageMessage = '网站数据已导出。将下载的 data.js 放到网站 assets/production/ 目录后重新 push。'; $('storage-status').textContent = storageMessage;});
  $('export-json').addEventListener('click', () => download('production-backup-' + today() + '.json',JSON.stringify(data,null,2),'application/json;charset=utf-8'));
  $('import-json').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    try {const parsed = JSON.parse(await file.text()); const next = C.merge(data,parsed); save(next); period = data.records.at(-1)?.date || data.baseline.date; mode = 'day'; page = 0; render();}
    catch (error) {$('storage-status').textContent = '导入失败，现有数据保留：' + error.message;} finally {e.target.value = '';}
  });
  render();
})();
