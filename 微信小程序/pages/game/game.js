const store = require("../../utils/store.js");
const audio = require("../../utils/audio.js");

const FRUITS = {
  good: ["🍏", "🍐", "🫐", "🍊"],
  bad: ["🌶️"],
  gold: ["⭐"],
};
const OPPONENTS = [["🐘", "大象擂主"], ["🦏", "犀牛擂主"], ["🦍", "大猩猩擂主"], ["🐊", "鳄鱼擂主"], ["🦖", "霸王龙擂主"]];
const GAME_NAMES = { light: "红绿灯", simon: "星星复现", stroop: "大小擂台" };

function diff(age) {
  const D = {
    "4-6": { stim: 1700, gap: 450, simonStart: 2, simonMax: 5, stroopTrials: 14, ruleEvery: 99, sessionDef: 5 },
    "7-9": { stim: 1250, gap: 350, simonStart: 2, simonMax: 7, stroopTrials: 20, ruleEvery: 5, sessionDef: 10 },
    "10-12": { stim: 900, gap: 260, simonStart: 3, simonMax: 9, stroopTrials: 20, ruleEvery: 4, sessionDef: 10 },
  };
  return D[age] || D["7-9"];
}

Page({
  data: {
    mode: "", modeName: "", stage: "play", sessionMin: 10,
    timePct: 100, minsLeft: 0, scoreline: "",
    // light
    stimKind: "", stimEmoji: "❓", stimCls: "", stimDone: false,
    fbText: "", fbSub: "", fbState: "",
    flyItems: [],
    // simon
    pads: [false, false, false, false], simonMsg: "", showRetry: false,
    // stroop
    oppEmoji: "", oppName: "", hp: 100, ruleTxt: "", isMeaning: true,
    charText: "", charBig: true, combo: 0, flipBanner: false,
    // end
    endTitle: "", stars3: [false, false, false], endRounds: 0,
    balloonBig: false, brMsg: "跟着气球:吸气…屏住…呼气…", breathDone: false,
    mood: "", claimed: false, claimW: 0, claimHint: "",
  },

  onLoad(options) {
    const mode = options.mode || "";
    if (!GAME_NAMES[mode]) { wx.navigateBack(); return; }
    this.G = store.loadGame();
    this.cleanups = [];
    this.claimT = null;
    this.setData({ mode, modeName: GAME_NAMES[mode], sessionMin: this.G.sessionMin });
    this.newSession(mode);
  },
  onUnload() { this.cleanupAll(); },
  onHide() { this.cleanupAll(); },
  cleanupAll() {
    (this.cleanups || []).forEach(f => { try { f(); } catch (e) {} });
    this.cleanups = [];
    this.stopTick();
    this.claimCancel();
  },
  reg(fn) { this.cleanups.push(fn); },
  later(fn, ms) { const t = setTimeout(fn, ms); this.reg(() => clearTimeout(t)); return t; },

  newSession(mode) {
    const d = diff(this.G.age);
    this.E = {
      mode, rounds: 0, hits: 0, trials: 0, shows: 0,
      endsAt: Date.now() + this.G.sessionMin * 60000,
      stimT: null, stimKind: "", stimDone: false,
      seq: null, pos: 0, locked: false, len: d.simonStart,
      hp: 100, combo: 0, trial: 0, rule: "meaning", nextRule: d.ruleEvery, opp: null,
      next: 15,
    };
    if (mode === "simon") this.E.len = d.simonStart;
    this.setData({ mode, modeName: GAME_NAMES[mode], stage: "play", flipBanner: false, showRetry: false, flyItems: [] });
    this.startGame(mode);
    this.startTick();
  },
  startTick() {
    this.stopTick();
    this.tick = setInterval(() => {
      const left = this.E.endsAt - Date.now();
      const pct = Math.max(0, Math.min(100, left / (this.G.sessionMin * 600) / 10));
      this.setData({ timePct: pct, minsLeft: Math.max(0, Math.ceil(left / 60000)) });
      if (left <= 0) this.endSession(false);
    }, 1000);
  },
  stopTick() { if (this.tick) { clearInterval(this.tick); this.tick = null; } },
  timeUp() { return Date.now() >= this.E.endsAt; },

  /* ══ 红绿灯 go/no-go ══ */
  startLight() {
    this.setData({
      stimKind: "", stimEmoji: "❓", stimDone: false, stimCls: "",
      fbText: "看到水果立刻点它,辣椒什么都别做", fbSub: "", fbState: "",
    });
    this.later(() => this.lightShow(), 700);
    const chk = setInterval(() => {
      if (!this.E || this.E.mode !== "light") { clearInterval(chk); return; }
      if (this.E.trials >= this.E.next) { this.E.next += 15; this.roundDone(""); }
    }, 400);
    this.reg(() => clearInterval(chk));
  },
  lightShow() {
    const E = this.E;
    if (!E || E.mode !== "light") return;
    if (this.timeUp()) { this.endSession(false); return; }
    if (E.stimT) { clearTimeout(E.stimT); E.stimT = null; }
    E.shows += 1;
    const r = Math.random();
    const kind = r < 0.62 ? "good" : (r < 0.86 ? "bad" : "gold");
    E.stimKind = kind; E.stimDone = false;
    this.setData({
      stimKind: kind, stimDone: false,
      stimEmoji: FRUITS[kind][Math.floor(Math.random() * FRUITS[kind].length)],
      stimCls: kind === "good" ? "good" : kind === "bad" ? "bad" : "gold",
    });
    E.stimT = setTimeout(() => {
      E.stimT = null;
      if (!this.E || this.E.mode !== "light") return;
      if (E.stimDone) return;
      E.stimDone = true; E.trials += 1;
      this.setData({ stimDone: true });
      if (kind === "bad") { E.hits += 1; this.fb("忍住了,真棒!","+1",true); audio.ok(); this.fly("忍住 +1",""); audio.vibrate("light"); }
      else { this.fb("溜走了…","注意要快一点哦",false); this.fly("溜走了…","mutedfly"); }
      this.later(() => this.lightShow(), diff(this.G.age).gap);
    }, diff(this.G.age).stim);
  },
  stimTap() {
    const E = this.E;
    if (!E || E.mode !== "light" || E.stimDone) return;
    E.stimDone = true; E.trials += 1;
    if (E.stimT) { clearTimeout(E.stimT); E.stimT = null; }
    const kind = E.stimKind;
    this.setData({ stimDone: true, stimCls: (kind === "bad" ? "bad " : kind === "gold" ? "gold " : "good ") + "hitpop " + (kind === "bad" ? "flash-bad" : "flash-good") });
    if (kind === "good") { E.hits += 1; this.fb("抓到啦!","+1",true); audio.ok(); this.fly("+1",""); audio.vibrate("light"); }
    else if (kind === "gold") { E.hits += 1; this.fb("金色星星!+2","+2",true); audio.ok(); this.fly("+2 ⭐","gold"); audio.vibrate("medium"); }
    else { this.fb("哎呀,是辣椒…","下次先停一停",false); audio.no(); this.fly("✗","no"); audio.vibrate("heavy"); }
    this.later(() => this.lightShow(), 450);
  },

  /* ══ 星星复现 simon ══ */
  startSimon() {
    this.setData({ pads: [false, false, false, false], simonMsg: "准备…", showRetry: false });
    this.simonRound();
  },
  simonRound() {
    const E = this.E, d = diff(this.G.age);
    const seq = Array.from({ length: E.len }, () => Math.floor(Math.random() * 4));
    E.seq = seq; E.pos = 0; E.locked = true;
    this.setData({ simonMsg: "第 " + (E.rounds + 1) + " 轮 · " + E.len + " 颗星 · 看好了…", showRetry: false, pads: [false, false, false, false] });
    seq.forEach((p, i) => {
      this.later(() => {
        const pads = [false, false, false, false];
        pads[p] = true;
        this.setData({ pads });
        audio.ok();
        this.later(() => this.setData({ pads: [false, false, false, false] }), 380);
      }, 600 + i * 620);
    });
    this.later(() => {
      E.locked = false;
      this.setData({ simonMsg: "到你了!按一样的顺序点", pads: [false, false, false, false] });
    }, 600 + seq.length * 620);
  },
  padTap(e) {
    const E = this.E;
    if (!E || E.mode !== "simon" || !E.seq || E.locked) return;
    const i = Number(e.currentTarget.dataset.i);
    const pads = [false, false, false, false];
    pads[i] = true;
    this.setData({ pads });
    audio.ok();
    this.later(() => this.setData({ pads: [false, false, false, false] }), 220);
    if (E.seq[E.pos] === i) {
      E.pos += 1; E.hits += 1; E.trials += 1;
      if (E.pos >= E.seq.length) {
        if (E.len < diff(this.G.age).simonMax) E.len += 1;
        this.roundDone("");
      }
    } else {
      E.trials += 1;
      const wrongStep = E.pos + 1, correctIdx = E.seq[E.pos];
      E.pos = 0; E.locked = true;
      audio.no();
      const pads2 = [false, false, false, false];
      pads2[correctIdx] = true;
      this.setData({ simonMsg: "第 " + wrongStep + " 颗点错啦,正确的是闪亮的那颗", pads: pads2, showRetry: true });
      this.later(() => this.setData({ pads: [false, false, false, false] }), 900);
    }
  },
  simonRetry() {
    if (!this.E || this.E.mode !== "simon") return;
    this.simonRound();
  },

  /* ══ 大小擂台 stroop ══ */
  startStroop() {
    const E = this.E, d = diff(this.G.age);
    E.trial = 0; E.rule = "meaning"; E.nextRule = d.ruleEvery;
    E.hp = 100; E.combo = 0; E.locked = false;
    E.opp = OPPONENTS[E.rounds % OPPONENTS.length];
    this.stroopNext();
  },
  stroopNext() {
    const E = this.E, d = diff(this.G.age);
    if (!E || E.mode !== "stroop") return;
    if (this.timeUp()) { this.endSession(false); return; }
    if (E.trial >= d.stroopTrials) { this.roundDone("这一局撑满了,也很棒!"); return; }
    let flip = false;
    if (E.trial > 0 && E.trial >= E.nextRule) {
      E.rule = E.rule === "meaning" ? "size" : "meaning";
      E.nextRule += d.ruleEvery;
      flip = true; audio.ok(); audio.vibrate("medium");
    }
    const word = Math.random() < 0.5 ? "大" : "小";
    const big = Math.random() < 0.5;
    E.q = { word, big };
    E.locked = false;
    this.setData({
      oppEmoji: E.opp[0], oppName: E.opp[1], hp: E.hp,
      ruleTxt: E.rule === "meaning" ? "🔵 按字的意思选(\"大\"字就点 大)" : "🟠 按字的个头选(字大就点 大)",
      isMeaning: E.rule === "meaning", flipBanner: flip,
      charText: word, charBig: big, combo: E.combo,
      fbText: flip ? "规则变啦,看仔细!" : "", fbSub: "", fbState: flip ? "ok" : "",
    });
    if (flip) this.later(() => this.setData({ flipBanner: false }), 1050);
  },
  stroopAnswer(e) {
    const E = this.E;
    if (!E || E.mode !== "stroop" || !E.q || E.locked) return;
    const v = e.currentTarget.dataset.v;
    E.trials += 1; E.trial += 1;
    const d = diff(this.G.age);
    const correct = E.rule === "meaning" ? v === E.q.word : (v === "大") === E.q.big;
    const hpStep = Math.max(4, Math.round(100 / Math.max(6, d.stroopTrials - 4)));
    if (correct) {
      E.hits += 1; E.combo += 1;
      E.hp = Math.max(0, E.hp - hpStep - (E.combo >= 5 ? 2 : 0));
      this.fb("对啦!", "继续!", true);
      audio.ok();
      if (E.combo === 5 || E.combo === 10 || E.combo === 15) {
        audio.star();
        audio.vibrate("light");
      }
    } else {
      if (E.combo >= 3) this.fly("🔥x" + E.combo + " 断了", "no");
      E.combo = 0;
      E.hp = Math.min(100, E.hp + 3);
      this.fb("反啦反啦!", "停一停,看规则", false);
      audio.no(); audio.vibrate("heavy");
      E.locked = true;
      this.later(() => this.stroopNext(), 450);
      if (E.hp <= 0) { this.roundDone("打败了" + E.opp[1] + "!"); return; }
      return;
    }
    if (E.hp <= 0) { this.roundDone("打败了" + E.opp[1] + "!"); return; }
    this.stroopNext();
  },

  /* ══ 通用 ══ */
  fb(text, sub, okFlag) {
    this.setData({ fbText: text, fbSub: sub || "", fbState: okFlag === true ? "ok" : okFlag === false ? "no" : "" });
  },
  fly(text, cls) {
    const id = "f" + Date.now() + Math.floor(Math.random() * 999);
    const items = this.data.flyItems.concat([{ id, text, cls: cls || "" }]);
    this.setData({ flyItems: items });
    this.later(() => {
      this.setData({ flyItems: this.data.flyItems.filter(x => x.id !== id) });
    }, 700);
  },
  startGame(mode) {
    if (mode === "light") this.startLight();
    else if (mode === "simon") this.startSimon();
    else if (mode === "stroop") this.startStroop();
  },
  roundDone(winTitle) {
    const E = this.E;
    E.rounds += 1;
    audio.win();
    this.stopTick();
    if (this.timeUp()) { this.endSession(false); return; }
    const title = winTitle || "第 " + E.rounds + " 轮完成!";
    this.setData({
      stage: "round", roundTitle: title,
      minsLeft: Math.max(0, Math.ceil((E.endsAt - Date.now()) / 60000)),
    });
  },
  playAgain() { // 与网页版一致:继续当前会话(序列长度、轮次延续),而非重置
    this.setData({ stage: "play" });
    this.startGame(this.E.mode); // 以引擎状态为准,而非可能过期的视图层mode
    this.startTick();
  },
  endEarly() { this.endSession(true); },
  endSession(early) {
    const E = this.E;
    if (!E) return;
    this.cleanupKeepEnd();
    let stars = E.rounds >= 1 ? 1 : 0;
    if (E.rounds >= 3) stars = 2;
    if (E.rounds >= 5) stars = 3;
    E.stars = stars;
    this.G.history.unshift({
      id: store.uid(), ts: Date.now(), game: E.mode, rounds: E.rounds,
      hits: E.hits, trials: E.trials, stars, mood: null, claimed: false,
    });
    this.G.history = this.G.history.slice(0, 20);
    this.G.stars += stars;
    store.saveGame(this.G);
    this.setData({
      stage: "end",
      endTitle: early ? "本次提前收工 · 一起做三次\"气球呼吸\"平静下来" : "时间到!一起做三次\"气球呼吸\"平静下来",
      endRounds: E.rounds, endStarN: stars,
      stars3: [0, 1, 2].map(i => i < stars),
      breathDone: false, balloonBig: false, brMsg: "跟着气球:吸气…屏住…呼气…",
      mood: "", claimed: false, claimW: 0,
      claimHint: "长按2.5秒,把星星存进家庭助手",
    });
    this.runBreath();
  },
  cleanupKeepEnd() {
    (this.cleanups || []).forEach(f => { try { f(); } catch (e) {} });
    this.cleanups = [];
    this.stopTick();
  },
  runBreath() {
    let i = 0;
    const one = () => {
      if (i >= 3) {
        this.setData({ brMsg: "平静下来啦,真了不起!", breathDone: true });
        audio.win();
        return;
      }
      this.setData({ brMsg: "第 " + (i + 1) + " 次:吸气…", balloonBig: true });
      this.later(() => {
        this.setData({ brMsg: "屏住…" });
        this.later(() => {
          this.setData({ brMsg: "呼气…", balloonBig: false });
          this.later(() => { i += 1; one(); }, 3900);
        }, 1200);
      }, 3800);
    };
    one();
  },
  skipBreath() {
    this.cleanupKeepEnd();
    this.setData({ breathDone: true, brMsg: "平静下来啦,真了不起!" });
  },
  pickMood(e) {
    const m = e.currentTarget.dataset.m;
    this.setData({ mood: m });
    if (this.G.history[0]) { this.G.history[0].mood = m; store.saveGame(this.G); }
  },

  /* 家长长按领星(触点不丢,移动不断) */
  claimStart() {
    if (this.data.claimed || this.claimT) return;
    const self = this;
    this.setData({ claimW: 100 });
    this.claimT = setTimeout(() => { self.claimT = null; self.doClaim(); }, 2500);
  },
  claimCancel() {
    if (!this.claimT) return;
    clearTimeout(this.claimT); this.claimT = null;
    this.setData({ claimW: 0 });
  },
  doClaim() {
    this.claimT = null;
    const h = this.G.history[0];
    if (!h || h.claimed) return;
    const SApp = store.loadApp();
    store.addBonus(SApp, h.stars, "专注力练习");
    h.claimed = true;
    this.G.claimed = (this.G.claimed || 0) + h.stars;
    store.saveGame(this.G);
    audio.win();
    this.setData({ claimed: true, claimW: 0 });
    wx.showToast({ title: "已领取 " + h.stars + " 颗星,去家庭助手看看!", icon: "none" });
  },
  goHub() { wx.navigateBack({ fail: () => wx.switchTab({ url: "/pages/games/games" }) }); },

  onShareAppMessage() { return { title: "专注力练习 · " + (GAME_NAMES[this.data.mode] || ""), path: "/pages/games/games" }; },
});
