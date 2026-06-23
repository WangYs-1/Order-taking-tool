import './styles.css';
import { icon } from './icons.js';
import { loadState, saveState, uid, addTerms } from './store.js';
import { loadCloudState, queueCloudSave } from './cloudStore.js';

let state = loadState();
let route = location.hash.slice(1) || 'home';
let cleanupMode = false;
let randomSelection = [];
let manualSelection = [];
let selectionMode = 'manual';
let editorIngredients = [];
let lastConfirmedMenu = null;
let latestShareImage = null;

const app = document.querySelector('#app');
const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const isUrl = text => /^https?:\/\//i.test(text || '');
const activeShopping = () => state.shopping.filter(item => !item.done);
const persist = () => { saveState(state); queueCloudSave(state); };
const toast = message => {
  const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
};

function navigate(next) { location.hash = next; }
window.addEventListener('hashchange', () => { route = location.hash.slice(1) || 'home'; render(); scrollTo(0,0); });

function shell(content) {
  const shopping = activeShopping();
  return `<div class="app-shell">
    <header class="topbar">
      <button class="brand" data-nav="home" aria-label="返回首页"><span class="brand-mark">${icon('chef',26)}</span><span><strong>今天吃点啥</strong><span>家庭吃饭决策小助手</span></span></button>
      <div class="avatar" aria-label="家庭账号">家</div>
    </header>
    ${shopping.length ? `<aside class="ticker" aria-label="待采购提醒"><div class="ticker-label">${icon('cart',18)} 待采购</div><div class="ticker-track"><div class="ticker-content">${[...shopping,...shopping].map(x=>`<span>${esc(x.name)}</span>`).join('')}</div></div><button class="ticker-action" data-nav="fridge">去看看</button></aside>` : ''}
    <main id="main">${content}</main>
  </div>${bottomNav()}`;
}

function bottomNav() {
  return `<nav class="bottom-nav" aria-label="主要导航">
    ${[['cook','chef','自己做'],['out','store','出去吃'],['takeout','bike','点外卖'],['fridge','fridge','冰箱']].map(([r,i,t])=>`<button class="${route===r?'active':''}" data-nav="${r}" aria-label="${t}">${icon(i,21)}<span>${t}</span></button>`).join('')}
  </nav>`;
}

function homePage() {
  const expiring = state.inventory.filter(x => x.expiry && new Date(x.expiry) - new Date() < 4*86400000).length;
  return `<section class="hero"><div class="hero-copy"><span class="eyebrow">${icon('sparkle',16)} 今天也要好好吃饭</span><h1>别纠结，<br>好吃的马上来。</h1><p>从家里的菜到附近的小店，把“吃什么”变成一件轻松的小事。</p></div><div class="hero-side"><div class="big-icon">${icon('chef',42)}</div><div><strong>${state.dishes.length} 道家常菜</strong><p>已经收入你家的菜单库，想吃什么直接去菜单里挑。</p></div></div></section>
  <div class="section-head"><div><h2>今天怎么吃？</h2><p>${expiring ? `有 ${expiring} 样食材快到期了，优先消灭它们吧。` : '选一个方向，马上开饭。'}</p></div></div>
  <section class="entry-grid" aria-label="四大核心功能">
    ${entry('cook','chef','自己做','从家常菜单里搭配一桌','cook')}
    ${entry('out','store','出去吃','抽一家收藏的小馆子','out')}
    ${entry('takeout','bike','点外卖','不用出门也能吃点好的','takeout')}
    ${entry('fridge','fridge','看看冰箱','先把现有食材安排上','fridge')}
  </section>`;
}
function entry(routeName, iconName, title, desc, cls) { return `<button class="entry-card ${cls}" data-nav="${routeName}"><span class="bubble">${icon(iconName,28)}</span><span><strong>${title}</strong><span>${desc}</span></span><span class="go">${icon('arrow',20)}</span></button>`; }

function pageHead(title, actionLabel, action) {
  return `<div class="page-head"><div class="page-title"><button class="back-btn" data-nav="home" aria-label="返回首页">${icon('back')}</button><h1>${title}</h1></div><div class="toolbar">${actionLabel ? `<button class="btn btn-primary" data-action="${action}" aria-label="${actionLabel}">${icon('plus',19)}<span>${actionLabel}</span></button>`:''}</div></div>`;
}

