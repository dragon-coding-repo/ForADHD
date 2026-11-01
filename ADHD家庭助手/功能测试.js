// Functional test for ADHD家庭助手 via jsdom (no real browser available in this env)
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

async function main() {

const APP = "/home/ubuntu/adhd_build/app";
const html = fs.readFileSync(path.join(APP, "index.html"), "utf-8");
const dataJs = fs.readFileSync(path.join(APP, "app_data.js"), "utf-8");

let pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ FAIL: " + name + (extra ? " | " + extra : "")); }
}

function boot(storage) {
  // inline app_data.js so jsdom (runScripts:dangerously) executes everything like a real browser
  const html2 = html.replace('<script src="app_data.js"></script>', "<script>" + dataJs + "</script>");
  const dom = new JSDOM(html2, {
    url: "http://localhost:8734/index.html",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.scrollTo = () => {};
      if (storage) for (const [k, v] of Object.entries(storage)) window.localStorage.setItem(k, v);
    },
  });
  return dom.window;
}
const q = (w, sel) => w.document.querySelector(sel);
const qa = (w, sel) => [...w.document.querySelectorAll(sel)];

console.log("── 1. 首次启动:今日页 ──");
let w = boot();
T("余额卡片显示0颗星", q(w, ".balance .num").textContent.trim().startsWith("0"));
T("种子目标2个", qa(w, "#v-home .row").filter(r => r.querySelector(".star")).length === 2);
T("作息表7行", qa(w, "#v-home .srow").length === 7);
T("导航5项", qa(w, "nav .ni").length === 5);

console.log("── 2. 星星打卡计分 ──");
qa(w, "#v-home .star")[0].click();
T("点星后余额为1", q(w, ".balance .num").textContent.trim().startsWith("1"));
T("星星点亮", qa(w, "#v-home .star.on").length === 1);
T("今日目标1/2", q(w, ".balance .split").textContent.includes("1/2"));
qa(w, "#v-home .star")[0].click();
T("再点取消,回0", q(w, ".balance .num").textContent.trim().startsWith("0"));

console.log("── 3. 打卡页周视图 ──");
w.nav("checkin");
T("周网格:2目标行", qa(w, "#v-checkin .grid tr").length >= 3);
T("奖励菜单5项", qa(w, "#v-checkin .rrow").length === 5);
const redeemBtns = qa(w, "#v-checkin .rrow .btn.sm");
T("0星时兑换按钮全部禁用", redeemBtns.every(b => b.disabled));
qa(w, "#v-home .star") && w.nav("home");
qa(w, "#v-home .star")[0].click(); // +1 → 1
qa(w, "#v-home .star")[1].click(); // +1 → 2
w.nav("checkin");
T("周合计显示2", [...qa(w, "#v-checkin .grid .sum")].some(el => el.textContent === "2"));
const btn10 = qa(w, "#v-checkin .rrow").find(r => r.textContent.includes("10"));
btn10.querySelector(".btn.sm").click();
T("兑换10星奖励(余额2)被拒", btn10.querySelector(".name").className.indexOf("done") === -1);

console.log("── 4. 快速记录:行为 ──");
w.nav("log");
const chips = sel => qa(w, "#v-log .chip").filter(c => c.textContent === sel);
chips("作业")[0].click();
chips("走神发呆")[0].click();
chips("提醒后完成")[0].click();
q(w, "#bNote").value = "应用题环节";
q(w, "#bNote").dispatchEvent(new w.Event("input"));
w.saveBehavior();
T("行为已保存并出现在历史", q(w, "#v-log").textContent.includes("走神发呆"));
T("标签显示为待改善(红)", q(w, "#v-log .tag.neg") !== null);
T("备注已保存", q(w, "#v-log").textContent.includes("应用题环节"));
w.saveBehavior();
T("空行为不能保存(仍1条)", w.eval("S.behavior.length") === 1);

