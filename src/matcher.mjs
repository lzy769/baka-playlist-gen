/**
 * QQ 音乐匹配器（核心）
 *
 * 把"歌名 + 歌手"映射到 QQ 音乐的歌曲 mid，并做【严格二次校验】，
 * 确保 mid 对应的真实歌曲与期待的歌名/歌手一致，杜绝"歌名和歌曲不对版"。
 *
 * 流程：
 *  1. 用 QQ 带签名搜索接口，按 `歌名 歌手` 搜候选（8 条）
 *  2. 对每个候选 mid，调 CgiGetTrackInfo 查其真实歌名/歌手
 *  3. 只有真实歌名 + 歌手都匹配才采纳
 *  4. 全部不匹配 → 标记为"未匹配"，绝不硬配
 *
 * 注意：本模块只做匹配逻辑，播放接口另见 templates 中的 getMediaSource。
 */

import { createHash } from "node:crypto";

// ---- QQ 搜索接口常量（复用聚合源协议） ----
const P1 = [23, 14, 6, 36, 16, 40, 7, 19];
const P2 = [16, 1, 32, 12, 19, 27, 8, 5];
const SV = [89, 39, 179, 150, 218, 82, 58, 252, 177, 52, 186, 123, 120, 64, 242, 133, 143, 161, 121, 179];

const sha1 = (t) => createHash("sha1").update(t).digest("hex").toUpperCase();
const b64u = (b) => Buffer.from(b).toString("base64").replace(/[/+=]/g, "");
function zzcSign(text) {
  const h = sha1(text);
  return `zzc${P1.map((i) => h[i]).join("")}${b64u(SV.map((v, i) => v ^ parseInt(h.slice(i * 2, i * 2 + 2), 16)))}${P2.map((i) => h[i]).join("")}`.toLowerCase();
}
function getSearchId() {
  let g = "";
  for (let i = 0; i < 32; i += 1) g += Math.floor(Math.random() * 16).toString(16);
  return g.toUpperCase() + String(Math.floor(Math.random() * 100000)).padStart(5, "0");
}

const SEARCH_BODY = {
  comm: {
    _channelid: "0", _os_version: "6.2.9200-2", ct: "19", cv: "2151",
    guid: "1F70E520B2EAA7D25E11760783C53CA9", patch: "118",
    psrf_access_token_expiresAt: 0, psrf_qqaccess_token: "", psrf_qqopenid: "",
    psrf_qqunionid: "", tmeAppID: "qqmusic", tmeLoginType: 0, uin: "0",
    wid: "7223299733393904640",
  },
  "music.search.SearchCgiService": {
    module: "music.search.SearchCgiService",
    method: "DoSearchForQQMusicDesktop",
    param: { grp: 1, num_per_page: 8, page_num: 1, remoteplace: "txt.newclient.top", search_type: 0 },
  },
};

/**
 * 搜索 QQ 音乐，返回候选歌曲数组。
 * @param {string} query
 * @param {number} [retries=4]
 * @returns {Promise<Array<{mid:string, name:string, singer:string}>>}
 */
async function searchQQ(query, retries = 4) {
  const body = JSON.parse(JSON.stringify(SEARCH_BODY));
  const searchCgi = body["music.search.SearchCgiService"];
  searchCgi.param.query = query;
  searchCgi.param.searchid = getSearchId();

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const sign = zzcSign(JSON.stringify(body));
      const res = await fetch(`https://u.y.qq.com/cgi-bin/musics.fcg?sign=${sign}`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json", "User-Agent": "QQMusic 14090508(android 12)" },
      });
      const json = await res.json();
      const req = json["music.search.SearchCgiService"] ?? json.req;
      const data = req?.data;
      if (!data || !data.body) return [];
      const list = data.body?.song?.list ?? data.body?.item_song ?? [];
      return list.map((s) => ({
        mid: s.mid,
        name: s.name,
        singer: (s.singer || []).map((x) => x.name).join("/"),
      }));
    } catch {
      if (attempt === retries - 1) return [];
      await sleep(1500 + attempt * 800);
    }
  }
  return [];
}

/**
 * 用 CgiGetTrackInfo 按 mid 查真实歌名 + 歌手。
 * @param {string} mid
 * @returns {Promise<{name:string, singer:string}|null>}
 */
