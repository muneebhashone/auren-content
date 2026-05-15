import { copyFile, mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { gatewayFetch } from "@/lib/llm/gateway";

const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

interface ImageGenerationResponse {
  data?: Array<{ url?: string; b64_json?: string }>;
}

export async function generateImageWithCodex({
  filenamePrefix,
  imagePrompt,
}: {
  filenamePrefix: string;
  imagePrompt: string;
}): Promise<string> {
  const trimmed = imagePrompt.trim();
  if (!trimmed) throw new Error("No image prompt to generate from.");
  const safePrefix = sanitizePrefix(filenamePrefix);

  const model = process.env.AI_GATEWAY_IMAGE_MODEL || "codex/gpt-5.5";
  const size = process.env.AI_GATEWAY_IMAGE_SIZE || "1024x1024";
  const responseFormat = process.env.AI_GATEWAY_IMAGE_RESPONSE_FORMAT || "b64_json";

  const data = await gatewayFetch<ImageGenerationResponse>("/v1/images/generations", {
    method: "POST",
    body: JSON.stringify({
      model,
      prompt: trimmed,
      n: 1,
      size,
      response_format: responseFormat,
    }),
  });

  const image = data.data?.[0];
  if (!image?.b64_json && !image?.url) {
    throw new Error("AI gateway did not return an image.");
  }

  const generated = image.b64_json
    ? await writeBase64Image(safePrefix, image.b64_json)
    : await downloadImage(safePrefix, image.url!);

  const ext = extname(generated).toLowerCase();
  const publicDir = join(
    /*turbopackIgnore: true*/ process.cwd(),
    "public",
    "generated"
  );
  await mkdir(publicDir, { recursive: true });
  const publicName = `${safePrefix}-${Date.now()}${ext}`;
  const publicPath = join(publicDir, publicName);
  await copyFile(generated, publicPath);
  await rm(dirname(generated), { recursive: true, force: true }).catch(() => {});
  return `/generated/${publicName}`;
}

export async function generatePostImageWithCodex({
  postId,
  imagePrompt,
}: {
  postId: number;
  imagePrompt: string;
}): Promise<string> {
  if (!imagePrompt.trim()) throw new Error("This post has no image prompt.");
  return generateImageWithCodex({
    filenamePrefix: `post-${postId}`,
    imagePrompt,
  });
}

function sanitizePrefix(prefix: string): string {
  const cleaned = prefix.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "image";
}

async function writeBase64Image(prefix: string, b64: string): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "auren-gateway-image-"));
  const path = join(tempDir, `${prefix}.png`);
  await writeFile(path, Buffer.from(stripDataUrl(b64), "base64"));
  return path;
}

async function downloadImage(prefix: string, url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image download failed: ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "";
  const ext = extensionForContentType(contentType) ?? extname(new URL(url).pathname) ?? ".png";
  const normalizedExt = ALLOWED_EXTENSIONS.has(ext.toLowerCase()) ? ext : ".png";
  const tempDir = await mkdtemp(join(tmpdir(), "auren-gateway-image-"));
  const path = join(tempDir, `${prefix}${normalizedExt}`);
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
  return path;
}

function stripDataUrl(value: string): string {
  return value.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
}

function extensionForContentType(contentType: string): string | null {
  if (contentType.includes("image/png")) return ".png";
  if (contentType.includes("image/jpeg")) return ".jpg";
  if (contentType.includes("image/webp")) return ".webp";
  return null;
}
