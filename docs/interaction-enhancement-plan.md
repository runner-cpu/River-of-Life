# 交互性与可视化增强实施计划

计划日期：2026-11-02。确认日期：2026-11-12。状态：用户已回复“按计划执行”，按任务1至7连续实施。

## 1 依据与当前基线

需求依据为本次用户附件《生命长河交互性与可视化增强》，按任务1至7依次执行。已阅读README、原设计规格、交付状态、验收记录、learning-sources、模型清单、CREDITS和AI_USAGE，并检查content、core、modes、scene的主要导出及相关测试。

- 当前提交：7c5d904；工作区保留上一轮26页项目介绍及其附属文档修改，不能丢弃或混入首个功能提交。
- 2026年11月2日重新运行npm test：13个文件、103项通过。浏览器36项通过来自2026年10月30日的历史记录，实施后重新执行。
- 内容：8章、48档案、144题，13个外部模型；三个重点探究已有带核对范围的机构资料。
- 已有Progress版本为1，localStorage与IndexedDB双存储；领域逻辑集中在GameStore。
- 已有InquirySession为临时状态，导出是HTML打印记录，目前没有探究JSON导入协议。
- compareEnvironments已输出第0至30代频率；足以构建固定位置的比例点阵，无需增加随机调用。
- Vite构建插件自动枚举dist资源生成离线清单；新增本地模块随构建进入现有缓存流程。

## 2 实现原则与必要取舍

1. **不新增运行时依赖。** 使用TypeScript、原生DOM/SVG及已有Three.js、model-viewer。保留静态站点架构，不增加后台、账号、云同步、在线语言模型或运行时外部请求。
2. **关系视图真正只读。** 当前showSpecimen会调用observe，尺寸比较也可能记进度。增加明确的只读展台选项，关系视图及其展台不触发观察、收藏、阅读、奖励或徽章写入。
3. **年代只维护一份。** 从chapters和species字段派生节点、范围与参照句；采用明确标注的压缩时间轴，不使用附件中仅作示例的年代数字。注明不是完整系统发生树。
4. **归类不判分。** 四类连线只表示使用者对自己原始判断的归类。来源说明与科学参考解释保留，归类没有正确/错误色或自动能力分。
5. **导出协议与存档分开。** 保留HTML记录原有栏目，新增独立归类栏目及JSON记录。旧版单选依据在新流程中未作答时明确标为未记录，不伪造答案。探究文件由独立验证器处理，不能交给Progress验证器误认成存档。
6. **点阵表示数量。** 取值1的点数为round(frequency × population)，剩余点数为取值0；注明是频率的数量示意，固定点位不代表跨代追踪同一个体。
7. **热点按表现形式配置。** 扫描、复原和程序化示意使用对应定位；热点明确为近似教学观察位置，不声称精确解剖标定。缺少依据时只提出观察问题，不增加科学结论。
8. **本轮选择两个行为徽章。** 实现“保留判断”和“复现意识”，只记录发生过的操作，不评估科学能力；不改变演化点。归类、解释和同伴原文仍留在临时会话，只有相应徽章状态进入Progress。
9. **存档迁移与数据库版本分开。** Progress升级为2，保留现有存储位置，v1验证后迁移，不因更名存储键造成旧记录消失；旧记录不推算补发新徽章。

## 3 任务1 P1 纪元与档案关系视图

显示压缩时间轴、8个可展开纪元和48个档案。节点依据实际年代定位，标尺有MYA刻度、明确范围和两条由数据计算的参照句。桌面可切换图形/列表，320px默认列表，所有档案均能进入只读展台。关闭展台返回原节点或列表项。