async function getRealByMid(mid) {
  const data = {
    comm: { ct: "19", cv: "1859", uin: "0" },
    req: {
      module: "music.trackInfo.UniformRuleCtrl",
      method: "CgiGetTrackInfo",
      param: { types: [1], ids: [], mids: [mid], ctx: 0 },
    },
  };
  try {
    const res = await fetch("https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&data=" + encodeURIComponent(JSON.stringify(data)), {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://y.qq.com" },
    });
    const json = await res.json();
    const track = json.req?.data?.tracks?.[0];
    if (!track) return null;
    return { name: track.name, singer: (track.singer || []).map((s) => s.name).join("/") };
  } catch {
    return null;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 字符串归一化，用于比较。 */
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&/g, "/")
    .replace(/\s*(ft\.|feat\.)\s*/gi, "/")
    .replace(/[()[\]]/g, " ")
    .replace(/[《》「」]/g, " ")
    .replace(/[/]+/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

/** 去掉歌名常见后缀（版本/remix/live/括号注释等），便于同名比对。 */
function core(s) {
  return s
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/(-|–|—)?\s*(remix|live|version|mix|reloaded|extended|edit|explicit).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 校验 mid 对应的真实歌曲是否与期待的歌名/歌手匹配。
 * @param {{name:string, singer:string}} track 真实的歌
 * @param {string} title 期待的歌名
 * @param {string} artist 期待的歌手
 */
function isVerified(track, title, artist) {
  const tn = norm(track.name);
  const ta = norm(track.singer);
  const n = norm(title);
  const a = norm(artist);
  if (!tn) return false;
  const cn = core(tn);
  const ct = core(n);
  const nameOk = Boolean(cn && ct && (cn === ct || cn.includes(ct) || ct.includes(cn) || tn.includes(ct)));
  let artistOk = true;
  if (a) {
    const as = a.split("/").map((x) => x.trim().toLowerCase());
    const ts = ta.split("/").map((x) => x.trim().toLowerCase());
    artistOk = as.some((ap) => ts.some((tp) => tp.includes(ap) || ap.includes(tp)));
  }
  return nameOk && artistOk;
}

/**
 * 为单首歌曲匹配 QQ mid（带严格校验）。
 * @param {{title:string, artist:string}} song
 * @param {object} [opts] { intervalMs, concurrency }
 * @returns {Promise<{mid:string|null, verified:boolean, realName?:string, realArtist?:string}>}
 */
export async function matchSong(song, opts = {}) {
  const { title, artist } = song;
  const intervalMs = opts.intervalMs ?? 0;
  try {
    let list = await searchQQ(`${title} ${artist}`);
    if (!list.length) list = await searchQQ(title);
    for (const s of list) {
      const real = await getRealByMid(s.mid);
      if (real && isVerified({ name: real.name, singer: real.singer }, title, artist)) {
        if (intervalMs) await sleep(intervalMs);
        return { mid: s.mid, verified: true, realName: real.name, realArtist: real.singer };
      }
    }
    return { mid: null, verified: false, realName: null, realArtist: null };
  } catch {
    return { mid: null, verified: false, realName: null, realArtist: null };
  }
}

/**
 * 批量匹配歌曲列表（并发受控，支持断点续跑）。
 * @param {Array<{title:string, artist:string}>} songs
 * @param {object} [opts] { concurrency, intervalMs, onProgress }
 * @returns {Promise<Array<{title,artist,mid}|{title,artist,mid:null}>>}
 */
export async function matchSongs(songs, opts = {}) {
  const concurrency = opts.concurrency ?? 3;
  const intervalMs = opts.intervalMs ?? 120;
  const results = new Array(songs.length);
  let cursor = 0;
  let verified = 0;

  const worker = async () => {
    while (cursor < songs.length) {
      const idx = cursor;
      cursor += 1;
      const r = await matchSong(songs[idx], { intervalMs });
      results[idx] = { title: songs[idx].title, artist: songs[idx].artist, ...r };
      if (r.verified) verified += 1;
      if (opts.onProgress && ((idx + 1) % 20 === 0 || idx === songs.length - 1)) {
        opts.onProgress({ done: idx + 1, total: songs.length, verified });
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

// ---- 纯函数导出（便于单元测试 / 复用，不联网） ----
export { isVerified, core, norm };