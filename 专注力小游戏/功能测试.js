// 功能测试:专注力小游戏(jsdom) — 含与ADHD家庭助手的领星打通
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const GAME_HTML = fs.readFileSync("/home/ubuntu/adhd_build/game/index.html", "utf-8");
const APP_HTML = fs.readFileSync("/home/ubuntu/adhd_build/app/index.html", "utf-8");
const APP_DATA = fs.readFileSync("/home/ubuntu/adhd_build/app/app_data.js", "utf-8");

let pass = 0, fail = 0;
const T = (n, c, x) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.log("  ✗ FAIL: " + n + (x ? " | " + x : "")); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function bootGame(storage) {
  const dom = new JSDOM(GAME_HTML, {
    url: "http://localhost:8734/game/index.html",
    runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(w) { w.scrollTo = () => {};
      if (storage) for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v); },
  });
  return dom.window;
}
function bootApp(storage) {
  const html = APP_HTML.replace('<script src="app_data.js"></script>', "<script>" + APP_DATA + "</script>");
  const dom = new JSDOM(html, {
    url: "http://localhost:8734/app/index.html",
    runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(w) { w.scrollTo = () => {};
      if (storage) for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v); },
  });
  return dom.window;
}
const qa = (w, s) => [...w.document.querySelectorAll(s)];
const q = (w, s) => w.document.querySelector(s);

const waitFor = async (w, fn, timeout = 9000) => { const t0 = Date.now();
  while (Date.now() - t0 < timeout) { try { if (fn()) return true; } catch (e) {} await sleep(60); } return false; };

