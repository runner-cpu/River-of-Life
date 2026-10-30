"""Build the reviewed project introduction PDF from its editable Markdown source.

Uses ReportLab and embedded Noto Sans SC fonts. The site does not depend on Python.
"""
from pathlib import Path
import re
import html
import json
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak,
    NextPageTemplate, Table, TableStyle, Image, KeepTogether,
)
from reportlab.platypus.tableofcontents import TableOfContents
from PIL import Image as PILImage
from fontTools.ttLib import TTFont as SourceFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'output/pdf/life-museum-project-introduction.pdf'
SOURCE = ROOT / 'docs/project-introduction.md'
OUT.parent.mkdir(parents=True, exist_ok=True)
FONT_DIR = Path('C:/Windows/Fonts')
FONT_CACHE = ROOT / 'tmp/pdfs/fonts'
FONT_CACHE.mkdir(parents=True, exist_ok=True)
for name, weight in [('NotoSC', 400), ('NotoSCBold', 650)]:
    target = FONT_CACHE / f'{name}.ttf'
    if not target.exists():
        font = SourceFont(str(FONT_DIR / 'NotoSansSC-VF.ttf'))
        instantiateVariableFont(font, {'wght': weight}, inplace=True).save(str(target))
    pdfmetrics.registerFont(TTFont(name, str(target)))
pdfmetrics.registerFontFamily('NotoSC', normal='NotoSC', bold='NotoSCBold', italic='NotoSC', boldItalic='NotoSCBold')

INK = colors.HexColor('#243F34')
MUTED = colors.HexColor('#627367')
LINE = colors.HexColor('#D5DED2')
PAPER = colors.HexColor('#FAFBF6')
GREEN = colors.HexColor('#325E47')
PAGE_W, PAGE_H = 595.276, 841.89
LEFT, RIGHT, TOP, BOTTOM = 49, 49, 63, 49
WIDTH = PAGE_W - LEFT - RIGHT

styles = {
    'body': ParagraphStyle('body', fontName='NotoSC', fontSize=10.7, leading=19.2,
                           textColor=INK, spaceAfter=10, wordWrap='CJK', allowWidows=0, allowOrphans=0),
    'heading': ParagraphStyle('heading', fontName='NotoSCBold', fontSize=22, leading=32,
                              textColor=INK, spaceAfter=21, keepWithNext=True, wordWrap='CJK'),
    'cell': ParagraphStyle('cell', fontName='NotoSC', fontSize=9.2, leading=15.6,
                           textColor=INK, wordWrap='CJK'),
    'th': ParagraphStyle('th', fontName='NotoSCBold', fontSize=9.4, leading=15.6,
                         textColor=INK, wordWrap='CJK'),
    'caption': ParagraphStyle('caption', fontName='NotoSC', fontSize=8.7, leading=14,
                              textColor=MUTED, alignment=TA_LEFT, spaceAfter=13, wordWrap='CJK'),
    'code': ParagraphStyle('code', fontName='NotoSC', fontSize=9.1, leading=15.5,
                           backColor=colors.HexColor('#EDF2E8'), borderPadding=9,
                           spaceBefore=4, spaceAfter=16, wordWrap='CJK'),
}


def inline(text):
    result = html.escape(text)
    result = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', result)
    result = re.sub(r'`([^`]+)`', r'<font color="#325E47">\1</font>', result)
    return result


