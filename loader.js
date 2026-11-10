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

    /* Vendas: progresso do pedido e ordem dos status na listagem. */
    const salesStyle = document.createElement('style');
    salesStyle.textContent = `
      #data-table .moon3d-progress-cell { min-width: 112px; }
      #data-table .moon3d-progress-control { display: grid; gap: 6px; min-width: 96px; }
      #data-table .moon3d-progress-input { display: flex; align-items: center; gap: 5px; }
      #data-table .moon3d-progress-input input { width: 58px; min-width: 58px; padding: 5px 6px; text-align: right; }
      #data-table .moon3d-progress-input span { color: var(--muted); font-size: 12px; }
      #data-table .moon3d-progress-track { height: 7px; width: 100%; min-width: 90px; overflow: hidden; border-radius: 20px; background: var(--border, #e5e7eb); }
      #data-table .moon3d-progress-fill { height: 100%; border-radius: 20px; background: var(--accent, #80bc00); transition: width .2s ease; }
    `;
    document.head.appendChild(salesStyle);

    const normalizeColumnName = value => String(value || '')
      .toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
    const originalRenderForProduction = window.render;
    if (typeof originalRenderForProduction === 'function') {
      window.render = function () {
        const result = originalRenderForProduction.apply(this, arguments);
        try {
          const table = document.querySelector('#data-table');
          if (!table) return result;
          const headRow = table.querySelector('thead tr');
          const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
          if (!headRow || !bodyRows.length) return result;
          let headers = Array.from(headRow.children);
          const indexOf = name => headers.findIndex(cell => normalizeColumnName(cell.textContent) === name);
          if (indexOf('ordem') < 0) return result;

          /* Move os três status para a ordem Finalizado, Entregue, Pago. */
          const actionIndex = headers.length - 1;
          const statusIndexes = ['finalizado', 'entregue', 'pago'].map(indexOf);
          if (statusIndexes.every(i => i >= 0)) {
            const actionHeader = headRow.lastElementChild;
            statusIndexes.forEach(i => {
              const cell = headers[i];
              if (cell && cell !== actionHeader) headRow.insertBefore(cell, actionHeader);
            });
            bodyRows.forEach(row => {
              const cells = Array.from(row.children);
              const actionCell = row.lastElementChild;
              statusIndexes.forEach(i => {
                const cell = cells[i];
                if (cell && cell !== actionCell) row.insertBefore(cell, actionCell);
              });
            });
            headers = Array.from(headRow.children);
          }

          if (indexOf('producao') >= 0) return result;
          const finalIndex = indexOf('finalizado');
          if (finalIndex < 0) return result;
          const productionHeader = document.createElement('th');
          productionHeader.textContent = 'PRODUÇÃO';
          headRow.insertBefore(productionHeader, headers[finalIndex]);

          bodyRows.forEach((row, recordIndex) => {
            const sale = db.vendas[recordIndex];
            if (!sale) return;
            const td = document.createElement('td');
            td.className = 'moon3d-progress-cell';
            const savedProgress = Math.min(100, Math.max(0, Number(sale.producao) || 0));
            td.innerHTML =
              '<div class="moon3d-progress-control">' +
                '<label class="moon3d-progress-input">' +
                  '<input type="number" min="0" max="100" step="1" inputmode="numeric" aria-label="Porcentagem de produção da ordem ' +
                  String(sale.ordem || '') + '" value="' + savedProgress + '">' +
                  '<span>%</span>' +
                '</label>' +
                '<div class="moon3d-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + savedProgress + '">' +
                  '<div class="moon3d-progress-fill" style="width:' + savedProgress + '%"></div>' +
                '</div>' +
              '</div>';
            const input = td.querySelector('input');
            const fill = td.querySelector('.moon3d-progress-fill');
            const track = td.querySelector('.moon3d-progress-track');
            input.addEventListener('input', () => {
              const v = Math.min(100, Math.max(0, Number(input.value) || 0));
              fill.style.width = v + '%';
              track.setAttribute('aria-valuenow', String(v));
            });
            input.addEventListener('change', () => {
              const next = input.value === '' ? 0 : Math.min(100, Math.max(0, Math.round(Number(input.value) || 0)));
              const before = Math.min(100, Math.max(0, Number(sale.producao) || 0));
              input.value = String(next);
              if (next === before) {
                fill.style.width = next + '%';
                track.setAttribute('aria-valuenow', String(next));
                return;
              }
              if (!window.confirm('Confirma atualizar a produção da ordem ' + String(sale.ordem || '') + ' para ' + next + '%?')) {
                input.value = String(before);
                fill.style.width = before + '%';
                track.setAttribute('aria-valuenow', String(before));
                return;
              }
              sale.producao = next;
              save();
            });
            row.insertBefore(td, row.children[finalIndex]);
          });
        } catch (err) {
          console.error('Não foi possível atualizar a coluna de produção:', err);
        }
        return result;
      };
    }
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