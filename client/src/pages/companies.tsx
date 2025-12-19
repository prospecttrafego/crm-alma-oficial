import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTranslation } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Plus, Search, Building2, Globe, Users, ExternalLink } from "lucide-react";
import { EntityHistory } from "@/components/entity-history";
import type { Company, Contact } from "@shared/schema";

interface CompanyWithContacts extends Company {
  contacts?: Contact[];
}

export default function CompaniesPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [newCompanyOpen, setNewCompanyOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyWithContacts | null>(null);

  const { data: companies, isLoading } = useQuery<CompanyWithContacts[]>({
    queryKey: ["/api/companies"],
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (data: Partial<Company>) => {
      await apiRequest("POST", "/api/companies", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setNewCompanyOpen(false);
      toast({ title: t("toast.created") });
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "destructive" });
    },
  });

  const handleCreateCompany = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createCompanyMutation.mutate({
      name: formData.get("name") as string,
      domain: formData.get("domain") as string,
      website: formData.get("website") as string,
      industry: formData.get("industry") as string,
      size: formData.get("size") as string,
    });
  };

  const filteredCompanies = companies?.filter((company) => {
    if (!searchQuery) return true;
    return (
      company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.domain?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.industry?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-companies-title">{t("companies.title")}</h1>
          <p className="text-muted-foreground">
            {t("companies.subtitle")}
          </p>
        </div>
        <Dialog open={newCompanyOpen} onOpenChange={setNewCompanyOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-company">
              <Plus className="mr-2 h-4 w-4" />
              {t("companies.newCompany")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateCompany}>
              <DialogHeader>
                <DialogTitle>{t("companies.newCompany")}</DialogTitle>
                <DialogDescription>
                  {t("companies.newCompanyDescription")}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">{t("companies.name")}</Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    data-testid="input-company-name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="domain">{t("companies.domain")}</Label>
                  <Input
                    id="domain"
                    name="domain"
                    placeholder="example.com"
                    data-testid="input-company-domain"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="website">{t("companies.website")}</Label>
                  <Input
                    id="website"
                    name="website"
                    placeholder="https://example.com"
                    data-testid="input-company-website"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="industry">{t("companies.industry")}</Label>
                  <Input
                    id="industry"
                    name="industry"
                    data-testid="input-company-industry"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="size">{t("companies.size")}</Label>
                  <select
                    id="size"
                    name="size"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    data-testid="select-company-size"
                  >
                    <option value="">{t("companies.selectSize")}</option>
                    <option value="1-10">{t("companies.sizes.1-10")}</option>
                    <option value="11-50">{t("companies.sizes.11-50")}</option>
                    <option value="51-200">{t("companies.sizes.51-200")}</option>
                    <option value="201-500">{t("companies.sizes.201-500")}</option>
                    <option value="500+">{t("companies.sizes.500+")}</option>
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setNewCompanyOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={createCompanyMutation.isPending}
                  data-testid="button-create-company-submit"
                >
                  {createCompanyMutation.isPending ? t("common.saving") : t("common.create")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("common.search")}
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-companies"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="mt-2 h-4 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredCompanies && filteredCompanies.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCompanies.map((company) => (
              <Card
                key={company.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => setSelectedCompany(company)}
                data-testid={`card-company-${company.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    {company.industry && (
                      <Badge variant="secondary">{company.industry}</Badge>
                    )}
                  </div>
                  <CardTitle className="mt-2">{company.name}</CardTitle>
                  {company.domain && (
                    <CardDescription>{company.domain}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {company.website && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Globe className="h-4 w-4" />
                        <a
                          href={company.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-foreground"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t("companies.website")}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                    {company.size && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {company.size} {t("companies.employees")}
                      </div>
                    )}
                    {company.contacts && company.contacts.length > 0 && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {company.contacts.length} {t("contacts.title").toLowerCase()}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-md border">
            <div className="text-center text-muted-foreground">
              <Building2 className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>{t("companies.noCompanies")}</p>
              <p className="text-sm">{t("companies.noCompaniesDescription")}</p>
            </div>
          </div>
        )}
      </div>

      <Sheet open={!!selectedCompany} onOpenChange={() => setSelectedCompany(null)}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <span>{selectedCompany?.name}</span>
            </SheetTitle>
            <SheetDescription>{t("companies.detailsAndHistory")}</SheetDescription>
          </SheetHeader>

          {selectedCompany && (
            <div className="mt-6 space-y-6">
              <div className="space-y-3">
                {selectedCompany.domain && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedCompany.domain}</span>
                  </div>
                )}
                {selectedCompany.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={selectedCompany.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      {selectedCompany.website}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {selectedCompany.industry && (
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="secondary">{selectedCompany.industry}</Badge>
                  </div>
                )}
                {selectedCompany.size && (
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedCompany.size} {t("companies.employees")}</span>
                  </div>
                )}
              </div>

              {selectedCompany.contacts && selectedCompany.contacts.length > 0 && (
                <div className="rounded-md border p-4">
                  <h4 className="mb-3 text-sm font-medium">{t("contacts.title")}</h4>
                  <div className="space-y-2">
                    {selectedCompany.contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {contact.firstName} {contact.lastName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-md border">
                <EntityHistory entityType="company" entityId={selectedCompany.id} />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
