const store = require("../../utils/store.js");

Page({
  data: {
    stars: 0, claimed: 0, sessionMin: 10,
    age: "7-9", ages: ["4-6", "7-9", "10-12"], mins: [5, 10, 15],
    recent: [],
  },

  onLoad() { this.G = store.loadGame(); },
  onShow() { this.G = store.loadGame(); this.refresh(); },

  refresh() {
    const G = this.G;
    this.setData({
      stars: G.stars, claimed: G.claimed || 0,
      age: G.age, sessionMin: G.sessionMin,
      recent: G.history.slice(0, 5).map(h => ({
        id: h.id,
        date: store.todayKey(new Date(h.ts)),
        name: ({ light: "红绿灯", simon: "星星复现", stroop: "大小擂台" })[h.game] || h.game,
        rounds: h.rounds,
        mood: h.mood || "",
      })),
    });
  },

  play(e) { wx.navigateTo({ url: "/pages/game/game?mode=" + e.currentTarget.dataset.mode }); },
  goParent() { wx.navigateTo({ url: "/pages/parent/parent" }); },
  setAge(e) {
    const a = e.currentTarget.dataset.a;
    const def = { "4-6": 5, "7-9": 10, "10-12": 10 }[a];
    this.G.age = a; this.G.sessionMin = def;
    store.saveGame(this.G);
    this.refresh();
  },
  setMin(e) {
    this.G.sessionMin = Number(e.currentTarget.dataset.m);
    store.saveGame(this.G);
    this.refresh();
  },

  onShareAppMessage() { return { title: "专注力练习 · 玩中练'停下来、记得住、变通快'", path: "/pages/games/games" }; },
});