def page_art(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(MUTED)
    canvas.setFont('NotoSC', 8)
    canvas.drawString(LEFT, PAGE_H - 34, '生命长河  /  RIVER OF LIFE')
    canvas.drawRightString(PAGE_W - RIGHT, PAGE_H - 34, '项目介绍 · 2026.10.30')
    canvas.setStrokeColor(LINE)
    canvas.line(LEFT, PAGE_H - 44, PAGE_W - RIGHT, PAGE_H - 44)
    canvas.line(LEFT, 35, PAGE_W - RIGHT, 35)
    canvas.setFont('NotoSC', 7.8)
    canvas.drawString(LEFT, 22, '本地原型说明  ·  软件验证不等于科学审定或教学成效')
    canvas.drawRightString(PAGE_W - RIGHT, 22, f'{doc.page:02d}')
    canvas.restoreState()


def cover_art(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    canvas.setFillColor(GREEN)
    canvas.rect(0, PAGE_H - 14, PAGE_W, 14, fill=1, stroke=0)
    canvas.setFillColor(MUTED)
    canvas.setFont('NotoSC', 10)
    canvas.drawString(LEFT, 752, 'R I V E R  O F  L I F E')
    canvas.setFont('NotoSCBold', 44)
    canvas.setFillColor(INK)
    canvas.drawString(LEFT - 2, 660, '生命长河')
    canvas.setFont('NotoSC', 23)
    canvas.drawString(LEFT, 608, '详细项目介绍')
    canvas.setFont('NotoSC', 13)
    canvas.setFillColor(MUTED)
    canvas.drawString(LEFT, 561, '从观察生命，到用证据解释生命。')
    canvas.setStrokeColor(LINE)
    canvas.line(LEFT, 526, PAGE_W - RIGHT, 526)
    # A restrained vector timeline, not a newly generated raster asset.
    ys = [454, 435, 457, 434, 457, 435, 454, 434]
    labels = ['微光', '身体', '潮线', '森林', '重建', '羽翼', '分枝', '共处']
    for i, y in enumerate(ys):
        x = LEFT + 8 + i * 68
        if i:
            canvas.setStrokeColor(colors.HexColor('#A7B99E'))
            canvas.setLineWidth(1.3)
            canvas.line(x - 68, ys[i - 1], x, y)
        canvas.setFillColor(GREEN if i in [0, 7] else colors.HexColor('#8EA880'))
        canvas.circle(x, y, 4, fill=1, stroke=0)
        canvas.setFont('NotoSC', 8)
        canvas.setFillColor(MUTED)
        canvas.drawCentredString(x, 410, labels[i])
    canvas.setFont('NotoSCBold', 14)
    canvas.setFillColor(INK)
    canvas.drawString(LEFT, 342, '8个纪元  ·  48个生命档案  ·  3组证据探究')
    summary = '科普教育优先 / 兼顾数字展陈与创新实践<br/>涵盖产品定位、教学活动、视觉交互、工程实现、<br/>软件验证、比赛展示与后续路线。'
    p = Paragraph(summary, ParagraphStyle('coverbody', fontName='NotoSC', fontSize=11,
                                          leading=21, textColor=MUTED))
    p.wrap(WIDTH, 100)
    p.drawOn(canvas, LEFT, 245)
    canvas.setFillColor(colors.HexColor('#E9EFE2'))
    canvas.roundRect(LEFT, 122, WIDTH, 75, 7, fill=1, stroke=0)
    p = Paragraph('当前版本：可运行、可验证的本地原型。<br/>专业审校、真实课堂研究、真机AR及正式参赛成片仍待完成。',
                  ParagraphStyle('covernote', fontName='NotoSC', fontSize=10, leading=19, textColor=INK))
    p.wrap(WIDTH - 28, 60)
    p.drawOn(canvas, LEFT + 14, 143)
    canvas.setFont('NotoSC', 9)
    canvas.setFillColor(MUTED)
    canvas.drawString(LEFT, 65, '版本日期  2026年10月30日')
    canvas.drawRightString(PAGE_W - RIGHT, 65, '项目源码与验证记录配套文档')
    canvas.restoreState()


class ProjectDoc(BaseDocTemplate):
    def __init__(self):
        super().__init__(str(OUT), pagesize=(PAGE_W, PAGE_H), title='生命长河 · 详细项目介绍',
                         author='生命长河项目资料', subject='科普教育交互作品的产品、教学、工程与验证说明')
        self.section_pages = []
        self.addPageTemplates([
            PageTemplate(id='cover', frames=[Frame(LEFT, BOTTOM, WIDTH, PAGE_H - TOP - BOTTOM,
                                                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)], onPage=cover_art),
            PageTemplate(id='body', frames=[Frame(LEFT, BOTTOM, WIDTH, PAGE_H - TOP - BOTTOM,
                                                 leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)], onPage=page_art),
        ])

    def afterFlowable(self, flowable):
        if getattr(flowable, 'toc_title', None):
            title, key = flowable.toc_title, flowable.bookmark
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(title, key, 0)
            self.notify('TOCEntry', (0, title, self.page, key))
            self.section_pages.append({'title': title, 'page': self.page})


def table(rows):
    count = len(rows[0])
    proportions = [0.28, 0.72] if count == 2 else [0.22, 0.39, 0.39]
    if count == 2 and any(len(row[0]) > 26 for row in rows[1:]):
        proportions = [0.45, 0.55]
    cells = [[Paragraph(inline(c), styles['th' if ri == 0 else 'cell']) for c in row] for ri, row in enumerate(rows)]
    t = Table(cells, colWidths=[WIDTH * f for f in proportions], repeatRows=1, hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#E8EEE1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F7F9F3')]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 9), ('RIGHTPADDING', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LINEBELOW', (0, 0), (-1, -1), 0.35, LINE),
    ]))
    return [t, Spacer(1, 14)]