(async () => {
  console.log("── 1. 大厅 ──");
  let w = bootGame();
  T("三个游戏卡片", qa(w, ".gcard").length === 3);
  T("累计星星显示0", q(w, ".starrail .big").textContent.includes("0"));
  T("默认适龄7-9", w.eval("G.age") === "7-9");
  T("家长园地入口存在", q(w, "#v-hub").textContent.includes("家长园地"));

  console.log("── 2. 适龄参数 ──");
  w.setAge("4-6");
  T("4-6岁刺激时长1700ms", w.eval("diff().stim") === 1700);
  T("4-6岁默认时长5分钟", w.eval("G.sessionMin") === 5);
  w.setAge("10-12");
  T("10-12岁simon起始3", w.eval("diff().simonStart") === 3);
  w.setAge("7-9");

  console.log("── 3. 红绿灯(go/no-go) ──");
  w.eval("G.sessionMin=10;save()"); // 统一时长
  w.eval("Math.random=()=>0.1"); // 先固定随机数,保证开局必为好水果(否则38%概率开局是辣椒/金星)
  w.nav2("light");
  T("刺激卡已出现", await waitFor(w, () => { const c = q(w, "#stim"); return c && c.dataset.kind; }));
  const h0 = w.eval("S.hits"), t0 = w.eval("S.trials"), s0 = w.eval("S.__shows||0");
  q(w, "#stim").dispatchEvent(new w.Event("pointerdown")); // 此时 show 计数已≥1,刺激全新
  T("pointerdown 即点即中(+1)", w.eval("S.hits") === h0 + 1);
  T("点击有即时的视觉反馈(+1飘字)", q(w, "#stage .fly") !== null && q(w, "#stage .fly").textContent === "+1");
  T("点击有弹跳+波纹动画", q(w, "#stim").className.includes("hitpop") && q(w, "#stim").className.includes("flash-good"));
  T("点中后出现下一个刺激", await waitFor(w, () => w.eval("(S.__shows||0)") >= s0 + 1)); // +450ms 翻牌
  const tMid = w.eval("S.trials");
  await sleep(1100); // 跨过旧到期定时器的残留窗口(修复前:新刺激会在此时被吃掉)
  T("点中后的下一个刺激不被残留定时器吃掉", w.eval("S.trials") === tMid && q(w, "#stim").dataset.done !== "1");
  w.eval("Math.random=()=>0.7"); // 强制 bad 辣椒
  const sBad = w.eval("S.__shows||0");
  T("辣椒出现", await waitFor(w, () => w.eval("(S.__shows||0)") >= sBad + 1 && q(w, "#stim").dataset.kind === "bad"));
  const tBeforeBad = w.eval("S.trials"); // 中间可能有刺激到期(溜走),以实时值为准
  q(w, "#stim").click(); // click 兜底路径
  T("点辣椒:不得分但计一次尝试", w.eval("S.hits") === h0 + 1 && w.eval("S.trials") === tBeforeBad + 1);
  T("反馈提示先停一停", q(w, "#fb").textContent.includes("停一停"));
  T("忍住不点:到时消失算成功 +1", await waitFor(w, () => w.eval("S.hits") === h0 + 2));
  w.eval("S.trials=14");
  T("15次尝试触发一轮完成", await waitFor(w, () => w.eval("S.rounds") === 1));
  w.endSession(true);
  T("会话结束进入收工页", q(w, "#v-end").classList.contains("on"));
  T("历史记录已写入", w.eval("G.history.length") === 1);
  T("星星已累计", w.eval("G.stars") >= 1);
  const starsEarned = w.eval("G.history[0].stars");

  console.log("── 4. 呼吸收工仪式 ──");
  T("气球呼吸进行中", q(w, "#balloon") !== null && q(w, "#endCard").classList.contains("hide"));
  w.finishEnd();
  T("跳过后结果卡可见", !q(w, "#endCard").classList.contains("hide"));
  T("显示赢得的星星", q(w, "#s3").querySelectorAll(".on").length === starsEarned);
  const moods = qa(w, ".mood");
  moods[0].click();
  T("心情已记录", w.eval("G.history[0].mood") === "开心");

  console.log("── 5. 领星门禁(无家庭助手时) ──");
  T("提示先打开家庭助手", q(w, "#claimWrap").textContent.includes("先打开一次"));
  w.claim();
  T("无法领取(仍0)", w.eval("G.claimed") === 0 && w.eval("G.history[0].claimed") !== true);

  console.log("── 6. 领星打通(同源localStorage → 家庭助手钱包) ──");
  const appSeed = { v:1, goals:[{id:"g1",name:"测试目标"}], rewards:[], redemptions:[], checks:{}, schedule:[], scheduleChecks:{}, behavior:[], meds:[] };
  w.localStorage.setItem("adhd_app_v1", JSON.stringify(appSeed));
  w.renderClaim();
  T("长按按钮出现", q(w, "#claimBtn") !== null);
  w.claim();
  const appAfter = JSON.parse(w.localStorage.getItem("adhd_app_v1"));
  T("bonusStars已写入家庭助手", (appAfter.bonusStars || []).length === 1 && appAfter.bonusStars[0].amount === starsEarned);
  T("本局标记已领取", w.eval("G.history[0].claimed") === true && w.eval("G.claimed") === starsEarned);
  w.claim();
  T("重复领取被拒绝", (JSON.parse(w.localStorage.getItem("adhd_app_v1")).bonusStars || []).length === 1);

  console.log("── 7. 主App识别游戏奖励 ──");
  const appKey = w.localStorage.getItem("adhd_app_v1");
  const aw = bootApp({ "adhd_app_v1": appKey });
  const bal = parseInt(q(aw, ".balance .num").textContent, 10);
  T("家庭助手余额包含游戏星星", bal === starsEarned, "balance=" + bal);
  T("余额明细显示'游戏奖励'", q(aw, ".balance .split").textContent.includes("游戏奖励"));

  console.log("── 8. 星星复现(确认制 + 防误触) ──");
  w.toHub();
  w.nav2("simon");
  T("第一轮演示开始即锁定输入", await waitFor(w, () => w.eval("S.__locked") === true));
  const tr0 = w.eval("S.trials"), pos0 = w.eval("S.__pos");
  qa(w, "#pads .pad")[0].click(); // 模拟:演示期间孩子乱点
  T("演示期间的点按全部无效", w.eval("S.__locked") === true && w.eval("S.trials") === tr0 && w.eval("S.__pos") === pos0);
  T("演示结束提示'到你了'", await waitFor(w, () => q(w, "#smsg") && q(w, "#smsg").textContent.includes("到你了")));
  T("到你了后解锁", w.eval("S.__locked") === false);
  const seq = w.eval("S.__seq");
  seq.forEach((p, i) => setTimeout(() => qa(w, "#pads .pad")[p].click(), i * 60));
  T("按序完成,轮次+1", await waitFor(w, () => w.eval("S.rounds") === 1));
  T("序列长度增长", await waitFor(w, () => w.eval("G.__len") === 3));
  T("完成屏出现(需点'再来一轮'确认,不自动续)", await waitFor(w, () => q(w, "#stage").textContent.includes("再来一轮")));
  qa(w, "#stage .btn").find(b => b.textContent === "再来一轮").click(); // 用户确认开始下一轮
  T("新序列3颗且演示中锁定", await waitFor(w, () => { const s = w.eval("S.__seq"); return s && s.length === 3 && w.eval("S.__locked") === true; }));
  T("新序列演示完提示'到你了'", await waitFor(w, () => q(w, "#smsg") && q(w, "#smsg").textContent.includes("到你了")));
  const seq2 = w.eval("S.__seq");
  qa(w, "#pads .pad")[(seq2[0] + 1) % 4].click(); // 故意点错
  T("点错提示'第1颗点错啦'", await waitFor(w, () => q(w, "#smsg").textContent.includes("点错啦")));
  T("点错出现'再试一次'按钮", await waitFor(w, () => q(w, "#simonctl") && q(w, "#simonctl").textContent.includes("再试一次")));
  T("点错后锁定,不自动重播", w.eval("S.__locked") === true);
  await sleep(1000);
  T("1秒后仍在等确认(无自动重播)", q(w, "#simonctl").textContent.includes("再试一次"));
  q(w, "#simonctl .btn").click(); // 用户确认重试
  T("再试一次:重新演示并锁定", await waitFor(w, () => w.eval("S.__locked") === true));
  T("再次'到你了'", await waitFor(w, () => q(w, "#smsg") && q(w, "#smsg").textContent.includes("到你了")));
  w.endSession(true);

  console.log("── 9. 大小擂台(stroop,擂台战) ──");
  w.toHub();
  w.nav2("stroop");
  T("擂主与血条出现", q(w, "#oppHp") !== null && q(w, "#oppEmoji") !== null);
  T("规则徽章出现", q(w, "#ruleline").textContent.includes("意思") || q(w, "#ruleline").textContent.includes("个头"));
  const rule = w.eval("S.__rule"), word = w.eval("S.__q.word"), big = w.eval("S.__q.big");
  const correct = rule === "meaning" ? word : ((big) ? "大" : "小");
  const hp0 = w.eval("S.__hp"), h1 = w.eval("S.hits");
  w.stroopAnswer(correct);
  T("按规则答对:得分+1且擂主掉血", w.eval("S.hits") === h1 + 1 && w.eval("S.__hp") < hp0);
  const wrongV = correct === "大" ? "小" : "大";
  w.stroopAnswer(wrongV);
  T("答错:连击清零,进入消化停顿", w.eval("S.__combo") === 0 && w.eval("S.__locked") === true && w.eval("S.trials") >= 2);
  T("答错后擂主回血且血量不超上限", w.eval("S.__hp") > hp0 - 20 && w.eval("S.__hp") <= 100);
  await waitFor(w, () => w.eval("S.__locked") !== true); // 等停顿结束
  const c1 = w.eval("S.__q.word"), b1 = w.eval("S.__q.big");
  w.stroopAnswer(w.eval("S.__rule") === "meaning" ? c1 : (b1 ? "大" : "小"));
  const c2 = w.eval("S.__q.word"), b2v = w.eval("S.__q.big");
  w.stroopAnswer(w.eval("S.__rule") === "meaning" ? c2 : (b2v ? "大" : "小"));
  T("连对2次显示连击指示", q(w, "#comboLine").textContent.includes("x2"));
  // 强制触发规则翻转
  w.eval(`S.__trial=diff().ruleEvery-1`);
  const ruleBefore = w.eval("S.__rule");
  const q2 = w.eval("S.__q.word"), b2 = w.eval("S.__q.big");
  const correct2 = ruleBefore === "meaning" ? q2 : (b2 ? "大" : "小");
  w.stroopAnswer(correct2);
  T("规则发生翻转", w.eval("S.__rule") !== ruleBefore);
  T("翻转横幅'规则变啦'出现", q(w, "#flipBanner") !== null);
  T("每轮擂主不同(轮换)", w.eval("OPPONENTS.length") === 5);
  // KO:打到残血,答对即胜
  w.eval("S.__hp=1");
  const q3 = w.eval("S.__q.word"), b3 = w.eval("S.__q.big");
  const correct3 = w.eval("S.__rule") === "meaning" ? q3 : (b3 ? "大" : "小");
  w.stroopAnswer(correct3);
  T("打败擂主触发一轮完成(需确认)", await waitFor(w, () => q(w, "#stage").textContent.includes("打败了")));
  w.endSession(true);

  console.log("── 9.5 长按领星:进度条抗移动 ──");
  w.finishEnd(); // 跳过呼吸,进入结算
  T("长按按钮出现", await waitFor(w, () => q(w, "#claimBtn") !== null));
  const cbtn = q(w, "#claimBtn");
  cbtn.dispatchEvent(new w.Event("pointerdown", { bubbles: true }));
  await sleep(200);
  T("按住后进度开始计时", w.eval("claimT !== null"));
  cbtn.dispatchEvent(new w.Event("pointermove", { bubbles: true })); // 模拟手指轻微滑动
  await sleep(300);
  cbtn.dispatchEvent(new w.Event("pointermove", { bubbles: true }));
  await sleep(300);
  T("手指移动后仍在计时(不跳掉)", w.eval("claimT !== null"));
  cbtn.dispatchEvent(new w.Event("pointerup", { bubbles: true })); // 松手
  await sleep(150);
  T("松手后取消且未误领", w.eval("claimT === null") && q(w, "#cring").style.width === "0%" && w.eval("G.history[0].claimed") !== true);

  console.log("── 10. 会话限时与家长页 ──");
  w.setMin(5);
  w.toHub(); w.nav2("stroop");
  const leftMs = w.eval("S.endsAt - Date.now()");
  T("5分钟会话限时生效", leftMs > 280000 && leftMs <= 300000, String(leftMs));
  w.endSession(true);
  w.navParent();
  T("家长页说明'不是治疗'", q(w, "#v-parent").textContent.includes("不是治疗"));
  T("家长页有最近记录", q(w, "#v-parent").textContent.includes("最近记录"));
  T("家长页正确率统计", q(w, "#v-parent").textContent.includes("平均正确率"));

  console.log("── 11. 持久化(模拟重启) ──");
  const saved = w.localStorage.getItem("adhd_game_v1");
  const w2 = bootGame({ "adhd_game_v1": saved, "adhd_app_v1": appKey });
  T("重启后星星与历史保留", w2.eval("G.stars") === w.eval("G.stars") && w2.eval("G.history.length") === w.eval("G.history.length"));
  T("重启后已领取标记保留", w2.eval("G.history.some(x=>x.claimed)") === true);
  w2.render ? null : null;
  T("大厅渲染正常", qa(w2, ".gcard").length === 3);

  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("测试崩溃:", e); process.exit(2); });
