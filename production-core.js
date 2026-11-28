(function (root) {
  'use strict';
  const FIELDS = ['highStandardAdded', 'codeAdded', 'gptUsdUnits', 'claudeCnyFen'];
  const integer = (n, label) => {
    if (!Number.isSafeInteger(n) || n < 0) throw new Error(label + '必须是非负整数。');
    return n;
  };
  function validDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
    const d = new Date(s + 'T00:00:00Z');
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }
  function decimalUnits(value, places) {
    const s = String(value).trim();
    if (!new RegExp('^\\d+(?:\\.\\d{1,' + places + '})?$').test(s)) throw new Error('金额必须为非负数，最多保留 ' + places + ' 位小数。');
    const [a, b = ''] = s.split('.');
    return integer(Number(a) * 10 ** places + Number(b.padEnd(places, '0')), '金额');
  }
  function money(n, places, grouped = true) {
    integer(n, '金额');
    const scale = 10 ** places;
    const whole = Math.floor(n / scale);
    return (grouped ? whole.toLocaleString('en-US') : String(whole)) + '.' + String(n % scale).padStart(places, '0');
  }
  function imagePath(path) {
    return typeof path === 'string' && ((/^assets\/[a-zA-Z0-9_./-]+$/.test(path) && !path.split('/').includes('..')) || /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(path));
  }
  function validate(data) {
    if (!data || data.schemaVersion !== 1 || data.timezone !== 'Asia/Shanghai' || !data.baseline || !Array.isArray(data.records)) throw new Error('不是有效的生产动态数据文件。');
    const b = data.baseline;
    if (!validDate(b.date)) throw new Error('初始余额日期无效。');
    ['highStandard', 'code', 'gptUsdUnits', 'claudeCnyFen'].forEach(k => integer(b[k], k));
    const dates = new Set();
    let previous = b.date;
    const sorted = [...data.records].sort((a, z) => String(a.date).localeCompare(String(z.date)));
    for (const r of sorted) {
      if (!validDate(r.date) || r.date <= b.date || dates.has(r.date)) throw new Error('日报日期无效、重复或早于初始余额。');
      dates.add(r.date); previous = r.date;
      FIELDS.forEach(k => integer(r[k], k)); integer(r.accountCount, '号池账号数');
      if (r.note !== undefined && (typeof r.note !== 'string' || r.note.length > 1000)) throw new Error('备注最多 1,000 字。');
      if (!Array.isArray(r.thumbnails) || !Array.isArray(r.sheets)) throw new Error('缩略图列表无效。');
      const ids = new Set();
      for (const t of r.thumbnails) {
        if (!['high', 'code'].includes(t.category) || typeof t.id !== 'string' || ids.has(t.id) || typeof t.name !== 'string' || !imagePath(t.src)) throw new Error('缩略图信息无效。');
        if (t.kind !== undefined && !['asset','overview'].includes(t.kind)) throw new Error('图片类型无效。');
        ids.add(t.id);
      }
      for (const s of r.sheets) {
        if (!['high', 'code'].includes(s.category) || typeof s.name !== 'string' || !imagePath(s.src)) throw new Error('总览图信息无效。');
      }
      if (r.thumbnails.filter(t => t.category === 'high' && t.kind !== 'overview').length > r.highStandardAdded || r.thumbnails.filter(t => t.category === 'code' && t.kind !== 'overview').length > r.codeAdded) throw new Error('当日新增数量不能小于单个资产缩略图的数量。');
    }
    const clean = JSON.parse(JSON.stringify(data)); clean.records = sorted.map(r => JSON.parse(JSON.stringify(r)));
    totals(clean, previous); return clean;
  }
  function totals(data, through) {
    const b = data.baseline;
    const out = {highStandard: b.highStandard, code: b.code, gptUsdUnits: b.gptUsdUnits, claudeCnyFen: b.claudeCnyFen, accountCount: null, asOf: b.date};
    for (const r of data.records) if (r.date <= through) {
      out.highStandard += r.highStandardAdded; out.code += r.codeAdded;
      out.gptUsdUnits += r.gptUsdUnits; out.claudeCnyFen += r.claudeCnyFen;
      out.accountCount = r.accountCount; out.asOf = r.date;
    }
    ['highStandard', 'code', 'gptUsdUnits', 'claudeCnyFen'].forEach(k => integer(out[k], k));
    return out;
  }
  function select(data, mode, value) {
    if (!['day', 'month', 'all'].includes(mode)) throw new Error('统计方式无效。');
    const latest = data.records.at(-1)?.date || data.baseline.date;
    const end = mode === 'day' ? value : mode === 'month' ? value + '-31' : latest;
    const records = data.records.filter(r => mode === 'all' || (mode === 'day' ? r.date === value : r.date.startsWith(value + '-')));
    const added = Object.fromEntries(FIELDS.map(k => [k, records.reduce((sum, r) => sum + r[k], 0)]));
    FIELDS.forEach(k => integer(added[k], k));
    return {records, added, closing: totals(data, end), end, latest};
  }
  function upsert(data, record) {
    return validate({...data, records: [...data.records.filter(r => r.date !== record.date), record]});
  }
  function merge(base, imported) {
    imported = validate(imported);
    if (['date', 'highStandard', 'code', 'gptUsdUnits', 'claudeCnyFen'].some(k => base.baseline[k] !== imported.baseline[k])) throw new Error('备份的历史初始余额与本网站不一致。');
    const rows = new Map(base.records.map(r => [r.date, r]));
    imported.records.forEach(r => rows.set(r.date, r));
    return validate({...base, records: [...rows.values()]});
  }
  const api = {validate, validDate, decimalUnits, money, totals, select, upsert, merge, imagePath};
  root.ProductionCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
