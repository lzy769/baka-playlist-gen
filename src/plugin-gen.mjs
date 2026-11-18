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
 * @param {string} [cfg.cover]       歌单封面：图片 URL 或 data: URL（在"推荐歌单"卡片显示）
 * @param {Array<{mid:string,title:string,artist:string}>} cfg.songs
 * @param {object} [cfg.override]    透传给插件的元数据覆盖（如 platform/author/version）
 * @returns {string} 插件源码
 */
export function renderPlugin(cfg) {
  const {
    lang,
    sheetId = `local-${lang}`,
    sheetTitle,
    cover,
    songs,
    trigger = "local://import",
    override = {},
  } = cfg;

  const platform = override.platform || `${lang}歌单`;
  const author = override.author || "baka-playlist-gen";
  const version = override.version || "1.0.0";
  const description = override.description || `${lang}歌曲，共 ${songs.length} 首`;

  const coverJson = JSON.stringify(cover || "");

  // 歌曲数据内嵌为 JSON 数组（artwork 若已预取则一并写入，列表可直接显示封面）
  const songsJson = JSON.stringify(
    songs.map((s) => {
      const item = { mid: s.mid, title: s.title, artist: s.artist };
      if (s.artwork) item.artwork = s.artwork;
      if (s.album) item.album = s.album;
      return item;
    }),
  );

  return `"use strict";
/* eslint-disable */
// 本文件由 baka-playlist-gen 自动生成，请勿手改
// 使用说明见项目 README

const axiosModule = require("axios");
const axios = axiosModule.default || axiosModule;

/** 内嵌歌曲数据（mid ↔ 歌名/歌手已严格校验） */
const SONGS = ${songsJson};

/** 歌单封面（"推荐歌单"卡片展示），可为图片 URL 或 data: URL，留空则自动取歌单里第一首有封面的歌 */
const SHEET_COVER = ${coverJson};

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
  const item = {
    id: mid, mid: mid, songmid: mid,
    platform: ${JSON.stringify(platform)},
    title: song.title || "", artist: song.artist || "",
    album: song.album || "", duration: 0, qualities: {},
  };
  // 预取过封面时直接带上，列表无需点击即可显示专辑图
  if (song.artwork) item.artwork = song.artwork;
  return item;
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
      return { isEnd: true, sheetItem: { id: ${JSON.stringify(sheetId)}, title: sheet.title, artist: sheet.artist, artwork: sheet.artwork, worksNum: sheet.musicList.length }, musicList: sheet.musicList };
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

  // 播放时按 mid 从 QQ 拉取真实信息（歌名/歌手/专辑/封面 artwork）
  async getMusicInfo(musicBase) {
    const base = { ...musicBase, platform: ${JSON.stringify(platform)} };
    const mid = musicBase.mid || musicBase.songmid || musicBase.id;
    // 已有封面就直接返回
    if (!mid || (base.artwork && base.title)) return base;
    const track = await fetchTrackByMid(mid);
    if (!track) return base;
    return {
      ...base,
      id: mid, mid, songmid: mid,
      title: track.name || base.title,
      artist: track.singer ? (Array.isArray(track.singer) ? track.singer.map((s) => s.name).join(", ") : track.singer) : base.artist,
      album: track.album || base.album,
      artwork: track.artwork || base.artwork,
      duration: track.duration || base.duration,
    };
  },

  // 播放时按 mid 从 QQ 拉取歌词（legacy 接口 + base64 解码，返回明文 LRC）
  async getLyric(musicItem) {
    try {
      const mid = musicItem.mid || musicItem.songmid || musicItem.id;
      if (!mid) return null;
      const url = \`https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=\${mid}&pcachetime=\${Date.now()}\`;
      const res = await axios.get(url, { headers: { Referer: "https://y.qq.com", "user-agent": "Mozilla/5.0" } });
      const text = String(res.data || "");
      // 去掉 JSONP 包裹（如 MusicJsonCallback(...) / jsonCallback(...)）
      const inner = text.replace(/^[^(]*\\(/, "").replace(/\\)\\s*$/, "").trim();
      const json = JSON.parse(inner);
      const b64 = json && json.lyric;
      if (!b64) return null;
      const buf = Buffer.from(b64, "base64");
      const rawLrc = buf.toString("utf-8");
      if (!rawLrc) return null;
      const result = { rawLrc };
      if (json.trans) {
        // trans 也是 base64
        try { result.translation = Buffer.from(json.trans, "base64").toString("utf-8"); } catch (_) {}
      }
      return result;
    } catch (_) { return null; }
  },
};

function buildSheet() {
  const musicList = SONGS.map(toMediaItem);
  // 封面：自定义 SHEET_COVER 优先，否则取歌单里第一首有 artwork 的歌曲封面
  let artwork = SHEET_COVER;
  if (!artwork) {
    const withCover = musicList.find((m) => m.artwork);
    if (withCover && withCover.artwork) artwork = withCover.artwork;
  }
  return {
    id: ${JSON.stringify(sheetId)},
    platform: ${JSON.stringify(platform)},
    title: ${JSON.stringify(sheetTitle)},
    artist: "本地导入",
    description: ${JSON.stringify(description)},
    artwork,
    worksNum: musicList.length,
    isImported: true,
    musicList,
  };
}

// 用 QQ mid 反查歌曲真实信息（songID / 歌名 / 歌手 / 封面）。
async function fetchTrackByMid(mid) {
  try {
    const data = {
      comm: { ct: "19", cv: "1859", uin: "0" },
      req: { module: "music.trackInfo.UniformRuleCtrl", method: "CgiGetTrackInfo",
        param: { types: [1], ids: [], mids: [mid], ctx: 0 } },
    };
    const res = await axios.get("https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&data=" + encodeURIComponent(JSON.stringify(data)), {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://y.qq.com" },
    });
    const t = res.data?.req?.data?.tracks?.[0];
    if (!t) return null;
    const album = t.album || {};
    const singers = (t.singer || []).map((s) => ({ name: s.name, mid: s.mid }));
    const artwork = album.pmid
      ? \`https://y.gtimg.cn/music/photo_new/T002R300x300M000\${album.pmid}.jpg\`
      : (album.mid ? \`https://y.gtimg.cn/music/photo_new/T002R300x300M000\${album.mid}.jpg\` : "");
    return { songid: t.id, name: t.name, singer: singers, album: album.name, artwork, duration: t.interval };
  } catch (_) { return null; }
}
`;
}

