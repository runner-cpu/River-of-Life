import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

const files = (JSON.parse(readFileSync('dist/offline-manifest.json','utf8')) as string[]).sort();
const hash = createHash('sha256');files.forEach(file => hash.update(file).update(readFileSync(join('dist',file))));
const revision = hash.digest('hex');
const verification = JSON.parse(readFileSync('evidence/build-verification.json','utf8'));
if(verification.releaseContentSha256 !== revision) throw new Error('Run validation and npm run verify:build for the current production output first.');
const browserReport = JSON.parse(readFileSync('evidence/e2e-results.json','utf8'));
const tests = browserReport.stats;
const requiredSuites = readdirSync('tests/e2e').filter(name => name.endsWith('.spec.ts'));
if(browserReport.config.argv.slice(3).length || browserReport.config.shard || requiredSuites.some(file => !browserReport.suites.some((suite: { file: string }) => suite.file === file))) throw new Error('Run npm run test:e2e without filters before packaging.');
if(!tests.expected || tests.unexpected || tests.flaky || tests.skipped || Date.parse(tests.startTime) < Date.parse(verification.builtAt)) throw new Error('A fresh complete passing browser run is required before packaging.');
const documentVerification=JSON.parse(readFileSync('evidence/project-document-verification.json','utf8'));
const fileHash=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex');
if(documentVerification.releaseContentSha256!==revision || documentVerification.pdfSha256!==fileHash('output/pdf/life-museum-project-introduction.pdf') || documentVerification.sourceSha256!==fileHash('docs/project-introduction.md')) throw new Error('Review and verify the project introduction for this build before packaging.');

const stamp = new Date().toISOString().replaceAll(/[:.]/g,'-');
const target = join('output/competition',`life-museum-${stamp}`);
mkdirSync(target,{recursive:true});cpSync('dist',join(target,'site'),{recursive:true});
cpSync('docs/competition',join(target,'materials'),{recursive:true});
writeFileSync(join(target,'materials/project-introduction-detailed.md'),readFileSync('docs/project-introduction.md','utf8').replaceAll('../evidence/','../screenshots/'));
cpSync('output/pdf/life-museum-project-introduction.pdf',join(target,'项目介绍.pdf'));
for(const name of ['AI_USAGE.md','CREDITS.md'])cpSync(name,join(target,name));
writeFileSync(join(target,'README.md'),'# 生命长河 · 展示准备包\n\n先阅读 [项目介绍.pdf](项目介绍.pdf) 获取22页完整说明；双击 [评审说明.html](评审说明.html) 阅读简版教学方案和答辩材料。运行方式见 [开始查看.txt](开始查看.txt)：在本目录执行 `node serve.mjs`，浏览器打开 http://127.0.0.1:4180/。无需 npm 安装，已在 Node.js 24 验证。\n\n- `site/`：经过验证的生产站点。\n- `materials/`：可编辑准备文稿，含完整项目介绍Markdown。\n- `verification/`：构建、浏览器测试与本轮改进记录。\n- `screenshots/`：实际界面截图。\n- `CREDITS.md`、`AI_USAGE.md`：来源、署名与 AI 辅助披露。\n\n这是本地展示准备包，未提交报名；课堂成效、专业审校和真实设备验证仍待完成。外部模型与来源许可文本在 site/models/、site/licenses/ 中。\n');
const materialsReadme = join(target,'materials/README.md');
writeFileSync(materialsReadme,readFileSync(materialsReadme,'utf8').replace('../../evidence/competition-refinement.md','../verification/competition-refinement.md'));
mkdirSync(join(target,'verification'));
for(const name of ['build-verification.json','e2e-results.json','e2e-verification.md','competition-refinement.md','interface-polish.md','comprehensive-refinement.md','dependency-audit-after.json','model-validation.json','acceptance.md','project-document-verification.json'])cpSync(join('evidence',name),join(target,'verification',name));
mkdirSync(join(target,'screenshots'));
for(const name of readdirSync('evidence').filter(name => /^(competition|polish|deep)-.*\.png$/.test(name)))cpSync(join('evidence',name),join(target,'screenshots',name));

