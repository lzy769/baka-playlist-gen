# Templates

本目录存放 BakaMusic 插件的生成模板 / 参考。

实际的插件文件由 `src/plugin-gen.js` 从分组结果动态渲染生成（见 `dist/`），
模板段主要是文档参考。

## 插件能力约定

生成出的每个插件（一个语言一个文件）提供：

- `importMusicSheet(urlLike)` : 输入触发码（默认 `local://import`）即可导入完整歌单
- `getRecommendSheetTags()` : 暴露到「推荐歌单」的标签
- `getRecommendSheetsByTag(tag, page)` : 返回该语言歌单
- `getMusicSheetInfo(sheet, page)` : 歌单分页
- `getMediaSource(item, quality)` : 用 QQ mid 解析真实播放 URL
- `getMusicInfo(base)` : 补全歌曲信息

## 播放接口注意

默认的播放解析走第三方聚合接口 `tang.api.s01s.cn`（对应 QQ 音源）。
该接口为社区维护、可能失效或被限流，且涉及版权合规风险。
如需更换为自己的解析逻辑，可修改 `plugin-gen.js` 中的
`requestMusicUrl` 实现。