function cookPage() {
  const categories = [...new Set(state.dishes.map(x=>x.category))];
  return `${pageHead('自己做','录入新菜','dish-form')}
    ${manualSelection.length ? `<section class="selection-bar"><div><strong>已选 ${manualSelection.length} 道菜</strong><p>${manualSelection.map(id=>state.dishes.find(x=>x.id===id)?.name).filter(Boolean).map(esc).join('、')}</p></div><button class="btn btn-primary" data-action="manual-confirm">去下单 ${icon('arrow',18)}</button></section>`:''}
    <section class="random-panel"><div><strong>随机盲盒点菜</strong><p>按荤素搭配，一键决定今天的菜单。</p></div><div class="random-controls">${categories.map(c=>`<label>${esc(c)} <select data-random-cat="${esc(c)}" aria-label="${esc(c)}数量">${[0,1,2,3,4].map(n=>`<option value="${n}" ${((c==='荤菜'&&n===2)||(c!=='荤菜'&&n===1))?'selected':''}>${n}</option>`).join('')}</select></label>`).join('')}<button class="btn btn-primary" data-action="random-dishes">${icon('dice',19)} 开盲盒</button></div></section>
    <nav class="category-nav" aria-label="菜品分类">${categories.map((c,i)=>`<button class="chip ${i===0?'active':''}" data-anchor="cat-${i}">${esc(c)}</button>`).join('')}</nav>
    ${categories.map((cat,i)=>`<section class="dish-section" id="cat-${i}"><h2>${esc(cat)} <span class="count">${state.dishes.filter(x=>x.category===cat).length} 道</span></h2><div class="card-grid">${state.dishes.filter(x=>x.category===cat).map(dishCard).join('')}</div></section>`).join('') || `<div class="empty">菜单还是空的，先录入一道拿手菜吧。</div>`}`;
}
function dishCard(d) { const selected=manualSelection.includes(d.id); return `<article class="data-card"><h3>${esc(d.name)}</h3><p>${d.recipe ? (isUrl(d.recipe)?'外部菜谱链接':'家庭做法已记录') : '还没写菜谱'}</p><div class="tag-row">${d.ingredients.map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div><div class="card-actions"><button class="btn ${selected?'btn-dark':'btn-secondary'}" data-action="toggle-dish" data-id="${d.id}" aria-pressed="${selected}">${icon(selected?'check':'plus',16)} ${selected?'已选':'选这道'}</button><button class="btn btn-secondary" data-action="recipe" data-id="${d.id}">${icon('link',16)} 菜谱</button><button class="btn btn-secondary" data-action="dish-form" data-id="${d.id}" aria-label="编辑 ${esc(d.name)}">${icon('edit',16)}</button></div></article>`; }

function placesPage(type) {
  const isTakeout = type === 'takeout', items = state.places.filter(x=>x.type===type);
  const cats = [...new Set(items.map(x=>x.category))];
  return `${pageHead(isTakeout?'点外卖':'出去吃',isTakeout?'录入店铺':'录入餐馆','place-form')}
  <section class="random-panel"><div><strong>${isTakeout?'外卖抽签机':'餐馆抽签机'}</strong><p>设置条件，让运气替你做决定。</p></div><div class="random-controls"><select id="place-category" aria-label="店铺分类"><option value="">全部分类</option>${cats.map(c=>`<option>${esc(c)}</option>`).join('')}</select><select id="place-rating" aria-label="最低评分"><option value="0">不限评分</option><option value="4">4 星以上</option><option value="4.5">4.5 星以上</option></select><button class="btn btn-primary" data-action="random-place" data-type="${type}">${icon('dice',19)} 抽一家</button></div></section>
  <div class="section-head"><div><h2>${isTakeout?'常点店铺':'收藏菜馆'}</h2><p>共 ${items.length} 家，吃过以后记得回来打分。</p></div></div>
  <section class="card-grid">${items.map(placeCard).join('') || `<div class="empty">还没有收藏，录入第一家吧。</div>`}</section>`;
}
function starDisplay(value) {
  const rating = Number(value);
  return `<span class="star-display" aria-label="${rating.toFixed(1)} 星">${[1,2,3,4,5].map(n=>`<span class="star-shape ${rating>=n?'full':rating>=n-.5?'half':''}" aria-hidden="true">★</span>`).join('')}<b>${rating.toFixed(1)}</b></span>`;
}
function starPicker(value=5) {
  const rating = Number(value);
  return `<div class="field full"><label id="rating-label">评分 *</label><div class="star-picker" role="radiogroup" aria-labelledby="rating-label" data-value="${rating}"><input type="hidden" name="rating" value="${rating}">${[1,2,3,4,5].map(n=>`<span class="star-unit"><span class="star-base" aria-hidden="true">★</span><span class="star-fill" style="width:${rating>=n?100:rating>=n-.5?50:0}%" aria-hidden="true">★</span><button type="button" class="star-hit left" role="radio" aria-label="${n-.5} 星" aria-checked="${rating===n-.5}" data-action="set-rating" data-rating="${n-.5}"></button><button type="button" class="star-hit right" role="radio" aria-label="${n} 星" aria-checked="${rating===n}" data-action="set-rating" data-rating="${n}"></button></span>`).join('')}<output>${rating.toFixed(1)} 星</output></div><span class="hint">点击星星左半边可选择半星，支持 0.5 星步进。</span></div>`;
}
function placeCard(p) { return `<article class="data-card"><div class="stars">${starDisplay(p.rating)} <span class="tag">${esc(p.category)}</span></div><h3>${esc(p.name)}</h3><p>${esc(p.address)}</p><p><strong>招牌：</strong>${esc(p.specials)}</p>${p.fee?`<span class="tag">${esc(p.fee)}</span>`:''}<div class="card-actions"><button class="btn btn-secondary" data-action="share-place" data-id="${p.id}">${icon('share',16)} 分享</button><button class="btn btn-secondary" data-action="place-form" data-id="${p.id}" aria-label="编辑 ${esc(p.name)}">${icon('edit',16)}</button></div></article>`; }

