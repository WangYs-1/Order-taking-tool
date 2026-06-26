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
let cookCategoryFilter = '';

const app = document.querySelector('#app');
const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const isUrl = text => /^https?:\/\//i.test(text || '');
const isWechatBrowser = () => /MicroMessenger/i.test(navigator.userAgent || '');
const isIOSBrowser = () => /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
const activeShopping = () => state.shopping.filter(item => !item.done);
const persist = () => { saveState(state); queueCloudSave(state); };
const toast = message => {
  const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
};

function navigate(next) {
  if (next === 'cook' && route !== 'cook') cookCategoryFilter = '';
  location.hash = next;
}
window.addEventListener('hashchange', () => {
  const nextRoute = location.hash.slice(1) || 'home';
  if (nextRoute === 'cook' && route !== 'cook') cookCategoryFilter = '';
  route = nextRoute;
  render();
  scrollTo(0,0);
});

function shell(content) {
  const shopping = activeShopping();
  return `<div class="app-shell">
    <header class="topbar">
      <button class="brand" data-nav="home" aria-label="返回首页"><span class="brand-mark">${icon('chef',26)}</span><span><strong>随便吃点</strong></span></button>
      <div class="avatar" aria-label="家庭账号">家</div>
    </header>
    ${route==='home' && shopping.length ? `<aside class="ticker" aria-label="待采购提醒"><div class="ticker-label">${icon('cart',18)} 待采购</div><div class="ticker-track"><div class="ticker-content">${[...shopping,...shopping].map(x=>`<span>${esc(x.name)}</span>`).join('')}</div></div><button class="ticker-action" data-nav="fridge">去看看</button></aside>` : ''}
    <main id="main">${content}</main>
  </div>${bottomNav()}`;
}

function bottomNav() {
  return `<nav class="bottom-nav" aria-label="主要导航">
    ${[['cook','chef','自己做'],['out','store','出去吃'],['takeout','bike','点外卖'],['fridge','fridge','冰箱']].map(([r,i,t])=>`<button class="${route===r || (route==='terms'&&r==='fridge')?'active':''}" data-nav="${r}" aria-label="${t}">${icon(i,21)}<span>${t}</span></button>`).join('')}
  </nav>`;
}

function homePage() {
  const expiring = state.inventory.filter(x => x.expiry && new Date(x.expiry) - new Date() < 4*86400000).length;
  return `<section class="hero"><div class="hero-copy"><span class="eyebrow">${icon('sparkle',16)} 吃好喝好</span><h1>一键解决<br>“随便”和“都行”</h1></div><div class="hero-side"><div class="big-icon">${icon('chef',42)}</div><div><strong>${state.dishes.length} 道家常菜</strong><p>已经收入你家的菜单库，想吃什么直接去菜单里挑。</p></div></div></section>
  <div class="section-head"><div><h2>今天怎么吃？</h2><p>${expiring ? `有 ${expiring} 样食材快到期了，优先消灭它们吧。` : '冰箱好像没菜啦！'}</p></div></div>
  <section class="entry-grid" aria-label="四大核心功能">
    ${entry('cook','chef','自己做','','cook')}
    ${entry('out','store','出去吃','','out')}
    ${entry('takeout','bike','点外卖','','takeout')}
    ${entry('fridge','fridge','看看冰箱','','fridge')}
  </section>`;
}
function entry(routeName, iconName, title, desc, cls) { return `<button class="entry-card ${cls}" data-nav="${routeName}"><span class="bubble">${icon(iconName,28)}</span><span><strong>${title}</strong>${desc?`<span>${desc}</span>`:''}</span><span class="go">${icon('arrow',20)}</span></button>`; }

function pageHead(title, actionLabel, action) {
  return `<div class="page-head"><div class="page-title"><button class="back-btn" data-nav="home" aria-label="返回首页">${icon('back')}</button><h1>${title}</h1></div><div class="toolbar">${actionLabel ? `<button class="btn btn-primary" data-action="${action}" aria-label="${actionLabel}">${icon('plus',19)}<span>${actionLabel}</span></button>`:''}</div></div>`;
}

