const TALLY_FORM_URL = 'https://tally.so/r/2javLg';
const DATA = window.SOLWAVE_GALLERY;
const ASSETS = DATA.versions;
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
function image(path, alt, dimensions, eager = false) {
  const node = make('img'); node.src = path; node.alt = alt;
  node.width = dimensions.width; node.height = dimensions.height;
  node.loading = eager ? 'eager' : 'lazy'; node.decoding = 'async'; return node;
}
function figure(asset, item, eager = false) {
  const node = make('figure', 'panel'), frame = link('', asset.root + item.file, 'image-frame');
  frame.setAttribute('aria-label', '查看图片：' + item.title);
  frame.append(image(asset.root + item.file, item.title, item, eager));
  const caption = make('figcaption');
  caption.append(make('strong', '', item.title), document.createTextNode(item.caption));
  node.append(frame, caption); return node;
}
function section(id, eyebrow, title) {
  const node = make('section', 'io'); node.id = id;
  node.setAttribute('aria-labelledby', id + '-title');
  const head = make('div', 'section-head'), text = make('div'), heading = make('h2', '', title);
  heading.id = id + '-title'; text.append(make('p', 'eyebrow', eyebrow), heading);
  head.append(text); node.append(head); return node;
}
function card(asset) {
  const node = make('article', 'card'), thumb = link('', '?asset=' + asset.id, 'thumb');
  thumb.setAttribute('aria-label', '查看 ' + asset.name);
  thumb.append(image(asset.root + asset.thumbnail.file, asset.name + '闭门渲染', asset.thumbnail, true));
  thumb.append(make('span', 'state', asset.version.toUpperCase() + ' · PROCESS'), make('span', 'caption', asset.title));
  const body = make('div', 'body'), tags = make('div', 'tags'), footer = make('div', 'footer');
  tags.append(make('span', 'tag', 'Microwave'), make('span', 'tag method', 'Blender modeling'));
  footer.append(make('span', 'subtle', asset.images.length + ' 张过程图'), link('查看过程 →', '?asset=' + asset.id, 'detail-link'));
  body.append(tags, make('h3', '', asset.name), make('p', 'desc', asset.description), footer);
  node.append(thumb, body); return node;
}
function renderHome() {
  app.replaceChildren();
  const hero = make('section', 'hero');
  hero.append(make('p', 'eyebrow', 'Reference → Iteration'), make('h1', '', '从参考图，到逐轮修订。'), make('p', 'lead', '保留 SOLWAVE 微波炉的两轮建模过程，查看初版比例、开门结构，以及金属面齐平与圆角修订。'));
  const gallery = section('versions', 'Process archive', '过程版本'); gallery.classList.add('gallery-section');
  const grid = make('div', 'grid gallery-grid'); grid.append(...ASSETS.map(card));
  gallery.append(grid); app.append(hero, gallery); document.title = 'SOLWAVE · v1 / v2 过程记录';
}
function renderDetail(asset) {
  app.replaceChildren(link('← 返回过程版本', './index.html', 'back'));
  const head = make('section', 'detail-head'), title = make('div'), actions = make('div', 'actions');
  title.append(make('p', 'eyebrow', 'Process archive / ' + asset.version.toUpperCase()), make('h1', '', asset.name), make('p', 'detail-desc', asset.description));
  const other = ASSETS.find(item => item.id !== asset.id);
  actions.append(link('查看 ' + other.version.toUpperCase() + ' →', '?asset=' + other.id, 'primary secondary'));
  head.append(title, actions);
  const meta = make('section', 'meta');
  [['版本', asset.version.toUpperCase()], ['记录内容', asset.title], ['图片', asset.images.length + ' 张']].forEach(([label, value]) => {
    const item = make('div'); item.append(make('span', '', label), make('strong', '', value)); meta.append(item);
  });
  const nav = make('nav', 'section-nav'); nav.setAttribute('aria-label', '版本内容导航');
  nav.append(link('01 / 过程图片', '#process'), link('02 / 原始参考', '#reference'));
  const process = section('process', '01 / Iteration', asset.title), grid = make('div', 'io-grid');
  asset.images.forEach((item, i) => grid.append(figure(asset, item, i < 2))); process.append(grid);
  const reference = section('reference', '02 / Reference', '原始参考'), referenceGrid = make('div', 'io-grid');
  const ref = DATA.reference, refFigure = make('figure', 'panel'), refLink = link('', ref.path, 'image-frame');
  refLink.append(image(ref.path, '用户提供的 SOLWAVE 微波炉参考照片', ref));
  const refCaption = make('figcaption');
  refCaption.append(make('strong', '', '原始参考照片'), document.createTextNode('用于外观比例、材质和可见部件布局。'));
  refFigure.append(refLink, refCaption);
  const notes = make('article', 'panel input-notes');
  notes.append(make('h3', '', '本轮记录'), make('p', '', asset.description), make('p', '', '参考照片没有给出尺寸，也未展示内部和背面；尺寸及隐藏结构采用工程补全。开门画面为编辑展示姿态。'));
  referenceGrid.append(refFigure, notes); reference.append(referenceGrid);
  const footer = make('footer', 'page-footer');
  footer.append(make('span', '', 'SOLWAVE / ' + asset.version.toUpperCase() + ' / 过程图片'), link('返回过程版本 ↑', './index.html'));
  app.append(head, meta, nav, process, reference, footer);
  reportButton.href = TALLY_FORM_URL + '?asset_id=' + encodeURIComponent(asset.id);
  document.title = asset.name + ' · 过程记录';
}
function renderNotFound() {
  app.replaceChildren(make('p', 'eyebrow', 'Process archive'), make('h1', '', '这里记录 v1 与 v2。'), make('p', 'lead', '请选择一个过程版本查看图片。'), link('返回过程版本', './index.html', 'primary'));
}
const current = new URLSearchParams(location.search).get('asset');
if (current) {
  const found = ASSETS.find(asset => asset.id === current);
  if (found) renderDetail(found); else renderNotFound();
} else renderHome();
