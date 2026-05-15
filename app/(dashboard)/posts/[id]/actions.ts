"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";
import { generatePostImageWithCodex } from "@/lib/images/codex-image";

type Status = "draft" | "approved" | "posted" | "logged";

export async function updateStatus(id: number, status: Status) {
  await db
    .update(posts)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(posts.id, id));
  revalidatePath("/");
  revalidatePath(`/posts/${id}`);
}

export async function updateBody(id: number, body: string) {
  await db
    .update(posts)
    .set({ body, updatedAt: new Date().toISOString() })
    .where(eq(posts.id, id));
  revalidatePath(`/posts/${id}`);
}

export async function updateHook(id: number, hook: string) {
  await db
    .update(posts)
    .set({ hook, updatedAt: new Date().toISOString() })
    .where(eq(posts.id, id));
  revalidatePath(`/posts/${id}`);
}

export async function deletePost(id: number) {
  await db.delete(posts).where(eq(posts.id, id));
  revalidatePath("/");
  redirect("/");
}

export async function generateImage(id: number) {
  const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!post) throw new Error("Post not found.");

  const imageUrl = await generatePostImageWithCodex({
    postId: post.id,
    imagePrompt: post.imagePrompt,
  });

  await db
    .update(posts)
    .set({
      imageUrl,
      imageProvider: process.env.AI_GATEWAY_IMAGE_MODEL || "codex/gpt-5.5",
      imageGeneratedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(posts.id, id));
  revalidatePath("/");
  revalidatePath(`/posts/${id}`);
}
