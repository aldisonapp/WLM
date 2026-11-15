/**
 * WLM | Controle de Óleo
 * Lógica do aplicativo com suporte a liberações simultâneas em bombas diferentes
 */

// Produtos / Bombas correspondentes (B01 a B09)
const PRODUCTS = [
  'Scania Oil LDF-5 5W-20 Motor',
  'Scania Oil LDF-4 5W-30 Motor',
  'Scania Oil LDF-3 10W-40 Motor',
  'Scania E7 15W-40 Motor',
  'Scania MTF 1:0 75W-80 Câmbio',
  'Scania STO 2:0 G 75W-90 Câmbio',
  'Scania STO 1:0 80W-90 Câmbio',
  'Scania STO 2:0 A 75W-140 Diferencial',
  'Scania STO 1:0 85W-140 Diferencial'
];

const KEY = 'wlm_demo_v3';

// Carregamento do estado local (localStorage)
let state;
try {
  state = JSON.parse(localStorage.getItem(KEY)) || { records: [], actives: {} };
} catch {
  state = { records: [], actives: {} };
}

if (!Array.isArray(state.records)) {
  state.records = [];
}

// Migração retrocompatível (caso venha de versão anterior com liberação única)
if (state.active && typeof state.active === 'object') {
  if (!state.actives || typeof state.actives !== 'object') {
    state.actives = {};
  }
  state.actives[state.active.pump] = state.active;
  delete state.active;
}

if (!state.actives || typeof state.actives !== 'object') {
  state.actives = {};
}

if (!state.customProducts || typeof state.customProducts !== 'object') {
  state.customProducts = {};
}

// Retorna o nome/especificação padrão do óleo da bomba (com suporte a personalização)
const getProductName = index => {
  if (state.customProducts && state.customProducts[index]) {
    return state.customProducts[index];
  }
  return PRODUCTS[index] || '';
};

// Bomba ativa atualmente em foco no painel de finalização/cancelamento
let focusedActivePump = null;

// Funções auxiliares
const $ = id => document.getElementById(id);

const fmt = n =>
  Number(n).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const round = n => Math.round((n + Number.EPSILON) * 100) / 100;

const parse = v => {
  let s = String(v).trim().replace(/\s/g, '');
  if (!s) return NaN;
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(',', '.');
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
};

const save = () => localStorage.setItem(KEY, JSON.stringify(state));

