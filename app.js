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
function figure(item, eager = false, showTitle = true) {
  const node = make('figure', 'panel');
  const frame = link('', item.path, 'image-frame');
  frame.setAttribute('aria-label', '放大查看：' + item.title);
  frame.append(image(item, eager));
  node.append(frame);
  if (showTitle) {
    const caption = make('figcaption');
    caption.append(make('strong', '', item.title)); node.append(caption);
  }
  return node;
}
function section(id, title) {
  const node = make('section', 'section'); node.id = id;
  const heading = make('h2', '', title); heading.id = id + '-title';
  node.setAttribute('aria-labelledby', heading.id);
  const head = make('div', 'section-head');
  head.append(heading); node.append(head); return node;
}
function card(asset) {
  const node = make('article', 'card');
  const thumb = link('', '?asset=' + asset.id, 'thumb');
  thumb.setAttribute('aria-label', '查看资产：' + asset.name);
  thumb.append(image(asset.thumbnail, true));
  const body = make('div', 'card-body');
  const title = make('h2');
  title.append(link(asset.name, '?asset=' + asset.id, 'asset-title'));
  const arrow = make('span', 'card-arrow', '↗'); arrow.setAttribute('aria-hidden', 'true');
  body.append(title, arrow);
  node.append(thumb, body); return node;
}
function renderHome() {
  const hero = make('section', 'hero');
  hero.append(make('h1', '', 'Articulated Assets Gallery'));
  const gallery = make('section'); gallery.id = 'assets'; gallery.setAttribute('aria-label', '资产');
  const grid = make('div', 'gallery-grid'); grid.append(...DATA.assets.map(card)); gallery.append(grid);
  app.replaceChildren(hero, gallery); document.title = 'Articulated Assets Gallery';
}
function round(stage) {
  const node = make('article', 'round'); node.id = stage.id;
  const header = make('div', 'round-head');
  header.append(make('p', 'eyebrow', stage.label), make('h3', '', stage.title));
  const instruction = make('div', 'instruction');
  instruction.append(make('blockquote', '', stage.instruction.text));
  const images = make('div', 'round-images' + (stage.images.length === 1 ? ' single-image' : ''));
  images.append(...stage.images.map(item => figure(item, false, stage.images.length > 1)));
  node.append(header, instruction, images);
  return node;
}
function renderDetail(asset) {
  const header = make('header', 'detail-head');
  header.append(make('h1', '', asset.name));
  const overview = make('div', 'overview'); overview.id = 'input-output';
  const input = section('input', 'Input');
  input.append(...asset.input.map(item => figure(item, true)));
  const output = section('output', 'Output');
  const outputImages = make('div', 'output-images');
  outputImages.append(...asset.output.map(item => figure(item, true))); output.append(outputImages);
  overview.append(input, output);
  const navigation = make('nav', 'section-nav'); navigation.setAttribute('aria-label', '资产页内容导航');
  navigation.append(link('Input / Output ↑', '#input-output'), ...asset.process.map(stage => link(stage.label, '#' + stage.id)));
  const process = section('process', '详细过程');
  if (asset.references.length) {
    const references = make('section', 'references');
    references.append(make('h3', '', '参考资料'));
    const grid = make('div', 'reference-grid'); grid.append(...asset.references.map(item => figure(item)));
    references.append(grid); process.append(references);
  }
  const timeline = make('div', 'timeline' + (asset.process.every(stage => stage.images.length === 1) ? ' compact' : ''));
  timeline.append(...asset.process.map(round)); process.append(timeline);
  const download = link('保存记录 ↓', asset.recordPath, 'record-download');
  download.setAttribute('download', asset.id + '-record.json');
  const footer = make('footer', 'page-footer');
  footer.append(download, link('回到顶部 ↑', '#input-output'));
  app.replaceChildren(link('← 返回', './index.html', 'back'), header, overview, navigation, process, footer);
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
