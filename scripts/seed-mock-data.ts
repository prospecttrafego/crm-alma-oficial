/**
 * Script para popular o banco de dados com dados de demonstracao
 * Execute com: npx tsx scripts/seed-mock-data.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import pg from "pg";
import {
  users,
  organizations,
  companies,
  contacts,
  pipelines,
  pipelineStages,
  deals,
  conversations,
  messages,
  activities,
} from "../shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL deve estar configurada no .env");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// Dados mock realistas em portugues
const mockCompanies = [
  { name: "TechSolutions Brasil", domain: "techsolutions.com.br", website: "https://techsolutions.com.br", segment: "Tecnologia", size: "50-100", industry: "Software" },
  { name: "Construtora Horizonte", domain: "horizonteconstrucoes.com.br", website: "https://horizonteconstrucoes.com.br", segment: "Construcao", size: "100-500", industry: "Construcao Civil" },
  { name: "Clinica Vida Saudavel", domain: "vidasaudavel.med.br", website: "https://vidasaudavel.med.br", segment: "Saude", size: "10-50", industry: "Saude" },
  { name: "Restaurante Sabor Mineiro", domain: "sabormineiro.com.br", website: "https://sabormineiro.com.br", segment: "Alimentacao", size: "10-50", industry: "Gastronomia" },
  { name: "Advocacia Martins & Associados", domain: "martinsadvocacia.com.br", website: "https://martinsadvocacia.com.br", segment: "Juridico", size: "10-50", industry: "Servicos Juridicos" },
  { name: "Automoveis Premium SP", domain: "premiumautos.com.br", website: "https://premiumautos.com.br", segment: "Automotivo", size: "50-100", industry: "Comercio de Veiculos" },
  { name: "Escola Futuro Brilhante", domain: "futurobrilhante.edu.br", website: "https://futurobrilhante.edu.br", segment: "Educacao", size: "50-100", industry: "Educacao" },
  { name: "Imobiliaria Casa Nova", domain: "casanovaimoveis.com.br", website: "https://casanovaimoveis.com.br", segment: "Imobiliario", size: "10-50", industry: "Imobiliario" },
  { name: "Agencia Digital Criativa", domain: "criativadigital.com.br", website: "https://criativadigital.com.br", segment: "Marketing", size: "10-50", industry: "Marketing Digital" },
  { name: "Logistica Express", domain: "logisticaexpress.com.br", website: "https://logisticaexpress.com.br", segment: "Logistica", size: "100-500", industry: "Transporte e Logistica" },
];

const mockContacts = [
  { firstName: "Carlos", lastName: "Silva", email: "carlos.silva@techsolutions.com.br", phone: "(11) 99999-1234", jobTitle: "Diretor de TI", source: "LinkedIn" },
  { firstName: "Maria", lastName: "Santos", email: "maria.santos@horizonteconstrucoes.com.br", phone: "(11) 98888-5678", jobTitle: "Gerente de Projetos", source: "Indicacao" },
  { firstName: "Pedro", lastName: "Oliveira", email: "pedro.oliveira@vidasaudavel.med.br", phone: "(11) 97777-9012", jobTitle: "Diretor Administrativo", source: "Site" },
  { firstName: "Ana", lastName: "Costa", email: "ana.costa@sabormineiro.com.br", phone: "(31) 96666-3456", jobTitle: "Proprietaria", source: "Instagram" },
  { firstName: "Roberto", lastName: "Martins", email: "roberto@martinsadvocacia.com.br", phone: "(11) 95555-7890", jobTitle: "Socio Fundador", source: "Evento" },
  { firstName: "Fernanda", lastName: "Lima", email: "fernanda.lima@premiumautos.com.br", phone: "(11) 94444-2345", jobTitle: "Gerente Comercial", source: "Google Ads" },
  { firstName: "Lucas", lastName: "Ferreira", email: "lucas.ferreira@futurobrilhante.edu.br", phone: "(11) 93333-6789", jobTitle: "Coordenador Pedagogico", source: "Facebook" },
  { firstName: "Patricia", lastName: "Almeida", email: "patricia@casanovaimoveis.com.br", phone: "(11) 92222-0123", jobTitle: "Corretora Chefe", source: "Indicacao" },
  { firstName: "Rodrigo", lastName: "Souza", email: "rodrigo@criativadigital.com.br", phone: "(11) 91111-4567", jobTitle: "CEO", source: "LinkedIn" },
  { firstName: "Juliana", lastName: "Pereira", email: "juliana.pereira@logisticaexpress.com.br", phone: "(11) 90000-8901", jobTitle: "Diretora de Operacoes", source: "Site" },
  { firstName: "Marcos", lastName: "Ribeiro", email: "marcos.ribeiro@gmail.com", phone: "(21) 99876-5432", jobTitle: "Consultor", source: "WhatsApp" },
  { firstName: "Camila", lastName: "Mendes", email: "camila.mendes@outlook.com", phone: "(11) 98765-4321", jobTitle: "Empreendedora", source: "Instagram" },
];

const mockDeals = [
  { title: "Projeto de Site Institucional", value: "15000.00", probability: 80, source: "Site", notes: "Cliente precisa de um site moderno e responsivo" },
  { title: "Campanha de Marketing Digital", value: "8500.00", probability: 60, source: "LinkedIn", notes: "Campanha para lancamento de produto" },
  { title: "Sistema de Gestao Interno", value: "45000.00", probability: 40, source: "Indicacao", notes: "ERP customizado para a empresa" },
  { title: "Redesign de Marca", value: "12000.00", probability: 90, source: "Instagram", notes: "Nova identidade visual completa" },
  { title: "Aplicativo móvel iOS/Android", value: "75000.00", probability: 30, source: "Evento", notes: "Aplicativo de delivery" },
  { title: "Consultoria em SEO", value: "6000.00", probability: 70, source: "Google", notes: "Otimizacao para motores de busca" },
  { title: "Comércio eletrônico completo", value: "35000.00", probability: 50, source: "Site", notes: "Loja virtual com integracao de pagamentos" },
  { title: "Gestao de Redes Sociais", value: "4500.00", probability: 85, source: "WhatsApp", notes: "Pacote mensal de gestao" },
  { title: "Video Institucional", value: "18000.00", probability: 45, source: "LinkedIn", notes: "Video de 3 minutos com animacoes" },
  { title: "Treinamento em Marketing", value: "9000.00", probability: 65, source: "Indicacao", notes: "Workshop de 2 dias para equipe" },
  { title: "Automacao de WhatsApp", value: "7500.00", probability: 75, source: "Site", notes: "Chatbot e integracao com CRM" },
  { title: "Página de captura para lançamento", value: "5000.00", probability: 95, source: "Instagram", notes: "Pagina de captura de leads" },
];

const mockConversations = [
  { subject: "Duvida sobre orcamento do projeto", channel: "email" as const, status: "open" },
  { subject: "Reuniao de alinhamento", channel: "whatsapp" as const, status: "open" },
  { subject: "Feedback sobre proposta", channel: "email" as const, status: "pending" },
  { subject: "Solicitacao de ajustes", channel: "whatsapp" as const, status: "open" },
  { subject: "Aprovacao de layout", channel: "email" as const, status: "closed" },
  { subject: "Duvidas tecnicas", channel: "whatsapp" as const, status: "open" },
  { subject: "Negociacao de prazo", channel: "phone" as const, status: "pending" },
  { subject: "Suporte pos-venda", channel: "whatsapp" as const, status: "open" },
];

const mockMessages = [
  "Ola! Gostaria de saber mais sobre os servicos de voces.",
  "Claro! Podemos agendar uma reuniao para discutir os detalhes?",
  "Perfeito! Estou disponivel na quinta-feira as 14h.",
  "Ótimo! Vou enviar o convite do Google Meet.",
  "Recebi a proposta. Vou analisar com minha equipe e retorno em breve.",
  "Temos algumas duvidas sobre o escopo do projeto.",
  "Podemos incluir mais uma funcionalidade no sistema?",
  "Sim, vou recalcular o orcamento e enviar a nova proposta.",
  "O prazo de entrega pode ser antecipado?",
  "Vamos fazer o possivel para atender essa demanda.",
  "Aprovado! Quando podemos comecar?",
  "Excelente! Vou preparar o contrato para assinatura.",
];

const mockActivities = [
  { type: "call" as const, title: "Ligacao de qualificacao", description: "Primeira ligacao para entender as necessidades do cliente" },
  { type: "meeting" as const, title: "Reuniao de apresentacao", description: "Apresentacao dos servicos e portfolio" },
  { type: "email" as const, title: "Envio de proposta comercial", description: "Proposta detalhada com valores e prazos" },
  { type: "task" as const, title: "Preparar apresentacao", description: "Criar slides para reuniao com cliente" },
  { type: "note" as const, title: "Anotacoes da reuniao", description: "Cliente interessado em pacote completo" },
  { type: "call" as const, title: "Acompanhamento", description: "Ligacao de acompanhamento apos envio da proposta" },
  { type: "meeting" as const, title: "Reuniao de fechamento", description: "Negociacao final e assinatura do contrato" },
  { type: "task" as const, title: "Enviar contrato", description: "Preparar e enviar contrato para assinatura digital" },
];

const pipelineStagesData = [
  { name: "Novo Lead", order: 1, color: "#6366f1", isWon: false, isLost: false },
  { name: "Qualificacao", order: 2, color: "#8b5cf6", isWon: false, isLost: false },
  { name: "Proposta Enviada", order: 3, color: "#ec4899", isWon: false, isLost: false },
  { name: "Negociacao", order: 4, color: "#f97316", isWon: false, isLost: false },
  { name: "Fechado Ganho", order: 5, color: "#22c55e", isWon: true, isLost: false },
  { name: "Fechado Perdido", order: 6, color: "#ef4444", isWon: false, isLost: true },
];

async function seed() {
  console.log("🌱 Iniciando seed de dados mock...\n");

  try {
    // Buscar usuario e organizacao existentes
    const existingUsers = await db.select().from(users).limit(1);

    if (existingUsers.length === 0) {
      console.log("❌ Nenhum usuario encontrado. Crie uma conta primeiro.");
      process.exit(1);
    }

    const currentUser = existingUsers[0];
    console.log(`✅ Usuario encontrado: ${currentUser.email}`);

    // Verificar ou criar organizacao
    let orgId = currentUser.organizationId;

    if (!orgId) {
      console.log("📦 Criando organizacao...");
      const [newOrg] = await db.insert(organizations).values({
        name: "Alma Digital Agency",
        domain: "almaagencia.com.br",
      }).returning();
      orgId = newOrg.id;

      // Atualizar usuario com organizacao
      await db.update(users)
        .set({ organizationId: orgId })
        .where(eq(users.id, currentUser.id));

      console.log(`✅ Organizacao criada: ${newOrg.name}`);
    } else {
      console.log(`✅ Organizacao existente: ID ${orgId}`);
    }

    // Criar pipeline
    console.log("\n📊 Criando pipeline...");
    const existingPipeline = await db.select().from(pipelines).where(eq(pipelines.organizationId, orgId)).limit(1);

    let pipelineId: number;
    if (existingPipeline.length > 0) {
      pipelineId = existingPipeline[0].id;
      console.log(`✅ Pipeline existente: ${existingPipeline[0].name}`);
    } else {
      const [newPipeline] = await db.insert(pipelines).values({
        name: "Pipeline de Vendas",
        organizationId: orgId,
        isDefault: true,
      }).returning();
      pipelineId = newPipeline.id;
      console.log(`✅ Pipeline criado: ${newPipeline.name}`);
    }

    // Criar stages
    console.log("\n🎯 Criando etapas do pipeline...");
    const existingStages = await db.select().from(pipelineStages).where(eq(pipelineStages.pipelineId, pipelineId));

    let stageIds: number[] = [];
    if (existingStages.length > 0) {
      stageIds = existingStages.sort((a, b) => a.order - b.order).map(s => s.id);
      console.log(`✅ ${existingStages.length} etapas existentes`);
    } else {
      for (const stage of pipelineStagesData) {
        const [newStage] = await db.insert(pipelineStages).values({
          ...stage,
          pipelineId,
        }).returning();
        stageIds.push(newStage.id);
        console.log(`  ✅ ${stage.name}`);
      }
    }

    // Criar empresas
    console.log("\n🏢 Criando empresas...");
    const companyIds: number[] = [];
    for (const company of mockCompanies) {
      const [newCompany] = await db.insert(companies).values({
        ...company,
        organizationId: orgId,
        ownerId: currentUser.id,
      }).returning();
      companyIds.push(newCompany.id);
      console.log(`  ✅ ${company.name}`);
    }

    // Criar contatos
    console.log("\n👥 Criando contatos...");
    const contactIds: number[] = [];
    for (let i = 0; i < mockContacts.length; i++) {
      const contact = mockContacts[i];
      const [newContact] = await db.insert(contacts).values({
        ...contact,
        companyId: companyIds[i % companyIds.length],
        organizationId: orgId,
        ownerId: currentUser.id,
        tags: ["lead", contact.source.toLowerCase()],
      }).returning();
      contactIds.push(newContact.id);
      console.log(`  ✅ ${contact.firstName} ${contact.lastName}`);
    }

    // Criar deals
    console.log("\n💰 Criando negocios...");
    const dealIds: number[] = [];
    for (let i = 0; i < mockDeals.length; i++) {
      const deal = mockDeals[i];
      // Distribuir deals entre as etapas (exceto ganho/perdido para maioria)
      const stageIndex = i < 8 ? i % 4 : (i < 10 ? 4 : 5);
      const status = stageIndex === 4 ? "won" : (stageIndex === 5 ? "lost" : "open");

      const [newDeal] = await db.insert(deals).values({
        title: deal.title,
        value: deal.value,
        probability: deal.probability,
        source: deal.source,
        notes: deal.notes,
        pipelineId,
        stageId: stageIds[stageIndex],
        contactId: contactIds[i % contactIds.length],
        companyId: companyIds[i % companyIds.length],
        organizationId: orgId,
        ownerId: currentUser.id,
        status,
        currency: "BRL",
        expectedCloseDate: new Date(Date.now() + (i + 1) * 7 * 24 * 60 * 60 * 1000), // Proximas semanas
      }).returning();
      dealIds.push(newDeal.id);
      console.log(`  ✅ ${deal.title} - R$ ${deal.value}`);
    }

    // Criar conversas
    console.log("\n💬 Criando conversas...");
    const conversationIds: number[] = [];
    for (let i = 0; i < mockConversations.length; i++) {
      const conv = mockConversations[i];
      const [newConv] = await db.insert(conversations).values({
        ...conv,
        contactId: contactIds[i % contactIds.length],
        dealId: dealIds[i % dealIds.length],
        organizationId: orgId,
        assignedToId: currentUser.id,
        unreadCount: conv.status === "open" ? Math.floor(Math.random() * 3) : 0,
        lastMessageAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      }).returning();
      conversationIds.push(newConv.id);
      console.log(`  ✅ ${conv.subject}`);
    }

    // Criar mensagens
    console.log("\n📝 Criando mensagens...");
    let messageCount = 0;
    for (let i = 0; i < conversationIds.length; i++) {
      const numMessages = 2 + Math.floor(Math.random() * 4); // 2-5 mensagens por conversa
      for (let j = 0; j < numMessages; j++) {
        const isFromUser = j % 2 === 1;
        await db.insert(messages).values({
          conversationId: conversationIds[i],
          senderId: isFromUser ? currentUser.id : null,
          senderType: isFromUser ? "user" : "contact",
          content: mockMessages[(i + j) % mockMessages.length],
          isInternal: false,
          createdAt: new Date(Date.now() - (numMessages - j) * 60 * 60 * 1000),
        });
        messageCount++;
      }
    }
    console.log(`  ✅ ${messageCount} mensagens criadas`);

    // Criar atividades
    console.log("\n📋 Criando atividades...");
    for (let i = 0; i < mockActivities.length; i++) {
      const activity = mockActivities[i];
      const isPast = i < 4;
      const dueDate = isPast
        ? new Date(Date.now() - (4 - i) * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + (i - 3) * 24 * 60 * 60 * 1000);

      await db.insert(activities).values({
        ...activity,
        contactId: contactIds[i % contactIds.length],
        dealId: dealIds[i % dealIds.length],
        organizationId: orgId,
        userId: currentUser.id,
        dueDate,
        status: isPast ? "completed" : "pending",
        completedAt: isPast ? dueDate : null,
      });
      console.log(`  ✅ ${activity.title}`);
    }

    console.log("\n✨ Seed concluido com sucesso!");
    console.log("\n📊 Resumo:");
    console.log(`   - ${mockCompanies.length} empresas`);
    console.log(`   - ${mockContacts.length} contatos`);
    console.log(`   - ${mockDeals.length} negocios`);
    console.log(`   - ${mockConversations.length} conversas`);
    console.log(`   - ${messageCount} mensagens`);
    console.log(`   - ${mockActivities.length} atividades`);

  } catch (error) {
    console.error("❌ Erro durante o seed:", error);
    process.exit(1);
  }

  process.exit(0);
}

seed();