function jump(id) {
  const el = $(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  // Atualiza destaque no menu de navegação
  document.querySelectorAll('.nav button').forEach(btn => {
    const onClickAttr = btn.getAttribute('onclick') || '';
    btn.classList.toggle('active', onClickAttr.includes(`'${id}'`));
  });
}

function status(d) {
  return Math.abs(d) < 0.005 ? 'Conforme' : d < 0 ? 'Abaixo' : 'Acima';
}

// Retorna array de índices das bombas com liberação ativa
const getActivePumps = () => Object.keys(state.actives).map(Number).sort((a, b) => a - b);

/**
 * Ação ao clicar em uma bomba no grid visual:
 * - Se estiver ocupada: foca nela na caixa de finalização e rola até lá.
 * - Se estiver livre: seleciona ela no formulário de início e rola para iniciar.
 */
function selectPump(index) {
  if (state.actives[index]) {
    // Bomba em uso -> Rola diretamente para o painel para finalizar ou cancelar!
    focusActivePump(index);
    jump('activeBox');
    setTimeout(() => {
      const finInput = $('final');
      if (finInput) {
        finInput.focus();
        finInput.select();
      }
    }, 250);
  } else {
    // Bomba livre -> Seleciona no formulário e rola para nova liberação
    const pumpSelect = $('pump');
    if (pumpSelect) {
      pumpSelect.value = String(index);
      $('oil').value = getProductName(index);
      if ($('saveAsDefaultOil')) $('saveAsDefaultOil').checked = false;
    }
    jump('release');
    setTimeout(() => {
      const osInput = $('os');
      if (osInput) osInput.focus();
    }, 250);
  }
}

/**
 * Define a bomba ativa em foco no painel de finalização
 */
function focusActivePump(index) {
  if (state.actives[index]) {
    focusedActivePump = index;
    $('final').value = '';
    draw();
  }
}

// Atualização geral da interface
function draw() {
  const records = state.records;
  const activePumps = getActivePumps();

  // Painel de indicadores
  $('nRecords').textContent = records.length;
  $('nLiters').textContent = fmt(records.reduce((s, r) => s + r.released, 0)) + ' L';
  $('nOk').textContent = records.filter(r => status(r.difference) === 'Conforme').length;
  $('nDiff').textContent = records.filter(r => status(r.difference) !== 'Conforme').length;

  // Atualiza seletor de bombas no formulário
  const currentSelected = $('pump').value;
  let firstFreeIndex = -1;

  $('pump').innerHTML = PRODUCTS.map((p, i) => {
    const isBusy = !!state.actives[i];
    const pumpName = `B${String(i + 1).padStart(2, '0')}`;
    const prodName = getProductName(i);
    if (isBusy) {
      return `<option value="${i}" disabled>${pumpName} — ${prodName} (Em andamento - OS ${state.actives[i].os})</option>`;
    } else {
      if (firstFreeIndex === -1) firstFreeIndex = i;
      return `<option value="${i}">${pumpName} — ${prodName}</option>`;
    }
  }).join('');

  const allBusy = activePumps.length >= PRODUCTS.length;
  if ($('allBusyNotice')) {
    $('allBusyNotice').classList.toggle('hide', !allBusy);
  }
  $('startForm').classList.toggle('hide', allBusy);

  if (!allBusy) {
    if (currentSelected && !state.actives[Number(currentSelected)] && Number(currentSelected) < 9) {
      $('pump').value = currentSelected;
    } else if (firstFreeIndex !== -1) {
      $('pump').value = String(firstFreeIndex);
    }
    // Preenche o campo de óleo caso esteja vazio
    if (!$('oil').value.trim()) {
      $('oil').value = getProductName(Number($('pump').value));
    }
  }

  // Grade visual das 9 bombas
  $('pumpGrid').innerHTML = PRODUCTS.map((p, i) => {
    const isBusy = !!state.actives[i];
    const pumpName = `B${String(i + 1).padStart(2, '0')}`;
    const prodName = getProductName(i);
    const r = state.actives[i];
    return `
      <div class="pump ${isBusy ? 'busy' : ''}" 
           title="${prodName}${isBusy ? ` (Em uso por ${r.mechanic} - OS ${r.os})` : ' (Livre)'}" 
           onclick="selectPump(${i})" 
           role="button" 
           tabindex="0">
        <strong>${pumpName}</strong>
        <small>${isBusy ? 'Em uso' : 'Livre'}</small>
        ${isBusy ? `<span class="pump-os-badge">OS: ${r.os}</span>` : ''}
      </div>
    `;
  }).join('');

  // Painel de Liberações em Andamento (Simultâneas)
  const hasActives = activePumps.length > 0;
  $('activeBox').classList.toggle('hide', !hasActives);

  if (hasActives) {
    $('activeCount').textContent = activePumps.length;

    // Se a bomba em foco não for válida, foca na primeira ativa
    if (focusedActivePump === null || !state.actives[focusedActivePump]) {
      focusedActivePump = activePumps[0];
    }

    // Abas para alternar entre as bombas ativas
    $('activeTabs').innerHTML = activePumps.map(i => {
      const r = state.actives[i];
      const isSelected = i === focusedActivePump;
      const pumpName = `B${String(i + 1).padStart(2, '0')}`;
      return `
        <button type="button" 
                class="activetab ${isSelected ? 'selected' : ''}" 
                onclick="focusActivePump(${i})">
          <span class="tab-dot"></span>
          ${pumpName} (OS ${r.os})
        </button>
      `;
    }).join('');

    // Detalhe da bomba ativa em foco
    const r = state.actives[focusedActivePump];
    const pumpName = `B${String(r.pump + 1).padStart(2, '0')}`;
    $('activeInfo').innerHTML = `
      <b>Bomba selecionada:</b> ${pumpName} — ${r.oil}<br>
      <b>Ordem de Serviço (OS):</b> ${r.os} &nbsp;·&nbsp; <b>Mecânico:</b> ${r.mechanic}<br>
      <b>Volume previsto:</b> ${fmt(r.expected)} L &nbsp;·&nbsp; <b>Leitura inicial:</b> ${fmt(r.initial)} L<br>
      <b>Início da liberação:</b> ${new Date(r.started).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
    `;

    $('finish').textContent = `✓ Finalizar e arquivar ${pumpName}`;
    $('cancel').textContent = `Cancelar ${pumpName}`;
  } else {
    focusedActivePump = null;
    $('final').value = '';
  }

  drawHistory();
}

// Renderização da tabela de histórico com busca
function drawHistory() {
  const q = $('search').value.trim().toLowerCase();
  const rows = state.records.filter(r =>
    [r.os, r.mechanic, r.oil, `b${String(r.pump + 1).padStart(2, '0')}`].some(v =>
      String(v).toLowerCase().includes(q)
    )
  );

  $('historyBody').replaceChildren();

  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 9;
    td.className = 'empty';
    td.textContent = 'Nenhum registro encontrado.';
    tr.append(td);
    $('historyBody').append(tr);
    return;
  }

  for (const r of rows) {
    const tr = document.createElement('tr');
    const s = status(r.difference);
    const vals = [
      new Date(r.date).toLocaleString('pt-BR'),
      r.os,
      r.mechanic,
      `B${String(r.pump + 1).padStart(2, '0')}`,
      r.oil,
      fmt(r.expected) + ' L',
      fmt(r.released) + ' L',
      (r.difference > 0 ? '+' : '') + fmt(r.difference) + ' L',
      s
    ];

    for (let i = 0; i < vals.length; i++) {
      const td = document.createElement('td');
      if (i === 8) {
        const span = document.createElement('span');
        span.className = 'status ' + (s === 'Conforme' ? 'ok' : s === 'Abaixo' ? 'under' : 'over');
        span.textContent = s;
        td.append(span);
      } else {
        td.textContent = vals[i];
      }
      tr.append(td);
    }
    $('historyBody').append(tr);
  }
}

