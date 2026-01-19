"use client";

import { useCallback, useMemo, useState } from "react";
import { Building2, MessageSquare, User } from "lucide-react";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
import { contactsApi } from "@/lib/api/contacts";
import { dealsApi } from "@/lib/api/deals";
import { queryClient } from "@/lib/queryClient";
import type { ConversationWithRelations } from "@/lib/api/conversations";
import type { UpdateContactDTO, UpdateDealDTO } from "@shared/types";

type CustomFieldRow = { key: string; value: string };

type Props = {
  conversation: ConversationWithRelations;
  collapsed: boolean;
  getChannelLabel: (channel: string) => string;
  getStatusLabel: (status: string) => string;
  onConversationUpdated?: (conversation: ConversationWithRelations) => void;
};

function toDateInputValue(value: unknown) {
  if (!value) return "";
  const date = new Date(value as any);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toTagsString(tags: string[] | null | undefined) {
  return Array.isArray(tags) ? tags.join(", ") : "";
}

function normalizeTags(raw: string) {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function toCustomFieldRows(fields: Record<string, unknown> | null | undefined): CustomFieldRow[] {
  if (!fields || typeof fields !== "object") return [];
  return Object.entries(fields)
    .filter(([key]) => key.trim().length > 0)
    .map(([key, value]) => ({ key, value: value == null ? "" : String(value) }));
}

function toCustomFieldsObject(rows: CustomFieldRow[]) {
  // Convertendo o array editável em objeto para persistir no backend
  return rows.reduce<Record<string, unknown>>((acc, row) => {
    const key = row.key.trim();
    if (!key) return acc;
    acc[key] = row.value;
    return acc;
  }, {});
}

export function ContextPanel({
  conversation,
  collapsed,
  getChannelLabel,
  getStatusLabel,
  onConversationUpdated,
}: Props) {
  const { t, language } = useTranslation();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const [contactDraft, setContactDraft] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    jobTitle: "",
    tagsText: "",
  });
  const [dealDraft, setDealDraft] = useState({
    title: "",
    value: "",
    probability: 0,
    expectedCloseDate: "",
    source: "",
    notes: "",
    tagsText: "",
  });
  const [contactCustomFields, setContactCustomFields] = useState<CustomFieldRow[]>([]);
  const [dealCustomFields, setDealCustomFields] = useState<CustomFieldRow[]>([]);

  if (collapsed) {
    return <div className="flex h-full flex-col" />;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(language === "pt-BR" ? "pt-BR" : "en-US", {
      style: "currency",
      currency: language === "pt-BR" ? "BRL" : "USD",
    }).format(value);
  };

  const contactTags = useMemo(
    () => (conversation.contact?.tags ? conversation.contact.tags : []),
    [conversation.contact?.tags],
  );
  const dealTags = useMemo(
    () => (conversation.deal?.tags ? conversation.deal.tags : []),
    [conversation.deal?.tags],
  );

  const contactMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateContactDTO }) =>
      contactsApi.update(id, data),
    onSuccess: (updatedContact) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      onConversationUpdated?.({
        ...conversation,
        contact: updatedContact,
      });
    },
  });

  const dealMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateDealDTO }) =>
      dealsApi.update(id, data),
    onSuccess: (updatedDeal) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      onConversationUpdated?.({
        ...conversation,
        deal: updatedDeal,
      });
    },
  });

  const startEdit = useCallback(() => {
    if (conversation.contact) {
      setContactDraft({
        firstName: conversation.contact.firstName || "",
        lastName: conversation.contact.lastName || "",
        email: conversation.contact.email || "",
        phone: conversation.contact.phone || "",
        jobTitle: conversation.contact.jobTitle || "",
        tagsText: toTagsString(conversation.contact.tags),
      });
      setContactCustomFields(toCustomFieldRows(conversation.contact.customFields as Record<string, unknown> | null));
    }
    if (conversation.deal) {
      setDealDraft({
        title: conversation.deal.title || "",
        value: conversation.deal.value ? String(conversation.deal.value) : "",
        probability: Number(conversation.deal.probability || 0),
        expectedCloseDate: toDateInputValue(conversation.deal.expectedCloseDate),
        source: conversation.deal.source || "",
        notes: conversation.deal.notes || "",
        tagsText: toTagsString(conversation.deal.tags),
      });
      setDealCustomFields(toCustomFieldRows(conversation.deal.customFields as Record<string, unknown> | null));
    }
    setIsEditing(true);
  }, [conversation]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      if (conversation.contact) {
        const customFieldsObject = toCustomFieldsObject(contactCustomFields);
        const tags = normalizeTags(contactDraft.tagsText);
        const contactPayload: UpdateContactDTO = {
          // Evita salvar nome vazio e quebrar validações no backend
          firstName: contactDraft.firstName.trim() || conversation.contact.firstName,
          lastName: contactDraft.lastName.trim() || null,
          email: contactDraft.email.trim() || null,
          phone: contactDraft.phone.trim() || null,
          jobTitle: contactDraft.jobTitle.trim() || null,
          tags: tags.length > 0 ? tags : null,
          customFields: Object.keys(customFieldsObject).length > 0 ? customFieldsObject : null,
        };
        await contactMutation.mutateAsync({ id: conversation.contact.id, data: contactPayload });
      }

      if (conversation.deal) {
        const customFieldsObject = toCustomFieldsObject(dealCustomFields);
        const tags = normalizeTags(dealDraft.tagsText);
        const dealPayload: UpdateDealDTO = {
          title: dealDraft.title.trim() || conversation.deal.title,
          value: dealDraft.value.trim() ? dealDraft.value.trim() : null,
          probability: Number.isFinite(dealDraft.probability) ? dealDraft.probability : 0,
          expectedCloseDate: dealDraft.expectedCloseDate ? new Date(dealDraft.expectedCloseDate) : null,
          source: dealDraft.source.trim() || null,
          notes: dealDraft.notes.trim() || null,
          tags: tags.length > 0 ? tags : null,
          customFields: Object.keys(customFieldsObject).length > 0 ? customFieldsObject : null,
        };
        await dealMutation.mutateAsync({ id: conversation.deal.id, data: dealPayload });
      }

      toast({ title: "Atualizado com sucesso" });
      setIsEditing(false);
    } catch (error) {
      toast({
        title: t("toast.error"),
        description: "Falha ao salvar alterações.",
        variant: "destructive",
      });
    }
  }, [
    contactCustomFields,
    contactDraft,
    dealCustomFields,
    dealDraft,
    conversation,
    contactMutation,
    dealMutation,
    toast,
    t,
  ]);

  const addContactField = () =>
    setContactCustomFields((prev) => [...prev, { key: "", value: "" }]);
  const addDealField = () =>
    setDealCustomFields((prev) => [...prev, { key: "", value: "" }]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h4 className="text-sm font-medium text-foreground">{t("inbox.contextPanel.title")}</h4>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button size="sm" onClick={handleSave} disabled={contactMutation.isPending || dealMutation.isPending}>
                Salvar
              </Button>
              <Button size="sm" variant="outline" onClick={cancelEdit}>
                Cancelar
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={startEdit}>
              Editar
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {conversation.contact && (
          <div className="mb-4 rounded-lg bg-muted p-3">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <User className="h-4 w-4" />
              {t("inbox.contextPanel.contact")}
            </div>
            {isEditing ? (
              <div className="space-y-3 text-sm">
                <div className="grid gap-2">
                  <Label className="text-xs">Nome</Label>
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input
                      value={contactDraft.firstName}
                      onChange={(e) => setContactDraft((prev) => ({ ...prev, firstName: e.target.value }))}
                      placeholder="Nome"
                    />
                    <Input
                      value={contactDraft.lastName}
                      onChange={(e) => setContactDraft((prev) => ({ ...prev, lastName: e.target.value }))}
                      placeholder="Sobrenome"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Email</Label>
                  <Input
                    value={contactDraft.email}
                    onChange={(e) => setContactDraft((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Telefone</Label>
                  <Input
                    value={contactDraft.phone}
                    onChange={(e) => setContactDraft((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Cargo</Label>
                  <Input
                    value={contactDraft.jobTitle}
                    onChange={(e) => setContactDraft((prev) => ({ ...prev, jobTitle: e.target.value }))}
                    placeholder="Cargo"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Labels (separe por vírgula)</Label>
                  <Input
                    value={contactDraft.tagsText}
                    onChange={(e) => setContactDraft((prev) => ({ ...prev, tagsText: e.target.value }))}
                    placeholder="cliente, vip, onboarding"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Campos personalizados</Label>
                  <div className="space-y-2">
                    {contactCustomFields.map((row, idx) => (
                      <div key={`contact-field-${idx}`} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                        <Input
                          value={row.key}
                          onChange={(e) =>
                            setContactCustomFields((prev) =>
                              prev.map((item, index) => (index === idx ? { ...item, key: e.target.value } : item)),
                            )
                          }
                          placeholder="Campo"
                        />
                        <Input
                          value={row.value}
                          onChange={(e) =>
                            setContactCustomFields((prev) =>
                              prev.map((item, index) => (index === idx ? { ...item, value: e.target.value } : item)),
                            )
                          }
                          placeholder="Valor"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            setContactCustomFields((prev) => prev.filter((_, index) => index !== idx))
                          }
                        >
                          Remover
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addContactField}>
                      Adicionar campo
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">
                  {conversation.contact.firstName} {conversation.contact.lastName}
                </p>
                {conversation.contact.email && (
                  <p className="text-xs text-muted-foreground">{conversation.contact.email}</p>
                )}
                {conversation.contact.phone && (
                  <p className="text-xs text-muted-foreground">{conversation.contact.phone}</p>
                )}
                {contactTags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {contactTags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                {conversation.contact.customFields &&
                  typeof conversation.contact.customFields === "object" &&
                  Object.keys(conversation.contact.customFields).length > 0 && (
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {Object.entries(conversation.contact.customFields as Record<string, unknown>).map(
                        ([key, value]) => (
                          <p key={key}>
                            {key}: <span className="text-foreground">{String(value)}</span>
                          </p>
                        ),
                      )}
                    </div>
                  )}
              </>
            )}
          </div>
        )}

        {conversation.deal && (
          <div className="mb-4 rounded-lg bg-muted p-3">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Building2 className="h-4 w-4" />
              {t("inbox.contextPanel.relatedDeal")}
            </div>
            {isEditing ? (
              <div className="space-y-3 text-sm">
                <div className="grid gap-2">
                  <Label className="text-xs">Título</Label>
                  <Input
                    value={dealDraft.title}
                    onChange={(e) => setDealDraft((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Título do deal"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Valor</Label>
                  <Input
                    value={dealDraft.value}
                    onChange={(e) => setDealDraft((prev) => ({ ...prev, value: e.target.value }))}
                    placeholder="0,00"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Probabilidade (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={dealDraft.probability}
                    onChange={(e) => setDealDraft((prev) => ({ ...prev, probability: Number(e.target.value) }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Data prevista</Label>
                  <Input
                    type="date"
                    value={dealDraft.expectedCloseDate}
                    onChange={(e) => setDealDraft((prev) => ({ ...prev, expectedCloseDate: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Fonte</Label>
                  <Input
                    value={dealDraft.source}
                    onChange={(e) => setDealDraft((prev) => ({ ...prev, source: e.target.value }))}
                    placeholder="Origem"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Notas</Label>
                  <Textarea
                    value={dealDraft.notes}
                    onChange={(e) => setDealDraft((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Notas do deal"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Labels (separe por vírgula)</Label>
                  <Input
                    value={dealDraft.tagsText}
                    onChange={(e) => setDealDraft((prev) => ({ ...prev, tagsText: e.target.value }))}
                    placeholder="pipeline, urgente"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">Campos personalizados</Label>
                  <div className="space-y-2">
                    {dealCustomFields.map((row, idx) => (
                      <div key={`deal-field-${idx}`} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                        <Input
                          value={row.key}
                          onChange={(e) =>
                            setDealCustomFields((prev) =>
                              prev.map((item, index) => (index === idx ? { ...item, key: e.target.value } : item)),
                            )
                          }
                          placeholder="Campo"
                        />
                        <Input
                          value={row.value}
                          onChange={(e) =>
                            setDealCustomFields((prev) =>
                              prev.map((item, index) => (index === idx ? { ...item, value: e.target.value } : item)),
                            )
                          }
                          placeholder="Valor"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setDealCustomFields((prev) => prev.filter((_, index) => index !== idx))}
                        >
                          Remover
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addDealField}>
                      Adicionar campo
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">{conversation.deal.title}</p>
                {conversation.deal.value && (
                  <p className="text-xs text-primary">
                    {formatCurrency(Number(conversation.deal.value))}
                  </p>
                )}
                {dealTags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {dealTags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                {conversation.deal.customFields &&
                  typeof conversation.deal.customFields === "object" &&
                  Object.keys(conversation.deal.customFields).length > 0 && (
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {Object.entries(conversation.deal.customFields as Record<string, unknown>).map(
                        ([key, value]) => (
                          <p key={key}>
                            {key}: <span className="text-foreground">{String(value)}</span>
                          </p>
                        ),
                      )}
                    </div>
                  )}
              </>
            )}
          </div>
        )}

        <div className="rounded-lg bg-muted p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <MessageSquare className="h-4 w-4" />
            {t("inbox.contextPanel.conversationInfo")}
          </div>
          <div className="space-y-1 text-xs">
            <p className="text-muted-foreground">
              {t("inbox.contextPanel.channel")}: <span className="text-foreground">{getChannelLabel(conversation.channel)}</span>
            </p>
            <p className="text-muted-foreground">
              {t("inbox.contextPanel.status")}:{" "}
              <span className="inline-flex items-center rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
                {getStatusLabel(conversation.status || "open")}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