story = [Spacer(1, 1), NextPageTemplate('body'), PageBreak()]
story.append(Paragraph('阅读导航', styles['heading']))
story.append(Paragraph('初次了解项目可先阅读第01至09节；工程复核重点见第10至16节；准备展示和交付可阅读第17至20节。目录页码及章节书签可点击跳转。', styles['body']))
toc = TableOfContents()
toc.levelStyles = [ParagraphStyle('toc', fontName='NotoSC', fontSize=10.5, leading=21,
                                  textColor=INK, leftIndent=0, firstLineIndent=0, spaceBefore=0)]
toc.dotsMinLevel = 0
story.append(toc)
story.append(Spacer(1, 15))
story.append(Paragraph('口径说明：功能与数字均为当前版本快照；“已验证”仅覆盖所列方法和环境。目标、设计假设及待办均明确标注，不能混同为完成结果。', styles['caption']))

lines = SOURCE.read_text(encoding='utf-8').splitlines()
i = 0
while i < len(lines):
    line = lines[i].strip()
    if not line or line.startswith('# '):
        i += 1
        continue
    if line.startswith('## '):
        story.append(PageBreak())
        title = line[3:]
        p = Paragraph(inline(title), styles['heading'])
        p.toc_title = title
        p.bookmark = 'section-' + title[:2]
        story.append(p)
        i += 1
        if title.startswith('07 '):
            section = []
            while i < len(lines) and not lines[i].startswith('## '):
                if lines[i].strip():
                    section.append(lines[i].strip())
                i += 1
            photo = next(re.fullmatch(r'!\[(.*?)\]\((.+?)\)', text) for text in section if text.startswith('!['))
            caption, path = photo.groups()
            image_path = (SOURCE.parent / path).resolve()
            with PILImage.open(image_path) as im:
                iw, ih = im.size
            image_width = 207
            left = [Image(str(image_path), width=image_width, height=image_width * ih / iw),
                    Spacer(1, 8), Paragraph(caption + '。截图摄于本轮本地生产预览。', styles['caption'])]
            right = [Paragraph(inline(text), styles['body']) for text in section if not text.startswith('![')]
            layout = Table([[left, right]], colWidths=[222, WIDTH - 222], hAlign='LEFT')
            layout.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'),
                                        ('LEFTPADDING', (0, 0), (0, 0), 0),
                                        ('RIGHTPADDING', (0, 0), (0, 0), 15),
                                        ('LEFTPADDING', (1, 0), (1, 0), 10),
                                        ('RIGHTPADDING', (1, 0), (1, 0), 0),
                                        ('TOPPADDING', (0, 0), (-1, -1), 0)]))
            story.append(layout)
        continue
    image_match = re.fullmatch(r'!\[(.*?)\]\((.+?)\)', line)
    if image_match:
        caption, path = image_match.groups()
        image_path = (SOURCE.parent / path).resolve()
        with PILImage.open(image_path) as im:
            width, height = im.size
        max_height = 233 if height > width else 260
        scale = min(WIDTH / width, max_height / height)
        img = Image(str(image_path), width=width * scale, height=height * scale, hAlign='CENTER')
        story.append(KeepTogether([img, Spacer(1, 7), Paragraph(caption + '。截图摄于本轮本地生产预览。', styles['caption'])]))
        i += 1
        continue
    if line.startswith('|'):
        rows = []
        while i < len(lines) and lines[i].strip().startswith('|'):
            cells = [c.strip() for c in lines[i].strip().strip('|').split('|')]
            if not all(re.fullmatch(r':?-+:?', c.replace(' ', '')) for c in cells):
                rows.append(cells)
            i += 1
        story.extend(table(rows))
        continue
    if line.startswith('`') and line.endswith('`'):
        story.append(Paragraph(html.escape(line[1:-1]), styles['code']))
    else:
        story.append(Paragraph(inline(line), styles['body']))
    i += 1

doc = ProjectDoc()
doc.multiBuild(story)
# multiBuild records two passes; keep the last occurrence of each section.
mapping = {item['title']: item['page'] for item in doc.section_pages}
(OUT.parent / 'project-document-pages.json').write_text(json.dumps(mapping, ensure_ascii=False, indent=2), encoding='utf-8')
print(OUT)
print(json.dumps(mapping, ensure_ascii=False))
