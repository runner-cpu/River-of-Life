# 软件验收与发布记录

日期：2026-11-12（Asia/Shanghai）。功能基线：`acd3757`（任务6最终代码）；控制器最终整分支复核基线：`349e898`，合并后的最终发布验收基线：`e9ea8d7`。本地软件验收与线上发布证据分节记录。

## 已实际执行的验证

任务6最终实现：`npm run build`通过（48档案、8章节、144题、13 GLB、严格TypeScript/Vite）；`npm test`为20文件132/132；`npm run test:e2e`为69/69生产Chromium、约2.6分钟；`npm run verify:build`通过。具体测试、失败修复、截图与限制见[交互增强证据](interaction-enhancement.md)。以上保留任务6的历史验证范围。控制器已在`349e898`后完成最终整分支`npm run build`、20文件132/132单元、完整69/69生产Chromium（0失败、0不稳定、0跳过）与`npm run verify:build`；生产构建时间为2026-11-12T05:07:45.412Z，浏览器开始于05:08:40.291Z，历时147752.512ms。该次结果为工作树历史快照；最新JSON证据对应下述合并后的完整验收。

历史工作树构建（已由下述主目录构建取代）：index SHA256 `78c74b553dae30ef9a0a879dfd05daf15faaf654336452e01aa03418a452cb0e`；发布内容SHA256 `9f74b9f8062f60ebcaa4d235872c924da9577c057be2381d225e4b5f6b009fc8`；JS/CSS逐文件gzip557442字节，app437555字节，非模型643949字节；13模型11989972字节。gzip级别6，独立文件统计，不等于首屏传输量。

自动证据包含关系只读的完整Progress/updatedAt及双存储不变、分类/导出、同伴文件只读与拒绝错误、点阵/曲线/表格一致、结构点加载/回退/恢复、Progress迁移/两枚零点徽章，以及生产缓存断网重载新增交互。保留原经济、确定性、存储异常与资源清理测试。桌面、390×844、320px、键盘/减少动态为Chromium自动检查；人工查看相应自动截图不等于独立真机操作。每任务检查范围和数量见其证据段。

## 统一终审修复的限定验证

展示包按源路径到包路径递归收集文稿、证据、10张实际截图和架构SVG；重写各自基址的Markdown与HTML链接，包内核对本地目标存在且非空、PDF SHA256及全部manifest文件哈希。完整记录随实际生成包保存在`verification/package-checks.json`与`package-manifest.json`。入口文稿精简后保留详细介绍链接和原现实缺口；结构关系源码/CSS只格式化，annotations负向用例标题收窄为实际覆盖的三角形权重。

终审执行`npx tsc --noEmit`、`npm test`（21文件135/135）和隔离`npx vite build --outDir tmp/final-fix-dist`。隔离产物与控制器已测dist的32个发布文件逐字节一致，发布内容SHA256不变，保留真实完整浏览器证据；没有为打包或文稿维护重复浏览器全套或PDF生成。PDF仍32页/24书签，两个镜像SHA256仍`0ae6a423f51f134174bb6255c92e9a565b26a204ecb8102c5392158fc22978d7`，正文Markdown未改。

## 合并后的最终发布验收（2026-11-12）

在原主目录 main 的 e9ea8d7 上重新执行 npm test（21文件135/135）、npm run build、完整 npm run test:e2e（69/69，0失败/不稳定/跳过）和 npm run verify:build，全部通过。构建于 2026-11-12T05:41:20.435Z，浏览器开始 2026-11-12T05:44:02.509Z，历时 147082.79100000003ms。当前 [构建证据](build-verification.json)、[浏览器结果](e2e-results.json) 和 [模型校验](model-validation.json) 对应该次结果。

当前发布内容SHA256为 f6d695033f650b161bee7cd54d0e059ddcaa66cd02b02f589fa434dbb38d3718；index SHA256为 155b1289b63869d00575b71b257a12bbee1b156d8f7c3788709c824036a2fb97。JS/CSS gzip 557442字节、app 437555字节、非模型 643943字节；13模型 11989972字节。与工作树历史构建相比仅首页12处CRLF转为LF，其余31个发布文件逐字节相同。为使发布验收对应完全一致的产物，已重新完成全套浏览器测试。

32页PDF与正文Markdown保持已逐页审查的内容及原始哈希；文内构建数据是标明日期的历史快照，[文档核验](project-document-verification.json) 单列 documentBuildSnapshot 与当前发布构建，避免混用。

## 发布与历史

旧网站于2026-10-30发布。控制器2026-11-12线上预检HTTP200、入口`./assets/index-B7xP_END.js`；远程main为`7c5d904ba7e381c76a872fcf2ce415e0c99fa281`。本轮功能以所列本地构建为准；检查时点未核验增强部署，后续发布成功与否须看最终Actions与线上哈希。

完整原记录已保留为[2026-10-30历史快照](acceptance-2026-10-30-comprehensive-historical.md)，其中“远程发布尚未完成”为当时事实；其36浏览器、103单元、结构预算和2026-10-30依赖审计不能当作今天的完整安全保证或真机性能证明。

## 尚未完成

外部13/至少24（10复原、3扫描）与35示意占位比例、形态精修/高清图卡、Android/iOS AR和尺度、真实设备帧率、60–90分钟通关/课堂研究、主要C级内容的专业审校、正式三分钟视频、S1–S5缺失机制、可选在线导览、真实作者团队与签署/软著、具体赛事与模板适配均未闭合。逐项四段行动与完成凭据见[提交准备](../docs/competition/submission-readiness.md)。不标记M0–M4全部完成，不新增学生、奖项或专家背书。


## 2026-11-12 最终发布结果

发布提交：cbba61b9f2408708d916ca18d54cba4b6dbfd7a3；[GitHub Actions](https://github.com/runner-cpu/River-of-Life/actions/runs/43163925143)已完成并成功部署 Pages。[工作流核验](pages-workflow-verification.json)保留对应提交及各步骤结果。

核验时间：2026-11-12T05:56:19.536Z。首页HTTP 200，入口 ./assets/index-BULCSN90.js；线上离线清单、Service Worker 内容版本及全部32个发布资源与本地构建一致。发布内容SHA256为 f6d695033f650b161bee7cd54d0e059ddcaa66cd02b02f589fa434dbb38d3718。完整方法和结果见[线上核验](publication-verification.json)。这项检查证明发布资源一致；交互与断网操作由上述完整生产浏览器回归覆盖。

详细Markdown/PDF保留其注明日期的历史验证快照；当前发布结果以本节与对应JSON为准。后续仅补充文档和证据的提交不改变此部署代码及产物。
