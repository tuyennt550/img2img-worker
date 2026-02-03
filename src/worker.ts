export interface Env {
  AI: any;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
      }

      const contentType = req.headers.get('content-type') || '';
      if (!contentType.includes('multipart/form-data')) {
        return new Response('Expected multipart/form-data', { status: 400 });
      }

      const form = await req.formData();

      const imageFile = form.get('image');
      const prompt = form.get('prompt');

      if (!(imageFile instanceof File) || !prompt) {
        return new Response('Missing image or prompt', { status: 400 });
      }

      const buffer = await imageFile.arrayBuffer();
      const image = new Uint8Array(buffer);

      const input = {
        image,
        prompt: String(prompt),
        strength: 0.7,
        guidance_scale: 7.5,
        num_steps: 20,
        seed: 0,
        width: 768,
        height: 768
      };

      console.log('AI input OK', {
        prompt: input.prompt,
        strength: input.strength,
        guidance_scale: input.guidance_scale,
        num_steps: input.num_steps,
        imageSize: image.length,
        seed: input.seed,
        width: input.width,
        height: input.height,
      });

      const result = await env.AI.run(
        '@cf/stabilityai/stable-diffusion-xl-base-1.0',
        input
      );

      return new Response(result, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-store',
        },
      });
    } catch (err: any) {
      console.error('Worker img2img error:', err);
      return new Response(
        JSON.stringify({ error: String(err?.message || err) }),
        { status: 500 }
      );
    }
  },
};
