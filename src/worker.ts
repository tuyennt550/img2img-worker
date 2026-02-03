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
      const negativePrompt = form.get('negativePrompt');

      if (!(imageFile instanceof File) || !prompt || !negativePrompt) {
        return new Response('Missing image or prompt', { status: 400 });
      }

      const buffer = await imageFile.arrayBuffer();
      const image = new Uint8Array(buffer);
      const base64 = btoa(
        String.fromCharCode(...new Uint8Array(buffer))
      );

      const input = {
        prompt: String(prompt),
        negative_prompt: String(negativePrompt),
        width: 512,
        height: 512,
        image_b64: base64,
        num_steps : 20,
        strength: 0.5,
        guidance : 6,
        //seed: 0,
      };

      console.log('AI input OK', {
        prompt: input.prompt,
        negative_prompt: input.negative_prompt,
        width: input.width,
        height: input.height,
        //imageSize: input.image.length,
        num_steps : input.num_steps ,
        strength: input.strength,
        guidance : input.guidance ,
        //seed: input.seed,
      });

      //@cf/stabilityai/stable-diffusion-xl-base-1.0
      const result = await env.AI.run(
        '@cf/runwayml/stable-diffusion-v1-5-img2img',
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
