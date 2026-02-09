export interface Env {
  AI: any;
}

const routes: Record<string, Function> = {
  'POST:/api/v1/image/image-to-image': handleImg2Img,
  //'POST:/api/txt2img': handleTxt2Img,
  'POST:/api/v1/text/summary': handleSummary,
  'POST:/api/v1/text/generate': handleGenerateText,
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const key = `${req.method}:${url.pathname}`;
    try {
      const handler = routes[key];
      if (!handler) {
        return new Response('Not Found', { status: 404 });
      }

      return await handler(req, env);
    } catch (err: any) {
      console.error('Worker error:', err);
      return new Response(JSON.stringify({ error: err?.message || err }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};

async function handleImg2Img(req: Request, env: Env): Promise<Response> {
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
  const base64 = btoa(
    String.fromCharCode(...new Uint8Array(buffer))
  );

  const imageUint8 = new Uint8Array(buffer);
  const size = getImageSize(imageUint8);

  if (!size) {
    throw new Error('Unsupported image format');
  }

  let { width, height } = size;

  const clamp = (v: number, min: number, max: number) =>
    Math.min(Math.max(v, min), max);

  const roundTo = (v: number, base: number) =>
    Math.floor(v / base) * base;
  width = roundTo(clamp(width, 256, 2048), 8);
  height = roundTo(clamp(height, 256, 2048), 8);

  const input = {
    prompt: String(prompt),
    negative_prompt: String(negativePrompt),
    width: height,
    height: width,
    image_b64: base64,
    num_steps : 20,
    strength: 0.25,
    guidance : 7,
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
}

async function handleSummary(req: Request, env: Env): Promise<Response> {
  const requestBody = await req.json();
  const inputText = requestBody.text || "";
  if (!inputText) {
    return new Response("Missing text to summarize", { status: 400 });
  }
  const aiResponse = await env.AI.run("@cf/facebook/bart-large-cnn", {
    input_text: inputText,
    max_length: requestBody.maxLength || 256,
  });
  return Response.json(aiResponse);
}

async function handleGenerateText(req: Request, env: Env): Promise<Response> {
  const requestBody = await req.json();
  const prompt = requestBody.prompt || "";
  if (!prompt) {
    return new Response("Missing input prompt to generate", { status: 400 });
  }
  const messages = requestBody.messages || [
    { role: "system", content: "You are a helpful assistant" },
    { role: "user", content: requestBody.prompt || "" }
  ];
  const aiResponse = await env.AI.run("@hf/mistral/mistral-7b-instruct-v0.2", {
    messages,
    max_tokens: requestBody.max_tokens ?? 256,
    temperature: requestBody.temperature ?? 0.7,
    top_p: requestBody.top_p ?? 0.9
  });
  return Response.json(aiResponse);
}

async function streamToUint8Array(stream: ReadableStream) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.length;
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}


function getImageSize(bytes: Uint8Array) {
  // --- PNG ---
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 &&
    bytes[2] === 0x4E && bytes[3] === 0x47
  ) {
    return {
      width:
        (bytes[16] << 24) |
        (bytes[17] << 16) |
        (bytes[18] << 8) |
        bytes[19],
      height:
        (bytes[20] << 24) |
        (bytes[21] << 16) |
        (bytes[22] << 8) |
        bytes[23],
    };
  }

  // --- JPEG ---
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] === 0xFF && bytes[i + 1] === 0xC0) {
      return {
        height: (bytes[i + 5] << 8) + bytes[i + 6],
        width:  (bytes[i + 7] << 8) + bytes[i + 8],
      };
    }
    i++;
  }

  // --- WebP ---
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 &&
    bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 &&
    bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    // VP8X chunk
    if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x58) {
      const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
      const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
      return { width, height };
    }
  }

  return null;
}
