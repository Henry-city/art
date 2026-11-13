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
function card(asset, index) {
  const node = make('article', 'card');
  const thumb = link('', '?asset=' + asset.id, 'thumb');
  thumb.setAttribute('aria-label', '查看资产：' + asset.name);
  thumb.append(image(asset.thumbnail, index < 2));
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
function motionComparison(motion) {
  const node = section('motion', '动画');
  const pair = make('div', 'motion-pair');
  const videos = [motion.input, motion.output].map((item, index) => {
    const panel = make('figure', 'panel');
    const video = make('video'); video.poster = item.poster;
    video.preload = 'none'; video.muted = true; video.playsInline = true;
    video.width = item.width; video.height = item.height;
    video.setAttribute('aria-label', index ? 'Output 动画' : 'Input 视频');
    panel.append(video, make('figcaption', '', index ? 'Output' : 'Input'));
    pair.append(panel); return video;
  });
  const controls = make('div', 'motion-controls');
  const play = make('button', '', '播放');
  const previous = make('button', '', '←'); previous.setAttribute('aria-label', '上一帧');
  const next = make('button', '', '→'); next.setAttribute('aria-label', '下一帧');
  const seek = make('input'); seek.type = 'range'; seek.min = 0;
  seek.max = motion.frameCount - 1; seek.value = 0; seek.step = 1;
  seek.setAttribute('aria-label', '逐帧查看');
  const label = make('output', 'motion-position');
  const [numerator, denominator = 1] = motion.frameRate.split('/').map(Number);
  const fps = numerator / denominator; let ready; let playing = false; let command = 0;
  const position = frame => {
    frame = Math.max(0, Math.min(motion.frameCount - 1, frame));
    seek.value = frame;
    const segment = motion.segments.find(s => frame >= s.outputStart && frame < s.outputStart + s.count);
    const sourceFrame = segment ? segment.sourceStart + frame - segment.outputStart : frame;
    label.textContent = `${frame + 1} / ${motion.frameCount} · 原片帧 ${sourceFrame}`;
  };
  const load = () => {
    if (ready) return ready;
    ready = Promise.all(videos.map((video, index) => new Promise((resolve, reject) => {
      if (video.readyState >= 1 && !video.error) { resolve(); return; }
      const cleanup = () => {
        video.removeEventListener('loadedmetadata', loaded);
        video.removeEventListener('error', failed);
      };
      const loaded = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error('Video unavailable')); };
      video.addEventListener('loadedmetadata', loaded);
      video.addEventListener('error', failed);
      video.src = (index ? motion.output : motion.input).path;
      video.load();
    }))).catch(error => { ready = undefined; throw error; });
    return ready;
  };
  const pause = () => { command++; playing = false; videos.forEach(v => v.pause()); play.textContent = '播放'; };
  const go = async frame => {
    pause(); position(frame); const requested = command;
    try { await load(); if (requested === command) videos.forEach(v => { v.currentTime = (Number(seek.value) + 0.05) / fps; }); }
    catch { label.textContent = '视频加载失败'; }
  };
  play.addEventListener('click', async () => {
    if (playing) { pause(); return; }
    const requested = ++command; play.disabled = true;
    try {
      await load();
      if (requested !== command) return;
      if (videos[0].ended) videos.forEach(v => { v.currentTime = 0; });
      playing = true; play.textContent = '暂停';
      await Promise.all(videos.map(v => v.play()));
    } catch { if (requested === command) { pause(); label.textContent = '视频加载失败，点击重试'; } }
    finally { play.disabled = false; }
  });
  previous.addEventListener('click', () => go(Number(seek.value) - 1));
  next.addEventListener('click', () => go(Number(seek.value) + 1));
  seek.addEventListener('input', () => go(Number(seek.value)));
  const sync = time => {
    if (!playing) return;
    position(Math.round(time * fps));
    if (Math.abs(videos[1].currentTime - time) > 1.5 / fps) videos[1].currentTime = time;
  };
  if (videos[0].requestVideoFrameCallback) {
    const tick = (_, metadata) => { sync(metadata.mediaTime); videos[0].requestVideoFrameCallback(tick); };
    videos[0].requestVideoFrameCallback(tick);
  } else videos[0].addEventListener('timeupdate', () => sync(videos[0].currentTime));
  videos[0].addEventListener('ended', pause);
  controls.append(play, previous, seek, next, label); position(0);
  node.append(pair, controls); return node;
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
  if (asset.motion) navigation.prepend(link('动画', '#motion'));
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
  app.replaceChildren(link('← 返回', './index.html', 'back'), header, overview, navigation,
    ...(asset.motion ? [motionComparison(asset.motion)] : []), process, footer);
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
