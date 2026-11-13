const DATA = window.ASSET_GALLERY;
const app = document.getElementById('app');
const reportButton = document.getElementById('report-issue');
function make(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}
function link(text, href, cls) {
  const node = make('a', cls, text); node.href = href; return node;
}
function image(item, eager = false) {
  const node = make('img'); node.src = item.path; node.alt = item.title;
  node.width = item.width; node.height = item.height;
  node.loading = eager ? 'eager' : 'lazy'; node.decoding = 'async'; return node;
}
function figure(item, eager = false) {
  const node = make('figure', 'panel');
  const frame = link('', item.path, 'image-frame');
  frame.setAttribute('aria-label', '放大查看：' + item.title);
  frame.append(image(item, eager));
  const caption = make('figcaption');
  caption.append(make('strong', '', item.title));
  if (item.caption) caption.append(make('span', '', item.caption));
  node.append(frame, caption); return node;
}
function section(id, eyebrow, title) {
  const node = make('section', 'section'); node.id = id;
  const heading = make('h2', '', title); heading.id = id + '-title';
  node.setAttribute('aria-labelledby', heading.id);
  const head = make('div', 'section-head');
  head.append(make('p', 'eyebrow', eyebrow), heading); node.append(head); return node;
}
function card(asset) {
  const node = make('article', 'card');
  const thumb = link('', '?asset=' + asset.id, 'thumb');
  thumb.setAttribute('aria-label', '查看资产：' + asset.name);
  thumb.append(image(asset.thumbnail, true), make('span', 'state', 'INPUT → OUTPUT'));
  const body = make('div', 'card-body'), tags = make('div', 'tags'), foot = make('div', 'card-footer');
  tags.append(make('span', 'tag', asset.category), make('span', 'tag method', asset.method));
  foot.append(make('span', 'muted', asset.process.length + ' 轮过程记录'), link('查看资产 →', '?asset=' + asset.id, 'detail-link'));
  body.append(tags, make('h3', '', asset.name), make('p', 'description', asset.description), foot);
  node.append(thumb, body); return node;
}
function renderHome() {
  const hero = make('section', 'hero');
  hero.append(make('p', 'eyebrow', 'Articulated asset gallery'), make('h1', '', '从参考，到成形。'),
    make('p', 'lead', '查看每个资产的输入与最终结果，沿着过程图片、修改提示词和人工编辑记录，回看它如何一步步成形。'));
  const gallery = section('assets', 'Collection / ' + String(DATA.assets.length).padStart(2, '0'), '资产库');
  const grid = make('div', 'gallery-grid'); grid.append(...DATA.assets.map(card)); gallery.append(grid);
  app.replaceChildren(hero, gallery); document.title = 'Articulated Assets · 资产库';
}
function round(stage) {
  const node = make('article', 'round'); node.id = stage.id;
  const header = make('div', 'round-head');
  header.append(make('p', 'eyebrow', stage.label), make('h3', '', stage.title));
  const instruction = make('div', 'instruction');
  instruction.append(make('p', 'instruction-label', stage.instruction.kind), make('blockquote', '', stage.instruction.text),
    make('p', 'source-line', stage.instruction.source));
  const images = make('div', 'round-images' + (stage.images.length === 1 ? ' single-image' : ''));
  images.append(...stage.images.map(item => figure(item)));
  node.append(header, instruction, make('p', 'round-description', stage.description), images);
  return node;
}
function renderDetail(asset) {
  const header = make('header', 'detail-head');
  header.append(make('p', 'eyebrow', asset.method), make('h1', '', asset.name), make('p', 'lead', asset.description));
  const overview = make('div', 'overview'); overview.id = 'input-output';
  const input = section('input', '01 / Input', '输入参考');
  input.append(...asset.input.map(item => figure(item, true)));
  const output = section('output', '02 / Output', '最终结果');
  const outputImages = make('div', 'output-images');
  outputImages.append(...asset.output.map(item => figure(item, true))); output.append(outputImages);
  overview.append(input, output);
  const navigation = make('nav', 'section-nav'); navigation.setAttribute('aria-label', '资产页内容导航');
  navigation.append(link('Input / Output ↑', '#input-output'), ...asset.process.map(stage => link(stage.label, '#' + stage.id)), link('来源与记录', '#record'));
  const process = section('process', '03 / Process', '详细过程');
  process.append(make('p', 'section-description', '按修改顺序保存过程图片、提示词和编辑说明。'));
  if (asset.references.length) {
    const references = make('section', 'references');
    references.append(make('h3', '', '参考收集 · 说明书与结构资料'));
    const grid = make('div', 'reference-grid'); grid.append(...asset.references.map(item => figure(item)));
    references.append(grid); process.append(references);
  }
  const timeline = make('div', 'timeline' + (asset.process.every(stage => stage.images.length === 1) ? ' compact' : ''));
  timeline.append(...asset.process.map(round)); process.append(timeline);
  const record = section('record', '04 / Record', '来源与记录');
  record.append(make('p', 'record-source', asset.sourceLabel), make('p', 'record-note', asset.note));
  const download = link('保存图片索引与提示词 ↓', asset.recordPath, 'record-download');
  download.setAttribute('download', asset.id + '-record.json'); record.append(download);
  const footer = make('footer', 'page-footer');
  footer.append(make('span', '', 'Articulated Assets / ' + asset.name), link('回到顶部 ↑', '#input-output'));
  app.replaceChildren(link('← 返回资产库', './index.html', 'back'), header, overview, navigation, process, record, footer);
  reportButton.href = 'https://tally.so/r/2javLg?asset_id=' + encodeURIComponent(asset.id);
  document.title = asset.name + ' · Articulated Assets';
}
function renderNotFound() {
  app.replaceChildren(make('h1', '', '未找到这个资产'), link('返回资产库 →', './index.html', 'detail-link'));
}
const requested = new URLSearchParams(location.search).get('asset');
const id = DATA.aliases[requested] || requested;
if (!id) renderHome();
else {
  const asset = DATA.assets.find(item => item.id === id);
  if (asset) {
    if (requested !== id) history.replaceState(null, '', '?asset=' + id + location.hash);
    renderDetail(asset);
  } else renderNotFound();
}