| 文件 | 操作与职责 |
| --- | --- |
| src/content/relationships.ts | 新增，由现有章节与档案生成关系视图数据，不重复维护年代。 |
| src/core/relationships.ts | 新增，时间变换、范围、参照句和展开状态的纯函数。 |
| src/modes/relationships.ts | 新增，SVG时间视图、等价分组列表和节点详情。 |
| src/modes/relationships.css | 新增，桌面、390px与320px布局及减少动态样式。 |
| src/core/types.ts | 扩展Mode类型，不增加持久化字段。 |
| src/main.ts | 接入导航、路由与只读展台入口。 |
| src/modes/specimen.ts | 增加只读配置，阻止浏览关系视图时写入GameStore。 |
| src/modes/help.ts | 增加关系视图使用入口与组织方式说明。 |
| tests/relationships.test.ts | 新增，8章48档案完整性、时间转换、范围与展开逻辑。 |
| tests/e2e/relationships.spec.ts | 新增，节点与列表、展台返回焦点、只读、窄屏和键盘路径。 |

依赖：无新增。离线：仅本地模块，纳入现有构建清单。导入兼容：不改变Progress。额外检查当前章节边界与跨章档案的显示，不隐藏越界年代，也不暗示同地同时共存。

## 4 任务2 P1 证据归类与关系反馈

三组主题提供带sourceRef与scope的证据卡片。点选/键盘目标按钮为完整路径，桌面拖放作为增强。允许待归类状态；完成四区归类后生成只读SVG关系图，同时提供文字等价内容。焦点移到关系图标题，可回到归类修改并保留解释。

| 文件 | 操作与职责 |
| --- | --- |
| src/content/inquiries.ts | 为三组主题补充有稳定ID的证据卡，引用现有来源与核对范围。 |
| src/content/learning-sources.ts | 补齐来源引用类型与映射；只有核对后的新来源才追加登记。 |
| src/core/inquiry.ts | 扩展临时归类状态、阶段转移、修改与完整性检查。 |
| src/core/inquiry-record.ts | 新增，可打印记录的数据快照与独立版本JSON序列化，供任务5复用。 |
| src/modes/inquiry.ts | 实现卡片归类、关系反馈、修改入口、解释计数与两种导出。 |
| src/modes/inquiry-graph.ts | 新增，只读取归类的SVG关系图与文字替代内容。 |
| src/learning.css | 更新证据卡、四区、图形、手机单列与非颜色反馈。 |
| tests/inquiry.test.ts | 保留阶段保护、错误路径与输出转义目的，更新被新流程取代的单选操作。 |
| tests/inquiry-record.test.ts | 新增，独立记录序列化、栏目兼容、来源与解释完整性。 |
| tests/e2e/inquiry-classification.spec.ts | 新增，完整归类、键盘、图标题焦点、修改与导出。 |
| tests/e2e/learning.spec.ts | 将旧依据单选操作换成归类，保留三主题、文字路线、导出与存档隔离断言。 |
| tests/e2e/museum.spec.ts | 更新离线探究用例的依据步骤，继续验证断网完成活动。 |

依赖：无新增。离线：证据和关系图完全本地。导入兼容：个人存档不变；HTML保留原有栏目，独立添加归类数据，不将旧字段伪装成新的评分。

## 5 任务3 P2 对照实验个体池

为两组各显示固定100点的比例示意，纹理与文字区分基因0/1。默认对照初始第0代与终点第30代，世代控件同步当前点阵、曲线标记、表格行和文字摘要；第0代明确没有上一代，其他世代与前一代比较。修改输入后所有结果仍绑定原运行并共同提示需重跑。

| 文件 | 操作与职责 |
| --- | --- |
| src/core/population-view.ts | 新增，从已有频率行计算整数点数、世代选择和差值文案。 |
| src/modes/population-view.ts | 新增，SVG点阵、文字摘要、初始与当前世代显示。 |
| src/modes/lab-comparison.ts | 接入世代控件、曲线和表格同步、旧结果提示。 |
| src/learning.css | 增加点阵、图例与窄屏纵排，不新增渲染循环。 |
| tests/population-view.test.ts | 新增，点数总和、频率一致性、边界与世代变化。 |
| tests/lab-comparison.test.ts | 保留固定种子、同环境一致性与CSV结构断言。 |
| tests/e2e/population-view.spec.ts | 新增，键盘换代、同步、旧结果、320px与减少动态。 |

