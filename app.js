const TALLY_FORM_URL = 'https://tally.so/r/2javLg';
const ROOT = 'assets/solwave_reference_v003/';
const ASSETS = [{
  id: 'solwave_reference_v003',
  name: 'SOLWAVE 微波炉 · v003',
  objectType: 'Microwave',
  manufacturingMethod: 'Agentic Blender modeling',
  description: '从单张参考照片重建可编辑的 Blender 模型。v003 完成黑色控制面板内凹、内腔与机身连续衔接，并保留齐平金属面和圆角。'
}];
const app = document.getElementById('app');
function make(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}
function link(text, href, cls, download) {
  const node = make('a', cls, text);
  node.href = href;
  if (download) node.setAttribute('download', '');
  return node;
}
function fileLinks(items) {
  const node = make('div', 'file-links');
  items.forEach(([file, label]) => node.append(link(label, ROOT + file)));
  return node;
}
function section(id, eyebrow, title) {
  const node = make('section', 'io');
  node.id = id;
  node.setAttribute('aria-labelledby', id + '-title');
  const head = make('div', 'section-head'), text = make('div'), heading = make('h2', '', title);
  heading.id = id + '-title';
  text.append(make('p', 'eyebrow', eyebrow), heading);
  head.append(text);
  node.append(head);
  return node;
}
function figure(file, title, description, eager) {
  const node = make('figure', 'panel'), frame = link('', ROOT + file, 'image-frame');
  frame.setAttribute('aria-label', '查看原图：' + title);
  const image = make('img');
  image.src = ROOT + file;
  image.alt = title;
  image.loading = eager ? 'eager' : 'lazy';
  image.decoding = 'async';
  frame.append(image);
  const caption = make('figcaption');
  caption.append(make('strong', '', title), document.createTextNode(description));
  node.append(frame, caption);
  return node;
}
function card(asset) {
  const article = make('article', 'card'), thumb = link('', '?asset=' + asset.id, 'thumb');
  thumb.setAttribute('aria-label', '查看 ' + asset.name);
  const image = make('img');
  image.src = ROOT + 'closed_reference.png';
  image.alt = 'SOLWAVE v003 微波炉闭门渲染';
  thumb.append(image, make('span', 'state', 'V003 · BLENDER'), make('span', 'caption', '面板内凹 / 内腔连续衔接'));
  const body = make('div', 'body'), tags = make('div', 'tags'), footer = make('div', 'footer');
  tags.append(make('span', 'tag', asset.objectType), make('span', 'tag method', asset.manufacturingMethod));
  body.append(tags, make('h3', '', asset.name), make('p', 'desc', asset.description));
  footer.append(make('code', '', asset.id), link('查看详情 →', '?asset=' + asset.id, 'detail-link'));
  body.append(footer);
  article.append(thumb, body);
  return article;
}
function renderHome() {
  app.replaceChildren();
  const hero = make('section', 'hero');
  hero.append(make('p', 'eyebrow', 'Reference-based asset gallery'), make('h1', '', 'From reference input to editable output.'), make('p', 'lead', '查看 SOLWAVE v003 的原始输入、制作过程和模型输出。参考照片、面板与内腔近景，以及可下载的 Blender 资产集中展示。'));
  const browser = make('section'), head = make('div', 'section-head'), headText = make('div'), count = make('p', 'count');
  count.setAttribute('aria-live', 'polite');
  headText.append(make('p', 'eyebrow', 'Asset browser'), make('h2', '', 'Available assets'));
  head.append(headText, count);
  const filters = make('div', 'filters'), selects = [];
  [['objectType', 'Object type', 'All object types'], ['manufacturingMethod', 'Manufacturing method', 'All manufacturing methods']].forEach(([field, label, all]) => {
    const control = make('label'), select = make('select');
    ['', ...new Set(ASSETS.map(asset => asset[field]))].forEach(value => {
      const option = make('option', '', value || all); option.value = value; select.append(option);
    });
    control.append(make('span', '', label), select);
    filters.append(control);
    selects.push({field, select});
  });
  const clear = make('button', 'clear', 'Clear filters');
  clear.type = 'button';
  filters.append(clear);
  const grid = make('div', 'grid'), empty = make('p', 'empty', '没有匹配的资产。');
  function draw() {
    const shown = ASSETS.filter(asset => selects.every(({field, select}) => !select.value || asset[field] === select.value));
    grid.replaceChildren(...shown.map(card));
    count.textContent = shown.length + ' of ' + ASSETS.length + ' asset · v003';
    empty.hidden = shown.length !== 0;
  }
  selects.forEach(({select}) => select.addEventListener('change', draw));
  clear.addEventListener('click', () => { selects.forEach(({select}) => select.value = ''); draw(); });
  browser.append(head, filters, grid, empty);
  app.append(hero, browser);
  draw();
}
function renderDetail(asset) {
  app.replaceChildren(link('← Back to gallery', './index.html', 'back'));
  const head = make('section', 'detail-head'), title = make('div'), actions = make('div', 'actions');
  title.append(make('p', 'eyebrow', 'Asset detail / Revision 003'), make('h1', '', asset.name), make('p', 'detail-desc', asset.description));
  actions.append(make('code', '', asset.id), link('下载 Blender 模型 ↓', ROOT + 'microwave_solwave.blend', 'primary', true), link('面板与内腔近景 ↘', '#process', 'detail-link'));
  head.append(title, actions);
  const meta = make('section', 'meta');
  [['Object type', asset.objectType], ['Manufacturing method', asset.manufacturingMethod], ['Validation', '几何 / 导出已核查 · 物理未运行']].forEach(([label, value]) => {
    const item = make('div'); item.append(make('span', '', label), make('strong', '', value)); meta.append(item);
  });
  const nav = make('nav', 'section-nav');
  nav.setAttribute('aria-label', '资产内容导航');
  nav.append(link('01 / Input', '#input'), link('02 / 制作过程', '#process'), link('03 / Output', '#output'));
  app.append(head, meta, nav);

  const input = section('input', '01 / Input', '原始输入与建模依据'), inputGrid = make('div', 'io-grid');
  const notes = make('article', 'panel input-notes');
  notes.append(make('h3', '', '一张参考照片，分离记录几何与外观'), make('p', '', '可见外观以原始照片为依据；v003 的修订要求是控制面板真实内凹，以及内腔、前框与机身连续衔接。'));
  const list = make('ul');
  ['几何：箱体、门窗、拉手、旋钮、散热孔及内腔参数。', '外观：金属、玻璃、黑色控制面板及文字布局。', '尺度：箱体 550 × 445 × 332 mm，为工程估计。'].forEach(text => list.append(make('li', '', text)));
  notes.append(list, fileLinks([['reference/user_reference.png', '原始参考图'], ['parameters.json', 'parameters.json'], ['materials.json', 'materials.json']]));
  inputGrid.append(figure('reference/user_reference.png', '原始参考照片', '用户提供的单张斜前方照片，用于外观比例、材质和可见部件布局。', true), notes);
  input.append(inputGrid, make('p', 'note', '照片未提供尺度，也未展示内部和背面。绝对尺寸、内腔、背面、铰链及锁钩为工程补全，控制面板小字为版式近似。'));

  const process = section('process', '02 / Process', 'v003 制作过程'), steps = make('ol', 'process-list');
  [
    ['参考拆解与参数输入', '依据照片划分箱体、门框、玻璃、防护网、拉手、旋钮与控制面板。几何参数和外观参数分别记录，箱体采用工程估计尺度。', [['parameters.json', '几何参数'], ['materials.json', '材质参数']]],
    ['Blender 参数化分件建模', '使用 Blender Python 从几何原语生成模型，组织箱体、门和旋钮的编辑层级；金属拉丝、玻璃及面板文字随模型保存。', [['build.py', '生成脚本'], ['assembly.json', '装配层级']]],
    ['v003 面板与内腔修订', '黑色面板嵌入真实切槽：表面内凹 2.2 mm，槽底深 2.8 mm。内腔前口采用共享顶点过渡，与机身实体联合，形成连续腔壁。', [['recessed_control_detail.png', '面板近景'], ['continuous_cavity_detail.png', '内腔近景']]],
    ['保存、回读与几何核查', '保存后重新读取模型，检查齐平面、圆角、散热孔及内腔连通性；导出视觉 USD 后重新导入，核对包围盒并渲染。', [['audit.py', '核查脚本'], ['geometry_audit.json', '核查结果'], ['build_manifest.json', '构建记录']]]
  ].forEach(([title, text, links]) => {
    const item = make('li'); item.append(make('h3', '', title), make('p', '', text), fileLinks(links)); steps.append(item);
  });
  const closeups = make('div', 'io-grid');
  closeups.append(figure('recessed_control_detail.png', '控制面板 · 真实内凹', '黑色表面低于周围金属面 2.2 mm，槽底深度 2.8 mm；保留切槽和金属斜面边缘。'), figure('continuous_cavity_detail.png', '内腔 · 连续衔接', '前口、腔壁与外壳为一个连通网格；9 个截面、36 条内壁射线检查连续腔壁。'));
  process.append(steps, closeups);

  const output = section('output', '03 / Output', '模型、渲染与交付文件'), downloads = make('div', 'downloads');
  downloads.append(link('闭门模型 .blend · 7.6 MB', ROOT + 'microwave_solwave.blend', 'primary', true), link('开门模型 .blend · 7.6 MB', ROOT + 'microwave_solwave_open.blend', 'primary secondary', true), link('完整 v003 资产包 .zip · 28.5 MB', 'assets/solwave_reference_v003.zip', 'primary secondary', true));
  const outputs = make('div', 'io-grid');
  outputs.append(figure('closed_reference.png', '闭门整体', 'v003 Blender 渲染 · 原生模型可分件编辑。'), figure('open_inspection.png', '开门与内腔', '105° 编辑展示姿态，门、拉手、玻璃和内框随编辑父级运动。'));
  const more = make('details', 'more'), moreGrid = make('div', 'io-grid');
  more.append(make('summary', '', '更多 v003 输出：正面、圆角、齐平面与 USD 回读'));
  [
    ['front_inspection.png', '正面检查', '门窗、拉手、控制面板和双排散热孔。'],
    ['rounded_corner_detail.png', '机身与门框圆角', '机身圆角 6 mm、门轮廓 7 mm、前缘 2.8 mm，均为工程比例估计。'],
    ['flush_panel_detail.png', '金属面齐平', '门与控制区金属面的前后差值小于 0.001 mm。'],
    ['usd_readback.png', 'USD 回读渲染', '视觉 USD 重新导入后的核查图；世界包围盒与 Blender 源文件一致。']
  ].forEach(item => moreGrid.append(figure(...item)));
  more.append(moreGrid);
  const audit = make('div', 'audit'), tableWrap = make('div', 'table-wrap'), table = make('table');
  audit.append(make('h3', '', 'v003 几何与导出核查'));
  table.append(make('caption', '', '以下结果来自本版本随附的 geometry_audit.json。'));
  const tbody = make('tbody');
  [
    ['源文件', 'Blender 5.2.0 LTS；164 个网格对象、29 个文字对象；参考图与字体已打包。'],
    ['孔洞', '防护网 25,629 孔；18 个散热孔在面板与支承壳体上均通过射线贯通检查。'],
    ['内腔连续性', '1 个连通网格、0 条非流形边；9 个截面 / 36 条内壁射线检查。'],
    ['USD 回读', '193 个网格；与源文件的世界包围盒差值为 0。'],
    ['完整模型尺寸', '约 550 × 514.1 × 346 mm，含拉手与支脚；为工程估计。'],
    ['物理验证', '未运行 Isaac Sim；本版本为视觉模型，未建立物理关节或刚体。']
  ].forEach(([label, value]) => {
    const row = make('tr'), th = make('th', '', label); th.scope = 'row'; row.append(th, make('td', '', value)); tbody.append(row);
  });
  table.append(tbody); tableWrap.append(table); audit.append(tableWrap);
  output.append(downloads, outputs, more, audit, make('p', 'note', 'Blender 文件保留完整拉丝与玻璃外观。视觉 USD 使用通用材质近似；完整资产包包含 USD、纹理、参考图、生成与核查脚本、参数和渲染。开门状态为编辑展示，几何核查不代表物理仿真通过。'));
  const resources = make('div', 'more');
  resources.append(fileLinks([['README.txt', '使用与复现说明'], ['geometry_audit.json', '独立核查数据'], ['build_manifest.json', '构建与来源清单'], ['assembly.json', '装配层级'], ['index.html', '完整图文审阅页']]));
  output.append(resources);
  const footer = make('footer', 'page-footer');
  footer.append(make('span', '', 'SOLWAVE / v003 / Native Blender asset'), link('Report Issue ↗', TALLY_FORM_URL + '?asset_id=' + encodeURIComponent(asset.id)));
  app.append(input, process, output, footer);
  document.title = asset.name + ' | Articulated Asset Gallery';
}
function renderNotFound() {
  app.replaceChildren(make('p', 'eyebrow', 'Asset unavailable'), make('h1', '', '未找到这个资产。'), make('p', 'lead', '当前资产库提供 SOLWAVE v003。'), link('返回资产库', './index.html', 'primary'));
}
const current = new URLSearchParams(location.search).get('asset');
if (current) {
  const found = ASSETS.find(asset => asset.id === current);
  if (found) renderDetail(found); else renderNotFound();
} else renderHome();
