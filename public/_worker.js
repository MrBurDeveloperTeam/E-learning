export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Pages rejects individual assets larger than 25 MiB. The Godot Web
    // export is uploaded as index.wasm.gz while retaining its public URL.
    if (url.pathname === '/games/mole-game/index.wasm') {
      const compressedUrl = new URL(request.url);
      compressedUrl.pathname = `${url.pathname}.gz`;
      const compressedResponse = await env.ASSETS.fetch(
        new Request(compressedUrl, request)
      );

      if (!compressedResponse.ok) return compressedResponse;

      const headers = new Headers(compressedResponse.headers);
      headers.set('Content-Type', 'application/wasm');
      headers.set('Content-Encoding', 'gzip');
      headers.set('Vary', 'Accept-Encoding');
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');

      return new Response(compressedResponse.body, {
        status: compressedResponse.status,
        headers,
      });
    }

    return env.ASSETS.fetch(request);
  },
};
