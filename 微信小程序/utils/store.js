// 全局状态与持久化 —— 与网页版数据模型同构,存储改用 wx storage
const APPKEY = "adhd_app_v1";
const GKEY = "adhd_game_v1";

function todayKey(d) {
  d = d || new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function monday(d) {
  d = d || new Date();
  const x = new Date(d);
  const w = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - w);
  return x;
}
function weekKey(d) { return todayKey(monday(d)); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function seedApp() {
  return {
    v: 1, seeded: true, created: Date.now(),
    goals: [
      { id: uid(), name: "20分钟内开始写作业" },
      { id: uid(), name: "睡前自己收拾书包" },
    ],
    rewards: [
      { id: uid(), name: "多读一个睡前故事", cost: 10 },
      { id: uid(), name: "和爸爸/妈妈下一盘棋", cost: 15 },
      { id: uid(), name: "决定周日全家活动", cost: 30 },
      { id: uid(), name: "邀请同学来家里玩", cost: 40 },
      { id: uid(), name: "兑换一个大心愿(玩具/图书)", cost: 100 },
    ],
    redemptions: [],
    checks: {},
    schedule: [
      { time: "7:00", item: "起床、洗漱" },
      { time: "7:30", item: "早餐" },
      { time: "16:30", item: "运动30分钟" },
      { time: "18:00", item: "作业时间" },
      { time: "19:00", item: "晚餐" },
      { time: "20:30", item: "睡前程序(洗漱、故事)" },
      { time: "21:00", item: "熄灯睡觉" },
    ],
    scheduleChecks: {},
    behavior: [], meds: [], medLast: { drug: "", dose: "" },
    bonusStars: [],
    bookFont: 30,
  };
}
function loadApp() {
  try {
    const v = wx.getStorageSync(APPKEY);
    if (v && v.v === 1 && v.goals) return v;
  } catch (e) {}
  const s = seedApp();
  saveApp(s);
  return s;
}
function saveApp(s) { try { wx.setStorageSync(APPKEY, s); } catch (e) {} }

function seedGame() {
  return {
    v: 1, age: "7-9", sessionMin: 10, stars: 0, history: [], claimed: 0,
  };
}
function loadGame() {
  try {
    const v = wx.getStorageSync(GKEY);
    if (v && v.v === 1 && v.history) return v;
  } catch (e) {}
  const s = seedGame();
  saveGame(s);
  return s;
}
function saveGame(g) { try { wx.setStorageSync(GKEY, g); } catch (e) {} }

function starCount(S) {
  let n = 0;
  for (const w in S.checks) for (const g in S.checks[w]) for (const b of S.checks[w][g]) if (b) n++;
  return n;
}
function bonusCount(S) { return (S.bonusStars || []).reduce((a, b) => a + (b.amount || 0), 0); }
function spent(S) { return S.redemptions.reduce((a, r) => a + r.cost, 0); }
function balance(S) { return starCount(S) + bonusCount(S) - spent(S); }
function addBonus(S, amount, src) {
  S.bonusStars = (S.bonusStars || []).concat([{ ts: Date.now(), amount, src: src || "专注力练习" }]);
  saveApp(S);
}

// 行为记录快捷标签(与网页版一致)
const SCENES = ["作业", "餐桌", "睡前", "起床", "外出", "屏幕时间", "同伴玩耍"];
const BEH_NEG = ["走神发呆", "离开座位", "发脾气哭闹", "争抢打闹", "拖延顶嘴", "打断插话"];
const BEH_POS = ["顺利完成", "主动收拾", "安静等待", "自己开始学习", "遵守约定"];
const RESP = ["表扬+⭐", "提醒后完成", "忽略冷静", "平静制止", "协商解决", "批评"];

module.exports = {
  APPKEY, GKEY, todayKey, monday, weekKey, uid, esc,
  seedApp, loadApp, saveApp, seedGame, loadGame, saveGame,
  starCount, bonusCount, spent, balance, addBonus,
  SCENES, BEH_NEG, BEH_POS, RESP,
};
