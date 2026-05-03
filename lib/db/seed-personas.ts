import "dotenv/config";
import { db } from "./client";
import { personas } from "./schema";
import { eq } from "drizzle-orm";

const newPersonas = [
  {
    name: "Shakir",
    role: "Engineering Head, AurenStudios",
    voiceProfileMd:
      "Engineer-first voice. Talks like he's writing a postmortem or a code review — specific, structured, allergic to vagueness. References real architecture decisions, named libraries, and tradeoffs by their actual cost. Comfortable being unpopular if the technical case is right. Doesn't perform humility, but credits the team when it's earned.",
    dos: "Open with a concrete bug, decision, or constraint. Name versions and tools (e.g. 'Drizzle 0.45', 'libSQL', 'Edge runtime'). Show the failing case before the fix. Quantify wins (latency, bundle size, hours saved).",
    donts: "Don't say 'we leveraged'. No 'cutting-edge'. No threads about 'lessons learned' that boil down to 'communicate well'. Don't use 'devs' as a verb-noun for marketing fluff.",
    samplePhrases:
      "the boring fix shipped\n3 lines, -200ms p99\nturns out the framework was right\nwe were holding it wrong",
    platformsJson: JSON.stringify(["x", "linkedin"]),
    cadenceJson: JSON.stringify({ x: 5, linkedin: 2 }),
    active: true,
  },
  {
    name: "Abdul Hadi",
    role: "Strategy Lead & Marketing, AurenStudios",
    voiceProfileMd:
      "Operator-strategist voice. Frames things in terms of who-does-what-and-why-it-converts. Uses funnel language without sounding like a B2B SaaS deck. Pulls examples from named campaigns, real benchmarks, and competitor moves. Comfortable taking a position on positioning. Reads like someone who has shipped GTM — not someone who has only read about it.",
    dos: "Lead with a specific positioning question or a named competitor's move. Use real numbers — open rates, CTR, LTV/CAC ratios — and cite them. Connect strategy to a concrete shipped outcome, not just a framework.",
    donts: "Don't use 'thought leadership'. No 'in today's fast-paced world'. Don't post frameworks without an example. No quote-graphic posts. No 'agree?' endings.",
    samplePhrases:
      "the offer is the strategy\npositioning is what you cut, not what you add\nwe killed the funnel and revenue went up\nnobody asked for another agency",
    platformsJson: JSON.stringify(["x", "linkedin"]),
    cadenceJson: JSON.stringify({ x: 3, linkedin: 4 }),
    active: true,
  },
];

async function run() {
  for (const p of newPersonas) {
    const existing = await db
      .select()
      .from(personas)
      .where(eq(personas.name, p.name))
      .limit(1);
    if (existing.length > 0) {
      console.log(`  - ${p.name} already exists (id=${existing[0].id}), skipping`);
      continue;
    }
    const [inserted] = await db.insert(personas).values(p).returning();
    console.log(`  ✓ Created ${p.name} (id=${inserted.id})`);
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
