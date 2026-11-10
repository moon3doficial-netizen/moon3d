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