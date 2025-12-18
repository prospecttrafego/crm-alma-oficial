import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Inbox, Kanban, Users, Zap } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <span className="text-sm font-bold text-primary-foreground">A</span>
            </div>
            <span className="text-xl font-bold" data-testid="text-logo">Alma</span>
          </div>
          <Link href="/login">
            <Button data-testid="button-login">Entrar</Button>
          </Link>
        </div>
      </header>

      <main>
        <section className="py-20 md:py-32">
          <div className="container mx-auto px-4 text-center">
            <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl" data-testid="text-hero-title">
              CRM feito para
              <span className="text-primary"> agências modernas</span>
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl" data-testid="text-hero-description">
              Simplifique seu pipeline de vendas e conversas com clientes em uma plataforma
              bonita e rápida. Feito para equipes que exigem excelência.
            </p>
            <Link href="/login">
              <Button size="lg" className="text-lg" data-testid="button-get-started">
                Comece Agora
              </Button>
            </Link>
          </div>
        </section>

        <section className="border-t py-20">
          <div className="container mx-auto px-4">
            <h2 className="mb-12 text-center text-3xl font-bold" data-testid="text-features-title">
              Tudo que você precisa para fechar negócios
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                    <Inbox className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Inbox Unificado</CardTitle>
                  <CardDescription>
                    Todas as suas conversas em um só lugar. Email, WhatsApp e muito mais.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                    <Kanban className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Pipeline Visual</CardTitle>
                  <CardDescription>
                    Arraste e solte negócios entre etapas. Veja todo seu pipeline de uma só vez.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Gestão de Contatos</CardTitle>
                  <CardDescription>
                    Acompanhe todos os contatos e empresas com campos personalizados.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">Tempo Real</CardTitle>
                  <CardDescription>
                    Notificações instantâneas quando negócios mudam ou mensagens chegam.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Alma Digital Agency. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
