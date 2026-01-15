import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/contexts/LanguageContext";
import { contactsApi, type ContactWithStats } from "@/lib/api/contacts";
import { ContactsTable } from "./contacts-table";
import { ContactDetailsSheet } from "./contact-details-sheet";

export default function ContactsPage() {
  const { t } = useTranslation();
  const [selectedContact, setSelectedContact] = useState<ContactWithStats | null>(null);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["/api/contacts", "withStats"],
    queryFn: contactsApi.listWithStats,
  });

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col p-6">
      <div className="mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold" data-testid="text-contacts-title">
            {t("contacts.title")}
          </h1>
          <p className="text-muted-foreground">{t("contacts.subtitle")}</p>
        </div>
      </div>

      <ContactsTable
        contacts={contacts || []}
        isLoading={isLoading}
        onSelectContact={setSelectedContact}
      />

      <ContactDetailsSheet
        contact={selectedContact}
        open={!!selectedContact}
        onOpenChange={(open) => {
          if (!open) setSelectedContact(null);
        }}
      />
    </div>
  );
}
