import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";
import { PostDetailView } from "@/components/post-detail/post-detail-view";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, numericId))
    .limit(1);

  if (!post) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1 text-xs text-fg-muted hover:text-fg"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Back to calendar
      </Link>
      <PostDetailView post={post} />
    </div>
  );
}