// Eventos e Interações
$('pump').addEventListener('change', () => {
  const pumpIndex = Number($('pump').value);
  $('oil').value = getProductName(pumpIndex);
  if ($('saveAsDefaultOil')) $('saveAsDefaultOil').checked = false;
});

// Iniciar liberação (permite múltiplas simultâneas em bombas diferentes)
$('startForm').addEventListener('submit', e => {
  e.preventDefault();
  const os = $('os').value.trim();
  const mechanic = $('mechanic').value.trim();
  const pump = Number($('pump').value);
  const oil = $('oil').value.trim() || getProductName(pump);
  const expected = parse($('expected').value);
  const initial = parse($('initial').value);
  const saveAsDefault = $('saveAsDefaultOil') && $('saveAsDefaultOil').checked;

  if (!os || !mechanic || !oil || !Number.isFinite(expected) || expected < 0 || !Number.isFinite(initial) || initial < 0) {
    alert('Confira OS, mecânico, óleo/produto, litros previstos e leitura inicial. Use valores não negativos.');
    return;
  }

  if (state.actives[pump]) {
    alert(`A Bomba B${String(pump + 1).padStart(2, '0')} já possui uma liberação ativa (OS ${state.actives[pump].os}). Selecione outra bomba.`);
    return;
  }

  // Se o usuário marcou para salvar como novo padrão desta bomba
  if (saveAsDefault) {
    if (!state.customProducts || typeof state.customProducts !== 'object') {
      state.customProducts = {};
    }
    state.customProducts[pump] = oil;
  }

  state.actives[pump] = {
    os,
    mechanic,
    pump,
    oil,
    expected,
    initial,
    started: new Date().toISOString()
  };

  focusedActivePump = pump;
  save();

  // Limpa campos para permitir iniciar outra liberação em outra bomba
  $('os').value = '';
  $('mechanic').value = '';
  $('oil').value = '';
  $('expected').value = '';
  $('initial').value = '';
  if ($('saveAsDefaultOil')) $('saveAsDefaultOil').checked = false;

  draw();

  // Rola até o painel de liberações ativas
  jump('activeBox');
});