function fridgePage() {
  const selectedClass = cleanupMode ? '' : 'hidden';
  return `${pageHead('冰箱库存')}
  <section class="inventory-summary"><div><strong>冰箱里有 ${state.inventory.length} 样食材</strong><p>${activeShopping().length ? `还有 ${activeShopping().length} 样东西待采购。`:'采购清单已经清空。'}</p></div><div class="toolbar">${cleanupMode?`<button class="btn btn-danger" data-action="delete-stock">${icon('trash',18)} 删除所选</button><button class="btn btn-secondary" data-action="cleanup-cancel">取消</button>`:`<button class="btn btn-secondary" data-action="cleanup">${icon('trash',18)} 清理冰箱</button>`}</div></section>
  <div class="inventory-grid"><section class="panel"><div class="section-head"><div><h2>现有存货</h2><p>按到期时间优先安排</p></div><button class="icon-btn" data-action="inventory-form" aria-label="录入食材">${icon('plus')}</button></div><div class="inventory-list">${state.inventory.sort((a,b)=>(a.expiry||'9').localeCompare(b.expiry||'9')).map(x=>`<article class="inventory-item">${cleanupMode?`<input type="checkbox" data-stock-select value="${x.id}" aria-label="选择 ${esc(x.name)}">`:''}<span class="food-dot">${esc(x.name.slice(0,1))}</span><span class="inventory-meta"><strong>${esc(x.name)} · ${esc(x.amount)}</strong><small>入库：${esc(x.added||'/')}</small><small>到期：${esc(x.expiry||'/')}</small></span><button class="icon-btn" data-action="inventory-form" data-id="${x.id}" aria-label="编辑 ${esc(x.name)}">${icon('edit',17)}</button></article>`).join('') || `<div class="empty">冰箱空空的。</div>`}</div></section>
  <section class="panel"><div class="section-head"><div><h2>待补充清单</h2><p>同步显示在首页提醒</p></div><button class="icon-btn" data-action="shopping-form" aria-label="添加待采购食材">${icon('plus')}</button></div><div class="inventory-list">${state.shopping.map(x=>`<article class="inventory-item shopping-item ${x.done?'done':''}"><button class="icon-btn" data-action="toggle-shopping" data-id="${x.id}" aria-label="${x.done?'恢复':'标记已采购'} ${esc(x.name)}">${icon(x.done?'check':'cart',18)}</button><span class="inventory-meta"><strong>${esc(x.name)}</strong><small>${x.done?'已采购':'等待采购'}</small></span><button class="icon-btn" data-action="delete-shopping" data-id="${x.id}" aria-label="删除 ${esc(x.name)}">${icon('trash',17)}</button></article>`).join('') || `<div class="empty">没有待采购食材。</div>`}</div></section></div><datalist id="terms">${state.terms.map(x=>`<option value="${esc(x)}">`).join('')}</datalist>`;
}

function render() {
  const pages = {home:homePage,cook:cookPage,out:()=>placesPage('out'),takeout:()=>placesPage('takeout'),fridge:fridgePage};
  app.innerHTML = shell((pages[route] || homePage)());
}

function modal(title, body, footer = '', wide = false) {
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-wrap" role="presentation"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><h2 id="modal-title">${title}</h2><button class="icon-btn" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div>${body}${footer?`<div class="modal-foot">${footer}</div>`:''}</section></div>`);
  document.querySelector('.modal input, .modal textarea, .modal select, .modal button')?.focus();
}
function closeModal() { document.querySelector('.modal-wrap')?.remove(); }
function field(label, name, value='', opts={}) {
  const {type='text', full=false, required=false, placeholder='', list=''} = opts;
  if(type==='textarea') return `<div class="field ${full?'full':''}"><label for="${name}">${label}${required?' *':''}</label><textarea id="${name}" name="${name}" placeholder="${placeholder}" ${required?'required':''}>${esc(value)}</textarea></div>`;
  return `<div class="field ${full?'full':''}"><label for="${name}">${label}${required?' *':''}</label><input id="${name}" name="${name}" type="${type}" value="${esc(value)}" placeholder="${placeholder}" ${list?`list="${list}"`:''} ${required?'required':''}></div>`;
}

