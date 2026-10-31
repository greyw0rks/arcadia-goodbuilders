/* Rebuild: ARCADIA_BRAND_TOOLS=/path/to/tools node scripts/build-brandkit.cjs
   Tools: npm install --prefix /path/to/tools fontkit @resvg/resvg-js pdfkit svg-to-pdfkit */
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const req = createRequire(path.join(process.env.ARCADIA_BRAND_TOOLS || path.join(root, '.data/brand-tools'), 'package.json'));
const fontkit = req('fontkit');
const { Resvg } = req('@resvg/resvg-js');
const PDFDocument = req('pdfkit');
const SVGtoPDF = req('svg-to-pdfkit');
const out = path.join(root, 'public/brand');
fs.mkdirSync(out, { recursive: true });
const palette = { violet:'#7564F6', ink:'#17182B', paper:'#F5F3EE', mint:'#55E6A5', gold:'#FFC857', blue:'#2D83F7', coral:'#FF7A70' };
const { violet, ink, paper, mint, gold } = palette;
const variable = fontkit.openSync(path.join(root, 'public/fonts/Manrope.ttf'));
const fonts = { word: variable.getVariation({wght:800}), body: variable.getVariation({wght:550}), label: variable.getVariation({wght:700}), display: fontkit.openSync(path.join(root, 'public/fonts/BarlowCondensed-Bold.ttf')) };
const cache = new Map();
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
function layout(s, font='body') { const key=font+':'+s; if(!cache.has(key)) cache.set(key, fonts[font].layout(s)); return cache.get(key); }
function measure(s, size, font='body', tracking=0) { const r=layout(s,font); return r.positions.reduce((a,p)=>a+p.xAdvance,0)*size/fonts[font].unitsPerEm + Math.max(0,r.glyphs.length-1)*tracking*size; }
function text(s,x,y,size,color=ink,font='body',tracking=0,anchor='start') {
  const r=layout(s,font), scale=size/fonts[font].unitsPerEm;
  if(anchor==='middle') x-=measure(s,size,font,tracking)/2;
  if(anchor==='end') x-=measure(s,size,font,tracking);
  let cursor=0;
  const paths=r.glyphs.map((glyph,i)=>{ const p=r.positions[i]; const str=`<path d="${glyph.path.toSVG()}" transform="translate(${cursor+p.xOffset} ${p.yOffset})"/>`; cursor+=p.xAdvance+tracking*fonts[font].unitsPerEm; return str; }).join('');
  return `<g aria-label="${esc(s)}" fill="${color}" transform="translate(${x} ${y}) scale(${scale} ${-scale})">${paths}</g>`;
}
const MARK='M12 112V61C12 31 34 8 64 8C94 8 116 31 116 61V98L102 112H86V87H42V112ZM42 64H86V61C86 47 77 38 64 38C51 38 42 47 42 61Z';
function mark(x,y,size,color=violet,opacity=1) { return `<path d="${MARK}" fill="${color}" fill-rule="evenodd" opacity="${opacity}" transform="translate(${x} ${y}) scale(${size/128})"/>`; }
function logo(x,y,h,color=ink,accent=violet) { return mark(x,y,h,accent)+text('arcadia',x+h*1.1,y+h*.86,h*.96,color,'word',-.04); }
function logoWidth(h) { return h*1.1+measure('arcadia',h*.96,'word',-.04); }
function rect(x,y,w,h,fill,rx=0,extra='') { return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`; }
function line(x,y,x2,y2,color,opacity=1) { return `<path d="M${x} ${y}H${x2}" stroke="${color}" opacity="${opacity}"/>`; }
function svg(w,h,body,title) { return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title"><title id="title">${esc(title)}</title>${body}</svg>`; }
function save(name,w,h,body,title,width=w) {
  const source=svg(w,h,body,title); fs.writeFileSync(path.join(out,name+'.svg'),source);
  fs.writeFileSync(path.join(out,name+'.png'),new Resvg(source,{fitTo:{mode:'width',value:width}}).render().asPng());
  return source;
}

const logoW=Math.ceil(logoWidth(160)+64);
save('arcadia-logo',logoW,220,logo(32,28,160), 'Arcadia primary logo',2400);
save('arcadia-logo-white',logoW,220,logo(32,28,160,paper,paper), 'Arcadia white logo',2400);
save('arcadia-logo-ink',logoW,220,logo(32,28,160,ink,ink), 'Arcadia monochrome logo',2400);
for(const [name,color] of [['violet',violet],['white',paper],['ink',ink]]) save('arcadia-mark-'+name,128,128,mark(0,0,128,color),'Arcadia gateway A mark',1024);
save('arcadia-logo-stacked',720,600,mark(228,20,264)+text('arcadia',360,468,142,ink,'word',-.04,'middle'),'Arcadia stacked logo',1440);
const icon=save('arcadia-app-icon',1024,1024,rect(0,0,1024,1024,violet,224)+mark(216,224,592,paper),'Arcadia app icon');
save('arcadia-avatar',1024,1024,rect(0,0,1024,1024,violet)+mark(216,224,592,paper),'Arcadia social avatar');
for(const size of [32,180,192,512]) fs.writeFileSync(path.join(out,`arcadia-icon-${size}.png`),new Resvg(icon,{fitTo:{mode:'width',value:size}}).render().asPng());

