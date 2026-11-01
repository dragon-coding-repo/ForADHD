const store = require("../../utils/store.js");
const audio = require("../../utils/audio.js");

Page({
  data: {
    tab: "behavior",
    scenes: store.SCENES, behNeg: store.BEH_NEG, behPos: store.BEH_POS, resp: store.RESP,
    sel: { scene: "", behavior: "", response: "" }, note: "",
    behHistory: [], medDate: "", meds: [],
    mDrug: "", mTime: "07:30", mAppetite: "一般", mNote: "",
  },

  onLoad() { this.S = store.loadApp(); },
  onShow() { this.S = store.loadApp(); this.refresh(); },

  refresh() {
    const S = this.S;
    const group = (list) => {
      const byDate = {};
      list.forEach(x => {
        const d = store.todayKey(new Date(x.ts));
        (byDate[d] = byDate[d] || []).push(x);
      });
      return Object.keys(byDate).sort().reverse().slice(0, 7).map(d => ({
        date: d,
        items: byDate[d].slice().reverse().map(x => ({
          id: x.id,
          time: String(new Date(x.ts).getHours()).padStart(2, "0") + ":" + String(new Date(x.ts).getMinutes()).padStart(2, "0"),
          behavior: x.behavior, scene: x.scene || "",
          neg: store.BEH_NEG.indexOf(x.behavior) >= 0,
          response: x.response || "", note: x.note || "",
          drug: x.drug || "(未填药名)", time2: x.time || "",
          appetite: x.appetite || "",
        })),
      }));
    };
    this.setData({
      behHistory: group(S.behavior),
      medDate: store.todayKey(),
      meds: group(S.meds),
      mDrug: S.medLast.drug || "",
    });
  },

  setTab(e) { this.setData({ tab: e.currentTarget.dataset.tab }); this.refresh(); },
  onChip(e) {
    const g = e.currentTarget.dataset.group, v = e.currentTarget.dataset.val;
    const sel = this.data.sel;
    sel[g] = sel[g] === v ? "" : v;
    this.setData({ sel });
  },
  onNote(e) { this.setData({ note: e.detail.value }); },

  saveBehavior() {
    const s = this.data.sel;
    if (!s.behavior) { wx.showToast({ title: "先选一个行为", icon: "none" }); return; }
    this.S.behavior.push({
      id: store.uid(), ts: Date.now(), scene: s.scene, behavior: s.behavior,
      response: s.response, note: this.data.note || "",
    });
    store.saveApp(this.S);
    audio.ok();
    this.setData({ sel: { scene: "", behavior: "", response: "" }, note: "" });
    wx.showToast({ title: "已记录 ✓", icon: "none" });
    this.refresh();
  },
  delBehavior(e) {
    const id = e.currentTarget.dataset.id;
    this.S.behavior = this.S.behavior.filter(b => b.id !== id);
    store.saveApp(this.S);
    this.refresh();
  },

  onDrug(e) { this.setData({ mDrug: e.detail.value }); },
  onTime(e) { this.setData({ mTime: e.detail.value }); },
  onApp(e) { this.setData({ mAppetite: e.currentTarget.dataset.v }); },
  onMedNote(e) { this.setData({ mNote: e.detail.value }); },
  saveMed() {
    const drug = (this.data.mDrug || "").trim();
    this.S.meds.push({
      id: store.uid(), date: store.todayKey(), time: this.data.mTime,
      drug, appetite: this.data.mAppetite, note: (this.data.mNote || "").trim(),
    });
    this.S.medLast = { drug };
    store.saveApp(this.S);
    audio.ok();
    this.setData({ mNote: "" });
    wx.showToast({ title: "已记录 ✓", icon: "none" });
    this.refresh();
  },
  delMed(e) {
    const id = e.currentTarget.dataset.id;
    this.S.meds = this.S.meds.filter(m => m.id !== id);
    store.saveApp(this.S);
    this.refresh();
  },
});
