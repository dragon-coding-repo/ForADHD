const store = require("../../utils/store.js");
const { CLASSROOM } = require("../../utils/content.js");

const GAME_NAMES = { light: "红绿灯", simon: "星星复现", stroop: "大小擂台" };

Page({
  data: {
    acc: 0, perGame: [], recent: [], slidesOpen: false,
    slides: [], slideIdx: 0,
  },

  onLoad() {
    this.G = store.loadGame();
    const h = this.G.history;
    const acc = h.length
      ? Math.round(h.reduce((a, x) => a + (x.trials ? x.hits / x.trials : 0), 0) / h.length * 100)
      : 0;
    const perGame = ["light", "simon", "stroop"].map(g => {
      const hs = h.filter(x => x.game === g);
      return {
        game: GAME_NAMES[g],
        count: hs.length,
        best: hs.length ? Math.max.apply(null, hs.map(x => x.rounds)) : 0,
      };
    });
    this.setData({
      acc, perGame,
      recent: h.slice(0, 10).map(x => ({
        id: x.id,
        date: store.todayKey(new Date(x.ts)),
        name: GAME_NAMES[x.game] || x.game,
        rounds: x.rounds,
        acc: x.trials ? Math.round(x.hits / x.trials * 100) : 0,
        stars: x.stars, mood: x.mood || "",
      })),
      slides: CLASSROOM.map((lines, i) => ({ idx: i, title: lines[0] || "", lines: lines.slice(1) })).slice(1),
      slideIdx: 0,
    });
  },

  toggleSlides() { this.setData({ slidesOpen: !this.data.slidesOpen }); },
  nextSlide() {
    if (this.data.slideIdx < this.data.slides.length - 1) {
      this.setData({ slideIdx: this.data.slideIdx + 1 });
    }
  },
  prevSlide() {
    if (this.data.slideIdx > 0) this.setData({ slideIdx: this.data.slideIdx - 1 });
  },
  callHotline() { wx.makePhoneCall({ phoneNumber: "12356", fail: () => {} }); },
});
