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