function banner(profile=false) {
  const x=profile?326:88;
  return rect(0,0,1500,500,ink)+mark(902,-72,720,violet,.13)+mark(1000,-44,650,violet)+
    logo(x,38,68,paper,paper)+text('MAKE TODAY',x+4,248,132,paper,'display')+text('A GOOD RUN.',x+4,376,132,paper,'display')+
    text('Daily quizzes. Friendly competition.',x+4,444,23,paper,'body')+text('g.arcadia.uno',1440,455,18,paper,'label',0,'end');
}
save('arcadia-banner-x',1500,500,banner(true),'Arcadia X profile banner, with space for the profile photo');
save('arcadia-banner-wide',1500,500,banner(false),'Arcadia wide website banner',2400);
const social=save('arcadia-social-card',1200,630,rect(0,0,1200,630,ink)+mark(765,10,680,violet)+logo(64,48,72,paper,paper)+text('MAKE TODAY',68,294,134,paper,'display')+text('A GOOD RUN.',68,426,134,paper,'display')+text('Daily quizzes. Friendly competition.',72,527,25,paper)+text('g.arcadia.uno',72,575,21,mint,'label'),'Arcadia social sharing card');

const W=2400,H=1800,CW=760,CH=560,M=40,G=20;
let board=rect(0,0,W,H,'#10111F');
function panel(column,row,fill,body) { const x=M+column*(CW+G),y=M+row*(CH+G); return `<g transform="translate(${x} ${y})">${rect(0,0,CW,CH,fill,20)}${body}</g>`; }
const label=(s,color=ink)=>text(s,44,53,18,color,'label',.07);
board+=panel(0,0,paper,label('01 / THE IDENTITY')+logo((CW-logoWidth(138))/2,175,138)+text('A daily arcade. A better kind of streak.',44,492,22,ink));
let construction='';
for(let i=0;i<7;i++) { const p=182+i*66; construction+=`<path d="M${p} 100V452M182 ${100+i*58}H578" stroke="${paper}" opacity=".14"/>`; }
construction+=`<circle cx="380" cy="282" r="172" fill="none" stroke="${paper}" opacity=".28"/>`;
board+=panel(1,0,violet,label('02 / THE GATEWAY',paper)+construction+mark(176,85,408,paper)+text('An open arcade. An A with a forward cut.',44,514,21,paper));
let app=rect(118,116,524,344,ink,26)+rect(118,116,524,57,'#25263C',26)+text('g.arcadia.uno',380,151,18,paper,'body',0,'middle')+mark(153,202,66,mint)+text('Today’s five',240,248,43,paper,'word',-.03)+text('One daily quiz. Make it count.',154,307,23,paper)+rect(154,348,452,70,violet,14)+text('Play today’s quiz',380,391,23,paper,'label',0,'middle');
board+=panel(2,0,paper,label('03 / BUILT TO PLAY')+app);
board+=panel(0,1,mint,label('04 / THE INVITATION')+text('MAKE TODAY',44,225,118,ink,'display')+text('A GOOD RUN.',44,341,118,ink,'display')+text('Daily quizzes. Friendly competition.',44,493,23,ink));
let swatches='';
const shades=[['Violet',violet],['Ink',ink],['Paper',paper],['Mint',mint],['Gold',gold]];
shades.forEach(([name,color],i)=>{
  const y=107+i*78;
  swatches+=rect(44,y,182,54,color,8,color===paper?`stroke="#D9D6E4"`:'' )+text(name,250,y+35,25,ink,'label')+text(color,711,y+34,20,ink,'body',0,'end');
});
board+=panel(1,1,paper,label('05 / COLOR WITH A JOB')+swatches);
board+=panel(2,1,paper,label('06 / THE VOICE')+text('PLAY',43,251,190,ink,'display')+text('Barlow Condensed Bold',47,306,22,ink,'label')+line(44,338,716,338,'#D9D6E4')+text('A little wiser, every day.',44,411,37,ink,'word',-.025)+text('Manrope / clear, human, quietly confident',44,480,21,ink));
let stickers=rect(44,120,346,346,violet,62)+mark(107,181,218,paper)+rect(430,120,286,156,ink,18)+logo(466,170,48,paper,paper)+rect(430,307,286,159,gold,18)+text('KEEP YOUR',452,374,43,ink,'display')+text('STREAK.',452,428,58,ink,'display');
board+=panel(0,2,paper,label('07 / OUT IN THE WORLD')+stickers);
board+=panel(1,2,ink,label('08 / THE CAMPAIGN',paper)+mark(332,54,530,violet)+text('MAKE',42,243,106,paper,'display')+text('TODAY',42,345,106,paper,'display')+text('COUNT.',42,447,106,paper,'display')+text('g.arcadia.uno',44,515,19,paper));
let details=logo(44,117,103,paper,paper)+line(44,256,716,256,paper,.18)+text('Small mark. Same character.',44,309,23,paper)+mark(44,354,112,mint)+mark(201,388,72,paper)+mark(318,412,44,paper)+rect(430,371,286,75,violet,14)+text('Play today',573,416,25,paper,'label',0,'middle')+text('FREE ENTRY  /  XP STANDINGS',44,514,18,paper,'label',.07);
board+=panel(2,2,ink,label('09 / EVERY TOUCHPOINT',paper)+details);
const boardSvg=save('arcadia-brand-board',W,H,board,'Arcadia brand identity overview, nine-panel brand kit');

