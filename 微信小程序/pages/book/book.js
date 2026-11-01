const { HANDBOOK } = require("../../utils/content.js");
const store = require("../../utils/store.js");

function chapters() {
  const ch = [];
  HANDBOOK.forEach((b, i) => { if (b.t === "h1") ch.push({ title: b.x, start: i }); });
  ch.forEach((c, i) => { c.end = i < ch.length - 1 ? ch[i + 1].start : HANDBOOK.length; });
  return ch;
}

Page({
  data: {
    mode: "list", // list | reader
    chs: [], fs: 30, chTitle: "", blocks: [], chIdx: -1, hasNext: false,
  },

  onLoad() {
    this.S = store.loadApp();
    this.H = HANDBOOK;
    const chs = chapters().map((c, i) => ({ idx: i, title: c.title, count: c.end - c.start }));
    this.chs = chapters();
    this.setData({ chs, fs: this.S.bookFont || 30 });
  },
  onShow() { this.S = store.loadApp(); },

  openChapter(e) {
    const i = Number(e.currentTarget.dataset.idx);
    this.setData({ mode: "reader", chIdx: i, chTitle: this.chs[i].title });
    this.buildReader();
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },
  buildReader() {
    const ch = this.chs[this.data.chIdx];
    const blocks = [];
    this.H.slice(ch.start, ch.end).forEach(b => {
      if (b.t === "h1" || b.t === "h2" || b.t === "p") blocks.push({ t: b.t, x: b.x });
      else if (b.t === "tip") blocks.push({ t: "tip", title: b.title || "温馨提示", x: b.x });
      else if (b.t === "table" && b.rows.length > 1) {
        blocks.push({
          t: "table", headers: b.rows[0],
          rows: b.rows.slice(1).map((r, i) => ({ i, c0: r[0], c1: r[1] })),
        });
      } else if (b.t === "table" && b.rows.length === 1) {
        blocks.push({ t: "p", x: b.rows[0].join(" ") });
      }
    });
    this.setData({ blocks, hasNext: this.data.chIdx < this.chs.length - 1 });
  },
  nextChapter() {
    if (this.data.chIdx >= this.chs.length - 1) return;
    this.setData({ chIdx: this.data.chIdx + 1, chTitle: this.chs[this.data.chIdx + 1].title });
    this.buildReader();
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },
  backList() { this.setData({ mode: "list" }); },
  fontMinus() { this.setFont(this.data.fs - 2); },
  fontPlus() { this.setFont(this.data.fs + 2); },
  setFont(fs) {
    fs = Math.max(24, Math.min(44, fs));
    this.S.bookFont = fs;
    store.saveApp(this.S);
    this.setData({ fs });
  },

  onShareAppMessage() { return { title: "ADHD儿童家庭指导手册(随身版)", path: "/pages/book/book" }; },
});