function openDishForm(id) {
  const d = state.dishes.find(x=>x.id===id) || {};
  const cats = [...new Set(state.dishes.map(x=>x.category))];
  editorIngredients = [...(d.ingredients || [])];
  modal(d.id?'编辑菜品':'录入新菜', `<form id="dish-form"><div class="form-grid">${field('菜品名称','name',d.name,{required:true})}<div class="field"><label for="category">所属分类 *</label><input id="category" name="category" value="${esc(d.category||'') }" list="categories" required><datalist id="categories">${cats.map(x=>`<option value="${esc(x)}">`).join('')}</datalist></div>${field('菜谱文字或链接','recipe',d.recipe,{type:'textarea',full:true,placeholder:'可选：写下做法，或粘贴小红书/下厨房链接'})}<div class="field full"><label for="ingredient-input">所需食材 *</label><div class="term-composer"><div class="term-input-wrap"><input id="ingredient-input" list="terms" placeholder="输入新食材，或点右侧箭头选择"><button type="button" class="term-arrow" data-action="toggle-ingredient-menu" aria-label="展开食材下拉菜单" aria-expanded="false">${icon('down',18)}</button></div><button type="button" class="btn btn-secondary" data-action="add-ingredient">${icon('plus',17)} 加入</button><div class="term-menu hidden" role="listbox" aria-label="食材下拉菜单">${ingredientMenu()}</div></div><div class="ingredient-chips" aria-live="polite">${ingredientChips()}</div><input type="hidden" name="ingredients" value="${esc(editorIngredients.join('|'))}" required><span class="hint">手动输入后点“加入”；从下拉菜单点选会直接加入清单。</span><datalist id="terms">${termOptions()}</datalist></div></div><input type="hidden" name="id" value="${esc(d.id||'')}"></form>`, `${d.id?`<button class="btn btn-danger" data-action="delete-dish" data-id="${d.id}">删除</button>`:''}<button class="btn btn-secondary" data-action="close-modal">取消</button><button class="btn btn-primary" data-action="save-dish">保存菜品</button>`);
}
function termOptions() { return state.terms.map(x=>`<option value="${esc(x)}">`).join(''); }
function ingredientMenu() {
  const terms = state.terms.filter(Boolean).slice().sort((a,b)=>a.localeCompare(b,'zh-Hans-CN'));
  return terms.length ? terms.map(name=>`<button type="button" role="option" data-action="pick-ingredient" data-name="${esc(name)}">${esc(name)}</button>`).join('') : '<span class="hint">暂无可选食材</span>';
}
function ingredientChips() { return editorIngredients.map((name,index)=>`<span class="ingredient-chip">${esc(name)}<button type="button" data-action="remove-ingredient" data-index="${index}" aria-label="移除 ${esc(name)}">${icon('close',13)}</button></span>`).join('') || '<span class="hint">还没有添加食材</span>'; }
function refreshIngredientEditor() {
  const form = document.querySelector('#dish-form'); if(!form) return;
  form.querySelector('.ingredient-chips').innerHTML = ingredientChips();
  form.elements.ingredients.value = editorIngredients.join('|');
  form.querySelector('#terms').innerHTML = termOptions();
  form.querySelector('.term-menu').innerHTML = ingredientMenu();
}
function openPlaceForm(id) {
  const p = state.places.find(x=>x.id===id) || {type:route==='takeout'?'takeout':'out',rating:5};
  modal(p.id?'编辑信息':(p.type==='takeout'?'录入外卖店铺':'录入餐馆'), `<form id="place-form"><div class="form-grid">${field('名称','name',p.name,{required:true})}${field('分类','category',p.category,{required:true,placeholder:'火锅 / 日料 / 家常菜'})}${field(p.type==='takeout'?'配送信息':'地址','address',p.address,{full:true,required:true})}${field('特色推荐菜','specials',p.specials,{full:true,required:true})}${starPicker(p.rating)}${p.type==='takeout'?field('费用备注','fee',p.fee,{placeholder:'起送 ¥20 / 配送费 ¥3'}):''}</div><input type="hidden" name="id" value="${esc(p.id||'')}"><input type="hidden" name="type" value="${p.type}"></form>`, `${p.id?`<button class="btn btn-danger" data-action="delete-place" data-id="${p.id}">删除</button>`:''}<button class="btn btn-secondary" data-action="close-modal">取消</button><button class="btn btn-primary" data-action="save-place">保存</button>`);
}
function openInventoryForm(id) {
  const item = state.inventory.find(x=>x.id===id) || {};
  modal(item.id?'编辑存货':'录入存货', `<form id="inventory-form"><div class="form-grid">${field('食材名称','name',item.name,{required:true,list:'terms'})}${field('剩余数量（含单位）','amount',item.amount,{required:true,placeholder:'3 个 / 500 克'})}${field('入库日期','added',item.added||new Date().toISOString().slice(0,10),{type:'date'})}${field('过期日期','expiry',item.expiry,{type:'date'})}</div><datalist id="terms">${state.terms.map(x=>`<option value="${esc(x)}">`).join('')}</datalist><input type="hidden" name="id" value="${esc(item.id||'')}"></form>`, `<button class="btn btn-secondary" data-action="close-modal">取消</button><button class="btn btn-primary" data-action="save-inventory">保存</button>`);
}
function openRecipe(id) {
  const d = state.dishes.find(x=>x.id===id); if(!d) return;
  const recipe = d.recipe?.trim();
  modal(d.name, `<div class="share-card"><span class="eyebrow">${esc(d.category)}</span><h2>${esc(d.name)}</h2><div class="tag-row">${d.ingredients.map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div><h3>菜谱</h3><p>${recipe ? (isUrl(recipe)?`这是一个外部菜谱链接。复制后前往对应 App 打开查看：<br><a href="${esc(recipe)}" target="_blank" rel="noopener">${esc(recipe)}</a>`:esc(recipe)) : '这道菜还没有填写菜谱，之后可以再补。'}</p></div>`, `${isUrl(recipe)?`<button class="btn btn-secondary" data-copy="${esc(recipe)}">${icon('copy',17)} 复制链接</button>`:''}<button class="btn btn-primary" data-action="close-modal">知道了</button>`);
}

