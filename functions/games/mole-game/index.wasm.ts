interface Env {
  ASSETS: Fetcher;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const partUrls = [0, 1].map((part) => {
    const partUrl = new URL(url);
    partUrl.pathname = `${url.pathname}.part${part}`;
    return partUrl;
  });

  const partResponses = await Promise.all(
    partUrls.map((partUrl) => env.ASSETS.fetch(new Request(partUrl, request)))
  );
  const failedPart = partResponses.find((response) => !response.ok || !response.body);
  if (failedPart) return failedPart;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const response of partResponses) {
          const reader = response.body!.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/wasm',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
