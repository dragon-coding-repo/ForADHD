const store = require("../../utils/store.js");
const audio = require("../../utils/audio.js");

Page({
  data: {
    dateStr: "",
    bal: 0, starN: 0, bonusN: 0, spentN: 0,
    goals: [], sched: [], sDone: 0, sTot: 0, nextHint: "",
    timerOpen: false, tNum: "25:00", tRunning: false, tDone: false,
    tPresets: [10, 15, 25, 40], tSel: 25,
  },

  onLoad() { this.S = store.loadApp(); this.tLeft = 25 * 60; this.tDur = 25 * 60; },
  onShow() { this.S = store.loadApp(); this.refresh(); },
  onHide() { this.stopTick(); },
  onUnload() { this.stopTick(); },

  refresh() {
    const S = this.S;
    const goals = S.goals.filter(g => !g.archived);
    const tk = store.weekKey();
    const dow = (new Date().getDay() + 6) % 7;
    const wkChecks = S.checks[tk] || {};
    const goalRows = goals.map(g => {
      const arr = wkChecks[g.id] || [];
      return { id: g.id, name: g.name, on: !!arr[dow] };
    });
    const doneToday = goalRows.filter(r => r.on).length;
    const sc = S.scheduleChecks[store.todayKey()] || [];
    const sDone = sc.filter(Boolean).length;
    let nextHint = "今天全部完成,了不起!";
    for (let i = 0; i < S.schedule.length; i++) {
      if (!sc[i]) { nextHint = "下一项:" + S.schedule[i].time + " " + S.schedule[i].item; break; }
    }
    this.setData({
      dateStr: store.todayKey(),
      bal: store.balance(S), starN: store.starCount(S), bonusN: store.bonusCount(S), spentN: store.spent(S),
      goals: goalRows, doneToday, total: goals.length,
      sched: S.schedule.map((x, i) => ({ time: x.time, item: x.item, done: !!sc[i] })),
      sDone, sTot: S.schedule.length, nextHint,
    });
  },

  onStar(e) {
    const gid = e.currentTarget.dataset.gid;
    const dow = (new Date().getDay() + 6) % 7;
    const tk = store.weekKey();
    const w = this.S.checks[tk] || (this.S.checks[tk] = {});
    const arr = w[gid] || (w[gid] = [false, false, false, false, false, false, false]);
    arr[dow] = !arr[dow];
    store.saveApp(this.S);
    audio.star();
    audio.vibrate("light");
    wx.showToast({ title: arr[dow] ? "⭐ +1,马上具体地表扬孩子!" : "已取消", icon: "none" });
    this.refresh();
  },

  onSched(e) {
    const i = e.currentTarget.dataset.i;
    const dk = store.todayKey();
    const a = this.S.scheduleChecks[dk] || (this.S.scheduleChecks[dk] = this.S.schedule.map(() => false));
    a[i] = !a[i];
    store.saveApp(this.S);
    audio.ok();
    this.refresh();
  },

  goMore() { wx.navigateTo({ url: "/pages/more/more" }); },
  goLog() { wx.switchTab({ url: "/pages/log/log" }); },
  goCheckin() { wx.switchTab({ url: "/pages/checkin/checkin" }); },
  noop() {},

  /* ── 专注计时器 ── */
  openTimer() { this.setData({ timerOpen: true }); },
  closeTimer() { this.setData({ timerOpen: false }); },
  stopTick() { if (this.tick) { clearInterval(this.tick); this.tick = null; } },
  tPreset(e) {
    if (this.data.tRunning) return;
    const m = Number(e.currentTarget.dataset.m);
    this.tDur = m * 60; this.tLeft = m * 60;
    this.setData({ tSel: m, tNum: this.fmt(this.tLeft) });
  },
  fmt(s) { return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); },
  tToggle() {
    if (this.data.tRunning) { this.stopTick(); this.setData({ tRunning: false }); return; }
    if (this.tLeft <= 0) this.tLeft = this.tDur;
    this.setData({ tRunning: true });
    this.tick = setInterval(() => {
      this.tLeft -= 1;
      if (this.tLeft <= 0) {
        this.stopTick();
        this.tLeft = 0;
        audio.win();
        audio.vibrate("long");
        this.setData({ tRunning: false, tDone: true, tNum: "0:00" });
        return;
      }
      this.setData({ tNum: this.fmt(this.tLeft) });
    }, 1000);
  },
  tReset() {
    this.stopTick();
    this.tLeft = this.tDur;
    this.setData({ tRunning: false, tDone: false, tNum: this.fmt(this.tLeft) });
  },
  afterTimer() {
    this.tReset();
    this.setData({ timerOpen: false });
    wx.switchTab({ url: "/pages/checkin/checkin" });
    wx.showToast({ title: "选一个目标,给孩子点亮今天的星", icon: "none" });
  },

  onShareAppMessage() { return { title: "ADHD家庭助手 · 让每一天更可预期", path: "/pages/today/today" }; },
});