依赖：无新增。离线：纯计算与SVG。兼容：compareEnvironments返回结构、随机调用、频率与CSV字段均不改动。

## 6 任务4 P2 展台结构标注

优先为始祖鸟、沧龙与提塔利克鱼配置每档3至5个观察点。开关默认关闭，无数据时禁用并解释原因。热点可聚焦，展开名称、说明、来源与scope，Esc优先关闭热点说明。模型失败后的程序化示意继续使用对应热点；完全无法显示3D时保留等价文字观察点。

| 文件 | 操作与职责 |
| --- | --- |
| src/content/annotations.ts | 新增，三个重点档案的来源范围、近似定位与表现形式配置。 |
| src/core/annotations.ts | 新增，热点数量、引用、scope、坐标与表现形式校验。 |
| src/modes/specimen-annotations.ts | 新增，开关、热点说明、稳定键盘顺序与清理。 |
| src/modes/specimen.ts | 将标注层接入外部模型、加载恢复和示意回退。 |
| src/scene/life-scene.ts | 让SpecimenStage提供已有渲染周期内的投影更新，不新建循环。 |
| src/modes/specimen-annotations.css | 新增，热点、说明层、窄屏与减少动态样式。 |
| src/content/learning-sources.ts | 复用或补齐经核对的来源，严禁用一个scope支持无关断言。 |
| tests/annotations.test.ts | 新增，内容校验和坐标有效性。 |
| tests/e2e/annotations.spec.ts | 新增，三档案开关、键盘、Esc、模型失败回退与无数据提示。 |

依赖：无新增。离线：数据随代码发布。兼容：标注不改变收藏或观察奖励；关系视图只读展台保持无副作用。人工核对扫描、复原、示意分别对应的热点位置和遮挡。

## 7 任务5 P2 同伴记录只读比较

结束页提供JSON导出/导入。仅接受同一主题、已完成且版本受支持的记录；导入失败不替换当前会话。并排显示两方原始判断、四区归类和解释，并列出具体差异；小屏上下排列。不推断谁正确，也不统计协作得分。

| 文件 | 操作与职责 |
| --- | --- |
| src/core/inquiry-record.ts | 扩展独立记录验证：类型、版本、主题、卡片ID、归类、长度与来源引用。 |
| src/core/inquiry-comparison.ts | 新增，生成只读差异记录，不合并两人内容。 |
| src/modes/inquiry-comparison.ts | 新增，导入错误、并排/纵排展示与文字差异。 |
| src/modes/inquiry.ts | 接入同伴文件入口与当前记录快照。 |
| src/learning.css | 增加双栏比较和小屏单列。 |
| tests/inquiry-record.test.ts | 补充非法、过大、错误主题、旧版本、未知卡片与可执行文本。 |
| tests/inquiry-comparison.test.ts | 新增，同类与不同归类的比较结果及输入不可变性。 |
| tests/e2e/inquiry-comparison.spec.ts | 新增，导出后导入、真实文件往返与失败不覆盖当前活动。 |

依赖：无新增。离线：文件本地读写。兼容：旧HTML继续可阅读，但不能作为同伴JSON导入，显示具体原因；不是将旧HTML错误解析成新结构。

## 8 任务6 P3 行为徽章与存档迁移

先实现两项：“保留判断”为至少一张证据进入需要更多信息且完成记录导出；“复现意识”为完成一次对照后换种子重跑，并为该次运行保存非空备注。只记录发生过的行为，不宣称探究质量已达标；重复操作不重复发放，不产生演化点。

