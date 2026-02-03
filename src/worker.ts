export interface Env {
  AI: any;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return new Response('Expected multipart/form-data', { status: 400 });
    }

    const form = await req.formData();
    const image = form.get('image');
    const prompt = form.get('prompt');

    if (!image || !prompt) {
      return new Response('Missing image or prompt', { status: 400 });
    }

    const buffer = await (image as File).arrayBuffer();
    const uint8 = new Uint8Array(buffer);

    const result = await env.AI.run(
      '@cf/stabilityai/stable-diffusion-img2img',
      {
        image: [...uint8],
        prompt: String(prompt),
        strength: 0.75
      }
    );

    return new Response(result, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store'
      }
    });
  }
};