const escape = (value:string) => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function renderMarkdown(markdown:string) {
  const lines=markdown.split(/\r?\n/), html:string[]=[];
  for(let index=0;index<lines.length;index++) {
    const line=lines[index];if(!line.trim())continue;
    if(line.startsWith('|')) {
      const rows:string[]=[];while(index<lines.length && lines[index].startsWith('|'))rows.push(lines[index++]);index--;
      const cells=(row:string,tag:string)=>row.split('|').slice(1,-1).map(cell=>`<${tag}>${escape(cell.trim())}</${tag}>`).join('');
      html.push(`<table><thead><tr>${cells(rows[0],'th')}</tr></thead><tbody>${rows.slice(2).map(row=>`<tr>${cells(row,'td')}</tr>`).join('')}</tbody></table>`);continue;
    }
    const heading=/^(#{1,3}) (.+)$/.exec(line);
    html.push(heading?`<h${heading[1].length}>${escape(heading[2])}</h${heading[1].length}>`:`<p>${escape(line).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')}</p>`);
  }
  return html.join('\n');
}
const sections=['project-introduction.md','teaching-and-evaluation.md','demo-and-defense.md','submission-readiness.md'];
writeFileSync(join(target,'评审说明.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>生命长河 · 科普教育展示说明</title><style>body{max-width:1040px;margin:50px auto;padding:0 28px;color:#263f32;font:15px/1.9 system-ui;background:#f9faf4}header{border-bottom:3px solid #54704f;padding-bottom:25px}header small{letter-spacing:2px}h1{font-size:30px;line-height:1.5}h2{font-size:21px;margin-top:30px}h3{font-size:17px}section{padding:24px 0}table{border-collapse:collapse;width:100%;font-size:13px}td,th{padding:12px;border-bottom:1px solid #cdd7c7;text-align:left;vertical-align:top}th{background:#e9eee1}a{color:#3e684b}nav{display:flex;gap:20px;flex-wrap:wrap}@media print{body{background:white;font-size:11pt;margin:0;padding:0}header small,nav{display:none}section{break-before:page}h1,h2,h3{break-after:avoid}tr{break-inside:avoid}table{font-size:10pt}}</style><header><small>RIVER OF LIFE / 科普教育作品</small><h1>从看见生命，到用证据解释生命。</h1><p>展示准备版 · 核心功能可运行；真实教学成效与设备验收待补齐。</p><nav>${sections.map((file,index)=>`<a href="#part-${index}">${['作品介绍','教学与试测','演示与答辩','提交准备'][index]}</a>`).join('')}</nav></header>${sections.map((file,index)=>`<section id="part-${index}">${renderMarkdown(readFileSync(join('docs/competition',file),'utf8'))}</section>`).join('')}<footer>发布内容校验：${revision}<br>署名与 AI 披露见同目录 CREDITS.md、AI_USAGE.md。</footer></html>`);

writeFileSync(join(target,'serve.mjs'),`import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';
const root=fileURLToPath(new URL('./site/',import.meta.url));
const port=Number(process.argv[2]||4180);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Choose a port from 1024 to 65535.');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(resolve(root)+sep)){res.writeHead(403);res.end();return;}
  const content=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:content);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log('Open http://127.0.0.1:'+port));
`);
writeFileSync(join(target,'开始查看.txt'),`生命长河 · 科普教育展示准备包\n\n1. 打开“项目介绍.pdf”阅读22页完整文档；也可双击“评审说明.html”阅读简版材料。\n2. 运行作品需要 Node.js（已在 Node.js 24 验证），无需安装 npm 依赖。\n3. 在本目录打开终端运行：node serve.mjs\n4. 浏览器打开 http://127.0.0.1:4180/。端口占用时可运行 node serve.mjs 4181。\n5. 不要直接双击 site/index.html。站点只绑定本机地址。\n6. 如需离线演示，先在探索设置中“准备离线展馆”，等待完成。外部来源链接、设备语音与 AR 不保证离线。\n\n开始体验：主页→证据探究；演化实验室→对照实验。\n当前外部模型13个，结构示意35个；专家审校、真实课堂研究、真机AR、正式视频与签署文件尚待完成。\n本包是准备材料，不是已提交或已签署的报名文件。\n`);
const packageFiles:string[]=[];
function walk(dir:string){for(const entry of readdirSync(dir,{withFileTypes:true})){const file=join(dir,entry.name);if(entry.isDirectory())walk(file);else packageFiles.push(file);}}
walk(target);
writeFileSync(join(target,'package-manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),releaseContentSha256:revision,e2e:tests,files:packageFiles.map(file=>({path:relative(target,file).replaceAll('\\','/'),sha256:createHash('sha256').update(readFileSync(file)).digest('hex')}))},null,2));
console.log(`Competition preparation package: ${target}`);