function pickDishes() {
  const requested = [...document.querySelectorAll('[data-random-cat]')].map(el=>[el.dataset.randomCat,+el.value]);
  randomSelection = requested.flatMap(([cat,n]) => [...state.dishes.filter(x=>x.category===cat)].sort(()=>Math.random()-.5).slice(0,n));
  if(!randomSelection.length) return toast('至少选择一道菜');
  selectionMode = 'random';
  openMenuResult();
}
function openMenuResult() {
  const stock = new Set(state.inventory.map(x=>x.name));
  const ingredients = [...new Set(randomSelection.flatMap(x=>x.ingredients))];
  modal(selectionMode==='manual'?'确认已选菜品':'今晚就吃这些', `<div class="result-list">${randomSelection.map(x=>`<div class="result-dish"><strong>${esc(x.name)}</strong><span class="tag">${esc(x.category)}</span></div>`).join('')}</div><div class="section-head"><div><h2>食材准备</h2><p>已经和冰箱库存自动比对</p></div></div><div class="tag-row">${ingredients.map(x=>`<span class="tag"><span class="${stock.has(x)?'stock-ok':'stock-missing'}">${stock.has(x)?'充足':'缺少'}</span> ${esc(x)}</span>`).join('')}</div><div class="field" style="margin-top:18px"><label for="menu-note">今晚备注</label><textarea id="menu-note" placeholder="比如：少放辣，今晚 8 点吃"></textarea></div>`, `${selectionMode==='random'?`<button class="btn btn-secondary" data-action="random-dishes-again">${icon('dice',17)} 不满意，重随</button>`:''}<button class="btn btn-primary" data-action="confirm-menu">确认菜单</button>`, true);
}
function confirmMenu() {
  const note = document.querySelector('#menu-note')?.value || '无特殊备注';
  const stock = new Set(state.inventory.map(x=>x.name));
  const ingredients = [...new Set(randomSelection.flatMap(x=>x.ingredients))];
  const missing = ingredients.filter(x=>!stock.has(x));
  lastConfirmedMenu = { dishes: randomSelection.map(x=>({...x})), ingredients, note };
  closeModal();
  modal('菜单已确认', `<article class="share-card" id="share-card"><span class="eyebrow">今天吃点啥 · 家庭菜单</span><h2>今晚开饭啦</h2><h3>菜单</h3><ul>${randomSelection.map(x=>`<li>${esc(x.name)} · ${esc(x.category)}</li>`).join('')}</ul><h3>食材清单</h3><ul>${ingredients.map(x=>`<li>${esc(x)} — <strong class="${stock.has(x)?'stock-ok':'stock-missing'}">${stock.has(x)?'冰箱有':'需要采购'}</strong></li>`).join('')}</ul><h3>备注</h3><p>${esc(note)}</p></article>`, `${missing.length?`<button class="btn btn-secondary" data-add-missing="${esc(missing.join('|'))}">${icon('cart',17)} 缺的加入采购</button>`:''}<button class="btn btn-primary" data-action="share-menu-image">${icon('share',17)} 生成图片分享</button>`, true);
}