function cookPage() {
  const categories = [...new Set(state.dishes.map(x=>x.category))];
  const visibleCategories = cookCategoryFilter ? categories.filter(c=>c===cookCategoryFilter) : categories;
  return `${pageHead('自己做','录入新菜','dish-form')}
    ${manualSelection.length ? `<section class="selection-bar"><div><strong>已选 ${manualSelection.length} 道菜</strong><p>${manualSelection.map(id=>state.dishes.find(x=>x.id===id)?.name).filter(Boolean).map(esc).join('、')}</p></div><button class="btn btn-primary" data-action="manual-confirm">去确认 ${icon('arrow',18)}</button></section>`:''}
    <section class="random-panel"><div><strong>开盲盒</strong><p>一键选择一桌叫“随便”的菜</p></div><div class="random-controls">${categories.map(c=>`<label>${esc(c)} <select data-random-cat="${esc(c)}" aria-label="${esc(c)}数量">${[0,1,2,3,4].map(n=>`<option value="${n}" ${((c==='荤菜'&&n===2)||(c!=='荤菜'&&n===1))?'selected':''}>${n}</option>`).join('')}</select></label>`).join('')}<button class="btn btn-primary" data-action="random-dishes">${icon('dice',19)} 确认</button></div></section>
    <nav class="category-nav" aria-label="菜品分类"><button class="chip ${cookCategoryFilter===''?'active':''}" data-filter-cat="">全部</button>${categories.map(c=>`<button class="chip ${cookCategoryFilter===c?'active':''}" data-filter-cat="${esc(c)}">${esc(c)}</button>`).join('')}</nav>
    ${visibleCategories.map(cat=>`<section class="dish-section" id="cat-${categories.indexOf(cat)}"><h2>${esc(cat)} <span class="count">${state.dishes.filter(x=>x.category===cat).length} 道</span></h2><div class="card-grid">${state.dishes.filter(x=>x.category===cat).map(dishCard).join('')}</div></section>`).join('') || `<div class="empty">菜单还是空的，先录入一道拿手菜吧。</div>`}`;
}
function dishCard(d) { const selected=manualSelection.includes(d.id); return `<article class="data-card"><h3>${esc(d.name)}</h3><p>${d.recipe ? (isUrl(d.recipe)?'外部菜谱链接':'家庭做法已记录') : '还没写菜谱'}</p><div class="tag-row">${d.ingredients.map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div><div class="card-actions"><button class="btn ${selected?'btn-dark':'btn-secondary'}" data-action="toggle-dish" data-id="${d.id}" aria-pressed="${selected}">${icon(selected?'check':'plus',16)} ${selected?'已选':'选这道'}</button><button class="btn btn-secondary" data-action="recipe" data-id="${d.id}">${icon('link',16)} 菜谱</button><button class="btn btn-secondary" data-action="dish-form" data-id="${d.id}" aria-label="编辑 ${esc(d.name)}">${icon('edit',16)}</button></div></article>`; }

