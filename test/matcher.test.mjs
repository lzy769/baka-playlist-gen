// matcher 纯函数单元测试（不联网，只测比对逻辑）
import { test } from "node:test";
import assert from "node:assert/strict";
import { isVerified, core, norm } from "../src/matcher.mjs";

test("norm: 归一化字符串", () => {
  assert.equal(norm("Numb"), "numb");
  assert.equal(norm("The & All"), "the / all"); // `&` 归一化为 `/`
  assert.equal(norm("A (B)"), "a b");
});

test("core: 去掉版本后缀和括号", () => {
  assert.equal(core("Song (Original Mix)"), "Song");
  assert.equal(core("Song (Remix)"), "Song");
  assert.equal(core("Song - Extended"), "Song");
  assert.equal(core("Almost Easy"), "Almost Easy"); // 保留原大小写
});

test("isVerified: 歌名歌手匹配", () => {
  // 完全匹配
  assert.ok(isVerified({ name: "Numb", singer: "Linkin Park" }, "Numb", "Linkin Park"));
  // 版本后缀差异也接受
  assert.ok(isVerified({ name: "Wasted (Remix)", singer: "Strangerboi/Nightcore" }, "Wasted", "Strangerboi/Nightcore"));
  // 歌手名差异 → 不匹配
  assert.ok(!isVerified({ name: "Daze", singer: "We Are" }, "Daze", "acloudyskye"));
  // 空歌手时只校验歌名
  assert.ok(isVerified({ name: "晴天", singer: "" }, "晴天", ""));
});

test("校验容错: 括号注释差异", () => {
  // Excel 里的歌名可能带重复括号，QQ 返回的更简洁 → 应为匹配
  assert.ok(isVerified({ name: "ちっちゃな私 (小小的我)", singer: "重音テト" }, "ちっちゃな私 (小小的我) (小小的我)", "重音テト"));
});