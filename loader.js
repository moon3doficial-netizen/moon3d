/* Loader: mantém os assets compactados e aplica a identidade visual clara. */
(async function () {
  const root = document.getElementById('auth-root');
  try {
    if (!('DecompressionStream' in window)) {
      throw new Error('Atualize seu navegador para abrir o Moon3D.');
    }
    async function loadGzip(path) {
      const response = await fetch(path, { cache: 'no-cache' });
      if (!response.ok) throw new Error('Não foi possível carregar ' + path + ' (' + response.status + ').');
      const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
      return await new Response(stream).text();
    }
    async function loadText(path) {
      const response = await fetch(path, { cache: 'no-cache' });
      if (!response.ok) throw new Error('Não foi possível carregar ' + path + ' (' + response.status + ').');
      return await response.text();
    }
    const [baseCss, themeCss, js] = await Promise.all([
      loadGzip('styles.css.gz'),
      loadText('theme-light.css'),
      loadGzip('app.js.gz')
    ]);
    const baseStyle = document.createElement('style');
    baseStyle.textContent = baseCss;
    document.head.appendChild(baseStyle);
    const themeStyle = document.createElement('style');
    themeStyle.textContent = themeCss;
    document.head.appendChild(themeStyle);
    const script = document.createElement('script');
    script.textContent = js.replaceAll('logo-moon3d-completa.jpg', 'logo-moon3d-completa.webp');

    document.body.appendChild(script);
    /* Quadro simples de atividades no Dashboard: itens concluídos são removidos, sem histórico. */
    db.atividades = Array.isArray(db.atividades) ? db.atividades : [];
    const renderMoon3DTasks = () => {
      const tasks = Array.isArray(db.atividades) ? db.atividades : [];
      const taskRows = tasks.length ? '<ul class="moon3d-task-list">' + tasks.map(task =>
        '<li class="moon3d-task-item"><span class="moon3d-task-text">' + escapeHTML(task.texto || '') + '</span>' +
        '<button type="button" class="moon3d-task-done" data-task-complete="' + escapeHTML(task.id || '') + '">Concluído</button></li>'
      ).join('') + '</ul>' : '<div class="moon3d-task-empty"><strong>Nenhuma atividade anotada</strong><span>Escreva uma tarefa acima para ela aparecer aqui.</span></div>';
      return '<section class="panel moon3d-task-panel" aria-label="Quadro de atividades">' +
        '<div class="panel-head"><div><h3>Quadro de atividades</h3><span class="muted">Anote o que precisa fazer e remova ao concluir.</span></div>' +
        '<span class="tag green">' + tasks.length + ' pendente(s)</span></div>' +
        '<form id="moon3d-task-form" class="moon3d-task-form"><input id="moon3d-task-input" name="atividade" type="text" maxlength="180" required autocomplete="off" placeholder="Ex.: Comprar filamento branco">' +
        '<button type="submit" class="btn">＋ Adicionar</button></form>' + taskRows + '</section>';
    };
    if (typeof views !== 'undefined' && typeof views.dashboard === 'function') {
      const originalDashboardView = views.dashboard;
      views.dashboard = function () {
        let html = originalDashboardView();

        /* Atualiza os nomes e acrescenta o indicador percentual solicitado. */
        const revenue = db.vendas.reduce((total, sale) => total + (Number(sale.preco) || 0), 0);
        const productionCost = db.vendas.reduce((total, sale) => total + costOf(sale), 0);
        const netProfit = revenue - productionCost;
        const investment = revenue - netProfit;
        const receivable = db.vendas.reduce((total, sale) =>
          total + (['nao', 'não'].includes(String(sale.pago || '').trim().toLowerCase())
            ? (Number(sale.preco) || 0)
            : 0), 0);
        const roi = investment > 0 ? (netProfit / investment) * 100 : null;

        const marginCardPattern = new RegExp('<div class="metric [^\\"]*"><div class="label">Margem líquida</div><div class="value">[^<]*</div><div class="hint">Lucro líquido ÷ faturamento</div></div>');
        const marginCard = html.match(marginCardPattern);
        if (marginCard) {
          const renamedMarginCard = marginCard[0].replace('Margem líquida', 'Margem de lucro');
          const investmentCard = '<div class="metric yellow"><div class="label">Investimento</div><div class="value">' +
            money(investment) +
            '</div><div class="hint">Faturamento − lucro líquido</div></div>';
          const roiCard = '<div class="metric green"><div class="label">ROI</div><div class="value">' +
            (roi === null ? '—' : roi.toFixed(1).replace('.', ',') + '%') +
            '</div><div class="hint">(Lucro líquido ÷ investimento) × 100</div></div>';
          const receivableCard = '<div class="metric yellow"><div class="label">A Receber</div><div class="value">' +
            money(receivable) +
            '</div><div class="hint">Vendas com pagamento pendente</div></div>';
          html = html.replace(marginCard[0], investmentCard + renamedMarginCard + roiCard + receivableCard);
        }

        html = html.replaceAll('Lucro líquido operacional', 'Lucro líquido');

        /* Mantém o quadro de atividades depois do histórico e resultado acumulado. */
        const marker = '</div><div class="panel" style="margin-top:18px">';
        const insertion = '</div>' + renderMoon3DTasks() + '<div class="panel" style="margin-top:18px">';
        return html.includes(marker) ? html.replace(marker, insertion) : html;
      };
    }
    const moon3dDashboard = document.querySelector('#app');
    if (moon3dDashboard) {
      moon3dDashboard.addEventListener('submit', event => {
        const form = event.target.closest('#moon3d-task-form');
        if (!form) return;
        event.preventDefault();
        const input = form.querySelector('#moon3d-task-input');
        const texto = String(input?.value || '').trim();
        if (!texto) return;
        db.atividades = Array.isArray(db.atividades) ? db.atividades : [];
        db.atividades.unshift({ id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(36).slice(2)), texto });
        save();
        toast('Atividade adicionada.');
      });
      moon3dDashboard.addEventListener('click', event => {
        const button = event.target.closest('[data-task-complete]');
        if (!button) return;
        const id = button.getAttribute('data-task-complete');
        const before = db.atividades.length;
        db.atividades = db.atividades.filter(task => String(task.id) !== String(id));
        if (db.atividades.length !== before) { save(); toast('Atividade concluída e removida.'); }
      });
    }
    const moon3dTaskStyle = document.createElement('style');
    moon3dTaskStyle.textContent = `
      .moon3d-task-panel { margin: 16px 0 18px; }
      .moon3d-task-form { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 9px; margin: 12px 0; }
      .moon3d-task-form input { width: 100%; min-width: 0; min-height: 42px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); font: inherit; }
      .moon3d-task-list { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
      .moon3d-task-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--panel); }
      .moon3d-task-text { min-width: 0; color: var(--text); font-size: 13px; line-height: 1.4; overflow-wrap: anywhere; }
      .moon3d-task-done { flex: 0 0 auto; border: 1px solid #d6e7b9; border-radius: 8px; padding: 7px 10px; background: #f2f8e9; color: #527b16; font-size: 11px; font-weight: 700; cursor: pointer; }
      .moon3d-task-done:active { transform: scale(.98); }
      .moon3d-task-empty { display: flex; flex-direction: column; gap: 4px; padding: 13px; border: 1px dashed var(--border); border-radius: 10px; color: var(--muted); font-size: 12px; }
      .moon3d-task-empty strong { color: var(--text); font-size: 13px; }
      @media (max-width:700px) {
        .moon3d-task-panel { margin: 12px 0 14px; padding: 12px; }
        .moon3d-task-panel .panel-head { align-items: center; }
        .moon3d-task-panel .panel-head h3 { font-size: 13px; }
        .moon3d-task-panel .panel-head .muted { display: block; font-size: 9px; }
        .moon3d-task-form { grid-template-columns: minmax(0,1fr) auto; gap: 6px; margin: 9px 0; }
        .moon3d-task-form input { min-height: 38px; padding: 8px 9px; font-size: 12px; }
        .moon3d-task-form .btn { width: auto; min-height: 38px; padding: 8px 10px; font-size: 10px; white-space: nowrap; }
        .moon3d-task-list { gap: 6px; }
        .moon3d-task-item { padding: 8px 9px; gap: 8px; }
        .moon3d-task-text { font-size: 11px; }
        .moon3d-task-done { padding: 7px 8px; font-size: 9px; }
      }
    `;
    document.head.appendChild(moon3dTaskStyle);

    /* Correção: tempo de mão de obra é separado do tempo de impressão. */
    const originalOpenForm = window.openForm;
    if (typeof originalOpenForm === 'function') {
      window.openForm = function (type, index = null) {
        const result = originalOpenForm.apply(this, arguments);
        if (type !== 'vendas' && type !== 'orcamentos') return result;

        const form = document.getElementById('record-form');
        const printHours = form && form.querySelector('[name="horas"]');
        if (!form || !printHours || form.querySelector('[name="horasMaoObra"]')) return result;

        const laborField = document.createElement('div');
        laborField.className = 'field';
        laborField.innerHTML = '<label for="moon3d-labor-hours">Horas de mão de obra (total da venda)</label>' +
          '<input id="moon3d-labor-hours" name="horasMaoObra" type="number" min="0" step="0.01" placeholder="Ex.: 0,5">';
        printHours.closest('.field').insertAdjacentElement('afterend', laborField);

        const saved = index !== null && db[type][index] ? db[type][index].horasMaoObra : '';
        const laborInput = laborField.querySelector('input');
        laborInput.value = saved ?? '';

        const refreshLaborPreview = () => {
          const values = Object.fromEntries(new FormData(form).entries());
          const multiplier = Number(values.multiplicador) || 1.8;
          const laborHours = Number(values.horasMaoObra) || 0;
          const estimate = {
            ...(index !== null && db[type][index] ? db[type][index] : {}),
            ...values,
            quantidade: Number(values.quantidade) || 0,
            gramas: Number(values.gramas) || 0,
            horas: Number(values.horas) || 0,
            horasMaoObra: laborHours,
            multiplicador: multiplier
          };
          const productionCost = costOf(estimate);
          const laborCost = (Number(db.settings.labor) || 0) * laborHours;
          const suggested = productionCost * multiplier + laborCost;
          const preview = form.querySelector('#price-preview');
          if (!preview) return;
          const multiplierText = multiplier.toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1});
          preview.innerHTML =
            '<div class="preview-heading"><strong>Prévia do preço sugerido</strong><span>Atualização automática</span></div>' +
            '<div class="preview-breakdown">' +
              '<div><span>Custo de produção</span><b>' + money(productionCost) + '</b></div>' +
              '<div><span>Mão de obra (' + laborHours.toLocaleString('pt-BR') + ' h)</span><b>' + money(laborCost) + '</b></div>' +
              '<div><span>Multiplicador</span><b>' + multiplierText + '×</b></div>' +
            '</div>' +
            '<div class="preview-total"><span>Valor sugerido</span><strong>' + money(suggested) + '</strong></div>' +
            '<small>Fórmula: (custo de produção × ' + multiplierText + ') + (horas de mão de obra × ' + money(db.settings.labor || 0) + '/h). As horas de impressão não entram na mão de obra. O valor cobrado continua sendo definido por você.</small>';
        };
        form.addEventListener('input', refreshLaborPreview);
        form.addEventListener('change', refreshLaborPreview);
        refreshLaborPreview();
        return result;
      };
    }


    /* MOON3D_QUOTE_WHATSAPP_V1 — campos opcionais e mensagem editável para WhatsApp nos orçamentos. */
    const quoteExtraGroups = [
      { title:'Dimensões', fields:[
        {name:'largura',label:'Largura (cm)',placeholder:'Ex.: 20'},
        {name:'altura',label:'Altura (cm)',placeholder:'Ex.: 22'},
        {name:'profundidade',label:'Profundidade (cm)',placeholder:'Ex.: 4'}
      ]},
      { title:'Características', fields:[
        {name:'cor',label:'Cor',placeholder:'Ex.: Branco'},
        {name:'material',label:'Material',placeholder:'Ex.: PLA'},
        {name:'acabamento',label:'Acabamento',placeholder:'Ex.: Liso'},
        {name:'personalizacao',label:'Personalização',placeholder:'Ex.: Nome gravado'},
        {name:'modelo',label:'Modelo',placeholder:'Ex.: Personalizado'}
      ]},
      { title:'Entrega', fields:[
        {name:'prazoProducao',label:'Prazo de produção',placeholder:'Ex.: 5 dias úteis'},
        {name:'dataEntrega',label:'Data de entrega',type:'date'},
        {name:'formaEntrega',label:'Forma de entrega',placeholder:'Ex.: Retirada ou entrega'}
      ]}
    ];
    const quoteText = value => String(value == null ? '' : value).trim();
    const quoteNormalize = value => quoteText(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const quoteGet = (record, keys) => {
      for (const key of keys) if (record && record[key] != null && quoteText(record[key]) !== '') return record[key];
      return '';
    };
    const quoteParseCustom = raw => {
      if (Array.isArray(raw)) return raw;
      if (raw && typeof raw === 'object') return Object.entries(raw).map(([label,value]) => ({label,value}));
      if (typeof raw === 'string' && raw.trim()) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
          if (parsed && typeof parsed === 'object') return Object.entries(parsed).map(([label,value]) => ({label,value}));
        } catch (_) {}
      }
      return [];
    };
    const quoteFormatMoney = value => {
      if (value == null || quoteText(value) === '') return '';
      const numeric = typeof value === 'number' ? value : Number(String(value).replace(/[^\d,.-]/g,'').replace(/\.(?=.*[,])/g,'').replace(',','.'));
      return Number.isFinite(numeric) && typeof money === 'function' ? money(numeric) : quoteText(value);
    };
    const quoteSyncCustom = (form, hidden) => {
      hidden.value = JSON.stringify(Array.from(form.querySelectorAll('.moon3d-quote-custom-row')).map(row => ({
        label:quoteText(row.querySelector('[data-custom-label]')?.value),
        value:quoteText(row.querySelector('[data-custom-value]')?.value)
      })).filter(item => item.label && item.value));
    };

    const previousMoon3DOpenForm = window.openForm;
    if (typeof previousMoon3DOpenForm === 'function') {
      window.openForm = function(type, index = null) {
        const result = previousMoon3DOpenForm.apply(this, arguments);
        if (type !== 'orcamentos') return result;
        const form = document.getElementById('record-form');
        if (!form || form.dataset.moon3dQuoteFields === 'yes') return result;
        const record = index !== null && db.orcamentos && db.orcamentos[index] ? db.orcamentos[index] : {};
        form.dataset.moon3dQuoteFields = 'yes';

        const section = document.createElement('div');
        section.className = 'moon3d-quote-extra';
        const heading = document.createElement('div');
        heading.className = 'moon3d-quote-extra-heading';
        heading.innerHTML = '<strong>Informações para a mensagem do WhatsApp</strong><span>Todos os campos são opcionais. Campos vazios não aparecem na mensagem.</span>';
        section.appendChild(heading);

        quoteExtraGroups.forEach(group => {
          const groupBox = document.createElement('section');
          groupBox.className = 'moon3d-quote-group';
          const title = document.createElement('h4');
          title.textContent = group.title;
          const grid = document.createElement('div');
          grid.className = 'moon3d-quote-fields-grid';
          group.fields.forEach(field => {
            if (form.querySelector('[name="' + field.name + '"]')) return;
            const wrap = document.createElement('div');
            wrap.className = 'field moon3d-quote-field';
            const id = 'moon3d-quote-' + field.name;
            const label = document.createElement('label');
            label.htmlFor = id;
            label.textContent = field.label;
            const input = document.createElement('input');
            input.id = id;
            input.name = field.name;
            input.type = field.type || 'text';
            input.placeholder = field.placeholder || '';
            if (['largura','altura','profundidade'].includes(field.name)) input.inputMode = 'decimal';
            input.value = record[field.name] == null ? '' : record[field.name];
            wrap.append(label,input);
            grid.appendChild(wrap);
          });
          groupBox.append(title,grid);
          section.appendChild(groupBox);
        });

        const notesGroup = document.createElement('section');
        notesGroup.className = 'moon3d-quote-group';
        const notesTitle = document.createElement('h4');
        notesTitle.textContent = 'Informações adicionais';
        const notesField = document.createElement('div');
        notesField.className = 'field moon3d-quote-field';
        const notesLabel = document.createElement('label');
        notesLabel.htmlFor = 'moon3d-quote-observacoes';
        notesLabel.textContent = 'Observações';
        const notesInput = document.createElement('textarea');
        notesInput.id = 'moon3d-quote-observacoes';
        notesInput.name = 'observacoesOrcamento';
        notesInput.rows = 2;
        notesInput.placeholder = 'Informações extras para o cliente';
        notesInput.value = record.observacoesOrcamento || '';
        notesField.append(notesLabel,notesInput);
        notesGroup.append(notesTitle,notesField);
        section.appendChild(notesGroup);

        const customGroup = document.createElement('section');
        customGroup.className = 'moon3d-quote-group';
        const customTitle = document.createElement('h4');
        customTitle.textContent = 'Campos personalizados';
        const customList = document.createElement('div');
        customList.className = 'moon3d-quote-custom-list';
        const hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = 'informacoesPersonalizadas';
        hidden.value = JSON.stringify(quoteParseCustom(record.informacoesPersonalizadas));
        const addCustomRow = (labelValue = '', valueValue = '') => {
          const row = document.createElement('div');
          row.className = 'moon3d-quote-custom-row';
          const labelWrap = document.createElement('div');
          labelWrap.className = 'field';
          const labelCaption = document.createElement('label');
          labelCaption.textContent = 'Nome da informação';
          const labelInput = document.createElement('input');
          labelInput.type = 'text';
          labelInput.placeholder = 'Ex.: Frase';
          labelInput.dataset.customLabel = 'true';
          labelInput.value = labelValue;
          labelWrap.append(labelCaption,labelInput);
          const valueWrap = document.createElement('div');
          valueWrap.className = 'field';
          const valueCaption = document.createElement('label');
          valueCaption.textContent = 'Informação';
          const valueInput = document.createElement('input');
          valueInput.type = 'text';
          valueInput.placeholder = 'Ex.: Minha formatura!';
          valueInput.dataset.customValue = 'true';
          valueInput.value = valueValue;
          valueWrap.append(valueCaption,valueInput);
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'btn secondary moon3d-quote-remove-field';
          remove.textContent = 'Remover';
          remove.addEventListener('click',() => {
            if (!window.confirm('Deseja remover este campo personalizado?')) return;
            row.remove();
            quoteSyncCustom(form,hidden);
          });
          row.append(labelWrap,valueWrap,remove);
          customList.appendChild(row);
          labelInput.addEventListener('input',() => quoteSyncCustom(form,hidden));
          valueInput.addEventListener('input',() => quoteSyncCustom(form,hidden));
        };
        quoteParseCustom(record.informacoesPersonalizadas).forEach(item => addCustomRow(item.label || item.nome || '',item.value || item.valor || ''));
        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'btn secondary moon3d-quote-add-field';
        addButton.textContent = '+ Adicionar informação';
        addButton.addEventListener('click',() => addCustomRow());
        customGroup.append(customTitle,customList,addButton,hidden);
        section.appendChild(customGroup);

        const submit = form.querySelector('button[type="submit"],input[type="submit"]');
        const actionArea = submit && (submit.closest('.form-actions, .modal-actions, .actions') || submit);
        if (actionArea && actionArea.parentNode === form) form.insertBefore(section,actionArea);
        else form.appendChild(section);
        quoteSyncCustom(form,hidden);

        if (!document.getElementById('moon3d-quote-extra-style')) {
          const style = document.createElement('style');
          style.id = 'moon3d-quote-extra-style';
          style.textContent = '.moon3d-quote-extra{grid-column:1/-1;display:grid;gap:14px;margin-top:12px;padding-top:16px;border-top:1px solid var(--border,rgba(128,128,128,.25))}.moon3d-quote-extra-heading{display:grid;gap:4px}.moon3d-quote-extra-heading strong{font-size:14px}.moon3d-quote-extra-heading span{color:var(--muted,#888);font-size:12px}.moon3d-quote-group{display:grid;gap:9px;min-width:0}.moon3d-quote-group h4{margin:0;font-size:13px}.moon3d-quote-fields-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:10px}.moon3d-quote-custom-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;align-items:end;gap:10px;margin-bottom:9px}.moon3d-quote-remove-field{min-height:40px;white-space:nowrap}.moon3d-quote-add-field{justify-self:start}.moon3d-quote-extra input,.moon3d-quote-extra textarea{max-width:100%;box-sizing:border-box}@media(max-width:620px){.moon3d-quote-custom-row{grid-template-columns:1fr}.moon3d-quote-remove-field{justify-self:start}}';
          document.head.appendChild(style);
        }
        return result;
      };
    }

    const buildMoon3DQuoteMessage = record => {
      const lines = ['🎓 MOON 3D – ORÇAMENTO'];
      const addLine = (label,value) => { const clean = quoteText(value); if (clean) lines.push(label + ': ' + clean); };
      addLine('Cliente',quoteGet(record,['cliente','nomeCliente','nome']));
      addLine('Produto',quoteGet(record,['produto','nomeProduto','descricao','produtoNome']));

      const dimensions = [];
      [['Largura','largura'],['Altura','altura'],['Profundidade','profundidade']].forEach(([label,key]) => {
        const value = quoteText(record[key]);
        if (value) dimensions.push(label + ': ' + value + ' cm');
      });
      if (dimensions.length) lines.push('','📏 Dimensões:',...dimensions);

      const characteristics = [];
      [['Cor','cor'],['Material','material'],['Acabamento','acabamento'],['Personalização','personalizacao'],['Modelo','modelo']].forEach(([label,key]) => {
        const value = quoteText(record[key]);
        if (value) characteristics.push(label + ': ' + value);
      });
      if (characteristics.length) lines.push('','🎨 Características:',...characteristics);

      const additional = [];
      quoteParseCustom(record.informacoesPersonalizadas).forEach(item => {
        const label = quoteText(item.label || item.nome);
        const value = quoteText(item.value || item.valor);
        if (label && value) additional.push(label + ': ' + value);
      });
      [['Prazo de produção',['prazoProducao','prazo']],['Data de entrega',['dataEntrega']],['Forma de entrega',['formaEntrega']],['Observações',['observacoesOrcamento','observacoes']]].forEach(([label,keys]) => {
        const value = quoteGet(record,keys);
        if (quoteText(value)) additional.push(label + ': ' + quoteText(value));
      });
      if (additional.length) lines.push('','📝 Informações adicionais:',...additional);

      const total = quoteFormatMoney(quoteGet(record,['precoProposto','valorProposto','valorTotal','preco','valor']));
      if (total) lines.push('','💰 Valor total: ' + total);
      lines.push('','Se estiver tudo certo, é só me confirmar para darmos andamento ao pedido! 😊');
      return lines.join('\n');
    };

    const openMoon3DQuoteMessage = record => {
      document.getElementById('moon3d-quote-message-modal')?.remove();
      const overlay = document.createElement('div');
      overlay.id = 'moon3d-quote-message-modal';
      overlay.className = 'modal-backdrop moon3d-quote-message-backdrop';
      const panel = document.createElement('div');
      panel.className = 'modal moon3d-quote-message-panel';
      panel.setAttribute('role','dialog');
      panel.setAttribute('aria-modal','true');
      panel.innerHTML = '<div class="modal-header"><h3>Mensagem para WhatsApp</h3><button type="button" class="btn secondary moon3d-quote-message-close" aria-label="Fechar">×</button></div><p class="moon3d-quote-message-hint">Revise e edite a mensagem. As alterações aqui não modificam o orçamento salvo.</p><textarea class="moon3d-quote-message-text" rows="15"></textarea><div class="moon3d-quote-message-actions"><button type="button" class="btn secondary moon3d-quote-message-close">Fechar</button><button type="button" class="btn primary moon3d-quote-message-copy">Copiar mensagem</button></div>';
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      const textarea = panel.querySelector('textarea');
      textarea.value = buildMoon3DQuoteMessage(record);
      const close = () => overlay.remove();
      panel.querySelectorAll('.moon3d-quote-message-close').forEach(button => button.addEventListener('click',close));
      overlay.addEventListener('click',event => { if (event.target === overlay) close(); });
      panel.querySelector('.moon3d-quote-message-copy').addEventListener('click',async () => {
        const text = textarea.value;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
          else { textarea.focus(); textarea.select(); document.execCommand('copy'); }
          const button = panel.querySelector('.moon3d-quote-message-copy');
          button.textContent = 'Mensagem copiada!';
          setTimeout(() => { if (button.isConnected) button.textContent = 'Copiar mensagem'; },2200);
        } catch (_) {
          textarea.focus();
          textarea.select();
          panel.querySelector('.moon3d-quote-message-copy').textContent = 'Selecione e copie a mensagem';
        }
      });
      textarea.focus();
    };

    const resolveMoon3DQuoteIndex = (row,rowIndex,headers) => {
      const inline = Array.from(row.querySelectorAll('[onclick]')).map(element => element.getAttribute('onclick') || '').join(' ');
      const match = inline.match(/(?:orcamentos|orcamento)\s*['"]?\s*,\s*(\d+)/i);
      if (match && db.orcamentos[Number(match[1])]) return Number(match[1]);
      const clientColumn = headers.findIndex(header => quoteNormalize(header).includes('cliente'));
      const productColumn = headers.findIndex(header => quoteNormalize(header).includes('produto'));
      const clientText = clientColumn >= 0 ? quoteNormalize(row.children[clientColumn]?.textContent) : '';
      const productText = productColumn >= 0 ? quoteNormalize(row.children[productColumn]?.textContent) : '';
      if (clientText || productText) {
        const found = db.orcamentos.findIndex(item =>
          (!clientText || quoteNormalize(quoteGet(item,['cliente','nomeCliente','nome'])) === clientText) &&
          (!productText || quoteNormalize(quoteGet(item,['produto','nomeProduto','descricao','produtoNome'])) === productText)
        );
        if (found >= 0) return found;
      }
      return db.orcamentos[rowIndex] ? rowIndex : -1;
    };

    const applyMoon3DQuoteWhatsAppButtons = () => {
      const page = document.querySelector('#page-title')?.textContent.trim() || '';
      const table = document.querySelector('#data-table');
      if (page !== 'Orçamentos' || !table || !db.orcamentos) return;
      const headers = Array.from(table.querySelector('thead tr')?.children || []).map(cell => cell.textContent.trim());
      Array.from(table.querySelectorAll('tbody tr')).forEach((row,rowIndex) => {
        if (row.querySelector('.moon3d-quote-whatsapp-btn')) return;
        const cells = Array.from(row.children);
        let actionIndex = headers.findIndex(header => quoteNormalize(header).includes('acoes'));
        if (actionIndex < 0) actionIndex = cells.length - 1;
        const actionCell = cells[actionIndex];
        if (!actionCell) return;
        const quoteIndex = resolveMoon3DQuoteIndex(row,rowIndex,headers);
        if (quoteIndex < 0) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn secondary moon3d-quote-whatsapp-btn';
        button.textContent = '📲 Gerar mensagem WhatsApp';
        button.addEventListener('click',event => {
          event.preventDefault();
          event.stopPropagation();
          const quote = db.orcamentos[quoteIndex];
          if (quote) openMoon3DQuoteMessage(quote);
        });
        actionCell.appendChild(button);
      });
    };

    const quoteMessageStyle = document.createElement('style');
    quoteMessageStyle.textContent = '.moon3d-quote-whatsapp-btn{margin:5px 0 0;white-space:nowrap;font-size:12px}.moon3d-quote-message-backdrop{z-index:10050;padding:18px}.moon3d-quote-message-panel{width:min(620px,100%);max-height:min(88vh,850px);overflow:auto;display:grid;gap:12px;padding:18px}.moon3d-quote-message-panel .modal-header{display:flex;align-items:center;justify-content:space-between;gap:12px}.moon3d-quote-message-panel .modal-header h3{margin:0}.moon3d-quote-message-hint{margin:0;color:var(--muted,#888);font-size:12px}.moon3d-quote-message-text{width:100%;min-height:280px;resize:vertical;box-sizing:border-box;line-height:1.55}.moon3d-quote-message-actions{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8px}@media(max-width:620px){.moon3d-quote-message-backdrop{padding:10px}.moon3d-quote-message-panel{padding:14px}.moon3d-quote-whatsapp-btn{white-space:normal;width:100%}}';
    document.head.appendChild(quoteMessageStyle);

    /* Vendas: aplica a ordem diretamente na tabela sempre que ela for recriada. */
    const salesStyle = document.createElement('style');
    salesStyle.textContent = `
      #data-table .moon3d-progress-cell { min-width: 132px; width: 132px; }
      #data-table .moon3d-progress-control { display: grid; gap: 7px; min-width: 112px; }
      #data-table .moon3d-progress-meta { display: flex; align-items: center; justify-content: center; text-align: center; }
      #data-table .moon3d-progress-value { display: inline-flex; align-items: center; justify-content: center; min-width: 46px; padding: 3px 9px; border-radius: 999px; background: #eef6df; color: #4e7900; font-size: 12px; font-weight: 750; font-variant-numeric: tabular-nums; }
      #data-table .moon3d-progress-slider { appearance: none; -webkit-appearance: none; display: block; width: 100%; height: 8px; margin: 3px 0 5px; border: 0; border-radius: 999px; outline: none; cursor: pointer; background: linear-gradient(to right, #83bd18 0%, #83bd18 var(--progress, 0%), #e7ebdf var(--progress, 0%), #e7ebdf 100%); }
      #data-table .moon3d-progress-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; border: 3px solid #fff; border-radius: 50%; background: #70a900; box-shadow: 0 1px 4px rgba(0,0,0,.22); }
      #data-table .moon3d-progress-slider::-moz-range-thumb { width: 11px; height: 11px; border: 3px solid #fff; border-radius: 50%; background: #70a900; box-shadow: 0 1px 4px rgba(0,0,0,.22); }
      #data-table .moon3d-progress-slider:focus-visible { outline: 2px solid #70a900; outline-offset: 4px; }
    `;
    document.head.appendChild(salesStyle);

    const normalizeSalesHeader = value => String(value || '')
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

    const applyMoon3DSalesOrder = () => {
      const activePage = document.querySelector('#page-title')?.textContent.trim();
      if (activePage !== 'Vendas') return;
      const table = document.querySelector('#data-table');
      if (!table || table.dataset.moon3dSalesOrder === 'done') return;
      const headRow = table.querySelector('thead tr');
      if (!headRow) return;

      const headers = Array.from(headRow.children);
      const findHeader = key => headers.find(cell => normalizeSalesHeader(cell.textContent).includes(key));
      const finalHeader = findHeader('finalizado');
      const deliveredHeader = findHeader('entregue');
      const paidHeader = findHeader('pago');
      const orderHeader = findHeader('ordem');
      if (!orderHeader || !finalHeader || !deliveredHeader || !paidHeader) return;

      const actionHeader = findHeader('acoes') || headers[headers.length - 1];
      const oldProgressHeader = findHeader('producao');
      const progressHeader = oldProgressHeader || document.createElement('th');
      progressHeader.textContent = 'PRODUÇÃO (%)';

      const regularHeaders = headers.filter(cell =>
        cell !== finalHeader &&
        cell !== deliveredHeader &&
        cell !== paidHeader &&
        cell !== oldProgressHeader &&
        cell !== actionHeader
      );
      const orderedHeaders = [
        ...regularHeaders,
        progressHeader,
        finalHeader,
        deliveredHeader,
        paidHeader,
        actionHeader
      ];
      orderedHeaders.forEach(cell => headRow.appendChild(cell));

      const rows = Array.from(table.querySelectorAll('tbody tr'));
      rows.forEach((row, rowIndex) => {
        const oldCells = Array.from(row.children);
        if (oldCells.length !== headers.length) return;
        const cellFor = header => oldCells[headers.indexOf(header)];
        const orderCell = cellFor(orderHeader);
        const orderNumber = orderCell ? orderCell.textContent.trim() : '';
        const sale = db.vendas.find(item => String(item.ordem) === orderNumber) || db.vendas[rowIndex];
        if (!sale) return;

        const progressCell = oldProgressHeader ? cellFor(oldProgressHeader) : document.createElement('td');
        const progress = Math.min(100, Math.max(0, Number(sale.producao) || 0));
        progressCell.className = 'moon3d-progress-cell';
        progressCell.innerHTML =
          '<div class="moon3d-progress-control">' +
            '<div class="moon3d-progress-meta">' +
              '<strong class="moon3d-progress-value">' + progress + '%</strong>' +
            '</div>' +
            '<input class="moon3d-progress-slider" type="range" min="0" max="100" step="1" aria-label="Produção do pedido em porcentagem" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + progress + '" value="' + progress + '" style="--progress:' + progress + '%">' +
          '</div>';

        const input = progressCell.querySelector('.moon3d-progress-slider');
        const valueLabel = progressCell.querySelector('.moon3d-progress-value');
        const updateProgressVisual = value => {
          valueLabel.textContent = value + '%';
          input.style.setProperty('--progress', value + '%');
          input.setAttribute('aria-valuenow', String(value));
        };
        input.addEventListener('input', () => {
          updateProgressVisual(Number(input.value));
        });
        input.addEventListener('change', () => {
          const next = Math.min(100, Math.max(0, Math.round(Number(input.value) || 0)));
          const previous = Math.min(100, Math.max(0, Number(sale.producao) || 0));
          updateProgressVisual(next);
          if (next === previous) return;
          sale.producao = next;
          save();
        });

        [
          ...regularHeaders.map(cellFor),
          progressCell,
          cellFor(finalHeader),
          cellFor(deliveredHeader),
          cellFor(paidHeader),
          cellFor(actionHeader)
        ].filter(Boolean).forEach(cell => row.appendChild(cell));
      });

      table.dataset.moon3dSalesOrder = 'done';
    };

    /* A listagem é recriada pelo aplicativo ao salvar e filtrar; observa cada nova tabela. */

    let hidePaidAndDeliveredOrders = true;
    let lastSalesVisibilityPage = null;
    const updatePaidDeliveredVisibility = () => {
      const pageTitle = document.querySelector('#page-title');
      const currentPage = pageTitle?.textContent.trim() || '';
      const toolbar = document.querySelector('.toolbar');
      if (currentPage !== lastSalesVisibilityPage) {
        if (currentPage === 'Vendas') hidePaidAndDeliveredOrders = true;
        lastSalesVisibilityPage = currentPage;
      }
      if (currentPage !== 'Vendas') {
        toolbar?.querySelector('.moon3d-toggle-completed')?.remove();
        return;
      }
      if (!toolbar) return;

      let toggle = toolbar.querySelector('.moon3d-toggle-completed');
      if (!toggle) {
        toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'btn secondary moon3d-toggle-completed';
        toggle.addEventListener('click', () => {
          hidePaidAndDeliveredOrders = !hidePaidAndDeliveredOrders;
          updatePaidDeliveredVisibility();
        });
        toolbar.appendChild(toggle);
      }
      const toggleLabel = hidePaidAndDeliveredOrders
        ? 'Mostrar pedidos finalizados'
        : 'Ocultar pedidos finalizados';
      if (toggle.textContent !== toggleLabel) toggle.textContent = toggleLabel;
      const pressed = String(hidePaidAndDeliveredOrders);
      if (toggle.getAttribute('aria-pressed') !== pressed) toggle.setAttribute('aria-pressed', pressed);

      const table = document.querySelector('#data-table');
      if (!table) return;
      Array.from(table.querySelectorAll('tbody tr')).forEach((row, rowIndex) => {
        const orderNumber = row.children[0]?.textContent.trim() || '';
        const sale = db.vendas.find(item => String(item.ordem) === orderNumber) || db.vendas[rowIndex];
        const finalized = !!sale &&
          ['finalizado', 'entregue', 'pago'].every(field => String(sale[field] || '').trim().toLowerCase() === 'sim');
        row.classList.toggle('moon3d-hide-completed', hidePaidAndDeliveredOrders && finalized);
      });
    };

    salesStyle.textContent += `
      #data-table .moon3d-hide-completed { display: none !important; }
      .moon3d-toggle-completed { white-space: nowrap; }
      @media (max-width: 720px) {
        .toolbar { flex-wrap: wrap; }
        .moon3d-toggle-completed { width: 100%; }
      }
    `;

    const applyMoon3DQuoteLayout = () => {
      const pageTitle = document.querySelector('#page-title');
      if (!pageTitle || pageTitle.textContent.trim() !== 'Orçamentos') return;

      const table = document.querySelector('#data-table');
      if (!table) return;
      const headerRow = table.querySelector('thead tr');
      if (!headerRow) return;

      const headers = Array.from(headerRow.children);
      const rows = Array.from(table.querySelectorAll('tbody tr'));
      const statusColumns = headers
        .map((cell, index) => ({ cell, index, name: normalizeSalesHeader(cell.textContent) }))
        .filter(item => ['producao', 'finalizado', 'entregue', 'pago'].some(key => item.name.includes(key)));

      statusColumns.forEach(({cell, index}) => {
        cell.style.display = 'none';
        rows.forEach(row => {
          const matchingCell = row.children[index];
          if (matchingCell) matchingCell.style.display = 'none';
        });
      });

      const toolbar = document.querySelector('.toolbar');
      toolbar?.querySelector('.moon3d-toggle-completed')?.remove();
    };

    /* Impede que o formulário feche ao clicar fora do conteúdo. */
    document.addEventListener('click', event => {
      if (event.target?.classList?.contains('modal-backdrop')) event.stopPropagation();
    }, true);

    /* Dashboard: dá espaço ao nome e mostra o preço cadastrado do produto em estoque. */
    const dashboardStockStyle = document.createElement('style');
    dashboardStockStyle.textContent = `
      .moon3d-stock-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr)) !important; gap: 14px !important; }
      .moon3d-stock-card { display: flex !important; flex-direction: column !important; align-items: stretch !important; gap: 12px !important; padding: 14px !important; }
      .moon3d-stock-card > img, .moon3d-stock-card > div:first-child { width: 100% !important; max-width: 100% !important; height: 158px !important; flex: 0 0 158px !important; box-sizing: border-box !important; object-fit: contain !important; }
      .moon3d-stock-info { width: 100% !important; min-width: 0 !important; display: flex !important; flex-direction: column !important; align-items: flex-start !important; gap: 7px !important; }
      .moon3d-stock-name { display: block !important; width: 100% !important; white-space: normal !important; overflow-wrap: anywhere !important; font-size: 14px !important; line-height: 1.4 !important; }
      .moon3d-stock-size { display: block !important; white-space: normal !important; overflow-wrap: anywhere !important; font-size: 12px !important; }
      .moon3d-stock-price { width: 100%; display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px; margin-top: 3px; padding-top: 9px; border-top: 1px solid var(--border); }
      .moon3d-stock-price span { color: var(--muted); font-size: 11px; }
      .moon3d-stock-price strong { color: var(--text); font-size: 14px; font-weight: 700; }
    `;
    document.head.appendChild(dashboardStockStyle);

    const applyDashboardStockCards = () => {
      const pageTitle = document.querySelector('#page-title');
      if (!pageTitle || pageTitle.textContent.trim() !== 'Dashboard') return;
      const stockPanel = Array.from(document.querySelectorAll('#app .panel')).find(panel =>
        panel.querySelector('.panel-head h3')?.textContent.trim() === 'Produtos em estoque'
      );
      if (!stockPanel) return;
      const grid = stockPanel.querySelector('.panel-head')?.nextElementSibling;
      if (!grid || !grid.querySelector('img, .tag.green')) return;
      grid.classList.add('moon3d-stock-grid');
      const stockProducts = db.produtos.filter(product => Math.max(0, Math.floor(Number(product.estoque) || 0)) > 0);
      Array.from(grid.children).forEach((card, index) => {
        const product = stockProducts[index];
        if (!product) return;
        card.classList.add('moon3d-stock-card');
        const info = card.querySelector('strong')?.parentElement;
        if (!info) return;
        info.classList.add('moon3d-stock-info');
        const name = info.querySelector('strong');
        if (name) name.classList.add('moon3d-stock-name');
        const size = info.querySelector('.muted');
        if (size) size.classList.add('moon3d-stock-size');
        let price = info.querySelector('.moon3d-stock-price');
        if (!price) {
          price = document.createElement('div');
          price.className = 'moon3d-stock-price';
          const label = document.createElement('span');
          label.textContent = 'Valor de venda';
          const value = document.createElement('strong');
          price.append(label, value);
          info.appendChild(price);
        }
        const value = price.querySelector('strong');
        if (value) { const salePrice = Number(product.preco) > 0 ? money(product.preco) : 'Não informado'; if (value.textContent !== salePrice) value.textContent = salePrice; }
      });
    };

    /* No celular, transforma a tabela de registros em cartões legíveis. */
    const applyMobileTableLabels = () => {
      const app = document.querySelector('#app');
      if (!app) return;
      const pageTitle = document.querySelector('#page-title')?.textContent.trim() || '';
      if (app.dataset.mobilePage !== pageTitle) app.dataset.mobilePage = pageTitle;
      const table = app.querySelector('#data-table');
      if (table) {
        const wrapper = table.closest('.table-wrap');
        if (wrapper) wrapper.classList.add('moon3d-mobile-table-wrap');
        if (table.dataset.mobileType !== pageTitle) table.dataset.mobileType = pageTitle;
        const headers = Array.from(table.querySelectorAll('thead th'));
        Array.from(table.querySelectorAll('tbody tr')).forEach(row => {
          Array.from(row.children).forEach((cell, index) => {
            const label = headers[index]?.textContent.trim() || '';
            if (cell.dataset.label !== label) cell.dataset.label = label;
          });
        });
      }
      const panels = Array.from(app.querySelectorAll('.dashboard-grid .panel'));
      const history = panels.find(panel => panel.querySelector('.panel-head h3')?.textContent.trim() === 'Histórico mensal');
      const result = panels.find(panel => panel.querySelector('.panel-head h3')?.textContent.trim() === 'Resultado acumulado');
      history?.classList.add('moon3d-history-panel');
      result?.classList.add('moon3d-result-panel');
      const historyTable = history?.querySelector('.table-wrap table');
      if (historyTable) {
        historyTable.classList.add('moon3d-history-table');
        const headers = Array.from(historyTable.querySelectorAll('thead th'));
        Array.from(historyTable.querySelectorAll('tbody tr')).forEach(row => {
          Array.from(row.children).forEach((cell, index) => {
            const label = headers[index]?.textContent.trim() || '';
            if (cell.dataset.label !== label) cell.dataset.label = label;
          });
        });
      }
    };

    /* Cartões expansíveis em Vendas, Compras e Orçamentos — somente no celular. */
    const applyMoon3DExpandableCards = () => {
      const table = document.querySelector('#app #data-table');
      const page = document.querySelector('#page-title')?.textContent.trim() || '';
      if (!table || !['Vendas','Compras','Orçamentos'].includes(page)) return;
      table.classList.add('moon3d-expandable-table');
      const rows = Array.from(table.querySelectorAll('tbody tr'));
      rows.forEach(row => {
        row.classList.add('moon3d-expandable-card');
        const cells = Array.from(row.children);
        let actionCell = null;
        cells.forEach(cell => {
          const label = normalizeSalesHeader(cell.dataset.label || '');
          let slot = '';
          if (label.includes('acoes')) slot = 'actions';
          else if (page === 'Vendas') {
            if (label.includes('ordem')) slot = 'order';
            else if (label.includes('data')) slot = 'date';
            else if (label.includes('produto')) slot = 'product';
            else if (label.includes('cliente')) slot = 'client';
            else if (label.includes('valorcobrado')) slot = 'amount';
          } else if (page === 'Compras') {
            if (label.includes('data')) slot = 'date';
            else if (label.includes('produto') || label.includes('descricao')) slot = 'product';
            else if (label.includes('valor') && !label.includes('quantidade')) slot = 'amount';
          } else if (page === 'Orçamentos') {
            if (label.includes('data')) slot = 'date';
            else if (label.includes('produto')) slot = 'product';
            else if (label.includes('cliente')) slot = 'client';
            else if (label.includes('precoproposto') || (label.includes('valor') && label.includes('proposto'))) slot = 'amount';
          }
          if (slot) {
            cell.dataset.cardSummary = 'true';
            cell.dataset.cardSlot = slot;
          } else {
            delete cell.dataset.cardSummary;
            delete cell.dataset.cardSlot;
          }
          if (slot === 'actions') actionCell = cell;
        });
        if (!actionCell && cells.length) {
          actionCell = cells[cells.length - 1];
          actionCell.dataset.cardSummary = 'true';
          actionCell.dataset.cardSlot = 'actions';
        }
        if (actionCell && !actionCell.querySelector('.moon3d-card-expand-toggle')) {
          const toggle = document.createElement('button');
          toggle.type = 'button';
          toggle.className = 'moon3d-card-expand-toggle';
          toggle.textContent = 'Ver detalhes';
          toggle.setAttribute('aria-expanded','false');
          actionCell.prepend(toggle);
        }
      });
      if (table.dataset.expandHandlerInstalled !== 'yes') {
        table.dataset.expandHandlerInstalled = 'yes';
        table.addEventListener('click', event => {
          const toggle = event.target.closest('.moon3d-card-expand-toggle');
          if (!toggle) return;
          event.preventDefault();
          event.stopPropagation();
          const row = toggle.closest('tr');
          if (!row) return;
          const expanded = row.classList.toggle('moon3d-card-expanded');
          toggle.textContent = expanded ? 'Ocultar detalhes' : 'Ver detalhes';
          toggle.setAttribute('aria-expanded',String(expanded));
        });
      }
    };

    /* Layout mobile reorganizado: navegação inferior, conteúdo em coluna e controles maiores. */
    const mobileLayoutStyle = document.createElement('style');
    mobileLayoutStyle.textContent = `
      @media (max-width: 700px) {
        html, body { width: 100%; min-height: 100%; overflow-x: hidden; }
        body { display: block; padding-bottom: calc(72px + env(safe-area-inset-bottom)); -webkit-text-size-adjust: 100%; }
        .workspace { display: block; width: 100%; min-height: 100dvh; }
        .sidebar {
          position: fixed; inset: auto 0 0 0; z-index: 30; display: block;
          width: 100%; height: auto; padding: 6px 5px calc(6px + env(safe-area-inset-bottom));
          border: 0; border-top: 1px solid var(--line); box-shadow: 0 -5px 20px rgba(35,48,20,.07);
        }
        .brand, .sidebar-bottom, .nav-label { display: none !important; }
        #nav { display: flex; width: 100%; min-width: 0; align-items: stretch; gap: 3px; margin: 0; padding: 0; }
        .nav-item {
          display: flex !important; flex: 1 1 0; flex-direction: column; justify-content: center; align-items: center;
          gap: 4px; width: auto; min-width: 0; min-height: 53px; margin: 0; padding: 6px 2px;
          border-radius: 9px; font-size: 8px; line-height: 1.08; text-align: center; white-space: normal;
          overflow-wrap: anywhere;
        }
        .nav-item b { display: block; width: auto; font-size: 16px; line-height: 1; }
        .nav-item.active { box-shadow: inset 0 2px #9bc83f; }
        .main { margin: 0; width: 100%; max-width: 100%; padding: 0 13px calc(92px + env(safe-area-inset-bottom)); }
        .topbar { height: auto; min-height: 76px; padding: 12px 0; gap: 8px; }
        .topbar > div:first-child { min-width: 0; }
        .eyebrow { font-size: 8px; letter-spacing: 1.2px; }
        h1 { font-size: clamp(20px, 5.2vw, 24px); line-height: 1.15; margin: 4px 0 0; }
        .top-actions { flex: 0 0 auto; gap: 6px; }
        .today, .avatar { display: none; }
        .logout-btn { padding: 8px 10px; font-size: 10px; }
        .content { margin: 16px auto 22px; min-height: 0; }
        footer { padding-top: 12px; font-size: 9px; }
        .welcome { display: flex; flex-direction: column; align-items: stretch; gap: 11px; margin-bottom: 16px; }
        .welcome h2 { font-size: 17px; line-height: 1.25; }
        .welcome p { font-size: 11px; line-height: 1.45; }
        .welcome > .btn { width: 100%; min-height: 42px; }
        .cards, .dashboard-cards { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 9px; margin-bottom: 13px; }
        .metric { min-width: 0; padding: 11px 10px; border-radius: 13px; }
        .metric .label { font-size: 10px; line-height: 1.25; }
        .metric .value { font-size: clamp(15px, 4.4vw, 19px); line-height: 1.2; margin: 8px 0 4px; overflow-wrap: anywhere; }
        .metric .hint { font-size: 9px; line-height: 1.35; }
        .dashboard-grid { grid-template-columns: minmax(0, 1fr); gap: 12px; }
        .panel { min-width: 0; padding: 14px; border-radius: 14px; }
        .panel-head { align-items: flex-start; flex-wrap: wrap; gap: 7px; margin-bottom: 12px; }
        .panel h3 { font-size: 13px; }
        .muted { font-size: 10px; line-height: 1.4; }
        .toolbar { display: flex; flex-direction: column; align-items: stretch; gap: 8px; }
        .toolbar .search { width: 100%; max-width: none; min-height: 43px; font-size: 16px; }
        .toolbar .muted { align-self: flex-start; }
        .toolbar .btn { width: 100%; }
        .moon3d-mobile-table-wrap { overflow: visible; border: 0; background: transparent; }
        #data-table { display: block; width: 100%; min-width: 0; border: 0; }
        #data-table thead { display: none; }
        #data-table tbody { display: grid; gap: 10px; }
        #data-table tbody tr { display: block; overflow: hidden; padding: 6px 11px; background: #fff; border: 1px solid var(--line); border-radius: 13px; box-shadow: 0 2px 9px rgba(52,69,26,.05); }
        #data-table tbody tr[hidden], #data-table tbody tr.moon3d-hide-completed { display: none !important; }
        #data-table tbody td { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; min-width: 0; padding: 9px 0; border-top: 1px solid #edf0e8; font-size: 11px; text-align: right; overflow-wrap: anywhere; }
        #data-table tbody td:first-child { border-top: 0; }
        #data-table tbody td::before { content: attr(data-label); flex: 0 1 42%; min-width: 78px; color: var(--muted); font-size: 9px; font-weight: 700; line-height: 1.35; letter-spacing: .2px; text-align: left; }
        #data-table tbody td > * { max-width: 58%; min-width: 0; }
        #data-table tbody td:last-child { justify-content: flex-end; flex-wrap: wrap; gap: 7px; }
        #data-table tbody td:last-child::before { content: 'AÇÕES'; margin-right: auto; }
        #data-table tbody td:last-child .btn { max-width: none; padding: 8px 10px; font-size: 10px; }
        #data-table .moon3d-progress-cell { width: auto; min-width: 0; }
        #data-table .moon3d-progress-control { width: min(58vw, 190px); min-width: 105px; }
        #data-table .status-select { min-width: 95px; max-width: 135px; padding: 8px 9px; font-size: 12px; }
        .form-grid, .settings-grid { grid-template-columns: minmax(0, 1fr); gap: 11px; }
        .field.full { grid-column: auto; }
        .field label { font-size: 11px; }
        .field input, .field select, .field textarea { min-height: 43px; padding: 10px 12px; font-size: 16px; }
        .field textarea { min-height: 85px; }
        .price-preview { padding: 12px; }
        .preview-breakdown { grid-template-columns: minmax(0, 1fr); gap: 8px; }
        .preview-breakdown div { flex-direction: row; align-items: center; justify-content: space-between; gap: 10px; }
        .preview-total strong { font-size: 18px; }
        .modal-backdrop { display: flex; align-items: flex-end; justify-content: center; padding: 10px; }
        .modal { width: 100%; max-width: none; max-height: calc(100dvh - 20px - env(safe-area-inset-top)); padding: 16px; border-radius: 17px 17px 12px 12px; overflow: auto; overscroll-behavior: contain; }
        .modal-head { position: sticky; top: -16px; z-index: 2; margin: -2px 0 14px; padding: 12px 0 10px; background: #fff; border-bottom: 1px solid var(--line); }
        .modal-head h2 { padding-right: 8px; font-size: 15px; }
        .close { flex: none; width: 36px; height: 36px; }
        .modal-actions { position: sticky; bottom: -16px; z-index: 2; display: flex; justify-content: stretch; gap: 8px; margin: 14px -1px -2px; padding: 12px 0 max(3px, env(safe-area-inset-bottom)); background: #fff; border-top: 1px solid var(--line); }
        .modal-actions .btn { flex: 1; min-height: 42px; }
        .setting-row { align-items: flex-start; flex-wrap: wrap; gap: 8px; }
        .setting-row > span:first-child { flex: 1 1 100%; line-height: 1.4; }
        .setting-row input { width: min(46%, 150px); min-height: 40px; font-size: 16px; }
        .setting-row > span:last-child { display: flex; flex-wrap: wrap; gap: 6px; }
        .moon3d-stock-grid { grid-template-columns: minmax(0, 1fr) !important; gap: 9px !important; }
        .moon3d-stock-card { flex-direction: row !important; align-items: center !important; gap: 11px !important; padding: 11px !important; }
        .moon3d-stock-card > img, .moon3d-stock-card > div:first-child { width: 88px !important; max-width: 88px !important; height: 88px !important; flex: 0 0 88px !important; }
        .moon3d-stock-info { flex: 1; min-width: 0 !important; gap: 5px !important; }
        .moon3d-stock-name { font-size: 13px !important; line-height: 1.3 !important; }
        .moon3d-stock-price { gap: 5px; margin-top: 1px; padding-top: 7px; }
        .moon3d-stock-price span { font-size: 10px; }
        .moon3d-stock-price strong { font-size: 13px; }
        .toast { left: 12px; right: 12px; bottom: calc(82px + env(safe-area-inset-bottom)); text-align: center; }
      }
      @media (max-width: 380px) {
        .main { padding-left: 10px; padding-right: 10px; }
        .cards, .dashboard-cards { gap: 7px; }
        .metric { padding: 10px 9px; }
        .metric .value { font-size: 15px; }
        .nav-item { font-size: 7px; }
        .modal-actions { gap: 7px; }
        .modal-actions .btn { padding: 9px 8px; font-size: 11px; }
      }
    `;
    document.head.appendChild(mobileLayoutStyle);
    /* Cards mais compactos e com hierarquia clara em telas pequenas. */
    const mobileCompactStyle = document.createElement('style');
    mobileCompactStyle.textContent = `
      @media (max-width: 700px) {
        .dashboard-cards { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 8px !important; }
        .dashboard-cards .metric { min-height: 94px; padding: 10px 10px 9px !important; border-radius: 12px; display: flex; flex-direction: column; justify-content: space-between; }
        .dashboard-cards .metric:after { width: 48px; height: 48px; right: -20px; top: -22px; }
        .dashboard-cards .metric .label { position: relative; z-index: 1; font-size: 9px; font-weight: 700; line-height: 1.25; }
        .dashboard-cards .metric .value { position: relative; z-index: 1; font-size: clamp(15px, 4.3vw, 18px); line-height: 1.15; margin: 6px 0 3px; }
        .dashboard-cards .metric .hint { position: relative; z-index: 1; font-size: 8px; line-height: 1.25; }
        .moon3d-stock-grid { gap: 7px !important; }
        .moon3d-stock-card { gap: 9px !important; padding: 8px !important; border-radius: 11px !important; }
        .moon3d-stock-card > img, .moon3d-stock-card > div:first-child { width: 62px !important; max-width: 62px !important; height: 62px !important; flex: 0 0 62px !important; }
        .moon3d-stock-info { gap: 4px !important; }
        .moon3d-stock-name { font-size: 11px !important; line-height: 1.25 !important; font-weight: 700; }
        .moon3d-stock-size { font-size: 9px !important; line-height: 1.25 !important; }
        .moon3d-stock-price { padding-top: 5px; }
        .moon3d-stock-price span { font-size: 9px; }
        .moon3d-stock-price strong { font-size: 11px; }
        #data-table[data-mobile-type] { table-layout: fixed; }
        #data-table[data-mobile-type] tbody { display: grid; gap: 8px; }
        #data-table[data-mobile-type] tbody tr { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 0 10px; padding: 6px 10px; border-radius: 11px; }
        #data-table[data-mobile-type] tbody td { display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-start; gap: 3px; min-width: 0; padding: 7px 0; border-top: 1px solid #edf0e8; font-size: 11px; line-height: 1.3; text-align: left; }
        #data-table[data-mobile-type] tbody td:first-child, #data-table[data-mobile-type] tbody td:nth-child(2) { border-top: 0; }
        #data-table[data-mobile-type] tbody td::before { display: block; width: 100%; min-width: 0; flex: none; color: #858d7b; font-size: 8px; line-height: 1.15; letter-spacing: .45px; text-align: left; text-transform: uppercase; }
        #data-table[data-mobile-type] tbody td > * { width: auto; max-width: 100%; min-width: 0; text-align: left; overflow-wrap: anywhere; }
        #data-table[data-mobile-type] tbody td:last-child { grid-column: 1 / -1; display: flex; flex-direction: row; align-items: center; justify-content: flex-start; flex-wrap: wrap; gap: 7px; padding-top: 8px; border-top: 1px solid #e7ecdf; }
        #data-table[data-mobile-type] tbody td:last-child::before { width: auto; margin-right: auto; }
        #data-table[data-mobile-type] tbody td:last-child .btn { flex: 0 0 auto; width: auto; min-height: 32px; padding: 7px 10px; font-size: 10px; }
        #data-table[data-mobile-type='Vendas'] tbody tr { grid-template-columns: repeat(6, minmax(0, 1fr)); column-gap: 8px; }
        #data-table[data-mobile-type='Vendas'] tbody td:nth-child(1) { grid-column: span 2; }
        #data-table[data-mobile-type='Vendas'] tbody td:nth-child(2) { grid-column: span 4; }
        #data-table[data-mobile-type='Vendas'] tbody td:nth-child(3), #data-table[data-mobile-type='Vendas'] tbody td:nth-child(4), #data-table[data-mobile-type='Vendas'] tbody td:nth-child(7) { grid-column: 1 / -1; }
        #data-table[data-mobile-type='Vendas'] tbody td:nth-child(5), #data-table[data-mobile-type='Vendas'] tbody td:nth-child(6) { grid-column: span 3; }
        #data-table[data-mobile-type='Vendas'] tbody td:nth-child(8), #data-table[data-mobile-type='Vendas'] tbody td:nth-child(9), #data-table[data-mobile-type='Vendas'] tbody td:nth-child(10) { grid-column: span 2; }
        #data-table[data-mobile-type='Vendas'] tbody td:nth-child(8) .status-select, #data-table[data-mobile-type='Vendas'] tbody td:nth-child(9) .status-select, #data-table[data-mobile-type='Vendas'] tbody td:nth-child(10) .status-select { width: 100%; min-width: 0; max-width: 100%; padding: 6px 4px; font-size: 9px; }
        #data-table[data-mobile-type='Vendas'] tbody td:nth-child(7) .moon3d-progress-control { width: 100%; min-width: 0; }
        #data-table[data-mobile-type='Compras'] tbody td:nth-child(1) { grid-column: span 2; }
        #data-table[data-mobile-type='Compras'] tbody td:nth-child(2) { grid-column: 1 / -1; }
        #data-table[data-mobile-type='Orçamentos'] tbody td:nth-child(1), #data-table[data-mobile-type='Orçamentos'] tbody td:nth-child(2) { grid-column: span 3; }
        #data-table[data-mobile-type='Orçamentos'] tbody td:nth-child(3), #data-table[data-mobile-type='Orçamentos'] tbody td:nth-child(10) { grid-column: 1 / -1; }
        #data-table[data-mobile-type='Orçamentos'] tbody td:nth-child(6), #data-table[data-mobile-type='Orçamentos'] tbody td:nth-child(7), #data-table[data-mobile-type='Orçamentos'] tbody td:nth-child(8), #data-table[data-mobile-type='Orçamentos'] tbody td:nth-child(9) { grid-column: span 3; }
        #data-table[data-mobile-type='Produtos padrões'] tbody td:nth-child(1), #data-table[data-mobile-type='Produtos padrões'] tbody td:nth-child(2), #data-table[data-mobile-type='Produtos padrões'] tbody td:nth-child(6), #data-table[data-mobile-type='Produtos padrões'] tbody td:nth-child(7) { grid-column: span 2; }
        #data-table[data-mobile-type='Produtos padrões'] tbody td:nth-child(7) img { width: 56px !important; height: 56px !important; object-fit: contain; }
        #data-table[data-mobile-type='Produtos padrões'] tbody td:nth-child(7) { align-items: flex-start; }
        #data-table[data-mobile-type='Produtos padrões'] tbody td:nth-child(8) { grid-column: 1 / -1; }
        #data-table[data-mobile-type='Itens adicionais'] tbody td:nth-child(1), #data-table[data-mobile-type='Itens adicionais'] tbody td:nth-child(2) { grid-column: span 1; }
        .dashboard-grid .panel { padding: 12px; }
        .dashboard-grid .panel-head { margin-bottom: 9px; }
        .dashboard-grid .table-wrap { overflow-x: auto; }
      }
      @media (max-width: 380px) {
        .dashboard-cards .metric { min-height: 88px; padding: 8px !important; }
        .dashboard-cards .metric .value { font-size: 15px; }
        #data-table[data-mobile-type='Vendas'] tbody tr { column-gap: 6px; padding-left: 8px; padding-right: 8px; }
      }
    `;
    document.head.appendChild(mobileCompactStyle);


    /* Navegação móvel: quatro áreas principais e um menu compacto para cadastros. */
    const installMoon3DMobileDock = () => {
      const workspace = document.querySelector('#workspace');
      const originalNav = document.querySelector('#nav');
      if (!workspace || !originalNav || workspace.querySelector('.moon3d-mobile-dock')) return;
      const primary = [
        {page:'dashboard', label:'Início'},
        {page:'vendas', label:'Vendas'},
        {page:'compras', label:'Compras'},
        {page:'orcamentos', label:'Orçamentos'}
      ];
      const extras = [
        {page:'produtos', label:'Produtos padrões'},
        {page:'adicionais', label:'Itens adicionais'},
        {page:'configuracoes', label:'Configurações'}
      ];
      const iconFor = page => originalNav.querySelector('[data-page="' + page + '"] b')?.textContent.trim() || '•';
      const dock = document.createElement('nav');
      dock.className = 'moon3d-mobile-dock';
      dock.setAttribute('aria-label','Navegação principal');
      const more = document.createElement('button');
      more.type = 'button';
      more.innerHTML = '<span class="dock-icon">•••</span><span>Mais</span>';
      more.setAttribute('aria-expanded','false');
      const sheet = document.createElement('div');
      sheet.className = 'moon3d-mobile-more';
      sheet.hidden = true;
      sheet.setAttribute('aria-label','Mais opções');
      const sheetTitle = document.createElement('div');
      sheetTitle.className = 'moon3d-mobile-more-title';
      sheetTitle.textContent = 'Cadastros e ajustes';
      sheet.appendChild(sheetTitle);
      const buttons = new Map();
      const selectPage = page => {
        const target = originalNav.querySelector('[data-page="' + page + '"]');
        if (target) target.click();
        sheet.hidden = true;
        more.setAttribute('aria-expanded','false');
        sync();
      };
      const makeButton = item => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.page = item.page;
        const icon = document.createElement('span');
        icon.className = 'dock-icon';
        icon.textContent = iconFor(item.page);
        const label = document.createElement('span');
        label.textContent = item.label;
        button.append(icon,label);
        button.addEventListener('click',() => selectPage(item.page));
        buttons.set(item.page,button);
        return button;
      };
      primary.forEach(item => dock.appendChild(makeButton(item)));
      more.addEventListener('click',() => {
        sheet.hidden = !sheet.hidden;
        more.setAttribute('aria-expanded',String(!sheet.hidden));
        sync();
      });
      dock.appendChild(more);
      extras.forEach(item => sheet.appendChild(makeButton(item)));
      workspace.append(dock,sheet);
      const sync = () => {
        const active = originalNav.querySelector('.nav-item.active')?.dataset.page || 'dashboard';
        buttons.forEach((button,page) => {
          const selected = page === active;
          button.classList.toggle('active',selected);
          if (selected) button.setAttribute('aria-current','page');
          else button.removeAttribute('aria-current');
        });
        more.classList.toggle('active',extras.some(item => item.page === active) || !sheet.hidden);
        more.setAttribute('aria-expanded',String(!sheet.hidden));
      };
      document.addEventListener('click',event => {
        if (sheet.hidden || dock.contains(event.target) || sheet.contains(event.target)) return;
        sheet.hidden = true;
        more.setAttribute('aria-expanded','false');
        sync();
      });
      sync();
      return sync;
    };
    const syncMoon3DMobileDock = installMoon3DMobileDock() || (() => {});
    try {
      const professionalCss = await loadText('mobile-professional.css');
      const professionalStyle = document.createElement('style');
      professionalStyle.id = 'moon3d-mobile-professional';
      professionalStyle.textContent = professionalCss;
      document.head.appendChild(professionalStyle);
    } catch (mobileCssError) {
      console.warn('Estilos profissionais mobile não carregados; mantendo estilos anteriores.',mobileCssError);
    }

    /* Acompanha a área realmente visível do celular quando o teclado virtual abre. */
    const updateMoon3DVisualViewport = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height || window.innerHeight;
      const offset = viewport?.offsetTop || 0;
      document.documentElement.style.setProperty('--moon3d-visual-height', height + 'px');
      document.documentElement.style.setProperty('--moon3d-visual-offset', offset + 'px');
    };
    updateMoon3DVisualViewport();
    window.addEventListener('resize', updateMoon3DVisualViewport, { passive: true });
    window.visualViewport?.addEventListener('resize', updateMoon3DVisualViewport, { passive: true });
    window.visualViewport?.addEventListener('scroll', updateMoon3DVisualViewport, { passive: true });

    const salesTableObserver = new MutationObserver(() => {
      applyMoon3DSalesOrder();
      updatePaidDeliveredVisibility();
      applyMoon3DQuoteLayout();
      applyMoon3DQuoteWhatsAppButtons();
      applyMobileTableLabels();
      applyMoon3DExpandableCards();
      applyDashboardStockCards();
      syncMoon3DMobileDock();
    });
    salesTableObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    applyMoon3DSalesOrder();
    updatePaidDeliveredVisibility();
    applyMoon3DQuoteLayout();
    applyMoon3DQuoteWhatsAppButtons();
    applyMobileTableLabels();
    applyMoon3DExpandableCards();
    applyDashboardStockCards();
    syncMoon3DMobileDock();
  } catch (error) {
    console.error('Falha ao iniciar Moon3D:', error);
    if (root) {
      root.hidden = false;
      root.innerHTML = '<div class="auth-card"><div class="auth-kicker">FALHA AO INICIAR</div><h1>Não foi possível carregar o Moon3D</h1><p>' +
        String(error.message || error).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])) +
        '</p><small>Atualize a página. Se o problema continuar, confira os arquivos publicados no GitHub.</small></div>';
    }
  }
})();