/* Módulo complementar de ferramentas — independente do controle de óleo. */
(() => {
  'use strict';
  const KEY = 'wlm_tools_demo_v1';
  const el = id => document.getElementById(id);
  let loans = [];
  try { const parsed = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(parsed)) loans = parsed; } catch (_) {}
  let selectedId = null;
  const now = () => new Date().toISOString();
  const dateText = d => d ? new Date(d).toLocaleString('pt-BR') : '—';
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(loans)); return true; } catch (_) { alert('Não foi possível salvar. Verifique o espaço do navegador.'); return false; } };
  function signature(canvas) {
    const ctx = canvas.getContext('2d');
    let drawing = false, signed = false;
    function resize() {
      const old = signed ? canvas.toDataURL('image/png') : null;
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#102e1a';
      if (old) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height); img.src = old; }
    }
    const pos = e => { const r = canvas.getBoundingClientRect(); return [e.clientX-r.left,e.clientY-r.top]; };
    canvas.addEventListener('pointerdown', e => { e.preventDefault(); if (canvas.width <= 2 || canvas.height <= 2) resize(); canvas.setPointerCapture(e.pointerId); drawing = true; signed = true; const [x,y]=pos(e);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+.01,y+.01);ctx.stroke(); });
    canvas.addEventListener('pointermove', e => { if (!drawing) return; e.preventDefault(); const [x,y]=pos(e);ctx.lineTo(x,y);ctx.stroke(); });
    for (const event of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(event, () => drawing = false);
    resize();
    return { clear() {ctx.clearRect(0,0,canvas.width,canvas.height);signed=false;}, get() {return signed ? canvas.toDataURL('image/png') : null;}, resize };
  }
  const loanSig = signature(el('toolLoanSignature'));
  const returnSig = signature(el('toolReturnSignature'));
  el('toolClearLoanSig').onclick = () => loanSig.clear();
  el('toolClearReturnSig').onclick = () => returnSig.clear();
  function render() {
    const open = loans.filter(x => !x.returnedAt);
    el('toolOpenCount').textContent = open.length;
    el('toolClosedCount').textContent = loans.length - open.length;
    const query = el('toolSearch').value.trim().toLocaleLowerCase('pt-BR');
    const list = el('toolLoans'); list.replaceChildren();
    const matches = open.filter(x => [x.mechanic,x.name,x.code].some(v => (v || '').toLocaleLowerCase('pt-BR').includes(query)));
    if (!matches.length) { const p=document.createElement('p');p.className='tool-empty';p.textContent='Nenhuma ferramenta emprestada encontrada.';list.append(p); }
    for (const x of matches) {
      const b=document.createElement('button');b.type='button';b.className='tool-loan';
      const title=document.createElement('strong');title.textContent=x.name+(x.code?' — '+x.code:'');
      const sub=document.createElement('small');sub.textContent=x.mechanic+' · retirada '+dateText(x.loanedAt);
      b.append(title,sub);b.onclick=()=>selectReturn(x.id);list.append(b);
    }
    const body=el('toolHistoryBody');body.replaceChildren();
    for (const x of loans) {
      const tr=document.createElement('tr');
      for (const value of [x.name,x.code||'—',x.mechanic,dateText(x.loanedAt),dateText(x.returnedAt),x.condition||'—',x.returnedAt?'Devolvida':'Emprestada']) { const td=document.createElement('td');td.textContent=value;tr.append(td); }
      const td=document.createElement('td');
      for (const [label,src] of [['Retirada',x.loanSignature],['Devolução',x.returnSignature]]) if (src) {const a=document.createElement('a');a.href=src;a.download='assinatura_'+label.toLowerCase()+'_'+x.id+'.png';a.textContent=label;a.style.marginRight='10px';td.append(a);}
      tr.append(td);body.append(tr);
    }
    if (!loans.length) {const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=8;td.className='empty';td.textContent='Nenhum registro de ferramentas.';tr.append(td);body.append(tr);}
  }
  function selectReturn(id) {
    const x=loans.find(item=>item.id===id&&!item.returnedAt);if(!x)return;
    selectedId=id;el('toolReturnForm').classList.remove('hide');
    el('toolReturnSummary').textContent='Ferramenta: '+x.name+'\nMecânico: '+x.mechanic+'\nRetirada: '+dateText(x.loanedAt);
    // O formulário começa oculto: dimensionar o canvas somente após exibi-lo.
    requestAnimationFrame(() => {
      returnSig.resize();
      returnSig.clear();
      el('toolReturnForm').scrollIntoView({behavior:'smooth',block:'center'});
    });
  }
  el('toolCancelReturn').onclick=()=>{selectedId=null;el('toolReturnForm').classList.add('hide');returnSig.clear();};
  el('toolSearch').addEventListener('input',render);
  el('toolLoanForm').addEventListener('submit', e=>{
    e.preventDefault();
    const mechanic=el('toolMechanic').value.trim(),name=el('toolName').value.trim(),code=el('toolCode').value.trim();
    if(!mechanic||!name)return alert('Informe mecânico e ferramenta.');
    const sig=loanSig.get();if(!sig)return alert('O mecânico precisa assinar a retirada na tela.');
    if(code && loans.some(x=>!x.returnedAt&&x.code&&x.code.toLowerCase()===code.toLowerCase())) return alert('Já existe uma retirada em aberto com esse código.');
    const record={id:String(Date.now())+'_'+Math.random().toString(36).slice(2,7),mechanic,name,code,loanNotes:el('toolLoanNotes').value.trim(),loanedAt:now(),loanSignature:sig,returnedAt:null,condition:null,returnNotes:null,returnSignature:null};
    loans.unshift(record);if(!persist()){loans.shift();return;}e.target.reset();loanSig.clear();render();alert('Retirada registrada no WLM. Faça também o registro no SICON NET.');
  });
  el('toolReturnForm').addEventListener('submit',e=>{
    e.preventDefault();const x=loans.find(item=>item.id===selectedId&&!item.returnedAt);if(!x)return alert('Selecione uma retirada em aberto.');
    const sig=returnSig.get();if(!sig)return alert('O mecânico precisa assinar a devolução na tela.');
    const previous={...x};x.returnedAt=now();x.condition=el('toolCondition').value;x.returnNotes=el('toolReturnNotes').value.trim();x.returnSignature=sig;
    if(!persist()){Object.assign(x,previous);return;}
    selectedId=null;e.target.reset();returnSig.clear();e.target.classList.add('hide');render();alert('Devolução registrada no WLM. Faça também a baixa no SICON NET.');
  });
  // Exclui apenas empréstimos já devolvidos; preserva ferramentas ainda em circulação.
  el('toolClearHistory').onclick = () => {
    const completed = loans.filter(x => Boolean(x.returnedAt));
    if (!completed.length) {
      alert('Não há devoluções concluídas para apagar. Ferramentas emprestadas permanecem preservadas.');
      return;
    }
    const message = `Deseja apagar permanentemente ${completed.length} registro(s) de ferramentas já devolvidas, incluindo as assinaturas armazenadas?\n\nAs ferramentas ainda emprestadas NÃO serão apagadas.\n\nRecomendamos exportar o CSV antes de continuar.`;
    if (!confirm(message)) return;
    const previous = loans;
    loans = loans.filter(x => !x.returnedAt);
    if (!persist()) { loans = previous; return; }
    render();
    alert(`${completed.length} registro(s) de devolução apagado(s). Empréstimos em aberto preservados.`);
  };
  el('toolExport').onclick=()=>{
    const cols=['Ferramenta','Código','Mecânico','Retirada','Devolução','Condição','Status','Observação retirada','Observação devolução'];
    const rows=loans.map(x=>[x.name,x.code,x.mechanic,dateText(x.loanedAt),dateText(x.returnedAt),x.condition||'',x.returnedAt?'Devolvida':'Emprestada',x.loanNotes||'',x.returnNotes||'']);
    const esc=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const csv='﻿'+[cols,...rows].map(row=>row.map(esc).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='WLM_ferramentas.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  render();
})();
