/* Loader leve: descompacta CSS e JavaScript no navegador. */
(async function () {
  const root = document.getElementById('auth-root');
  try {
    if (!('DecompressionStream' in window)) {
      throw new Error('Este navegador não oferece suporte à descompactação necessária. Atualize o Chrome, Edge ou Firefox.');
    }
    async function loadGzip(path) {
      const response = await fetch(path, { cache: 'no-cache' });
      if (!response.ok) throw new Error('Não foi possível carregar ' + path + ' (' + response.status + ').');
      const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
      return await new Response(stream).text();
    }
    const [css, js] = await Promise.all([
      loadGzip('styles.css.gz'),
      loadGzip('app.js.gz')
    ]);
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    const script = document.createElement('script');
    script.textContent = js;
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