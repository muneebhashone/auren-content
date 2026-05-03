import "dotenv/config";
import { db } from "./client";
import {
  businessProfile,
  personas,
  quarterlyGoals,
  settings,
} from "./schema";

async function seed() {
  console.log("Seeding database...");

  const existingProfile = await db.select().from(businessProfile).limit(1);
  if (existingProfile.length === 0) {
    await db.insert(businessProfile).values({
      id: 1,
      region: "Global / MENA-leaning",
      icp: "Early-stage founders (pre-seed to Series A) and indie operators who need shipped product, not slideware. Secondary: ops/marketing leads at small startups looking to automate.",
      servicesJson: JSON.stringify([
        { name: "Web Development", description: "Production-grade web apps." },
        { name: "MVP in 3 Weeks", description: "Validated MVP shipped in 21 days, fixed scope." },
        { name: "Logo Design", description: "Brand-grade identity work." },
        { name: "AI Automations", description: "Workflow automations powered by LLMs and agents." },
        { name: "Agentic Workflows", description: "Multi-agent systems that operate end-to-end on a job." },
      ]),
      brandPillars: "Speed without sloppiness. Product taste. Engineering rigor. Ship over slideware.",
      antiGoals: "Don't sound like a generic agency. Don't promise vague AI magic. Don't lean on buzzwords without proof.",
      voiceGlobal:
        "Direct, builder-first, occasionally sharp. Specifics over abstractions. Show the work. Numbers, screenshots, code beats adjectives.",
    });
    console.log("  ✓ Business profile seeded");
  } else {
    console.log("  - Business profile already exists, skipped");
  }

  const existingPersonas = await db.select().from(personas).limit(1);
  if (existingPersonas.length === 0) {
    await db.insert(personas).values({
      name: "Muneeb (CEO)",
      role: "Founder / CEO of AurenStudios",
      voiceProfileMd:
        "Builder-operator energy. Speaks from first principles. Mixes opinionated takes with concrete examples from current client work. Comfortable being slightly contrarian. Avoids LinkedIn-platitude voice. Short sentences. Names tools and tradeoffs by name.",
      dos: "Lead with a specific problem or moment. Use real numbers. Reference what shipped this week. Take a clear position.",
      donts: "Don't start with 'I'm excited to announce'. No emoji walls. No 'thoughts?' filler endings. No motivational quotes.",
      samplePhrases: "shipped in 11 days, not 11 weeks\nthe boring answer is usually right\nstop scoping, start cutting",
      platformsJson: JSON.stringify(["x", "linkedin"]),
      cadenceJson: JSON.stringify({ x: 4, linkedin: 2 }),
      active: true,
    });
    console.log("  ✓ Default persona seeded");
  } else {
    console.log("  - Personas already exist, skipped");
  }

  const existingGoals = await db.select().from(quarterlyGoals).limit(1);
  if (existingGoals.length === 0) {
    await db.insert(quarterlyGoals).values({
      quarter: "2026-Q2",
      objective: "Position AurenStudios as the go-to MVP-in-3-weeks shop for technical founders.",
      narrative:
        "Every post should reinforce one of: (a) we ship faster than your devs, (b) we have product taste, (c) we own AI/agent integrations end-to-end. Avoid generic agency framing.",
      successMetrics: "5 inbound leads/week from social by end of quarter. 1 case study published per month.",
      active: true,
    });
    console.log("  ✓ Quarterly goal seeded");
  } else {
    console.log("  - Goals already exist, skipped");
  }

  const existingSettings = await db.select().from(settings).limit(1);
  if (existingSettings.length === 0) {
    await db
      .insert(settings)
      .values({ key: "model_overrides", valueJson: "{}" })
      .onConflictDoNothing();
    console.log("  ✓ Settings seeded");
  }

  console.log("Seed complete.");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