let guide=rect(0,0,W,H,paper)+logo(100,85,142)+text('THE PLAYBOOK',100,374,142,ink,'display')+text('A useful identity for a daily quiz arcade.',106,444,39,ink);
const cols=[100,885,1670];
guide+=text('THE IDEA',cols[0],598,34,violet,'label')+text('The Gateway A',cols[0],684,48,ink,'word',-.035);
['An arcade entrance, reduced to an A.','The cut on its right foot suggests','a next step: return, learn, climb.','Keep the symbol flat and simple.'].forEach((s,i)=>guide+=text(s,cols[0],748+i*48,28,ink));
guide+=text('USE IT WELL',cols[1],598,34,violet,'label');
['Use the outlined SVG as the master.','Leave at least 25% of the mark’s','width clear around the logo.','Minimum icon: 24 px recommended.','Use white on violet or ink.','Use violet or ink on warm paper.','Do not stretch, tilt or add effects.'].forEach((s,i)=>guide+=text(s,cols[1],684+i*48,28,ink));
guide+=text('COLOR ROLES',cols[2],598,34,violet,'label');
[['Violet','identity and primary action'],['Ink','reading and dark surfaces'],['Paper','space and everyday use'],['Mint','correct answers and progress'],['Gold','XP and a moment of delight']].forEach(([name,role],i)=>{guide+=text(name,cols[2],684+i*93,31,ink,'label')+text(role,cols[2],721+i*93,25,ink);});
guide+=line(100,1170,2300,1170,'#D9D6E4')+text('WHAT’S IN THE KIT',100,1258,34,violet,'label');
['Outlined SVG + transparent PNG logos','Square avatar + app icons','1500 × 500 profile header with avatar space','2400 × 800 wide banner + 1200 × 630 share card','Brand board, color tokens and open font licenses'].forEach((s,i)=>guide+=text(s,100,1338+i*55,30,ink));
guide+=text('Arcadia',2300,1550,62,ink,'word',-.04,'end')+text('Make today a good run.',2300,1612,28,ink,'body',0,'end')+text('IDENTITY 1.0  /  OCTOBER 2026',100,1704,20,ink,'label',.05);
const guideSvg=svg(W,H,guide,'Arcadia logo usage, typography and color guidelines');
fs.writeFileSync(path.join(out,'arcadia-brand-guidelines.svg'),guideSvg);
const pdf = new PDFDocument({size:[W,H],margin:0,autoFirstPage:false,info:{Title:'Arcadia Brand Kit',Author:'Arcadia',Subject:'Logo system, campaign, colors and usage'}});
const stream=fs.createWriteStream(path.join(out,'arcadia-brand-guide.pdf'));
pdf.pipe(stream);
for(const page of [boardSvg,guideSvg]) { pdf.addPage({size:[W,H],margin:0}); SVGtoPDF(pdf,page,0,0,{width:W,height:H,assumePt:true}); }
pdf.end();
fs.writeFileSync(path.join(out,'tokens.json'),JSON.stringify({brand:'Arcadia',version:'1.0',tagline:'Make today a good run.',colors:palette,typography:{display:'Barlow Condensed Bold',interface:'Manrope',wordmark:'Manrope ExtraBold, custom spacing; distributed as outlines'},logo:{concept:'The Gateway A',clearSpace:'25% of symbol width',recommendedMinimumIconPx:24}},null,2)+'\n');
stream.on('finish',()=>console.log('Arcadia brand assets, banners and two-page vector brand guide generated.'));
