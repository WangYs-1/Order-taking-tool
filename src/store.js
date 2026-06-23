const KEY = 'family-menu-v1';
export const seed = {
  dishes: [
    { id:'d1', name:'番茄炒蛋', category:'素菜', recipe:'鸡蛋炒至定型，加入番茄翻炒调味。', ingredients:['番茄','鸡蛋'] },
    { id:'d2', name:'可乐鸡翅', category:'荤菜', recipe:'https://www.xiachufang.com', ingredients:['鸡翅','可乐','生抽'] },
    { id:'d3', name:'蒜蓉西兰花', category:'素菜', recipe:'西兰花焯水，蒜末爆香后快速翻炒。', ingredients:['西兰花','大蒜'] },
    { id:'d4', name:'土豆炖牛腩', category:'荤菜', recipe:'牛腩焯水，和土豆一起小火炖煮。', ingredients:['牛腩','土豆','胡萝卜'] },
    { id:'d5', name:'葱油拌面', category:'主食', recipe:'熬葱油，加酱汁拌入煮好的面条。', ingredients:['面条','小葱','生抽'] }
  ],
  places: [
    { id:'p1', type:'out', name:'巷子口铜锅涮肉', category:'火锅', address:'云杉路 18 号', specials:'手切羊肉、糖蒜', rating:5 },
    { id:'p2', type:'out', name:'山葵食堂', category:'日料', address:'星河广场 2F', specials:'鳗鱼饭、寿喜锅', rating:4.5 },
    { id:'p3', type:'takeout', name:'椒香小碗菜', category:'家常菜', address:'配送约 35 分钟', specials:'辣子鸡、干煸豆角', rating:4.5, fee:'配送费 ¥3' },
    { id:'p4', type:'takeout', name:'米粒轻食', category:'轻食', address:'配送约 28 分钟', specials:'鸡胸谷物碗', rating:4, fee:'起送 ¥20' }
  ],
  inventory: [
    { id:'i1', name:'鸡蛋', amount:'6 个', added:'2026-06-20', expiry:'2026-07-05' },
    { id:'i2', name:'番茄', amount:'3 个', added:'2026-06-21', expiry:'2026-06-26' },
    { id:'i3', name:'胡萝卜', amount:'2 根', added:'2026-06-18', expiry:'2026-06-29' }
  ],
  shopping: [{ id:'s1', name:'牛奶', done:false }, { id:'s2', name:'小葱', done:false }],
  terms:['番茄','鸡蛋','鸡翅','可乐','生抽','西兰花','大蒜','牛腩','土豆','胡萝卜','面条','小葱','牛奶']
};

export const normalizeState = value => {
  const state = { ...structuredClone(seed), ...(value || {}) };
  state.dishes = Array.isArray(state.dishes) ? state.dishes : [];
  state.places = Array.isArray(state.places) ? state.places : [];
  state.inventory = Array.isArray(state.inventory) ? state.inventory : [];
  state.shopping = Array.isArray(state.shopping) ? state.shopping : [];
  state.terms = Array.isArray(state.terms) ? state.terms : [];
  state.places = state.places.map(place => ({ ...place, rating: Math.min(5, Math.max(.5, Math.round(Number(place.rating || 5) * 2) / 2)) }));
  return state;
};
export const loadState = () => {
  try { return normalizeState(JSON.parse(localStorage.getItem(KEY))); }
  catch { return normalizeState(); }
};
export const saveState = state => localStorage.setItem(KEY, JSON.stringify(state));
export const uid = prefix => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`;
export const addTerms = (state, names) => {
  names.filter(Boolean).forEach(name => { if (!state.terms.includes(name.trim())) state.terms.push(name.trim()); });
};
