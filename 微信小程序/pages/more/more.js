const store = require("../../utils/store.js");
const audio = require("../../utils/audio.js");

Page({
  data: { muted: false },

  onShow() { this.setData({ muted: audio.isMuted() }); },

  toggleMute() {
    const m = !audio.isMuted();
    audio.setMuted(m);
    this.setData({ muted: m });
    wx.showToast({ title: m ? "已静音" : "声音已开启", icon: "none" });
  },
  callHotline() { wx.makePhoneCall({ phoneNumber: "12356", fail: () => {} }); },
  goParent() { wx.navigateTo({ url: "/pages/parent/parent" }); },

  resetAll() {
    wx.showModal({
      title: "清空全部数据",
      content: "确定清空打卡、记录与练习数据?此操作不可恢复(建议先在手机上截图保存需要的记录)。",
      success: r1 => {
        if (!r1.confirm) return;
        wx.showModal({
          title: "再次确认",
          content: "真的要清空全部数据吗?",
          success: r2 => {
            if (!r2.confirm) return;
            try {
              wx.removeStorageSync(store.APPKEY);
              wx.removeStorageSync(store.GKEY);
            } catch (e) {}
            this.S = store.loadApp();
            this.G = store.loadGame();
            wx.showToast({ title: "已清空", icon: "none" });
          },
        });
      },
    });
  },

  onShareAppMessage() { return { title: "ADHD家庭助手 · 让每一天更可预期", path: "/pages/today/today" }; },
});