| 文件 | 操作与职责 |
| --- | --- |
| src/content/inquiry-badges.ts | 新增，两个稳定ID、条件与中性展示文案。 |
| src/core/inquiry-badges.ts | 新增，依据已完成的新操作判断资格，避免从历史进度反推。 |
| src/core/types.ts | Progress升级到2，声明行为徽章需要的最小状态。 |
| src/core/store.ts | v1验证后迁移、v2校验、唯一徽章写入及旧记录保护。 |
| src/modes/inquiry.ts | 在导出动作完成后通知徽章逻辑，不保存解释或归类原文。 |
| src/modes/lab-comparison.ts | 增加绑定运行的备注与换种子重跑记录。 |
| src/modes/lab-view.ts | 连接徽章回调并保持实时实验既有行为。 |
| src/main.ts | 将个人徽章回调接入正常使用路径，隔离课堂、演示与只读视图。 |
| src/learning.css | 备注区及中性徽章反馈布局。 |
| tests/inquiry-badges.test.ts | 新增，每条条件、负例、重复触发与临时预览隔离。 |
| tests/store.test.ts | 新增v1迁移、v2往返、不补发、不改点数与账目一致性测试。 |
| tests/e2e/inquiry-badges.spec.ts | 新增，每个徽章一条真实操作路径及刷新后的唯一记录。 |
| tests/e2e/learning.spec.ts | 徽章触发时改为验证只新增允许的徽章状态，个人收藏/点数/章节仍不变。 |
| docs/delivery-status.md | 记录Progress迁移、旧存储位置、无追溯与零点数奖励规则。 |

依赖：无新增。离线：徽章与迁移完全本地。兼容：保留原存储键和IndexedDB对象仓库；不把Progress版本提升误作数据库结构升级。旧测试“version=2不支持”需改为真正不支持的未来版本，同时新增v1迁移覆盖，不能直接删断言。

## 9 任务7 展示材料与边界说明

逐条将缺口组织为“已有证据—尚缺什么—最小行动—完成凭据”。保留外部模型数量与形态、AR真机、性能、课堂研究、科学审校、正式视频、署名声明、具体赛事适配和可选能力等原有事项。历史验收中远程未发布的表述保留为当时快照，并明确当前已上线。

| 文件 | 操作与职责 |
| --- | --- |
| docs/competition/submission-readiness.md | 按四段结构重组全部提交条件和最小行动。 |
| docs/competition/project-introduction.md | 对齐新增功能与已验证边界，避免过度宣称。 |
| docs/competition/demo-and-defense.md | 更新演示路径和答辩，包含归类、点阵与同伴比较。 |
| docs/competition/teaching-and-evaluation.md | 补充归类讨论与判断交换的课堂组织方式。 |
| docs/competition/README.md | 更新材料导航、当前能力和使用方式。 |
| docs/delivery-status.md | 更新实现、迁移与缺口，并注明实际修改日期。 |
| README.md | 更新入口、主要功能与验证结果。 |
| AI_USAGE.md | 如实补充本次代码、SVG与文档辅助范围。 |
| docs/project-introduction.md | 更新现有详细介绍中受功能变化影响的章节。 |
| docs/project-introduction.pdf | 从修订后正文重建并逐页检查。 |
| scripts/build-project-document.py | 仅在新内容排版确需调整时修改生成器。 |
| evidence/interaction-enhancement.md | 新增各任务提交、测试、截图、限制与最终结果索引。 |
| evidence/acceptance.md | 在完整最终验证后记录新构建，保留旧记录归档。 |
| evidence/project-document-verification.json | 记录新正文、PDF与构建的对应关系。 |

依赖：无新增。离线和导入协议：文档任务不增加行为。原验收条件逐条保留，不以新交互替代专业审校、真机或课堂研究。

## 10 测试 提交与完成条件

