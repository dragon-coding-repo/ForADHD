#!/usr/bin/env node
// 微信小程序工程静态校验:结构/JSON/非法API/事件绑定/JS语法
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

let pass = 0, fail = 0, warns = 0;
const T = (name, cond, extra) => {
  if (cond) { pass++; }
  else { fail++; console.log("  ✗ FAIL: " + name + (extra ? " | " + extra : "")); }
};
const W = (name) => { warns++; console.log("  ⚠ WARN: " + name); };
const rd = (p) => fs.readFileSync(p, "utf-8");
const exists = (p) => fs.existsSync(path.join(ROOT, p));

console.log("── 1. 工程配置 ──");
const cfg = JSON.parse(rd(path.join(ROOT, "project.config.json")));
T("project.config.json 合法", !!cfg.appid && !!cfg.miniprogramRoot);
const app = JSON.parse(rd(path.join(ROOT, "app.json")));
T("app.json pages 非空", Array.isArray(app.pages) && app.pages.length >= 8);
T("sitemap.json 存在", exists("sitemap.json"));
T("app.js / app.wxss 存在", exists("app.js") && exists("app.wxss"));
(app.tabBar.list || []).forEach(t => {
  T("tabBar页在pages中: " + t.pagePath, app.pages.includes(t.pagePath));
  if (t.iconPath) T("tabBar图标存在: " + t.iconPath, exists(t.iconPath));
  if (t.selectedIconPath) T("tabBar选中图标存在: " + t.selectedIconPath, exists(t.selectedIconPath));
});
T("tabBar 项数为2至5", (app.tabBar.list || []).length >= 2 && (app.tabBar.list || []).length <= 5);

console.log("── 2. 页面完整性 ──");
app.pages.forEach(p => {
  T("js: " + p, exists(p + ".js"));
  T("wxml: " + p, exists(p + ".wxml"));
  if (exists(p + ".json")) {
    try { JSON.parse(rd(path.join(ROOT, p + ".json"))); T("json合法: " + p, true); }
    catch (e) { T("json合法: " + p, false, e.message); }
  }
});

console.log("── 3. JS语法与非法API ──");
const FORBIDDEN = [
  ["document.", "DOM访问"], ["window.", "window对象"], ["localStorage", "localStorage"],
  ["innerHTML", "innerHTML"], ["new Event(", "new Event"], ["webkitAudioContext", "Web Audio"],
  ["eval(", "eval"], ["getElementById", "getElementById"],
];
function walk(dir, cb) {
  fs.readdirSync(dir).forEach(f => {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) { if (f !== "tools" && f !== "node_modules") walk(full, cb); }
    else cb(full);
  });
}
function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}
walk(ROOT, full => {
  const rel = path.relative(ROOT, full);
  if (full.endsWith(".js")) {
    const code = rd(full);
    try { new Function(code); pass++; } // 语法编译检查(不执行)
    catch (e) { fail++; console.log("  ✗ FAIL: JS语法 " + rel + " | " + e.message); }
    const bare = stripComments(code);
    FORBIDDEN.forEach(([tok, label]) => {
      if (bare.includes(tok)) { fail++; console.log("  ✗ FAIL: " + rel + " 含非法API " + label + " (" + tok + ")"); }
    });
  }
});

console.log("── 3.5 WXSS 编译器兼容性 ──");
const FORBIDDEN_WXSS = [
  [":active", "伪类(用hover-class替代)"], [":hover", "伪类(用hover-class替代)"],
  [":focus", "伪类"], [":has(", ":has选择器"], [":is(", ":is选择器"],
  ["inset:", "inset简写(拆成四个方向)"], ["aspect-ratio", "aspect-ratio(用固定高度)"],
  ["display: grid", "grid布局(用flex)"], ["grid-template", "grid属性"], ["backdrop-filter", "backdrop-filter"],
  ["env(", "env()(safe-area用固定内边距替代)"], ["constant(", "constant()"], ["calc(", "calc()"],
];
walk(ROOT, full => {
  if (!full.endsWith(".wxss")) return;
  const rel = path.relative(ROOT, full);
  const css = rd(full);
  FORBIDDEN_WXSS.forEach(([tok, label]) => {
    if (css.includes(tok)) { fail++; console.log("  ✗ FAIL: " + rel + " 含WXSS不兼容写法 " + label + " (" + tok + ")"); }
  });
  // 空 @keyframes 块(wcsc抛 unexpected token })
  const emptyKf = css.match(/@keyframes\s+[\w-]+\s*\{\s*\}/g);
  if (emptyKf) { fail++; console.log("  ✗ FAIL: " + rel + " 含空 @keyframes 块: " + emptyKf.join(", ")); }
  // 花括号平衡
  if ((css.match(/\{/g) || []).length !== (css.match(/\}/g) || []).length) {
    fail++; console.log("  ✗ FAIL: " + rel + " 花括号不平衡");
  }
});

console.log("── 4. WXML 事件处理器绑定 ──");
app.pages.forEach(p => {
  const wxml = rd(path.join(ROOT, p + ".wxml"));
  const js = rd(path.join(ROOT, p + ".js"));
  const handlers = new Set();
  let m;
  const re = /(?:bind|catch)[a-z]+="([A-Za-z_][\w]*)"/g;
  while ((m = re.exec(wxml))) handlers.add(m[1]);
  handlers.forEach(h => {
    const defined = new RegExp("(?:^|\\n\\s{0,8})" + h + "\\s*\\(|[\\s({,]" + h + "\\s*\\(").test(js);
    if (!defined) { fail++; console.log("  ✗ FAIL: " + p + " 缺少事件处理函数 " + h + "()"); }
  });
  // wx:for 缺 wx:key 提醒
  const forRe = /<[^>]*wx:for=(?:"[^"]*")[^>]*>/g;
  while ((m = forRe.exec(wxml))) {
    if (!m[0].includes("wx:key")) W(p + " 存在缺少 wx:key 的 wx:for");
  }
});

console.log("── 5. 资源与数据 ──");
T("utils/store.js 存在", exists("utils/store.js"));
T("utils/audio.js 存在", exists("utils/audio.js"));
["ok", "no", "win", "star"].forEach(n => T("音频存在: " + n + ".wav", exists("assets/audio/" + n + ".wav")));
try {
  const c = rd(path.join(ROOT, "utils/content.js"));
  const { HANDBOOK, CLASSROOM } = new Function("module", c + ";return module.exports;")({ exports: {} });
  T("content.js 手册块数 ≥150", HANDBOOK.length >= 150, String(HANDBOOK.length));
  T("content.js 课堂页数 ≥17", CLASSROOM.length >= 17, String(CLASSROOM.length));
} catch (e) { T("content.js 可加载", false, e.message); }

console.log("── 6. require 路径解析 ──");
walk(ROOT, full => {
  if (!full.endsWith(".js")) return;
  const code = rd(full);
  const re = /require\("([^"]+)"\)/g;
  let m;
  while ((m = re.exec(code))) {
    const target = path.resolve(path.dirname(full), m[1]);
    if (fs.existsSync(target) || fs.existsSync(target + ".js") || fs.existsSync(path.join(target, "index.js"))) continue;
    fail++; console.log("  ✗ FAIL: " + path.relative(ROOT, full) + " require 不可解析: " + m[1]);
  }
});

console.log(`\n结果: ${pass} 通过 / ${fail} 失败 / ${warns} 提醒`);
process.exit(fail ? 1 : 0);
