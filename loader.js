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
      if (!pageTitle || pageTitle.textContent.trim() !== 'Vendas') return;
      const toolbar = document.querySelector('.toolbar');
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

    const salesTableObserver = new MutationObserver(() => {
      applyMoon3DSalesOrder();
      updatePaidDeliveredVisibility();
    });
    salesTableObserver.observe(document.body, { childList: true, subtree: true });
    applyMoon3DSalesOrder();
    updatePaidDeliveredVisibility();
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