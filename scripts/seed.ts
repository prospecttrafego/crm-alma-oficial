import { db } from "../server/db";
import {
  organizations,
  pipelines,
  pipelineStages,
  companies,
  contacts,
  deals,
  conversations,
  messages,
  activities,
} from "../shared/schema";

async function seed() {
  console.log("Seeding database...");

  const existingOrgs = await db.select().from(organizations);
  if (existingOrgs.length > 0) {
    console.log("Database already seeded, skipping...");
    return;
  }

  const [org] = await db.insert(organizations).values({
    name: "Alma CRM",
    domain: "alma.io",
  }).returning();

  console.log("Created organization:", org.name);

  const [pipeline] = await db.insert(pipelines).values({
    name: "Sales Pipeline",
    organizationId: org.id,
    isDefault: true,
  }).returning();

  console.log("Created pipeline:", pipeline.name);

  const stagesData = [
    { name: "Lead", order: 1, color: "#6366F1", isWon: false, isLost: false },
    { name: "Qualified", order: 2, color: "#8B5CF6", isWon: false, isLost: false },
    { name: "Proposal", order: 3, color: "#A855F7", isWon: false, isLost: false },
    { name: "Negotiation", order: 4, color: "#EC4899", isWon: false, isLost: false },
    { name: "Won", order: 5, color: "#10B981", isWon: true, isLost: false },
    { name: "Lost", order: 6, color: "#EF4444", isWon: false, isLost: true },
  ];

  const createdStages = await db.insert(pipelineStages).values(
    stagesData.map((s) => ({ ...s, pipelineId: pipeline.id }))
  ).returning();

  console.log("Created", createdStages.length, "pipeline stages");

  const companiesData = [
    { name: "TechCorp Solutions", domain: "techcorp.com", website: "https://techcorp.com", segment: "Enterprise", size: "500-1000", industry: "Technology" },
    { name: "Startup Labs", domain: "startuplabs.io", website: "https://startuplabs.io", segment: "SMB", size: "10-50", industry: "Technology" },
    { name: "Global Finance Inc", domain: "globalfinance.com", website: "https://globalfinance.com", segment: "Enterprise", size: "1000+", industry: "Finance" },
    { name: "HealthFirst Medical", domain: "healthfirst.com", website: "https://healthfirst.com", segment: "Mid-Market", size: "100-500", industry: "Healthcare" },
    { name: "EcoGreen Energy", domain: "ecogreen.com", website: "https://ecogreen.com", segment: "SMB", size: "50-100", industry: "Energy" },
  ];

  const createdCompanies = await db.insert(companies).values(
    companiesData.map((c) => ({ ...c, organizationId: org.id }))
  ).returning();

  console.log("Created", createdCompanies.length, "companies");

  const contactsData = [
    { firstName: "Maria", lastName: "Silva", email: "maria.silva@techcorp.com", phone: "+55 11 99999-1111", jobTitle: "CTO", companyId: createdCompanies[0].id, source: "Website" },
    { firstName: "Carlos", lastName: "Santos", email: "carlos.santos@techcorp.com", phone: "+55 11 99999-2222", jobTitle: "VP Engineering", companyId: createdCompanies[0].id, source: "Referral" },
    { firstName: "Ana", lastName: "Oliveira", email: "ana@startuplabs.io", phone: "+55 21 99999-3333", jobTitle: "CEO", companyId: createdCompanies[1].id, source: "LinkedIn" },
    { firstName: "Roberto", lastName: "Costa", email: "roberto@globalfinance.com", phone: "+55 11 99999-4444", jobTitle: "CFO", companyId: createdCompanies[2].id, source: "Event" },
    { firstName: "Julia", lastName: "Pereira", email: "julia@healthfirst.com", phone: "+55 11 99999-5555", jobTitle: "COO", companyId: createdCompanies[3].id, source: "Cold Outreach" },
    { firstName: "Lucas", lastName: "Ferreira", email: "lucas@ecogreen.com", phone: "+55 21 99999-6666", jobTitle: "Director", companyId: createdCompanies[4].id, source: "Website" },
  ];

  const createdContacts = await db.insert(contacts).values(
    contactsData.map((c) => ({ ...c, organizationId: org.id, tags: ["prospect"] }))
  ).returning();

  console.log("Created", createdContacts.length, "contacts");

  const dealsData = [
    { title: "TechCorp Enterprise License", value: "150000.00", pipelineId: pipeline.id, stageId: createdStages[2].id, contactId: createdContacts[0].id, companyId: createdCompanies[0].id, probability: 60, status: "open" },
    { title: "Startup Labs Starter Plan", value: "25000.00", pipelineId: pipeline.id, stageId: createdStages[0].id, contactId: createdContacts[2].id, companyId: createdCompanies[1].id, probability: 20, status: "open" },
    { title: "Global Finance Integration", value: "500000.00", pipelineId: pipeline.id, stageId: createdStages[3].id, contactId: createdContacts[3].id, companyId: createdCompanies[2].id, probability: 75, status: "open" },
    { title: "HealthFirst Platform", value: "80000.00", pipelineId: pipeline.id, stageId: createdStages[1].id, contactId: createdContacts[4].id, companyId: createdCompanies[3].id, probability: 40, status: "open" },
    { title: "EcoGreen Dashboard", value: "35000.00", pipelineId: pipeline.id, stageId: createdStages[4].id, contactId: createdContacts[5].id, companyId: createdCompanies[4].id, probability: 100, status: "won" },
  ];

  const createdDeals = await db.insert(deals).values(
    dealsData.map((d) => ({ ...d, organizationId: org.id, currency: "BRL" }))
  ).returning();

  console.log("Created", createdDeals.length, "deals");

  const conversationsData = [
    { subject: "TechCorp License Renewal Discussion", channel: "email" as const, status: "open", contactId: createdContacts[0].id, dealId: createdDeals[0].id, unreadCount: 2 },
    { subject: "Startup Labs Demo Follow-up", channel: "whatsapp" as const, status: "open", contactId: createdContacts[2].id, dealId: createdDeals[1].id, unreadCount: 1 },
    { subject: "Global Finance Contract Review", channel: "email" as const, status: "open", contactId: createdContacts[3].id, dealId: createdDeals[2].id, unreadCount: 0 },
  ];

  const createdConversations = await db.insert(conversations).values(
    conversationsData.map((c) => ({ ...c, organizationId: org.id, lastMessageAt: new Date() }))
  ).returning();

  console.log("Created", createdConversations.length, "conversations");

  const messagesData = [
    { conversationId: createdConversations[0].id, senderType: "contact", content: "Hi, we would like to discuss the license renewal for next year.", isInternal: false },
    { conversationId: createdConversations[0].id, senderType: "user", content: "Of course! I can offer you a 15% discount for early renewal.", isInternal: false },
    { conversationId: createdConversations[1].id, senderType: "contact", content: "The demo was great! We have a few questions about integration.", isInternal: false },
    { conversationId: createdConversations[2].id, senderType: "user", content: "Please find the contract attached for your review.", isInternal: false },
  ];

  await db.insert(messages).values(messagesData);

  console.log("Created messages");

  const activitiesData = [
    { type: "call" as const, title: "Follow up call with Maria", description: "Discuss enterprise pricing", contactId: createdContacts[0].id, dealId: createdDeals[0].id, status: "pending", dueDate: new Date(Date.now() + 86400000) },
    { type: "meeting" as const, title: "Demo presentation to Startup Labs", description: "Product demonstration", contactId: createdContacts[2].id, dealId: createdDeals[1].id, status: "pending", dueDate: new Date(Date.now() + 172800000) },
    { type: "email" as const, title: "Send proposal to Global Finance", description: "Final pricing proposal", contactId: createdContacts[3].id, dealId: createdDeals[2].id, status: "pending", dueDate: new Date(Date.now() + 259200000) },
    { type: "task" as const, title: "Prepare contract for HealthFirst", description: "Draft the contract", contactId: createdContacts[4].id, dealId: createdDeals[3].id, status: "pending", dueDate: new Date(Date.now() + 345600000) },
    { type: "note" as const, title: "EcoGreen deal closed successfully", description: "Customer signed the contract", contactId: createdContacts[5].id, dealId: createdDeals[4].id, status: "completed", completedAt: new Date() },
  ];

  await db.insert(activities).values(
    activitiesData.map((a) => ({ ...a, organizationId: org.id }))
  );

  console.log("Created activities");

  console.log("Database seeding complete!");
}

seed().then(() => process.exit(0)).catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
