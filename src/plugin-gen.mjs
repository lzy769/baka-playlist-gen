/**
 * BakaMusic 插件生成器
 *
 * 读取语言分组后的歌曲数据，渲染出可直接放入 BakaMusic
 * `bakamusic-plugins` 目录的单文件插件（CommonJS）。
 *
 * 每个插件实现：
 *  - importMusicSheet : 输入约定的触发码即可导入完整歌单
 *  - getRecommendSheetTags / getRecommendSheetsByTag : 出现在"推荐歌单"
 *  - getMusicSheetInfo : 歌单分页
 *  - getMediaSource    : 播放（使用指定的解析函数）
 *  - getMusicInfo      : 补全信息
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

/**
 * 生成单个语言歌单插件。
 * @param {object} cfg
 * @param {string} cfg.lang          语言名，如 "中文"
 * @param {string} cfg.sheetId       歌单 id（默认 local-<lang>）
 * @param {string} cfg.sheetTitle    歌单标题，如 "中文歌单394首"
 * @param {Array<{mid:string,title:string,artist:string}>} cfg.songs
 * @param {object} [cfg.override]    透传给插件的元数据覆盖（如 platform/author/version）
 * @returns {string} 插件源码
 */
export function renderPlugin(cfg) {
  const {
    lang,
    sheetId = `local-${lang}`,
    sheetTitle,
    songs,
    trigger = "local://import",
    override = {},
  } = cfg;

  const platform = override.platform || `${lang}歌单`;
  const author = override.author || "baka-playlist-gen";
  const version = override.version || "1.0.0";
  const description = override.description || `${lang}歌曲，共 ${songs.length} 首`;

  // 歌曲数据内嵌为 JSON 数组
  const songsJson = JSON.stringify(songs.map((s) => ({ mid: s.mid, title: s.title, artist: s.artist })));

  return `"use strict";
/* eslint-disable */
// 本文件由 baka-playlist-gen 自动生成，请勿手改
// 使用说明见项目 README

const axiosModule = require("axios");
const axios = axiosModule.default || axiosModule;

/** 内嵌歌曲数据（mid ↔ 歌名/歌手已严格校验） */
const SONGS = ${songsJson};

/** 播放解析（多源按序回退，见 src/player-provider.mjs 的设计） */
async function resolvePlayerSource(songMid, quality) {
  const FIELDS = { "128k": "song_play_url_standard", "320k": "song_play_url_hq", "flac": "song_play_url_sq" };
  const mid = String(songMid || "");
  if (!mid) return null;
  // 可扩展：在这里追加更多 provider（按序回退）。默认用 QQ 聚合源。
  const providers = [
    async () => {
      const field = FIELDS[quality] || FIELDS["128k"];
      const res = await axios.get("https://tang.api.s01s.cn/music_open_api.php", { params: { mid }, timeout: 10000 });
      const json = res.data;
      let u = json && json[field];
      if (typeof u !== "string" || !/^https?:\\/\\/\\S+$/i.test(u.trim())) {
        for (const q of ["128k", "320k", "flac"]) {
          const v = json && json[FIELDS[q]];
          if (typeof v === "string" && /^https?:\\/\\//i.test(v.trim())) { u = v.trim(); break; }
        }
      }
      return u && u.trim().startsWith("http") ? { url: u.trim() } : null;
    },
  ];
  for (const p of providers) {
    try {
      const r = await p();
      if (r && r.url) return r;
    } catch (_) { /* 单个源失败，继续下一个 */ }
  }
  return null;
}

function toMediaItem(song) {
  const mid = String(song.mid || song.songmid || song.id || "");
  return {
    id: mid, mid: mid, songmid: mid,
    platform: ${JSON.stringify(platform)},
    title: song.title || "", artist: song.artist || "",
    album: "", duration: 0, qualities: {},
  };
}

module.exports = {
  platform: ${JSON.stringify(platform)},
  author: ${JSON.stringify(author)},
  version: ${JSON.stringify(version)},
  appVersion: ">0.1.0-alpha.0",
  srcUrl: "",
  primaryKey: ["id"],
  supportedQualities: ["128k", "320k", "flac"],
  supportedSearchType: ["music"],
  defaultSearchType: "music",

  async importMusicSheet(urlLike) {
    const s = String(urlLike || "").trim().toLowerCase();
    if (["${trigger}", "local://all", "localall"].includes(s)) {
      return buildSheet();
    }
    return null;
  },

  async getRecommendSheetTags() {
    return { pinned: [{ title: ${JSON.stringify(sheetTitle)}, id: ${JSON.stringify(sheetId)} }], data: [] };
  },
  async getRecommendSheetsByTag(tag, page) {
    if (!tag || !String(tag.id || "").includes(${JSON.stringify(sheetId)})) return { isEnd: true, data: [] };
    const sheet = buildSheet();
    return { isEnd: true, data: [{ ...sheet, musicList: sheet.musicList }] };
  },
  async getMusicSheetInfo(sheetItem, page) {
    if (sheetItem && String(sheetItem.id || "").includes(${JSON.stringify(sheetId)})) {
      const sheet = buildSheet();
      return { isEnd: true, sheetItem: { id: ${JSON.stringify(sheetId)}, title: sheet.title, artist: sheet.artist, worksNum: sheet.musicList.length }, musicList: sheet.musicList };
    }
    return { isEnd: true, musicList: [] };
  },

  async getMediaSource(musicItem, quality) {
    const mid = musicItem.mid || musicItem.songmid || musicItem.id;
    if (!mid) throw new Error("缺少歌曲 ID");
    const res = await resolvePlayerSource(mid, quality || "128k");
    if (res && res.url) { const r = { url: res.url }; if (res.quality) r.quality = res.quality; return r; }
    return null;
  },

  async getMusicInfo(musicBase) {
    return { ...musicBase, platform: ${JSON.stringify(platform)} };
  },
};

function buildSheet() {
  const musicList = SONGS.map(toMediaItem);
  return {
    id: ${JSON.stringify(sheetId)},
    platform: ${JSON.stringify(platform)},
    title: ${JSON.stringify(sheetTitle)},
    artist: "本地导入",
    description: ${JSON.stringify(description)},
    worksNum: musicList.length,
    isImported: true,
    musicList,
  };
}
`;
}

/**
 * 将语言分组结果写入 dist 目录，生成对应插件文件。
 * @param {Record<string, Array<{mid,title,artist}>>} groups
 * @param {object} [opts] { outDir, langMeta, trigger }
 * @returns {string[]} 生成的插件文件路径
 */
export function generatePlugins(groups, opts = {}) {
  const outDir = opts.outDir || path.join(ROOT, "dist");
  const trigger = opts.trigger || "local://import";
  const written = [];
  for (const [lang, songs] of Object.entries(groups)) {
    if (!songs || !songs.length) continue;
    const sheetTitle = opts.sheetTitleFor
      ? opts.sheetTitleFor(lang, songs.length)
      : `${lang}歌单${songs.length}首`;
    const code = renderPlugin({
      lang,
      sheetId: `local-${lang}`,
      sheetTitle,
      songs,
      trigger,
    });
    const file = path.join(outDir, `local-playlist-${lang}.js`);
    writeFileSync(file, code, "utf-8");
    written.push(file);
  }
  return written;
}

export { path as pathUtils };

/** 读取内置模板目录路径（供文档/参考）。 */
export function templatePath(name) {
  return path.join(ROOT, "templates", name);
}

/** 读插件模板源（用于文档展示）。 */
export function readTemplate(name) {
  return readFileSync(templatePath(name), "utf-8");
}