1. 确认后先将已完成的项目介绍改动保留为独立文档基线，随后每个任务单独Git提交并汇报，不覆盖或丢弃现有工作。
2. 任务1至6分别执行npm run build、npm test、npm run test:e2e。修复实际失败，不跳过、不设flaky、不删除保障既有行为的断言。
3. 任务7运行构建和单元测试；全任务结束运行完整浏览器回归及npm run verify:build，最后同步验收与文稿。
4. 每个交互任务检查桌面、390×844、320px、键盘和减少动态；需要3D的检查额外包含成功加载、示意回退与组件恢复。截图与方法写入任务记录。
5. 离线回归覆盖关系视图、归类、同伴文件、点阵与热点。确保没有新增网络依赖，不把可打开外部来源链接描述为离线可用。
6. 旧测试只因界面步骤或协议版本的有意变化而更新，保留原测试目标，并在报告列出修改理由。原有经济、确定性、存储异常与资源清理保障继续运行。
7. 每次汇报包含文件职责、测试名称与实际通过数、依赖/离线/兼容影响、人工检查及未达到项。没有执行的检查不能标为通过。

## 11 确认点

附件明确要求“输出一份变更计划……等我确认后再开始改代码”。目前只完成阅读、现有单元测试和本计划，尚未实施功能改动。确认后按任务1至7连续执行，无需逐个任务重复确认；只有出现超出本计划的新依赖或关键范围变化时再说明。

## 12 用户确认的接口与兼容约定（2026-11-12）

以下补充已随四项摘要获得“按计划执行”确认，是实施与验收依据。

### 12.1 Progress迁移

Progress数据版本由1升级至2，沿用localStorage键`life-museum-save-v1`及IndexedDB数据库`life-museum`、结构版本1、对象仓库`progress`、记录`current`。v1校验成功后迁移，保留原`updatedAt`供双存储按新旧选择，不因迁移伪造较新时间。不改点数、收藏、章节和既有行为，不从旧记录追溯发放两个新徽章。只持久化徽章状态，不保存解释、归类、同伴原文。非法导入保留当前记录；拒绝不支持的未来版本。兼容方向为新版读取旧存档，不承诺旧网站读取v2。

### 12.2 独立探究JSON协议

首次协议版本为1，与Progress版本独立。字段：`type: "life-inquiry-record"`、`version: 1`、`inquiryId`、`phase: "complete"`、`exportedAt`（ISO）、`answers.initial`、`answers.evidence`（新流程未作答为null）、`answers.transfer`、`observation: "model" | "text"`、`classifications`、`explanation`（最多1200字符）。归类数组每项包含`cardId`、`category`、`sourceRef`、`scope`，category只允许`support`、`irrelevant`、`oppose`、`more-information`。

保留HTML旧栏目并独立增加归类栏目，未作答显示“未记录”且不作一致性判断。既有HTML可阅读打印，不作为JSON导入；目前不存在旧版探究JSON迁移。独立验证器检查类型、版本、同一主题、完成状态、选项范围、卡片ID、归类、长度和来源引用。失败不替换当前活动。同伴记录只读比较，不合并、不写Progress、不触发徽章。

### 12.3 离线与回归

代码、样式、证据和热点数据及构建发布的本地资源进入现有dist枚举缓存流程；运行时SVG由已缓存代码和数据生成。下载的个人HTML/JSON属于本地文件，不是站点缓存资源；同伴文件可离线导入。外部来源网页、设备语音和AR不承诺离线。

检查生产清单和缓存版本更新，准备离线后断网刷新，操作关系视图、归类、同伴文件、点阵和热点；保留并更新现有生产离线测试。各交互任务运行build、test、test:e2e，最终运行verify:build；记录桌面、390×844、320px、键盘、减少动态与模型回退/恢复检查，未运行不得标通过。

### 12.4 展台只读接口

沿用展台，新增可选参数`showSpecimen(species, store, onLab, { readOnly: true })`，原调用默认正常模式。关系视图显式开启只读，在实际调用处拦截observe/read/collect/compare及奖励、徽章写入；不只隐藏按钮。尺寸比较保留显示，个人实验跳转不在只读模式接通。继续复用加载、旋转、缩放、知识、来源和热点，只读取设置；关闭后焦点回原关系节点/列表项。检查前后完整内存Progress（含updatedAt）、localStorage、IndexedDB均不变，并验证未调用写入方法。
