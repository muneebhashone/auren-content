import { db } from "@/lib/db/client";
import { storyBank } from "@/lib/db/schema";

const entries = [
  {
    kind: "story" as const,
    title: "The 8-week Figma graveyard",
    body: `A founder showed up to us last quarter with 47 Figma frames, three pivots of feature scope, and zero shipped code after eight weeks with another team. He'd been told an MVP needed a "design system" first. We threw out the system, picked the boring stack (Next.js, Postgres, Stripe), and shipped a working checkout flow in 19 days.

What stuck with me wasn't the timeline. It was the look on his face when his first real user signed up. He told me later he'd been afraid to launch because his last "MVP" had been a Notion doc that sat untouched for three months. The frames had been a way to keep moving without committing.

Eight weeks of frames is a story founders tell themselves about due diligence. It's actually fear of the launch. The fastest way to fix that is to ship something embarrassing and watch a stranger pay for it.`,
    tags: ["mvp", "shipping", "founders", "scope-cutting", "figma-graveyard"],
    personaId: null,
  },
  {
    kind: "hot_take" as const,
    title: "Fixed scope is the only honest scope",
    body: `Most agencies sell "agile" so they can keep the meter running. We sell fixed-scope, fixed-time MVPs because it's the only contract structure where we lose money when we're slow.

The weekly-retainer model only works if your incentive is to not-quite-ship. If you're billing every week and your client launched late, you got paid more. That's not a bug in the agency model. That's the model. The longer the engagement, the bigger the invoice. Read the case studies on most "trusted partner" agency sites: the ones they're proud of are 6-month-and-counting, not 21-days-and-launched.

Founders should ask exactly one question before signing anything: will I owe you more if you're slow?

If the answer is yes, you are buying the wrong thing. You are buying time. What you actually want is a shipped product. Those are not the same purchase, even though the line item looks identical.

This is also why "discovery phases" exist. They turn an unknown into billable hours. We do discovery in a 30-minute call, give you a fixed price, and if the scope is wrong we eat the difference. Our incentive is to scope tightly and ship. The agency's incentive should match the founder's, or you should walk.`,
    tags: ["agency-life", "retainers", "fixed-scope", "pricing", "incentives"],
    personaId: 1,
  },
  {
    kind: "story" as const,
    title: "The Kafka the client didn't need",
    body: `A founder came in with an architecture diagram before he had ten paying customers. Kafka, a service mesh, a vector DB, separate read-and-write paths. He'd watched a conference talk from a Series-B team and thought that was the floor for "doing it right".

We shipped his actual product on Postgres, a row of background workers, and a single Meilisearch index. The most exotic thing in the stack was a cron job. p99 stayed under 180ms through his first six months and his first thousand paying users. The Kafka cluster he was about to provision would have cost more per month than his entire AWS bill is now.

The thing nobody tells junior architects is that the Series-B teams running Kafka mostly wish they weren't. They picked it at 50 customers because someone read a blog post, and now they have a dedicated infra hire whose job is to keep it from falling over. That's a tax founder-stage companies cannot afford to pay.

Boring tech is not the slow choice. Boring tech is the choice that lets you spend the next six months talking to users instead of debugging consumer groups. Pick Postgres. Add Redis when you measure a problem. Add a queue when you have one.

The framework was right. We were holding it wrong.`,
    tags: [
      "over-engineering",
      "boring-tech",
      "postgres",
      "infra",
      "founder-myths",
    ],
    personaId: 2,
  },
];

async function main() {
  for (const e of entries) {
    const [row] = await db
      .insert(storyBank)
      .values({
        kind: e.kind,
        title: e.title,
        body: e.body,
        tagsJson: JSON.stringify(e.tags),
        personaId: e.personaId,
        active: true,
      })
      .returning();
    console.log(`Inserted [${e.kind}] id=${row.id} "${e.title}"`);
  }
  console.log(`\nDone. Inserted ${entries.length} story-bank entries.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
