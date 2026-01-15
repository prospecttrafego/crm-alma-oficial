import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useTranslation } from "@/contexts/LanguageContext";
import { contactsApi, type ContactWithStats, type ContactsPaginationParams } from "@/lib/api/contacts";
import { ContactsTable } from "./contacts-table";
import { ContactDetailsSheet } from "./contact-details-sheet";

const DEFAULT_PAGE_SIZE = 20;

export default function ContactsPage() {
  const { t } = useTranslation();
  const [selectedContact, setSelectedContact] = useState<ContactWithStats | null>(null);
  const [pagination, setPagination] = useState<ContactsPaginationParams>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    search: "",
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["/api/contacts", "paginatedWithStats", pagination],
    queryFn: () => contactsApi.listPaginatedWithStats(pagination),
    placeholderData: keepPreviousData,
  });

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handleSearchChange = (search: string) => {
    setPagination((prev) => ({ ...prev, search, page: 1 }));
  };

  const handlePageSizeChange = (limit: number) => {
    setPagination((prev) => ({ ...prev, limit, page: 1 }));
  };

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
        contacts={data?.data || []}
        isLoading={isLoading}
        isFetching={isFetching}
        pagination={data?.pagination}
        searchQuery={pagination.search || ""}
        onSelectContact={setSelectedContact}
        onPageChange={handlePageChange}
        onSearchChange={handleSearchChange}
        onPageSizeChange={handlePageSizeChange}
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
