const store = require("../../utils/store.js");
const audio = require("../../utils/audio.js");
const WD = ["一", "二", "三", "四", "五", "六", "日"];

Page({
  data: {
    wd: WD, week: "", rows: [], weekTotal: 0, fut: [false, false, false, false, false, false, false],
    isCur: true, goalsAll: [], rewards: [], bal: 0, redemptions: [], newGoal: "", newReward: "", newRewardCost: "",
  },

  onLoad() { this.S = store.loadApp(); this.G = store.loadGame(); },
  onShow() {
    this.S = store.loadApp(); this.G = store.loadGame();
    if (!this.data.week) this.setData({ week: store.weekKey() });
    this.refresh();
  },

  refresh() {
    const S = this.S;
    const wk = this.data.week;
    const mon = store.monday(new Date(wk));
    const isCur = wk === store.weekKey();
    const fut = WD.map((_, i) => {
      const d = new Date(mon); d.setDate(d.getDate() + i);
      return isCur && d > new Date();
    });
    const wkChecks = S.checks[wk] || {};
    const goals = S.goals.filter(g => !g.archived);
    let weekTotal = 0;
    const rows = goals.map(g => {
      const arr = wkChecks[g.id] || [];
      const cells = arr.map(Boolean);
      const sum = cells.filter(Boolean).length;
      weekTotal += sum;
      return { id: g.id, name: g.name, cells, sum };
    });
    const bal = store.balance(S);
    this.setData({
      fut, isCur, rows, weekTotal, bal,
      goalsAll: S.goals.map(g => ({ id: g.id, name: g.name, archived: !!g.archived })),
      rewards: S.rewards.map(r => ({ id: r.id, name: r.name, cost: r.cost, done: !!r.done, can: bal >= r.cost && !r.done })),
      redemptions: S.redemptions.slice(-6).reverse().map(r => ({
        id: r.id, name: r.name, cost: r.cost, date: store.todayKey(new Date(r.ts)),
      })),
    });
  },

  shiftWeek(e) {
    const n = Number(e.currentTarget.dataset.n);
    const d = store.monday(new Date(this.data.week));
    d.setDate(d.getDate() + 7 * n);
    const k = store.todayKey(d);
    if (k > store.weekKey()) return;
    this.setData({ week: k });
    this.refresh();
  },

  onStar(e) {
    const gid = e.currentTarget.dataset.gid;
    const dow = Number(e.currentTarget.dataset.dow);
    if (this.data.fut[dow]) return;
    const wk = this.data.week;
    const w = this.S.checks[wk] || (this.S.checks[wk] = {});
    const arr = w[gid] || (w[gid] = [false, false, false, false, false, false, false]);
    arr[dow] = !arr[dow];
    store.saveApp(this.S);
    audio.star();
    audio.vibrate("light");
    this.refresh();
  },

  onGoalInput(e) { this.setData({ newGoal: e.detail.value }); },
  addGoal() {
    const v = (this.data.newGoal || "").trim();
    if (!v) return;
    this.S.goals.push({ id: store.uid(), name: v });
    store.saveApp(this.S);
    this.setData({ newGoal: "" });
    wx.showToast({ title: "目标已添加", icon: "none" });
    this.refresh();
  },
  archiveGoal(e) {
    const id = e.currentTarget.dataset.id;
    const g = this.S.goals.find(x => x.id === id);
    if (!g) return;
    if (g.archived) {
      wx.showModal({
        title: "彻底删除", content: "删除该目标及其打卡记录?",
        success: res => {
          if (!res.confirm) return;
          this.S.goals = this.S.goals.filter(x => x.id !== id);
          for (const w in this.S.checks) delete this.S.checks[w][id];
          store.saveApp(this.S);
          this.refresh();
        },
      });
    } else {
      g.archived = true;
      store.saveApp(this.S);
      this.refresh();
    }
  },

  onRewardInput(e) { this.setData({ newReward: e.detail.value }); },
  onRewardCost(e) { this.setData({ newRewardCost: e.detail.value }); },
  addReward() {
    const n = (this.data.newReward || "").trim();
    const c = parseInt(this.data.newRewardCost, 10);
    if (!n || !(c > 0)) { wx.showToast({ title: "请填写奖励名称和星星数", icon: "none" }); return; }
    this.S.rewards.push({ id: store.uid(), name: n, cost: c });
    store.saveApp(this.S);
    this.setData({ newReward: "", newRewardCost: "" });
    wx.showToast({ title: "奖励已加入菜单", icon: "none" });
    this.refresh();
  },
  redeem(e) {
    const id = e.currentTarget.dataset.id;
    const r = this.S.rewards.find(x => x.id === id);
    if (!r || r.done) return;
    if (store.balance(this.S) < r.cost) { wx.showToast({ title: "星星还不够,继续加油", icon: "none" }); return; }
    r.done = true;
    this.S.redemptions.push({ ts: Date.now(), id, name: r.name, cost: r.cost });
    store.saveApp(this.S);
    audio.win();
    wx.showToast({ title: "已兑换:" + r.name, icon: "none" });
    this.refresh();
  },
  unredeem(e) {
    const id = e.currentTarget.dataset.id;
    const r = this.S.rewards.find(x => x.id === id);
    if (!r) return;
    r.done = false;
    this.S.redemptions = this.S.redemptions.filter(x => x.id !== id);
    store.saveApp(this.S);
    this.refresh();
  },
});
