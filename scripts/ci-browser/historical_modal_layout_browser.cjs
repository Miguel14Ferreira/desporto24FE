/* Historical player modal layout regression using the actual component CSS.
 * Chromium measures computed widths so generic modal CSS cannot silently shrink
 * the historical player card to 470px again. No network or production data.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const css=fs.readFileSync(path.resolve('src/app/pages/communities/communities.component.css'),'utf8');
const pt=fs.readFileSync(path.resolve('src/app/i18n/i18n.service.ts'),'utf8');
const en=fs.readFileSync(path.resolve('src/app/i18n/translations-en.ts'),'utf8');
assert.match(pt,/['"]common\.close['"]:\s*['"]Fechar['"]/);
assert.match(en,/['"]common\.close['"]:\s*['"]Close['"]/);

const labels=['Vitórias','Empates','Derrotas','Golos','Assistências','MVP','Jogos sem sofrer',
 'Percentagem de vitórias','Série atual','Melhor série de vitórias'];
const sections=labels.map((name,i)=>'<div><span>'+name+'</span><strong>'+[3,0,1,0,0,0,0,'75%','L1',3][i]+'</strong></div>').join('');
const fixture=`<!doctype html><html lang="pt"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#071927;color:#effbf9;font:14px Arial,sans-serif}
${css}
</style></head><body>
<div class="ranking-identity-backdrop">
 <section class="ranking-identity-dialog ranking-history-profile" role="dialog" aria-modal="true" aria-labelledby="historical-title">
  <div class="ranking-identity-heading"><div><span class="section-kicker">HISTÓRICO</span>
   <h3 id="historical-title">Estatísticas do jogador histórico</h3></div>
   <button class="ranking-identity-close" aria-label="Fechar">×</button></div>
  <div class="ranking-identity-player ranking-history-person">
   <span class="ranking-history-avatar">A</span><div><strong>Afonso Salvador</strong>
   <span>Jogador histórico sem conta associada</span></div></div>
  <p class="ranking-history-explainer">Estatísticas registadas nesta comunidade, de acordo com a classificação e a época selecionadas. Não é necessário ter uma conta Jynlo.</p>
  <div class="ranking-history-keyfacts">
   <div class="ranking-history-mainstat"><span>Posição</span><strong>#5</strong></div>
   <div class="ranking-history-mainstat"><span>Pontos</span><strong>9</strong></div>
   <div class="ranking-history-mainstat"><span>Jogos</span><strong>4</strong></div>
  </div>
  <h4 class="ranking-history-subtitle">DESEMPENHO</h4>
  <div class="ranking-history-grid">${sections}</div>
  <p class="ranking-history-readonly">Dados históricos de consulta. Nenhum resultado é alterado.</p>
  <section class="ranking-history-claim"><button type="button" class="ranking-history-claim-toggle">
   Este jogador sou eu — associar à minha conta (opcional)</button></section>
  <div class="ranking-identity-actions"><button type="button">Fechar</button></div>
 </section>
</div></body></html>`;
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox'],
   ...(process.env.JYNLO_USE_SYSTEM_CHROME==='1'?{channel:'chrome'}:{})});
 try {
  for(const {width,height,minimum,maximum,columns} of [
    {width:1440,height:900,minimum:850,maximum:900,columns:5},
    {width:1000,height:820,minimum:850,maximum:900,columns:5},
    {width:720,height:800,minimum:630,maximum:690,columns:3},
    {width:390,height:844,minimum:340,maximum:370,columns:2}
  ]){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
   await page.setContent(fixture);
   const measure=await page.evaluate(()=>{
    const dialog=document.querySelector('.ranking-history-profile');
    const grid=document.querySelector('.ranking-history-grid');
    const facts=document.querySelector('.ranking-history-keyfacts');
    const styles=getComputedStyle(grid);
    return {
      dialogWidth:dialog.getBoundingClientRect().width,
      dialogHeight:dialog.getBoundingClientRect().height,
      scrollWidth:document.documentElement.scrollWidth,
      columns:styles.gridTemplateColumns.split(' ').length,
      factColumns:getComputedStyle(facts).gridTemplateColumns.split(' ').length,
      buttonText:dialog.querySelector('.ranking-identity-actions button').textContent.trim()
    };
   });
   assert.ok(measure.dialogWidth>=minimum && measure.dialogWidth<=maximum,
     'Unexpected modal width at '+width+': '+JSON.stringify(measure));
   assert.equal(measure.columns,columns,'Statistics columns at '+width);
   assert.equal(measure.factColumns,3);
   assert.ok(measure.dialogHeight<=height,'Modal must fit the available viewport at '+width);
   assert.ok(measure.scrollWidth<=width,'Horizontal viewport clipping at '+width);
   assert.equal(measure.buttonText,'Fechar');
   await page.close();
  }
  process.stdout.write('Historical modal computed-style regression passed: desktop/tablet/mobile and PT/EN labels.\\n');
 } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
