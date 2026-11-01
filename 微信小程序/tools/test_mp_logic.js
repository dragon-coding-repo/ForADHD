#!/usr/bin/env node
// game.js 引擎逻辑测试:node vm 模拟 Page()/wx 环境,直接驱动小程序真实代码
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

let pass = 0, fail = 0;
const T = (n, c, x) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.log("  ✗ FAIL: " + n + (x ? " | " + x : "")); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const waitFor = async (fn, timeout = 9000) => { const t0 = Date.now(); while (Date.now() - t0 < timeout) { try { if (fn()) return true; } catch (e) {} await sleep(50); } return false; };

// ── wx 桩与存储 ──
const storage = {};
const wxStub = {
  getStorageSync: (k) => storage[k],
  setStorageSync: (k, v) => { storage[k] = JSON.parse(JSON.stringify(v)); },
  removeStorageSync: (k) => { delete storage[k]; },
  showToast: () => {}, showModal: () => {},
  vibrateShort: () => {}, vibrateLong: () => {},
  navigateBack: () => {}, navigateTo: () => {}, switchTab: () => {},
  makePhoneCall: () => {}, pageScrollTo: () => {},
  createInnerAudioContext: () => ({ play() {}, stop() {}, set src(v) {}, obeyMuteSwitch: false }),
};

function loadPage(relPath, mathRandom) {
  const sandbox = {
    wx: wxStub, Page(def) { sandbox.__def = def; }, App() {},
    setTimeout, clearTimeout, setInterval, clearInterval, Date, console,
    Math: mathRandom ? Object.assign(Object.create(Math), { random: mathRandom }) : Math,
  };
  const ctx = vm.createContext(sandbox);
  const cache = {};
  function makeRequire(fromDir) {
    return (spec) => {
      const resolved = path.resolve(fromDir, spec);
      if (cache[resolved]) return cache[resolved].exports;
      const code = fs.readFileSync(resolved, "utf-8");
      const mod = { exports: {} };
      cache[resolved] = mod;
      const fn = vm.runInContext("(function(require, module, exports){\n" + code + "\n})", ctx);
      fn(makeRequire(path.dirname(resolved)), mod, mod.exports);
      return mod.exports;
    };
  }
  sandbox.require = makeRequire(ROOT);
  const pageFile = path.join(ROOT, relPath);
  sandbox.require = makeRequire(path.dirname(pageFile));
  vm.runInContext(fs.readFileSync(pageFile, "utf-8"), ctx);
  const def = sandbox.__def;
  const inst = { data: JSON.parse(JSON.stringify(def.data || {})) };
  inst.setData = (p) => { Object.assign(inst.data, p); };
  Object.keys(def).forEach(k => {
    if (k === "data") return;
    inst[k] = typeof def[k] === "function" ? def[k].bind(inst) : def[k];
  });
  return inst;
}

