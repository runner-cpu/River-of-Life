import { icon, modal } from '../core/ui';

type HelpActions = { onJourney: () => void; onInquiry: () => void; onClassroom: () => void; onLab: () => void; onSettings: () => void };

export function openHelp(actions: HelpActions) {
  const { dialog, close } = modal('从这里开始你的探索', `
    <p class="definition">选择一条适合你的路线。个人探索会保存进度，课堂预览与证据探究使用临时记录。</p>
    <div class="help-paths">
      <section><span class="eyebrow">自己探索</span><h3>观察一个生命，读懂一张档案</h3><p>点击场景中的生物名称，旋转模型并阅读知识卡。第一次发现会免费加入图鉴；完成本章任务后开启下一纪元。</p><button class="btn primary" data-help="onJourney">${icon('Orbit',17)} 进入演化之旅</button></section>
      <section><span class="eyebrow">练习证据解释</span><h3>先判断，再用资料修订解释</h3><p>任选一个主题，查证后完成迁移问题。三维和文字路线都能完成活动；离开前可导出本次解释。</p><button class="btn" data-help="onInquiry">${icon('Compass',17)} 开始证据探究</button></section>
      <section><span class="eyebrow">教师展示</span><h3>直接选择纪元，带着问题观察</h3><p>课堂模式开放全部章节，可逐个查看物种、播放纪元高光并导出学习单。课堂操作不改变个人收藏。</p><button class="btn" data-help="onClassroom">${icon('Presentation',17)} 打开课堂模式</button></section>
      <section><span class="eyebrow">比较模型结果</span><h3>控制条件，观察两条曲线</h3><p>在实验室记录预测，再运行同起点对照。调整参数后重新运行；可导出逐代数据。离开实验室会重置本次实验。</p><button class="btn" data-help="onLab">${icon('FlaskConical',17)} 进入演化实验室</button></section>
    </div>
    <section class="help-details"><h3>触屏与键盘</h3><p>模型可拖动旋转，双指或滚轮缩放。使用 Tab 依次访问控件，Enter 或空格操作按钮，Esc 关闭弹窗；知识挑战页签支持方向键。挖掘也可使用“清理一片岩层”。</p><p>系统开启减少动态效果时，新存档会沿用这一偏好。也可在设置中调整动态、投影字号和画面质量。</p></section>
    <section class="help-details"><h3>离线与记录</h3><p>在联网时完成“准备离线展馆”，等待成功提示后再断网。知识、模型和核心活动可使用缓存；外部参考网页、设备语音与 AR 不保证离线可用。</p><p>个人进度保存在当前浏览器与地址。更换设备、端口或浏览器前导出记录；清理站点数据前保留备份。无需注册，作品不上传你的学习解释。</p><button class="text-btn" data-help="onSettings">打开探索设置 ${icon('ArrowRight',16)}</button></section>
  `, true);
  dialog.classList.add('help-dialog');
  dialog.querySelectorAll<HTMLButtonElement>('[data-help]').forEach(button => button.addEventListener('click', () => { close(); actions[button.dataset.help as keyof HelpActions](); }));
}
