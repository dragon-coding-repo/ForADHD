// 音效(打包内wav)与震动
const store = require("./store.js");
const ctxs = {};

function muted() {
  try { const g = store.loadGame(); return !!g.muted; } catch (e) { return false; }
}
function setMuted(m) {
  const g = store.loadGame();
  g.muted = !!m;
  store.saveGame(g);
}
function isMuted() { return muted(); }

function play(name) {
  if (muted()) return;
  try {
    if (!ctxs[name]) {
      const c = wx.createInnerAudioContext();
      c.src = "/assets/audio/" + name + ".wav";
      c.obeyMuteSwitch = false;
      ctxs[name] = c;
    }
    const c = ctxs[name];
    c.stop();
    c.play();
  } catch (e) {}
}
const ok = () => play("ok");
const no = () => play("no");
const win = () => play("win");
const star = () => play("star");

function vibrate(type) {
  try {
    if (type === "long") wx.vibrateLong({});
    else wx.vibrateShort({ type: type || "light" });
  } catch (e) {}
}

module.exports = { ok, no, win, star, vibrate, setMuted, isMuted };
