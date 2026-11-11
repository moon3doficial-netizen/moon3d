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
        const html = originalDashboardView();
        const marker = '<div class="dashboard-grid">';
        return html.includes(marker) ? html.replace(marker, renderMoon3DTasks() + marker) : html;
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

    let hidePaidAndDeliveredOrders = false;
    const updatePaidDeliveredVisibility = () => {
      const pageTitle = document.querySelector('#page-title');
      const toolbar = document.querySelector('.toolbar');
      if (!pageTitle || pageTitle.textContent.trim() !== 'Vendas') {
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
        ? 'Mostrar todos os pedidos'
        : 'Ocultar pedidos pagos e entregues';
      if (toggle.textContent !== toggleLabel) toggle.textContent = toggleLabel;
      const pressed = String(hidePaidAndDeliveredOrders);
      if (toggle.getAttribute('aria-pressed') !== pressed) toggle.setAttribute('aria-pressed', pressed);

      const table = document.querySelector('#data-table');
      if (!table) return;
      Array.from(table.querySelectorAll('tbody tr')).forEach((row, rowIndex) => {
        const orderNumber = row.children[0]?.textContent.trim() || '';
        const sale = db.vendas.find(item => String(item.ordem) === orderNumber) || db.vendas[rowIndex];
        const paidAndDelivered = !!sale && sale.pago === 'Sim' && sale.entregue === 'Sim';
        row.classList.toggle('moon3d-hide-completed', hidePaidAndDeliveredOrders && paidAndDelivered);
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
      const table = document.querySelector('#data-table');
      if (!table) return;
      const wrapper = table.closest('.table-wrap');
      if (wrapper) wrapper.classList.add('moon3d-mobile-table-wrap');
      const pageTitle = document.querySelector('#page-title')?.textContent.trim() || '';
      if (table.dataset.mobileType !== pageTitle) table.dataset.mobileType = pageTitle;
      const headers = Array.from(table.querySelectorAll('thead th'));
      if (!headers.length) return;
      Array.from(table.querySelectorAll('tbody tr')).forEach(row => {
        Array.from(row.children).forEach((cell, index) => {
          const label = headers[index]?.textContent.trim() || '';
          if (cell.dataset.label !== label) cell.dataset.label = label;
        });
      });
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

    const salesTableObserver = new MutationObserver(() => {
      applyMoon3DSalesOrder();
      updatePaidDeliveredVisibility();
      applyMoon3DQuoteLayout();
      applyMobileTableLabels();
      applyDashboardStockCards();
    });
    salesTableObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    applyMoon3DSalesOrder();
    updatePaidDeliveredVisibility();
    applyMoon3DQuoteLayout();
    applyMobileTableLabels();
    applyDashboardStockCards();
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