function placesPage(type) {
  const isTakeout = type === 'takeout', items = state.places.filter(x=>x.type===type);
  const cats = [...new Set(items.map(x=>x.category))];
  return `${pageHead(isTakeout?'点外卖':'出去吃',isTakeout?'录入店铺':'录入餐馆','place-form')}
  <section class="random-panel"><div><strong>抽一发</strong><p>一键选择一家叫“都可以”的店</p></div><div class="random-controls"><select id="place-category" aria-label="店铺分类"><option value="">全部分类</option>${cats.map(c=>`<option>${esc(c)}</option>`).join('')}</select><select id="place-rating" aria-label="最低评分"><option value="0">不限评分</option><option value="4">4 星以上</option><option value="4.5">4.5 星以上</option></select><button class="btn btn-primary" data-action="random-place" data-type="${type}">${icon('dice',19)} 开抽</button></div></section>
  <div class="section-head"><div><h2>${isTakeout?'常点店铺':'收藏菜馆'}</h2><p>共 ${items.length} 家，吃过以后记得回来打分。</p></div></div>
  <section class="card-grid">${items.map(placeCard).join('') || `<div class="empty">暂时还没有记录，先添加一家吧。</div>`}</section>`;
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
  const termCount = state.terms.filter(Boolean).length;
  return `${pageHead('冰箱库存')}
  <section class="inventory-summary"><div><strong>冰箱里有 ${state.inventory.length} 样食材</strong><p>${activeShopping().length ? `还有 ${activeShopping().length} 样东西待采购。`:'采购清单已经清空。'}</p></div><div class="toolbar">${cleanupMode?`<button class="btn btn-danger" data-action="delete-stock">${icon('trash',18)} 删除所选</button><button class="btn btn-secondary" data-action="cleanup-cancel">取消</button>`:`<button class="btn btn-secondary" data-action="cleanup">${icon('trash',18)} 清理冰箱</button>`}</div></section>
  <div class="inventory-grid"><section class="panel"><div class="section-head"><div><h2>现有存货</h2><p>优先显示快到期食材</p></div><button class="icon-btn" data-action="inventory-form" aria-label="录入食材">${icon('plus')}</button></div><div class="inventory-list">${state.inventory.sort((a,b)=>(a.expiry||'9').localeCompare(b.expiry||'9')).map(x=>`<article class="inventory-item">${cleanupMode?`<input type="checkbox" data-stock-select value="${x.id}" aria-label="选择 ${esc(x.name)}">`:''}<span class="food-dot">${esc(x.name.slice(0,1))}</span><span class="inventory-meta"><strong>${esc(x.name)} · ${esc(x.amount)}</strong><small>入库：${esc(x.added||'/')}</small><small>到期：${esc(x.expiry||'/')}</small></span><button class="icon-btn" data-action="inventory-form" data-id="${x.id}" aria-label="编辑 ${esc(x.name)}">${icon('edit',17)}</button></article>`).join('') || `<div class="empty">冰箱空空的。</div>`}</div></section>
  <section class="panel"><div class="section-head"><div><h2>采购清单</h2><p>同步显示在首页提醒</p></div><button class="icon-btn" data-action="shopping-form" aria-label="添加待采购食材">${icon('plus')}</button></div><div class="inventory-list">${state.shopping.map(x=>`<article class="inventory-item shopping-item ${x.done?'done':''}"><button class="icon-btn" data-action="toggle-shopping" data-id="${x.id}" aria-label="${x.done?'恢复':'标记已采购'} ${esc(x.name)}">${icon(x.done?'check':'cart',18)}</button><span class="inventory-meta"><strong>${esc(x.name)}</strong><small>${x.done?'已采购':'等待采购'}</small></span><button class="icon-btn" data-action="delete-shopping" data-id="${x.id}" aria-label="删除 ${esc(x.name)}">${icon('trash',17)}</button></article>`).join('') || `<div class="empty">没有待采购食材。</div>`}</div></section></div>
  <section class="panel terms-entry"><div><h2>食材词条管理</h2><p>管理下拉候选词条，清理不再使用的食材名称。</p></div><div class="terms-entry-actions"><span class="count">${termCount} 条</span><button class="btn btn-secondary" data-nav="terms">${icon('edit',17)} 管理词条</button></div></section><datalist id="terms">${state.terms.map(x=>`<option value="${esc(x)}">`).join('')}</datalist>`;
}

