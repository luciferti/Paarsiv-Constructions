import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Generic demo tenant so the platform is client-agnostic out of the box.
const TENANT_SLUG = "demo";
const ADMIN_PW = "ChangeMe!2026";
const AGENT_PW = "Demo@2026";

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: TENANT_SLUG },
    update: {},
    create: {
      slug: TENANT_SLUG,
      name: "Demo Realty",
      botName: "Demo Assistant",
      aiSource: "OWN",
      aiEnabled: true,
      graphVersion: "v21.0",
    },
  });
  console.log(`tenant: ${tenant.name} (${tenant.slug})`);

  async function upsertUser(
    username: string,
    displayName: string,
    role: "ADMIN" | "RM" | "SALES",
    password: string,
    managerUsername?: string,
    team?: string
  ) {
    const managerId = managerUsername
      ? (
          await prisma.user.findUnique({
            where: { tenantId_username: { tenantId: tenant.id, username: managerUsername } },
          })
        )?.id
      : null;
    return prisma.user.upsert({
      where: { tenantId_username: { tenantId: tenant.id, username } },
      update: { displayName, role, managerId: managerId || null, team: team || null },
      create: {
        tenantId: tenant.id,
        username,
        passwordHash: await bcrypt.hash(password, 10),
        displayName,
        role,
        managerId: managerId || null,
        team: team || null,
      },
    });
  }

  await upsertUser("admin", "Administrator", "ADMIN", ADMIN_PW);
  await upsertUser("priya", "Priya (RM North)", "RM", AGENT_PW, "admin", "North");
  await upsertUser("arjun", "Arjun (RM South)", "RM", AGENT_PW, "admin", "South");
  await upsertUser("sana", "Sana", "SALES", AGENT_PW, "priya", "North");
  await upsertUser("neha", "Neha", "SALES", AGENT_PW, "priya", "North");
  await upsertUser("vikram", "Vikram", "SALES", AGENT_PW, "arjun", "South");
  await upsertUser("rohit", "Rohit", "SALES", AGENT_PW, "arjun", "South");
  console.log("users: admin, priya, arjun (RM) + sana, neha, vikram, rohit (sales)");

  // ---- Knowledge intents (generic real-estate FAQ, English + Hinglish keywords) ----
  const intents: {
    intentKey: string;
    keywords: string;
    answer: string;
    priority: number;
    isHandoff?: boolean;
  }[] = [
    { intentKey: "greeting", keywords: "hi|hello|hey|namaste|hii", answer: "Hello! Welcome to Demo Realty. How can I help you find your home today?", priority: 2 },
    { intentKey: "property", keywords: "property|ghar|house|home|flat|apartment|villa|plot|makaan", answer: "We offer apartments, villas and plots across multiple cities. Which city and type are you interested in?", priority: 7 },
    { intentKey: "pricing", keywords: "price|cost|kitna|rate|budget|paisa|kimat", answer: "Prices range from Rs 79L to Rs 3 Cr depending on city, type and configuration. Share your budget and city and I'll suggest options.", priority: 8 },
    { intentKey: "loan", keywords: "loan|emi|finance|home loan|loan chahiye|kist", answer: "We assist with home loans from leading banks, typically up to 80% of property value. Would you like a callback from our loan desk?", priority: 7 },
    { intentKey: "visit", keywords: "visit|site visit|dekhna|appointment|tour", answer: "Happy to arrange a site visit! Please share your preferred city and date, and a team member will confirm.", priority: 6 },
    { intentKey: "contact", keywords: "contact|number|call|phone|baat", answer: "You can reach our team at +91 88677 00121, or I can have someone call you back.", priority: 6 },
    { intentKey: "hours", keywords: "timing|hours|time|open|kab|khula", answer: "Our team is available Mon-Sat, 10am to 7pm.", priority: 4 },
    { intentKey: "thanks", keywords: "thanks|thank you|shukriya|dhanyawad|ok thanks", answer: "You're welcome! Feel free to reach out anytime.", priority: 2 },
    { intentKey: "handoff", keywords: "agent|human|representative|baat karni|talk to someone|complaint", answer: "Sure, connecting you with a team member now. Please hold on.", priority: 9, isHandoff: true },
  ];

  for (const i of intents) {
    await prisma.intent.upsert({
      where: { tenantId_intentKey: { tenantId: tenant.id, intentKey: i.intentKey } },
      update: { keywords: i.keywords, answer: i.answer, priority: i.priority, isHandoff: !!i.isHandoff, isActive: true },
      create: { tenantId: tenant.id, ...i, isHandoff: !!i.isHandoff },
    });
  }
  console.log(`intents: ${intents.length}`);

  // ---- Sample projects ----
  const projects = [
    { name: "Green Meadows", city: "Bengaluru", propType: "Villa", config: "3-4 BHK", area: "Sarjapur", status: "Ready", priceText: "Rs 2.4 Cr" },
    { name: "Skyline Heights", city: "Bengaluru", propType: "Apartment", config: "2-3 BHK", area: "Whitefield", status: "Under construction", priceText: "Rs 95L" },
    { name: "Lakeview Plots", city: "Hyderabad", propType: "Plot", config: "Plots", area: "Kokapet", status: "Ready", priceText: "Rs 79L" },
    { name: "Palm Retreat", city: "Hosur", propType: "Villa", config: "3 BHK", area: "Hosur", status: "Ready", priceText: "Rs 1.3 Cr" },
  ];
  // Refresh sample projects idempotently.
  await prisma.project.deleteMany({ where: { tenantId: tenant.id } });
  for (const p of projects) {
    await prisma.project.create({ data: { tenantId: tenant.id, ...p } });
  }
  console.log(`projects: ${projects.length}`);

  // ---- Sample contacts (marketing audience) ----
  const contacts = [
    { phone: "919810000001", name: "Ravi Kumar", city: "Bengaluru", tags: ["lead", "villa"] },
    { phone: "919810000002", name: "Sneha Rao", city: "Bengaluru", tags: ["lead", "apartment"] },
    { phone: "919810000003", name: "Amit Gupta", city: "Hyderabad", tags: ["lead", "plot"] },
    { phone: "919810000004", name: "Priya Nair", city: "Hyderabad", tags: ["customer"] },
    { phone: "919810000005", name: "Vikas Shah", city: "Hosur", tags: ["lead", "villa"] },
    { phone: "919810000006", name: "Meera Iyer", city: "Bengaluru", tags: ["customer", "villa"] },
    { phone: "919810000007", name: "Arjun Reddy", city: "Mysuru", tags: ["lead"] },
    { phone: "919810000008", name: "Neha Jain", city: "Bengaluru", tags: ["lead", "apartment"] },
  ];
  for (const c of contacts) {
    await prisma.contact.upsert({
      where: { tenantId_phone: { tenantId: tenant.id, phone: c.phone } },
      update: { name: c.name, city: c.city, tags: c.tags },
      create: { tenantId: tenant.id, source: "import", ...c },
    });
  }
  console.log(`contacts: ${contacts.length}`);

  // ---- Segment folders ----
  const leadsFolder = await prisma.segmentFolder.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Leads" } },
    update: {},
    create: { tenantId: tenant.id, name: "Leads" },
  });
  await prisma.segmentFolder.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Customers" } },
    update: {},
    create: { tenantId: tenant.id, name: "Customers" },
  });

  // ---- Sample segments (inside the Leads folder) ----
  await prisma.segment.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Bengaluru leads" } },
    update: { folderId: leadsFolder.id },
    create: {
      tenantId: tenant.id,
      name: "Bengaluru leads",
      folderId: leadsFolder.id,
      rules: {
        match: "all",
        conditions: [
          { field: "city", op: "equals", value: "Bengaluru" },
          { field: "tag", op: "has", value: "lead" },
        ],
      },
    },
  });
  await prisma.segment.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Villa seekers" } },
    update: { folderId: leadsFolder.id },
    create: {
      tenantId: tenant.id,
      name: "Villa seekers",
      folderId: leadsFolder.id,
      rules: { match: "all", conditions: [{ field: "tag", op: "has", value: "villa" }] },
    },
  });
  console.log("segment folders: 2 (Leads, Customers) · segments: 2");

  // ---- Sample templates ----
  const templates = [
    {
      name: "Welcome offer",
      category: "MARKETING",
      body: "Hi {{name}}! Thanks for your interest in properties in {{city}}. We have new launches starting Rs 79L. Reply to book a free site visit.",
      footerText: "Demo Realty",
    },
    {
      name: "Site visit reminder",
      category: "UTILITY",
      body: "Hi {{name}}, this is a reminder about your site visit. Our team will call you shortly to confirm the time. See you soon!",
      footerText: "Demo Realty",
    },
  ];
  for (const t of templates) {
    await prisma.template.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: t.name } },
      update: { body: t.body, category: t.category, footerText: t.footerText, status: "APPROVED" },
      create: { tenantId: tenant.id, ...t, status: "APPROVED" },
    });
  }
  console.log(`templates: ${templates.length}`);

  // ---- Sample journey (keyword-triggered) ----
  await prisma.journey.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "New enquiry welcome" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "New enquiry welcome",
      status: "DRAFT",
      triggerType: "keyword",
      triggerValue: "brochure",
      steps: [
        { type: "message", text: "Hi {{name}}! Here is our brochure. Which city are you interested in?" },
        { type: "wait", hours: 24 },
        { type: "message", text: "Just checking in — would you like to book a free site visit?" },
      ],
    },
  });
  console.log("journeys: 1 (New enquiry welcome)");

  console.log("\nDone. Login at tenant 'demo':");
  console.log(`  admin / ${ADMIN_PW}`);
  console.log(`  priya, arjun, sana, neha, vikram, rohit / ${AGENT_PW}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
