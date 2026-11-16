/**
 * 语言检测分组
 *
 * 根据歌曲标题 / 歌手判断所属语言，供生成"按语言分类的歌单"。
 *
 * 分组规则：
 *  - 韩文  : 标题含韩文音节（가-힣）
 *  - 日文  : 标题含日文假名（平假名/片假名），或标题为汉字但歌手名含假名/命中日文歌手名单
 *  - 中文  : 标题含汉字（且不是上面的日文情形）
 *  - 英文  : 标题主体为拉丁字母
 *  - 其他  : 阿拉伯/俄文/数字/符号等
 *
 * 语言组可通过 CLI 的 `--langs` 参数配置启用哪些分组。
 */

// 常见日文歌手/艺人（用于判别"汉字歌名但实为日文歌"）
const DEFAULT_JP_ARTISTS = [
  "yorushika", "ヨルシカ", "vaundy", "mafumafu", "まふまふ", "aimer", "エメ",
  "sakanaction", "サカナクション", "yoasobi", "ヨアソビ", "radwimps", "ラッドウィンプス",
  "king gnu", "椎名林檎", "米津玄師", "yama", "milet", "澤野弘之", "さわの",
  "lisa", "ado", "one ok rock", "spyair", "スパイエアー", "linked horizon",
  "kikuo", "きくお", "eve", "yui", "ユイ", "superfly", "reol", "hige",
  "yuuri", "ゆーり", "ずっと真夜中", "ナナツカゼ", "wotaku", "大塚愛",
  "高橋洋子", "glay", "ayase", "sou", "4円", "chinozo", "jon",
].map((s) => s.trim().toLowerCase()).filter(Boolean);

const JP_KANA = /[\u3040-\u30ff]/;   // 平假名 + 片假名
const HAN = /[\u4e00-\u9fff]/;        // CJK 汉字
const KR = /[\uac00-\ud7af]/;         // 韩文音节

/**
 * 判断某歌手名是否为已知日文歌手（命中名单）。
 * @param {string} artist
 * @returns {boolean}
 */
export function isKnownJpArtist(artist) {
  const low = String(artist || "").toLowerCase();
  return DEFAULT_JP_ARTISTS.some((x) => low.includes(x));
}

/**
 * 检测单首歌曲所属语言。
 * @param {string} title  歌曲名
 * @param {string} artist 歌手名
 * @returns {'中文'|'日文'|'英文'|'韩文'|'其他'}
 */
export function detectLanguage(title, artist) {
  const t = String(title || "");
  const a = String(artist || "");

  if (KR.test(t)) return "韩文";
  if (JP_KANA.test(t)) return "日文";
  if (HAN.test(t)) {
    // 汉字标题：若歌手带假名或命中日文名单，判为日文
    if (JP_KANA.test(a) || isKnownJpArtist(a)) return "日文";
    return "中文";
  }
  // 拉丁字母主体 → 英文
  const stripped = t.replace(/[^A-Za-z\s]/g, "").trim();
  const len = t.replace(/\s/g, "").length || 1;
  if (stripped.length && stripped.length / len > 0.7) return "英文";
  return "其他";
}

/** 所有可用语言分组的稳定顺序。 */
export const LANGS = ["中文", "日文", "英文", "韩文", "其他"];

/**
 * 把歌曲数组按语言分组。
 * @param {Array<{title:string, artist:string, mid?:string}>} songs
 * @param {string[]} [enabledLangs] 需要启用的语言分组数组，默认全部
 * @returns {Record<string, Array<{title,artist,mid?}>>}
 */
export function groupByLanguage(songs, enabledLangs) {
  const enabled = new Set(enabledLangs && enabledLangs.length ? enabledLangs : LANGS);
  const groups = {};
  for (const lang of LANGS) groups[lang] = [];
  for (const song of songs || []) {
    const lang = detectLanguage(song.title, song.artist);
    if (enabled.has(lang)) groups[lang].push(song);
  }
  // 未启用的分组清空
  for (const lang of LANGS) if (!enabled.has(lang)) delete groups[lang];
  return groups;
}