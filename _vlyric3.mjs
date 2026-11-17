const mid = "004Ba7Yf4S1glA";
// legacy 接口 + base64 解码
const res = await fetch(`https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${mid}&pcachetime=${Date.now()}`, { headers: { Referer: "https://y.qq.com", "user-agent": "Mozilla/5.0" } });
const j = await res.json();
const b64 = j.lyric;
if (b64) {
  const buf = Buffer.from(b64, "base64");
  const lrc = buf.toString("utf-8");
  console.log("解码后歌词前300字:\n", lrc.slice(0,300));
} else { console.log("无 lyric 字段, 完整响应:", JSON.stringify(j).slice(0,300)); }