console.log("── 5. 用药记录 ──");
w.eval("logTab='med';renderLog()");
q(w, "#mDrug").value = "哌甲酯 10mg";
qa(w, "#mApp .chip")[2].click(); // 差
w.saveMed();
T("用药记录已保存", w.eval("S.meds.length") === 1 && w.eval("S.meds[0].drug") === "哌甲酯 10mg");
T("药名被记住(下次默认)", w.eval("S.medLast.drug") === "哌甲酯 10mg");
T("历史显示食欲:差", q(w, "#v-log").textContent.includes("食欲:差"));

console.log("── 6. 手册阅读器 ──");
w.nav("book");
const chRows = qa(w, "#v-book .chlist .row");
T("章节列表9章", chRows.length === 9);
chRows[1].click();
T("第一章标题渲染", q(w, "#v-book .reader .h1").textContent.includes("认识ADHD"));
T("表格渲染(th)", qa(w, "#v-book .reader th").length > 0);
w.openChapter(0);
T("提示框渲染(写在前面)", q(w, "#v-book .reader .tip") !== null);

console.log("── 7. 更多:课堂+求助+章节统计 ──");
w.nav("more");
T("热线12356显示", q(w, "#v-more .hot .num").textContent === "12356");
T("课堂17页要点(除封面)", qa(w, "#v-more .slide").length === 17);

console.log("── 8. 计时器 ──");
w.openTimer();
w.tPreset(10);
T("10分钟预设", q(w, "#tNum").textContent === "10:00");
w.tToggle();
T("计时启动", q(w, "#tToggle").textContent === "暂停");
w.tReset();
T("重置回10:00", q(w, "#tNum").textContent === "10:00");
w.tToggle();
await new Promise(r => setTimeout(r, 1300));
T("倒计时在走(9:5x)", /9:5\d/.test(q(w, "#tNum").textContent), q(w, "#tNum").textContent);
w.tReset(); w.closeTimer();

console.log("── 8.5 兑换成功扣分 ──");
w.eval("S.checks[weekKey()]={[S.goals[0].id]:[1,1,1,1,1,1,1],[S.goals[1].id]:[1,1,1,1,1,0,0]};save();render()");
w.nav("checkin");
T("攒到12星", w.eval("balance()") === 12);
const r10 = qa(w, "#v-checkin .rrow").find(r => r.textContent.includes("10"));
r10.querySelector(".btn.sm").click();
T("兑换后余额=2", w.eval("balance()") === 2);
T("兑换记录已生成", w.eval("S.redemptions.length") === 1);
const r10b = qa(w, "#v-checkin .rrow").find(r => r.textContent.includes("10"));
T("奖励标记为已兑换", r10b.querySelector(".name").className.indexOf("done") >= 0);

console.log("── 9. localStorage 持久化(模拟重启) ──");
const saved = w.localStorage.getItem("adhd_app_v1");
T("状态已写入localStorage", !!saved && w.eval("S.behavior.length") === 1);
const w2 = boot({ "adhd_app_v1": saved });
T("重启后余额=2", q(w2, ".balance .num").textContent.trim().startsWith("2"));
T("重启后行为记录还在", w2.eval("S.behavior.length") === 1);
T("重启后用药记录还在", w2.eval("S.meds.length") === 1);
w2.nav("checkin");
T("重启后兑换记录存在", q(w2, "#v-checkin").textContent.includes("兑换记录"));

console.log("── 10. 作息打卡与进度 ──");
w2.nav("home");
qa(w2, "#v-home .ck")[0].click();
qa(w2, "#v-home .ck")[1].click();
T("2/7完成进度", q(w2, "#v-home").textContent.includes("完成 2/7"));
const saved2 = w2.localStorage.getItem("adhd_app_v1");
const w3 = boot({ "adhd_app_v1": saved2 });
T("作息勾选跨重启保持", q(w3, "#v-home").textContent.includes("完成 2/7"));

console.log("── 11. XSS防护 ──");
w3.nav("checkin");
q(w3, "#newGoal").value = '<img src=x onerror="window.__xss=1">';
w3.addGoal();
w3.nav("home");
T("目标名被转义(脚本未执行)", !w3.__xss);

console.log("── 12. 导出/清空 ──");
T("resetAll需两次确认(jsdom跳过交互)", typeof w3.resetAll === "function");
T("importData存在", typeof w3.importData === "function");
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
}
main();
