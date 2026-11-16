// 语言检测单元测试（node:test）
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectLanguage, groupByLanguage, LANGS } from "../src/language-detect.mjs";

test("LANGS 顺序稳定", () => {
  assert.deepEqual(LANGS, ["中文", "日文", "英文", "韩文", "其他"]);
});

test("detectLanguage: 各种语言的判别", () => {
  // 中文
  assert.equal(detectLanguage("夜的第七章", "周杰伦"), "中文");
  assert.equal(detectLanguage("搁浅", "周杰伦"), "中文");
  // 日文：含假名
  assert.equal(detectLanguage("ミュージック", "砂の惑星"), "日文");
  assert.equal(detectLanguage("さくらんぼ", "大塚愛"), "日文");
  // 日文：汉字歌名 + 日文歌手
  assert.equal(detectLanguage("春泥棒", "ヨルシカ"), "日文");
  assert.equal(detectLanguage("怪物", "YOASOBI (ヨアソビ)"), "日文");
  // 英文
  assert.equal(detectLanguage("Numb", "Linkin Park"), "英文");
  assert.equal(detectLanguage("Shape of You", "Ed Sheeran"), "英文");
  // 韩文
  assert.equal(detectLanguage("Dynamite", "BTS"), "英文");
  assert.equal(detectLanguage("사랑을 했다", "IU"), "韩文");
  // 其他：纯数字/符号
  assert.equal(detectLanguage("123456", ""), "其他");
});

test("groupByLanguage: 按语言分组", () => {
  const songs = [
    { title: "夜的第七章", artist: "周杰伦" },
    { title: "さくらんぼ", artist: "大塚愛" },
    { title: "Numb", artist: "Linkin Park" },
    { title: "Dynamite", artist: "BTS" },
    { title: "사랑을 했다", artist: "IU" },
  ];
  const g = groupByLanguage(songs);
  assert.equal(g["中文"].length, 1);
  assert.equal(g["日文"].length, 1);
  assert.equal(g["英文"].length, 2); // Numb + Dynamite(歌名英文)
  assert.equal(g["韩文"].length, 1);
});

test("groupByLanguage: --langs 只启用指定分组", () => {
  const songs = [
    { title: "夜的第七章", artist: "周杰伦" },
    { title: "Numb", artist: "Linkin Park" },
  ];
  const g = groupByLanguage(songs, ["中文", "英文"]);
  assert.equal(g["中文"].length, 1);
  assert.equal(g["英文"].length, 1);
  assert.equal(g["日文"], undefined);
});

test("groupByLanguage: 相同 mid 去重", () => {
  const songs = [
    { title: "Numb", artist: "Linkin Park", mid: "aaa" },
    { title: "Numb", artist: "Linkin Park", mid: "aaa" }, // 重复 mid
    { title: "晴天", artist: "周杰伦", mid: "bbb" },
  ];
  const g = groupByLanguage(songs);
  assert.equal(g["英文"].length, 1); // Numb 只保留一条
  assert.equal(g["中文"].length, 1);
});