function wrapCanvasText(ctx, text, maxWidth) {
  const chars = String(text || '').split('');
  const lines = []; let line = '';
  chars.forEach(ch => {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = ch; }
    else line = test;
  });
  if (line) lines.push(line);
  return lines;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}
async function createShareImageData({ eyebrow, title, sections }) {
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  const width = 900, pad = 58, max = width - pad * 2;
  ctx.font = '26px "Microsoft YaHei UI", "PingFang SC", sans-serif';
  let height = 260;
  sections.forEach(section => {
    height += 64;
    section.items.forEach(item => height += Math.max(44, wrapCanvasText(ctx, item, max - 28).length * 34 + 12));
  });
  height += 76;
  canvas.width = width; canvas.height = height;
  ctx.fillStyle = '#fff9ef'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffe7dc'; roundRect(ctx, 28, 28, width-56, height-56, 36); ctx.fill();
  ctx.fillStyle = '#fffefb'; roundRect(ctx, 48, 48, width-96, height-96, 30); ctx.fill();
  ctx.strokeStyle = '#2d2926'; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = '#ef6a4c'; roundRect(ctx, pad, 72, 250, 38, 19); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '700 20px "Microsoft YaHei UI", "PingFang SC", sans-serif'; ctx.fillText(eyebrow, pad + 18, 98);
  ctx.fillStyle = '#2d2926'; ctx.font = '900 54px "Microsoft YaHei UI", "PingFang SC", sans-serif'; ctx.fillText(title, pad, 166);
  ctx.fillStyle = '#716a63'; ctx.font = '24px "Microsoft YaHei UI", "PingFang SC", sans-serif'; ctx.fillText('把今晚吃什么，一张图发给家人。', pad, 210);
  let y = 276;
  sections.forEach((section, sectionIndex) => {
    ctx.fillStyle = sectionIndex % 2 ? '#eaf7ef' : '#fff3c8';
    roundRect(ctx, pad, y - 38, max, 46, 18); ctx.fill();
    ctx.fillStyle = '#2d2926'; ctx.font = '900 26px "Microsoft YaHei UI", "PingFang SC", sans-serif'; ctx.fillText(section.title, pad + 18, y - 8);
    y += 26;
    ctx.font = '24px "Microsoft YaHei UI", "PingFang SC", sans-serif';
    section.items.forEach(item => {
      const lines = wrapCanvasText(ctx, item, max - 44);
      const boxH = Math.max(46, lines.length * 34 + 14);
      ctx.fillStyle = '#ffffff'; roundRect(ctx, pad, y, max, boxH, 18); ctx.fill();
      ctx.fillStyle = '#ef6a4c'; ctx.beginPath(); ctx.arc(pad + 24, y + 24, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2d2926';
      lines.forEach((line, i) => ctx.fillText(line, pad + 44, y + 32 + i * 34));
      y += boxH + 12;
    });
    y += 18;
  });
  ctx.fillStyle = '#716a63'; ctx.font = '20px "Microsoft YaHei UI", "PingFang SC", sans-serif'; ctx.fillText('今天吃点啥 · 家庭菜单助手', pad, height - 58);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', .96));
  return { blob, dataUrl: canvas.toDataURL('image/png') };
}
async function shareImageCard(config, filename) {
  latestShareImage = await createShareImageData(config);
  const file = new File([latestShareImage.blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try { await navigator.share({ title: config.title, files: [file] }); toast('图片已调起系统分享'); return; }
    catch(e) { if (e.name === 'AbortError') return; }
  }
  closeModal();
  modal('图片已生成', `<div class="image-preview"><img src="${latestShareImage.dataUrl}" alt="${esc(config.title)}分享图片"><p class="hint">长按或下载图片后，可直接转发到微信。</p></div>`, `<button class="btn btn-secondary" data-action="download-share-image">${icon('copy',17)} 下载图片</button><button class="btn btn-primary" data-action="close-modal">完成</button>`, true);
}
async function shareMenuImage() {
  const menu = lastConfirmedMenu || { dishes: randomSelection, ingredients:[...new Set(randomSelection.flatMap(x=>x.ingredients))], note:'无特殊备注' };
  const stock = new Set(state.inventory.map(x=>x.name));
  await shareImageCard({
    eyebrow: '今天吃点啥',
    title: '今晚开饭啦',
    sections: [
      { title: '菜单', items: menu.dishes.map(x=>`${x.name} · ${x.category}`) },
      { title: '食材清单', items: menu.ingredients.map(x=>`${x} — ${stock.has(x)?'冰箱有':'需要采购'}`) },
      { title: '备注', items: [menu.note || '无特殊备注'] }
    ]
  }, '今晚菜单.png');
}
async function sharePlaceImage(p) {
  if(!p) return;
  await shareImageCard({
    eyebrow: p.type === 'takeout' ? '外卖推荐' : '餐馆推荐',
    title: p.name,
    sections: [
      { title: '分类与评分', items: [`${p.category} · ${Number(p.rating).toFixed(1)} 星`] },
      { title: p.type === 'takeout' ? '配送信息' : '地址', items: [p.address] },
      { title: '招牌', items: [p.specials || '待补充'] }
    ]
  }, `${p.name}.png`);
}
async function shareText(title, text) {
  if(navigator.share) { try { await navigator.share({title,text}); return; } catch(e) { if(e.name==='AbortError') return; } }
  await navigator.clipboard.writeText(text); toast('内容已复制，可粘贴到微信');
}
function downloadShareImage() {
  if(!latestShareImage?.dataUrl) return toast('请先生成图片');
  const a = document.createElement('a');
  a.href = latestShareImage.dataUrl;
  a.download = '今天吃点啥.png';
  a.click();
}
function addIngredientName(name) {
  const value = name?.trim();
  if(!value) return false;
  if(!editorIngredients.includes(value)) editorIngredients.push(value);
  addTerms(state,[value]);
  persist();
  refreshIngredientEditor();
  return true;
}

document.addEventListener('click', async e => {
  const nav = e.target.closest('[data-nav]'); if(nav) return navigate(nav.dataset.nav);
  const anchor = e.target.closest('[data-anchor]'); if(anchor) return document.querySelector(`#${anchor.dataset.anchor}`)?.scrollIntoView();
  const copy = e.target.closest('[data-copy]'); if(copy) { await navigator.clipboard.writeText(copy.dataset.copy); return toast('链接已复制，请前往对应 App 打开'); }
  const addMissing = e.target.closest('[data-add-missing]'); if(addMissing) { addMissing.dataset.addMissing.split('|').forEach(name=>{if(!state.shopping.some(x=>x.name===name&&!x.done)) state.shopping.push({id:uid('s'),name,done:false});}); persist(); closeModal(); render(); return toast('缺少食材已加入采购清单'); }
  const el = e.target.closest('[data-action]'); if(!el) { if(e.target.classList.contains('modal-wrap')) closeModal(); return; }
  const action = el.dataset.action, id = el.dataset.id;
  if(action==='close-modal') closeModal();
  if(action==='dish-form') openDishForm(id);
  if(action==='place-form') openPlaceForm(id);
  if(action==='inventory-form') openInventoryForm(id);
  if(action==='recipe') openRecipe(id);
  if(action==='toggle-dish') { manualSelection=manualSelection.includes(id)?manualSelection.filter(x=>x!==id):[...manualSelection,id]; render(); }
  if(action==='manual-confirm') { randomSelection=manualSelection.map(id=>state.dishes.find(x=>x.id===id)).filter(Boolean); selectionMode='manual'; openMenuResult(); }
  if(action==='add-ingredient') { const input=document.querySelector('#ingredient-input'); const name=input?.value.trim(); if(!name)return toast('请先输入食材名称'); addIngredientName(name); input.value=''; input.focus(); }
  if(action==='toggle-ingredient-menu') { const menu=document.querySelector('.term-menu'); const open=menu?.classList.toggle('hidden')===false; el.setAttribute('aria-expanded',String(open)); }
  if(action==='pick-ingredient') { if(addIngredientName(el.dataset.name)) { document.querySelector('#ingredient-input').value=''; document.querySelector('.term-menu')?.classList.add('hidden'); document.querySelector('[data-action="toggle-ingredient-menu"]')?.setAttribute('aria-expanded','false'); toast('已加入食材清单'); } }
  if(action==='remove-ingredient') { editorIngredients.splice(Number(el.dataset.index),1); refreshIngredientEditor(); }
  if(action==='set-rating') updateStarPicker(Number(el.dataset.rating));
  if(action==='random-dishes') pickDishes();
  if(action==='random-dishes-again') { closeModal(); pickDishes(); }
  if(action==='confirm-menu') confirmMenu();
  if(action==='share-menu-image') shareMenuImage();
  if(action==='download-share-image') downloadShareImage();
  if(action==='random-place') {
    const cat=document.querySelector('#place-category').value, rating=+document.querySelector('#place-rating').value;
    const pool=state.places.filter(x=>x.type===el.dataset.type&&(!cat||x.category===cat)&&x.rating>=rating); if(!pool.length)return toast('没有符合条件的店');
    const p=pool[Math.floor(Math.random()*pool.length)]; modal('就它了！', `<article class="share-card"><span class="eyebrow">${esc(p.category)}</span><h2>${esc(p.name)}</h2><p>${esc(p.address)}</p><p><strong>招牌：</strong>${esc(p.specials)}</p><div class="stars">${starDisplay(p.rating)}</div></article>`, `<button class="btn btn-secondary" data-action="close-modal">换个条件</button><button class="btn btn-primary" data-action="share-place" data-id="${p.id}">${icon('share',17)} 分享结果</button>`);
  }
  if(action==='share-place') { const p=state.places.find(x=>x.id===id); sharePlaceImage(p); }
  if(action==='cleanup') { cleanupMode=true; render(); }
  if(action==='cleanup-cancel') { cleanupMode=false; render(); }
  if(action==='delete-stock') { const ids=[...document.querySelectorAll('[data-stock-select]:checked')].map(x=>x.value); if(!ids.length)return toast('请先选择要清理的食材'); state.inventory=state.inventory.filter(x=>!ids.includes(x.id)); cleanupMode=false; persist(); render(); toast('已清理所选食材'); }
  if(action==='shopping-form') modal('添加待采购食材', `<form id="shopping-form">${field('食材名称','name','',{required:true,list:'terms'})}<datalist id="terms">${state.terms.map(x=>`<option value="${esc(x)}">`).join('')}</datalist></form>`, `<button class="btn btn-secondary" data-action="close-modal">取消</button><button class="btn btn-primary" data-action="save-shopping">加入清单</button>`);
  if(action==='toggle-shopping') { const x=state.shopping.find(x=>x.id===id); x.done=!x.done; persist(); render(); toast(x.done?'已标记采购完成':'已恢复到采购清单'); }
  if(action==='delete-shopping') { state.shopping=state.shopping.filter(x=>x.id!==id); persist(); render(); }
  if(action==='delete-dish') { state.dishes=state.dishes.filter(x=>x.id!==id); manualSelection=manualSelection.filter(x=>x!==id); persist(); closeModal(); render(); toast('菜品已删除'); }
  if(action==='delete-place') { state.places=state.places.filter(x=>x.id!==id); persist(); closeModal(); render(); toast('记录已删除'); }
  if(action.startsWith('save-')) saveForm(action);
});

function formData(id) { const form=document.querySelector(`#${id}`); if(!form.reportValidity()) return null; return Object.fromEntries(new FormData(form)); }
function saveForm(action) {
  if(action==='save-dish') { if(!editorIngredients.length)return toast('请至少加入一种食材'); const x=formData('dish-form'); if(!x)return; const ingredients=[...editorIngredients]; const item={id:x.id||uid('d'),name:x.name.trim(),category:x.category.trim(),recipe:(x.recipe||'').trim(),ingredients}; const i=state.dishes.findIndex(d=>d.id===x.id); i<0?state.dishes.push(item):state.dishes.splice(i,1,item); addTerms(state,ingredients); }
  if(action==='save-place') { const x=formData('place-form'); if(!x)return; const item={...x,id:x.id||uid('p'),rating:Math.min(5,Math.max(.5,Math.round(+x.rating*2)/2))}; const i=state.places.findIndex(p=>p.id===x.id); i<0?state.places.push(item):state.places.splice(i,1,item); }
  if(action==='save-inventory') { const x=formData('inventory-form'); if(!x)return; const item={...x,id:x.id||uid('i')}; const i=state.inventory.findIndex(p=>p.id===x.id); i<0?state.inventory.push(item):state.inventory.splice(i,1,item); addTerms(state,[x.name]); }
  if(action==='save-shopping') { const x=formData('shopping-form'); if(!x)return; state.shopping.push({id:uid('s'),name:x.name.trim(),done:false}); addTerms(state,[x.name]); }
  persist(); closeModal(); render(); toast('保存成功');
}

document.addEventListener('keydown', e => { if(e.key==='Escape') closeModal(); });
document.addEventListener('keydown', e => { if(e.key==='Enter' && e.target.id==='ingredient-input') { e.preventDefault(); document.querySelector('[data-action="add-ingredient"]')?.click(); } });
function updateStarPicker(rating) {
  const picker=document.querySelector('.star-picker'); if(!picker)return;
  picker.dataset.value=rating; picker.querySelector('input[name="rating"]').value=rating; picker.querySelector('output').textContent=`${rating.toFixed(1)} 星`;
  picker.querySelectorAll('.star-unit').forEach((unit,index)=>unit.querySelector('.star-fill').style.width=rating>=index+1? '100%' : rating>=index+.5? '50%' : '0%');
  picker.querySelectorAll('[data-rating]').forEach(button=>button.setAttribute('aria-checked',String(Number(button.dataset.rating)===rating)));
}
render();
loadCloudState(state).then(result => {
  if (!result.enabled) {
    if (result.error) toast('云端同步暂不可用，已使用本地数据');
    return;
  }
  state = result.state;
  saveState(state);
  render();
  toast(result.loaded ? '已从云端同步' : '云端同步已开启');
});