function termsPage() {
  const terms = state.terms.filter(Boolean).slice().sort((a,b)=>a.localeCompare(b,'zh-Hans-CN'));
  return `<div class="page-head"><div class="page-title"><button class="back-btn" data-nav="fridge" aria-label="返回冰箱">${icon('back')}</button><h1>食材词条管理</h1></div></div>
  <section class="panel terms-panel"><div class="section-head"><div><h2>下拉候选词条</h2><p>删除不会影响已保存的菜品、库存和采购清单，只会从新增/选择食材的下拉候选里移除。</p></div><span class="count">${terms.length} 条</span></div><div class="term-edit-list">${terms.map(name=>`<span class="term-edit-chip">${esc(name)}<button type="button" data-action="delete-term" data-name="${esc(name)}" aria-label="删除词条 ${esc(name)}">${icon('close',13)}</button></span>`).join('') || `<div class="empty">还没有食材词条。</div>`}</div></section>`;
}

function render() {
  const pages = {home:homePage,cook:cookPage,out:()=>placesPage('out'),takeout:()=>placesPage('takeout'),fridge:fridgePage,terms:termsPage};
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
  modal(d.id?'编辑菜品':'录入新菜', `<form id="dish-form"><div class="form-grid">${field('菜品名称','name',d.name,{required:true})}<div class="field"><label for="category">所属分类 *</label><input id="category" name="category" value="${esc(d.category||'') }" list="categories" required><datalist id="categories">${cats.map(x=>`<option value="${esc(x)}">`).join('')}</datalist></div>${field('菜谱文字或链接','recipe',d.recipe,{type:'textarea',full:true,placeholder:'可选：写下做法，或填入网站链接'})}<div class="field full"><label for="ingredient-input">所需食材 *</label><div class="term-composer"><div class="term-input-wrap"><input id="ingredient-input" list="terms" placeholder="输入新食材，或点右侧箭头选择"><button type="button" class="term-arrow" data-action="toggle-ingredient-menu" aria-label="展开食材下拉菜单" aria-expanded="false">${icon('down',18)}</button></div><button type="button" class="btn btn-secondary" data-action="add-ingredient">${icon('plus',17)} 添加</button><div class="term-menu hidden" role="listbox" aria-label="食材下拉菜单">${ingredientMenu()}</div></div><div class="ingredient-chips" aria-live="polite">${ingredientChips()}</div><input type="hidden" name="ingredients" value="${esc(editorIngredients.join('|'))}" required><span class="hint">输入后点“添加”，或下拉选择并自动加入清单。</span><datalist id="terms">${termOptions()}</datalist></div></div><input type="hidden" name="id" value="${esc(d.id||'')}"></form>`, `${d.id?`<button class="btn btn-danger" data-action="delete-dish" data-id="${d.id}">删除</button>`:''}<button class="btn btn-secondary" data-action="close-modal">取消</button><button class="btn btn-primary" data-action="save-dish">保存菜品</button>`);
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
  modal(p.id?'编辑信息':(p.type==='takeout'?'录入外卖店铺':'录入餐馆'), `<form id="place-form"><div class="form-grid">${field('名称','name',p.name,{required:true})}${field('分类','category',p.category,{required:true,placeholder:'火锅 / 日料 / 家常菜'})}${field(p.type==='takeout'?'配送信息':'地址','address',p.address,{full:true,required:true})}${field('推荐菜','specials',p.specials,{full:true,required:true})}${starPicker(p.rating)}${p.type==='takeout'?field('费用备注','fee',p.fee,{placeholder:'起送 ¥20 / 配送费 ¥3'}):''}</div><input type="hidden" name="id" value="${esc(p.id||'')}"><input type="hidden" name="type" value="${p.type}"></form>`, `${p.id?`<button class="btn btn-danger" data-action="delete-place" data-id="${p.id}">删除</button>`:''}<button class="btn btn-secondary" data-action="close-modal">取消</button><button class="btn btn-primary" data-action="save-place">保存</button>`);
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
  modal(selectionMode==='manual'?'确认已选菜品':'这是你点的“随便”', `<div class="result-list">${randomSelection.map(x=>`<div class="result-dish"><strong>${esc(x.name)}</strong><span class="tag">${esc(x.category)}</span></div>`).join('')}</div><div class="section-head"><div><h2>食材准备</h2><p>已自动和冰箱库存比对</p></div></div><div class="tag-row">${ingredients.map(x=>`<span class="tag"><span class="${stock.has(x)?'stock-ok':'stock-missing'}">${stock.has(x)?'充足':'缺少'}</span> ${esc(x)}</span>`).join('')}</div><div class="field" style="margin-top:18px"><label for="menu-note">备注</label><textarea id="menu-note" placeholder="比如：狗都不吃胡萝卜、不吃香菜"></textarea></div>`, `${selectionMode==='random'?`<button class="btn btn-secondary" data-action="random-dishes-again">${icon('dice',17)} 不满意，重随</button>`:''}<button class="btn btn-primary" data-action="confirm-menu">确认菜单</button>`, true);
}
function confirmMenu() {
  const note = document.querySelector('#menu-note')?.value || '无特殊备注';
  const stock = new Set(state.inventory.map(x=>x.name));
  const ingredients = [...new Set(randomSelection.flatMap(x=>x.ingredients))];
  const missing = ingredients.filter(x=>!stock.has(x));
  lastConfirmedMenu = { dishes: randomSelection.map(x=>({...x})), ingredients, note };
  closeModal();
  modal('菜单已确认', `<article class="share-card" id="share-card"><span class="eyebrow">随便吃点</span><h2>菜单来啦</h2><h3>菜单</h3><ul>${randomSelection.map(x=>`<li>${esc(x.name)} · ${esc(x.category)}</li>`).join('')}</ul><h3>食材清单</h3><ul>${ingredients.map(x=>`<li>${esc(x)} — <strong class="${stock.has(x)?'stock-ok':'stock-missing'}">${stock.has(x)?'冰箱有':'需要采购'}</strong></li>`).join('')}</ul><h3>备注</h3><p>${esc(note)}</p></article>`, `${missing.length?`<button class="btn btn-secondary" data-add-missing="${esc(missing.join('|'))}">${icon('cart',17)} 缺的加入采购</button>`:''}<button class="btn btn-primary" data-action="share-menu-image">${icon('share',17)} 生成菜单</button>`, true);
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
function ellipsizeCanvasText(ctx, text, maxWidth) {
  const value = String(text || '');
  if (ctx.measureText(value).width <= maxWidth) return value;
  let low = 0, high = value.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (ctx.measureText(`${value.slice(0, mid)}…`).width <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return `${value.slice(0, low)}…`;
}
function visibleItems(items = [], limit = 8, empty = '暂无') {
  const list = items.filter(Boolean).map(String);
  if (!list.length) return [empty];
  if (list.length <= limit) return list;
  return [...list.slice(0, Math.max(1, limit - 1)), `还有 ${list.length - limit + 1} 项`];
}
function drawSoftCircle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function drawSectionTitle(ctx, title, x, y, w, color) {
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w, 48, 20);
  ctx.fill();
  ctx.fillStyle = '#2d2926';
  ctx.font = '900 25px "Microsoft YaHei UI", "PingFang SC", sans-serif';
  ctx.fillText(ellipsizeCanvasText(ctx, title, w - 36), x + 18, y + 32);
}
function drawListItems(ctx, items, x, y, w, limit = 5, empty) {
  const rows = visibleItems(items, limit, empty);
  ctx.font = '24px "Microsoft YaHei UI", "PingFang SC", sans-serif';
  rows.forEach((item, index) => {
    const rowY = y + index * 54;
    ctx.fillStyle = '#fffdfa';
    roundRect(ctx, x, rowY, w, 44, 16);
    ctx.fill();
    ctx.fillStyle = item.startsWith('还有 ') ? '#8cc7aa' : '#ef6a4c';
    ctx.beginPath();
    ctx.arc(x + 24, rowY + 22, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d2926';
    ctx.fillText(ellipsizeCanvasText(ctx, item, w - 58), x + 44, rowY + 30);
  });
  return y + rows.length * 54;
}
function drawChipItems(ctx, items, x, y, w, limit = 8, empty, color = '#fff3c8') {
  const chips = visibleItems(items, limit, empty);
  const gap = 14;
  const colW = (w - gap) / 2;
  ctx.font = '700 22px "Microsoft YaHei UI", "PingFang SC", sans-serif';
  chips.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const chipX = x + col * (colW + gap);
    const chipY = y + row * 52;
    ctx.fillStyle = item.startsWith('还有 ') ? '#eaf7ef' : color;
    roundRect(ctx, chipX, chipY, colW, 40, 18);
    ctx.fill();
    ctx.fillStyle = item.startsWith('还有 ') ? '#397958' : '#5c4211';
    ctx.fillText(ellipsizeCanvasText(ctx, item, colW - 28), chipX + 14, chipY + 27);
  });
  return y + Math.ceil(chips.length / 2) * 52;
}
function drawNoteItem(ctx, text, x, y, w) {
  ctx.fillStyle = '#fffdfa';
  roundRect(ctx, x, y, w, 88, 18);
  ctx.fill();
  ctx.fillStyle = '#6b625a';
  ctx.font = '22px "Microsoft YaHei UI", "PingFang SC", sans-serif';
  wrapCanvasText(ctx, text || '无特殊备注', w - 36).slice(0, 2).forEach((line, index) => {
    ctx.fillText(ellipsizeCanvasText(ctx, line, w - 36), x + 18, y + 34 + index * 30);
  });
  return y + 104;
}
async function createShareImageData({ eyebrow, title, subtitle = '', sections }) {
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  const width = 900, height = 1280, pad = 70, max = width - pad * 2;
  canvas.width = width; canvas.height = height;

  ctx.fillStyle = '#fff5e8'; ctx.fillRect(0, 0, width, height);
  drawSoftCircle(ctx, 124, 120, 86, '#ffe1d4');
  drawSoftCircle(ctx, 802, 188, 118, '#fff0be');
  drawSoftCircle(ctx, 790, 1050, 160, '#ddf3e7');
  drawSoftCircle(ctx, 112, 1120, 96, '#ffe5d9');

  ctx.shadowColor = 'rgba(45,41,38,.14)';
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = '#fffefb';
  roundRect(ctx, 44, 44, width - 88, height - 88, 42);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#2d2926';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = '#ef6a4c';
  roundRect(ctx, pad, 82, 236, 42, 21);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '800 21px "Microsoft YaHei UI", "PingFang SC", sans-serif';
  ctx.fillText(ellipsizeCanvasText(ctx, eyebrow, 192), pad + 20, 110);

  ctx.fillStyle = '#2d2926';
  ctx.font = '900 56px "Microsoft YaHei UI", "PingFang SC", sans-serif';
  const titleLines = wrapCanvasText(ctx, title, max).slice(0, 2);
  titleLines.forEach((line, index) => ctx.fillText(ellipsizeCanvasText(ctx, line, max), pad, 182 + index * 62));
  const subtitleY = titleLines.length > 1 ? 292 : 228;
  ctx.fillStyle = '#716a63';
  ctx.font = '25px "Microsoft YaHei UI", "PingFang SC", sans-serif';
  ctx.fillText(ellipsizeCanvasText(ctx, subtitle, max), pad, subtitleY);

  let y = subtitleY + 58;
  sections.forEach((section, sectionIndex) => {
    if (y > height - 190) return;
    const color = section.color || (sectionIndex % 2 ? '#eaf7ef' : '#fff3c8');
    drawSectionTitle(ctx, section.title, pad, y, max, color);
    y += 66;
    if (section.style === 'chips') y = drawChipItems(ctx, section.items, pad, y, max, section.limit, section.empty, color);
    else if (section.style === 'note') y = drawNoteItem(ctx, section.items?.[0], pad, y, max);
    else y = drawListItems(ctx, section.items, pad, y, max, section.limit, section.empty);
    y += 20;
  });

  ctx.strokeStyle = '#f0ded0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, height - 100);
  ctx.lineTo(width - pad, height - 100);
  ctx.stroke();
  ctx.fillStyle = '#716a63';
  ctx.font = '20px "Microsoft YaHei UI", "PingFang SC", sans-serif';
  ctx.fillText('长按保存后发给你的饲养员 · 随便吃点', pad, height - 62);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', .96));
  return { blob, dataUrl: canvas.toDataURL('image/png') };
}
async function shareImageCard(config, filename) {
  toast('正在生成分享图片');
  latestShareImage = { ...(await createShareImageData(config)), title: config.title, filename };
  closeModal();
  const wechat = isWechatBrowser();
  const iosWechat = wechat && isIOSBrowser();
  const help = wechat
    ? `<strong>操作Tips</strong><p>${iosWechat ? '不要从 iOS 分享菜单再点微信。' : ''}请长按图片保存到相册，再到微信聊天里发送。</p>`
    : `<strong>手机分享建议</strong><p>优先点“转发/系统分享”。如果目标 App 不接收图片，请长按图片保存后手动发送。</p>`;
  const footer = wechat
    ? ''
    : `<button class="btn btn-secondary" data-action="download-share-image">${icon('copy',17)} 保存图片</button><button class="btn btn-primary" data-action="share-generated-image">${icon('share',17)} 转发/系统分享</button>`;
  modal('图片已生成', `<div class="image-preview ${wechat ? 'wechat-share-preview' : ''}"><div class="image-frame"><img src="${latestShareImage.dataUrl}" alt="${esc(config.title)}分享图片"></div><div class="share-help">${help}</div></div>`, footer, true);
}
async function shareMenuImage() {
  const menu = lastConfirmedMenu || { dishes: randomSelection, ingredients:[...new Set(randomSelection.flatMap(x=>x.ingredients))], note:'无特殊备注' };
  const stock = new Set(state.inventory.map(x=>x.name));
  const ready = menu.ingredients.filter(x=>stock.has(x));
  const missing = menu.ingredients.filter(x=>!stock.has(x));
  await shareImageCard({
    eyebrow: '随便吃点',
    title: '菜单来啦',
    sections: [
      { title: `菜单 · ${menu.dishes.length} 道`, items: menu.dishes.map(x=>`${x.name} · ${x.category}`), limit: 4, color: '#fff0bd' },
      { title: `需要采购 · ${missing.length} 项`, items: missing, style: 'chips', limit: 8, empty: '冰箱都够用', color: '#ffe3d8' },
      { title: `冰箱已有 · ${ready.length} 项`, items: ready, style: 'chips', limit: 4, empty: '暂无匹配', color: '#e2f5e9' },
      { title: '备注', items: [menu.note || '无特殊备注'], style: 'note', color: '#f1edff' }
    ]
  }, '今晚菜单.png');
}
async function sharePlaceImage(p) {
  if(!p) return;
  await shareImageCard({
    eyebrow: p.type === 'takeout' ? '外卖推荐' : '餐馆推荐',
    title: p.name,
    subtitle: '这家今天可以安排。',
    sections: [
      { title: '分类与评分', items: [`${p.category} · ${Number(p.rating).toFixed(1)} 星`], limit: 1, color: '#fff0bd' },
      { title: p.type === 'takeout' ? '配送信息' : '地址', items: [p.address], limit: 2, color: '#e2f5e9' },
      { title: '招牌', items: [p.specials || '待补充'], style: 'note', color: '#ffe3d8' }
    ]
  }, `${p.name}.png`);
}
async function shareText(title, text) {
  if(navigator.share) { try { await navigator.share({title,text}); return; } catch(e) { if(e.name==='AbortError') return; } }
  await navigator.clipboard.writeText(text); toast('内容已复制');
}
async function shareGeneratedImage() {
  if(!latestShareImage?.blob) return toast('请先生成图片');
  if(isWechatBrowser()) return toast('微信内请长按图片选择发送给朋友或保存图片');
  const file = new File([latestShareImage.blob], latestShareImage.filename || '随便吃点.png', { type: 'image/png' });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title: latestShareImage.title || '随便吃点', files: [file] });
      return toast('已调起系统分享');
    } catch(e) {
      if(e.name === 'AbortError') return;
    }
  }
  if (navigator.share) {
    try {
      await navigator.share({ title: latestShareImage.title || '随便吃点', text: '分享图片已生成，请长按保存后转发到微信。' });
      return;
    } catch(e) {
      if(e.name === 'AbortError') return;
    }
  }
  toast('当前浏览器不支持直接分享图片，请长按图片保存后转发微信');
}
function downloadShareImage() {
  if(!latestShareImage?.dataUrl) return toast('请先生成图片');
  const a = document.createElement('a');
  a.href = latestShareImage.dataUrl;
  a.download = latestShareImage.filename || '随便吃点.png';
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
  const filterCat = e.target.closest('[data-filter-cat]'); if(filterCat) { cookCategoryFilter = filterCat.dataset.filterCat || ''; render(); scrollTo(0,0); return; }
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
  if(action==='share-generated-image') shareGeneratedImage();
  if(action==='download-share-image') downloadShareImage();
  if(action==='random-place') {
    const cat=document.querySelector('#place-category').value, rating=+document.querySelector('#place-rating').value;
    const pool=state.places.filter(x=>x.type===el.dataset.type&&(!cat||x.category===cat)&&x.rating>=rating); if(!pool.length)return toast('没有符合条件的店');
    const p=pool[Math.floor(Math.random()*pool.length)]; modal('就它了！', `<article class="share-card"><span class="eyebrow">${esc(p.category)}</span><h2>${esc(p.name)}</h2><p>${esc(p.address)}</p><p><strong>招牌：</strong>${esc(p.specials)}</p><div class="stars">${starDisplay(p.rating)}</div></article>`, `<button class="btn btn-secondary" data-action="close-modal">重新抽</button><button class="btn btn-primary" data-action="share-place" data-id="${p.id}">${icon('share',17)} 分享结果</button>`);
  }
  if(action==='share-place') { const p=state.places.find(x=>x.id===id); sharePlaceImage(p); }
  if(action==='cleanup') { cleanupMode=true; render(); }
  if(action==='cleanup-cancel') { cleanupMode=false; render(); }
  if(action==='delete-stock') { const ids=[...document.querySelectorAll('[data-stock-select]:checked')].map(x=>x.value); if(!ids.length)return toast('请先选择要清理的食材'); state.inventory=state.inventory.filter(x=>!ids.includes(x.id)); cleanupMode=false; persist(); render(); toast('已清理所选食材'); }
  if(action==='shopping-form') modal('添加待采购食材', `<form id="shopping-form">${field('食材名称','name','',{required:true,list:'terms'})}<datalist id="terms">${state.terms.map(x=>`<option value="${esc(x)}">`).join('')}</datalist></form>`, `<button class="btn btn-secondary" data-action="close-modal">取消</button><button class="btn btn-primary" data-action="save-shopping">加入清单</button>`);
  if(action==='toggle-shopping') { const x=state.shopping.find(x=>x.id===id); x.done=!x.done; persist(); render(); toast(x.done?'已标记采购完成':'已恢复到采购清单'); }
  if(action==='delete-shopping') { state.shopping=state.shopping.filter(x=>x.id!==id); persist(); render(); }
  if(action==='delete-term') { const name=el.dataset.name; state.terms=state.terms.filter(x=>x!==name); persist(); render(); toast('词条已删除'); }
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