/**
 * 将语言分组结果写入 dist 目录，生成对应插件文件。
 * @param {Record<string, Array<{mid,title,artist}>>} groups
 * @param {object} [opts] { outDir, langMeta, trigger }
 * @returns {string[]} 生成的插件文件路径
 */
/**
 * 批量预取封面（QQ CgiGetTrackInfo，一次最多 100 首）。
 *
 * 关键点：批量请求时 `types` 数组长度必须与 `mids` 一致，否则接口返回空数组。
 * 返回 Map<mid, { artwork, album, artist }>，查不到的 mid 不在 Map 中。
 *
 * @param {string[]} mids
 * @param {object} [opts] { batchSize, intervalMs, onProgress }
 * @returns {Promise<Map<string, {artwork?:string, album?:string, name?:string}>>}
 */
export async function prefetchCovers(mids, opts = {}) {
  const batchSize = opts.batchSize ?? 100;
  const intervalMs = opts.intervalMs ?? 120;
  const list = [...new Set((mids || []).filter(Boolean))];
  const result = new Map();

  for (let i = 0; i < list.length; i += batchSize) {
    const batch = list.slice(i, i + batchSize);
    const payload = {
      comm: { ct: "19", cv: "1859", uin: "0" },
      req: {
        module: "music.trackInfo.UniformRuleCtrl",
        method: "CgiGetTrackInfo",
        // types 必须与 mids 等长，否则接口不返回数据
        param: { types: batch.map(() => 1), ids: [], mids: batch, ctx: 0 },
      },
    };
    try {
      const res = await fetch(
        "https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&data=" + encodeURIComponent(JSON.stringify(payload)),
        { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://y.qq.com" } },
      );
      const json = await res.json();
      for (const t of json.req?.data?.tracks || []) {
        const album = t.album || {};
        const pmid = album.pmid || album.mid;
        const entry = { album: album.name || "" };
        if (pmid) entry.artwork = `https://y.gtimg.cn/music/photo_new/T002R300x300M000${pmid}.jpg`;
        const singer = (t.singer || []).map((s) => s.name).filter(Boolean).join("/");
        if (singer) entry.artist = singer;
        if (t.mid) result.set(t.mid, entry);
      }
    } catch {
      // 该批失败不影响整体，后续歌曲仍会有动态封面兜底
    }
    if (opts.onProgress) opts.onProgress({ done: Math.min(i + batchSize, list.length), total: list.length });
    if (i + batchSize < list.length) await new Promise((r) => setTimeout(r, intervalMs));
  }
  return result;
}

/**
 * 给分组数据补上封面（原地返回新对象，不修改入参）。
 * @param {Record<string, Array<{mid,title,artist}>>} groups
 * @param {Map} covers prefetchCovers 的返回值
 */
export function attachCovers(groups, covers) {
  const out = {};
  for (const [lang, songs] of Object.entries(groups)) {
    out[lang] = (songs || []).map((s) => {
      const c = covers.get(s.mid);
      if (!c) return s;
      return { ...s, artwork: c.artwork, album: c.album || s.album };
    });
  }
  return out;
}

export function generatePlugins(groups, opts = {}) {
  const outDir = opts.outDir || path.join(ROOT, "dist");
  const trigger = opts.trigger || "local://import";
  const written = [];
  for (const [lang, songs] of Object.entries(groups)) {
    if (!songs || !songs.length) continue;
    const sheetTitle = opts.sheetTitleFor
      ? opts.sheetTitleFor(lang, songs.length)
      : `${lang}歌单${songs.length}首`;
    // 支持自定义歌单封面：coverFor(lang, songs.length) 返回封面 URL/dataURL，也可为整体 opts.cover 固定封面
    const cover = typeof opts.coverFor === "function"
      ? opts.coverFor(lang, songs.length)
      : (opts.cover || "");
    const code = renderPlugin({
      lang,
      sheetId: `local-${lang}`,
      sheetTitle,
      songs,
      cover,
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