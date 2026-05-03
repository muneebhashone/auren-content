import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { Briefcase, Save, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db/client";
import { businessProfile } from "@/lib/db/schema";
import { safeJson } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Service = { name: string; description: string };

const serviceSchema = z.object({
  name: z.string().trim().default(""),
  description: z.string().trim().default(""),
});

const profileSchema = z.object({
  region: z.string().trim().default(""),
  icp: z.string().trim().default(""),
  brandPillars: z.string().trim().default(""),
  antiGoals: z.string().trim().default(""),
  voiceGlobal: z.string().trim().default(""),
  services: z.array(serviceSchema).default([]),
});

async function ensureProfile() {
  const existing = (await db.select().from(businessProfile).limit(1))[0];
  if (existing) return existing;
  const [created] = await db
    .insert(businessProfile)
    .values({ id: 1 })
    .returning();
  return created;
}

async function saveBusinessProfile(formData: FormData) {
  "use server";
  const names = formData.getAll("serviceName").map(String);
  const descriptions = formData.getAll("serviceDescription").map(String);
  const services: Service[] = names
    .map((name, i) => ({ name: name.trim(), description: (descriptions[i] ?? "").trim() }))
    .filter((s) => s.name.length > 0 || s.description.length > 0);

  const parsed = profileSchema.parse({
    region: formData.get("region") ?? "",
    icp: formData.get("icp") ?? "",
    brandPillars: formData.get("brandPillars") ?? "",
    antiGoals: formData.get("antiGoals") ?? "",
    voiceGlobal: formData.get("voiceGlobal") ?? "",
    services,
  });

  await db
    .update(businessProfile)
    .set({
      region: parsed.region,
      icp: parsed.icp,
      brandPillars: parsed.brandPillars,
      antiGoals: parsed.antiGoals,
      voiceGlobal: parsed.voiceGlobal,
      servicesJson: JSON.stringify(parsed.services),
    })
    .where(eq(businessProfile.id, 1));

  revalidatePath("/strategy/business");
}

export default async function BusinessProfilePage() {
  const profile = await ensureProfile();
  const services = safeJson<Service[]>(profile.servicesJson, []);
  const rows: Service[] = services.length > 0 ? services : [{ name: "", description: "" }];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Business Profile"
        description="The single source of truth for who you serve, what you sell, and how you sound. Drives every brief and post."
      />

      <form action={saveBusinessProfile} className="flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-accent" />
                <CardTitle>Positioning</CardTitle>
              </div>
              <CardDescription>Where you operate and who you exist to serve.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="region">Region</Label>
                  <Input
                    id="region"
                    name="region"
                    defaultValue={profile.region}
                    placeholder="e.g. Pakistan / GCC / Global"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="icp">Ideal customer profile</Label>
                  <Input
                    id="icp"
                    name="icp"
                    defaultValue={profile.icp}
                    placeholder="e.g. Series A SaaS founders"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="brandPillars">Brand pillars</Label>
                <Textarea
                  id="brandPillars"
                  name="brandPillars"
                  rows={3}
                  defaultValue={profile.brandPillars}
                  placeholder="Three to five themes you want to be known for."
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="antiGoals">Anti-goals</Label>
                <Textarea
                  id="antiGoals"
                  name="antiGoals"
                  rows={3}
                  defaultValue={profile.antiGoals}
                  placeholder="What you will NOT post, sound like, or pursue."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Voice (global)</CardTitle>
              <CardDescription>Cross-persona tone rules.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                name="voiceGlobal"
                rows={14}
                defaultValue={profile.voiceGlobal}
                placeholder={"Plainspoken. No hype.\nSentence fragments OK.\nAvoid corporate jargon."}
                className="font-mono text-[13px]"
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Service catalog</CardTitle>
            <CardDescription>Each row becomes a topic anchor for research and post generation.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-[200px_1fr_auto] gap-3 text-[10px] uppercase tracking-widest text-fg-subtle px-1">
                <div>Name</div>
                <div>Description</div>
                <div className="w-9" />
              </div>
              <div id="services-rows" className="flex flex-col gap-3">
                {rows.map((s, i) => (
                  <div key={i} className="grid grid-cols-[200px_1fr_auto] gap-3 items-start">
                    <Input name="serviceName" defaultValue={s.name} placeholder="e.g. Fractional CTO" />
                    <Input name="serviceDescription" defaultValue={s.description} placeholder="One-line value prop" />
                    <Button
                      type="submit"
                      formAction={removeServiceRow}
                      name="rowIndex"
                      value={String(i)}
                      variant="ghost"
                      size="icon"
                      aria-label="Remove row"
                      className="text-fg-subtle hover:text-danger"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="pt-1">
                <Button type="submit" formAction={addServiceRow} variant="secondary" size="sm">
                  <Plus className="w-4 h-4" />
                  Add service
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2 sticky bottom-0 py-4 bg-bg/80 backdrop-blur">
          <Button type="submit">
            <Save className="w-4 h-4" />
            Save profile
          </Button>
        </div>
      </form>
    </div>
  );
}

async function addServiceRow(formData: FormData) {
  "use server";
  const names = formData.getAll("serviceName").map(String);
  const descriptions = formData.getAll("serviceDescription").map(String);
  const services: Service[] = names.map((name, i) => ({
    name: name.trim(),
    description: (descriptions[i] ?? "").trim(),
  }));
  services.push({ name: "", description: "" });
  await db
    .update(businessProfile)
    .set({
      region: String(formData.get("region") ?? ""),
      icp: String(formData.get("icp") ?? ""),
      brandPillars: String(formData.get("brandPillars") ?? ""),
      antiGoals: String(formData.get("antiGoals") ?? ""),
      voiceGlobal: String(formData.get("voiceGlobal") ?? ""),
      servicesJson: JSON.stringify(services),
    })
    .where(eq(businessProfile.id, 1));
  revalidatePath("/strategy/business");
}

async function removeServiceRow(formData: FormData) {
  "use server";
  const idx = Number(formData.get("rowIndex") ?? -1);
  const names = formData.getAll("serviceName").map(String);
  const descriptions = formData.getAll("serviceDescription").map(String);
  const services: Service[] = names
    .map((name, i) => ({ name: name.trim(), description: (descriptions[i] ?? "").trim() }))
    .filter((_, i) => i !== idx);
  await db
    .update(businessProfile)
    .set({
      region: String(formData.get("region") ?? ""),
      icp: String(formData.get("icp") ?? ""),
      brandPillars: String(formData.get("brandPillars") ?? ""),
      antiGoals: String(formData.get("antiGoals") ?? ""),
      voiceGlobal: String(formData.get("voiceGlobal") ?? ""),
      servicesJson: JSON.stringify(services),
    })
    .where(eq(businessProfile.id, 1));
  revalidatePath("/strategy/business");
}