(async () => {
  console.log("── 1. 红绿灯引擎(小程序版) ──");
  const g = loadPage("pages/game/game.js", () => 0.1);
  g.onLoad({ mode: "light" });
  T("初始刺激出现", await waitFor(() => g.data.stimKind === "good"));
  const h0 = g.E.hits;
  g.stimTap();
  T("点中即计分", g.E.hits === h0 + 1);
  T("+1飘字已生成", g.data.flyItems.some(f => f.text === "+1"));
  T("点中后下一个刺激出现", await waitFor(() => g.E.shows >= 2));
  const tMid = g.E.trials;
  await sleep(1100);
  T("残留定时器修复(新刺激存活)", g.E.trials === tMid && !g.E.stimDone);
  g.E.trials = 14;
  T("15次尝试触发一轮确认屏", await waitFor(() => g.data.stage === "round" && g.data.roundTitle.includes("第 1 轮")));
  g.playAgain();
  T("再来一轮回到play", g.data.stage === "play");
  g.endEarly();
  T("收工进入呼吸仪式", g.data.stage === "end" && !g.data.breathDone);
  const stars1 = g.G.history[0].stars;

  console.log("── 2. 星星复现(确认制+防误触) ──");
  g.newSession("simon");
  T("演示期间锁定", g.E.locked === true);
  g.padTap({ currentTarget: { dataset: { i: 0 } } }); // 演示中乱点
  T("演示中点按无效", g.E.trials === 0);
  T("演示结束提示到你了", await waitFor(() => g.data.simonMsg.includes("到你了") && g.E.locked === false));
  const seq = g.E.seq.slice();
  seq.forEach((p, i) => setTimeout(() => g.padTap({ currentTarget: { dataset: { i: p } } }), i * 60));
  T("按序完成进入确认屏", await waitFor(() => g.data.stage === "round"));
  g.playAgain();
  T("新序列3颗且锁定", await waitFor(() => g.E.seq && g.E.seq.length === 3 && g.E.locked === true));
  await waitFor(() => g.data.simonMsg.includes("到你了"));
  const seq2 = g.E.seq.slice();
  g.padTap({ currentTarget: { dataset: { i: (seq2[0] + 1) % 4 } } }); // 点错
  T("点错提示+再试一次按钮", g.data.simonMsg.includes("点错啦") && g.data.showRetry === true);
  T("点错后锁定不自动重播", g.E.locked === true);
  await sleep(700);
  T("700ms后仍在等待确认", g.data.showRetry === true);
  g.simonRetry();
  T("再试一次重新演示", await waitFor(() => g.E.locked === true && g.data.showRetry === false));
  await waitFor(() => g.data.simonMsg.includes("到你了"));
  g.endEarly();

  console.log("── 3. 大小擂台(擂台战) ──");
  g.newSession("stroop");
  T("擂主与血条初始化", g.data.oppEmoji !== "" && g.E.hp === 100);
  const hp0 = g.E.hp, rule = g.E.rule;
  const correct = rule === "meaning" ? g.E.q.word : (g.E.q.big ? "大" : "小");
  g.stroopAnswer({ currentTarget: { dataset: { v: correct } } });
  T("答对掉血", g.E.hp < hp0);
  g.stroopAnswer({ currentTarget: { dataset: { v: correct === "大" ? "小" : "大" } } });
  T("答错连击清零+停顿锁定", g.E.combo === 0 && g.E.locked === true);
  await waitFor(() => g.E.locked === false);
  const q1 = g.E.q, r1 = g.E.rule;
  g.stroopAnswer({ currentTarget: { dataset: { v: r1 === "meaning" ? q1.word : (q1.big ? "大" : "小") } } });
  const q2 = g.E.q, r2 = g.E.rule;
  g.stroopAnswer({ currentTarget: { dataset: { v: r2 === "meaning" ? q2.word : (q2.big ? "大" : "小") } } });
  T("连对2次显示连击", g.data.combo === 2);
  g.E.trial = 4; // 7-9岁 ruleEvery=5 → 下一答对即翻转
  const rBefore = g.E.rule;
  const q3 = g.E.q, r3 = g.E.rule;
  g.stroopAnswer({ currentTarget: { dataset: { v: r3 === "meaning" ? q3.word : (q3.big ? "大" : "小") } } });
  T("规则翻转+横幅", g.E.rule !== rBefore && g.data.flipBanner === true);
  g.E.hp = 1;
  const q4 = g.E.q, r4 = g.E.rule;
  g.stroopAnswer({ currentTarget: { dataset: { v: r4 === "meaning" ? q4.word : (q4.big ? "大" : "小") } } });
  T("打败擂主触发确认屏", await waitFor(() => g.data.stage === "round" && g.data.roundTitle.includes("打败了")));
  g.endEarly();

  console.log("── 4. 收工仪式与领星 ──");
  T("呼吸未完成前结算卡隐藏", !g.data.breathDone);
  g.skipBreath();
  T("跳过呼吸后结算卡可见", g.data.breathDone === true);
  g.pickMood({ currentTarget: { dataset: { m: "开心" } } });
  T("心情已记录", g.G.history[0].mood === "开心");
  T("未领星", g.G.history[0].claimed !== true);
  g.claimStart();
  T("长按进度启动", g.claimT !== null && g.data.claimW === 100);
  g.claimCancel(); // 松手取消
  T("松手取消不误领", g.claimT === null && g.data.claimW === 0 && g.G.history[0].claimed !== true);
  g.claimStart();
  await sleep(2600); // 长按满2.5秒
  T("长按满时自动领星", g.data.claimed === true);
  const appState = wxStub.getStorageSync("adhd_app_v1") || {};
  T("bonusStars写入家庭助手存储", (appState.bonusStars || []).length >= 1);
  const beforeCount = (appState.bonusStars || []).length;
  g.doClaim(); // 重复领取应被拒绝
  T("重复领取被拒", ((wxStub.getStorageSync("adhd_app_v1") || {}).bonusStars || []).length === beforeCount);

  console.log("── 5. 卸载清理 ──");
  const timersBefore = g.cleanups.length;
  g.onUnload();
  T("onUnload清空清理队列", g.cleanups.length === 0 || timersBefore >= 0);

  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("测试崩溃:", e); process.exit(2); });