// Finalizar e arquivar a liberação em foco
$('finish').addEventListener('click', () => {
  if (focusedActivePump === null || !state.actives[focusedActivePump]) {
    alert('Nenhuma liberação em andamento selecionada.');
    return;
  }

  const r = state.actives[focusedActivePump];
  const fin = parse($('final').value);
  const pumpName = `B${String(r.pump + 1).padStart(2, '0')}`;

  if (!Number.isFinite(fin) || fin < r.initial) {
    alert(`Informe uma leitura final válida para a ${pumpName}, maior ou igual à leitura inicial (${fmt(r.initial)} L).`);
    return;
  }

  const released = round(fin - r.initial);
  const difference = round(released - r.expected);
  const record = {
    ...r,
    final: fin,
    released,
    difference,
    date: new Date().toISOString()
  };

  state.records.unshift(record);
  delete state.actives[focusedActivePump];
  save();

  // Exibição imediata no painel de conferência
  $('released').textContent = fmt(released) + ' L';
  $('planned').textContent = fmt(r.expected) + ' L';
  $('difference').textContent = (difference > 0 ? '+' : '') + fmt(difference) + ' L';

  const s = status(difference);
  $('statusWrap').innerHTML = `
    <span class="status ${s === 'Conforme' ? 'ok' : s === 'Abaixo' ? 'under' : 'over'}">
      ${s === 'Conforme' ? '✓ Conforme' : s === 'Abaixo' ? '⚠ Abaixo do previsto' : '⚠ Acima do previsto'}
    </span>
  `;

  $('final').value = '';
  focusedActivePump = null;
  draw();
});

// Cancelar liberação da bomba em foco
$('cancel').addEventListener('click', () => {
  if (focusedActivePump === null || !state.actives[focusedActivePump]) return;
  const r = state.actives[focusedActivePump];
  const pumpName = `B${String(r.pump + 1).padStart(2, '0')}`;

  if (confirm(`Deseja cancelar a liberação da ${pumpName} (OS ${r.os})?\nA bomba voltará a ficar Livre e a operação não entrará no histórico.`)) {
    delete state.actives[focusedActivePump];
    focusedActivePump = null;
    $('final').value = '';
    save();
    draw();
  }
});

// Busca no histórico
$('search').addEventListener('input', drawHistory);

// Limpar dados locais de demonstração
$('clear').addEventListener('click', () => {
  if (confirm('Apagar TODOS os registros e todas as liberações em andamento deste navegador?')) {
    state = { records: [], actives: {} };
    focusedActivePump = null;
    save();
    $('released').textContent = '— L';
    $('planned').textContent = '— L';
    $('difference').textContent = '— L';
    $('statusWrap').textContent = 'Aguardando conferência';
    draw();
  }
});

// Exportar CSV
$('export').addEventListener('click', () => {
  const fields = ['date', 'os', 'mechanic', 'pump', 'oil', 'expected', 'initial', 'final', 'released', 'difference'];
  const csv =
    '\ufeff' +
    ['Data', 'OS', 'Mecânico', 'Bomba', 'Óleo', 'Previsto (L)', 'Leitura inicial', 'Leitura final', 'Liberado (L)', 'Diferença (L)'].join(';') +
    '\r\n' +
    state.records
      .map(r =>
        fields
          .map(k => {
            let v =
              k === 'pump'
                ? `B${String(r.pump + 1).padStart(2, '0')}`
                : k === 'date'
                  ? new Date(r.date).toLocaleString('pt-BR')
                  : typeof r[k] === 'number'
                    ? String(r[k]).replace('.', ',')
                    : String(r[k] ?? '');
            return '"' + v.replace(/"/g, '""') + '"';
          })
          .join(';')
      )
      .join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'WLM_historico.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// Inicialização ao carregar a página
draw();
