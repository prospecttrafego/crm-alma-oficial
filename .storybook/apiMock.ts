type MockJson = Record<string, unknown> | unknown[] | string | number | boolean | null;

function jsonResponse(body: MockJson, init?: { status?: number; headers?: Record<string, string> }): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

function noContent(): Response {
  return new Response(null, { status: 204 });
}

function parseUrl(input: RequestInfo | URL): URL {
  const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return new URL(rawUrl, window.location.origin);
}

function getMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input !== "string" && !(input instanceof URL)) return input.method.toUpperCase();
  return "GET";
}

type SafeUserMock = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: "admin" | "sales" | "cs" | "support" | null;
  organizationId: number | null;
  preferences: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

type NotificationMock = {
  id: number;
  userId: string;
  type:
    | "new_message"
    | "deal_moved"
    | "deal_won"
    | "deal_lost"
    | "task_due"
    | "mention"
    | "activity_assigned"
    | "conversation_assigned";
  title: string;
  message: string | null;
  entityType: string | null;
  entityId: number | null;
  isRead: boolean | null;
  createdAt: string;
};

type SavedViewMock = {
  id: number;
  name: string;
  type: "pipeline" | "inbox" | "contacts" | "companies" | "deals" | "activities" | "auditLog";
  userId: string;
  organizationId: number;
  filters: Record<string, unknown>;
  isDefault: boolean | null;
  createdAt: string;
  updatedAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

const mockUsers: SafeUserMock[] = [
  {
    id: "user_demo",
    email: "demo@alma.com",
    firstName: "Demo",
    lastName: "User",
    profileImageUrl: null,
    role: "admin",
    organizationId: 1,
    preferences: { language: "pt-BR" },
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: "user_sales",
    email: "sales@alma.com",
    firstName: "Sales",
    lastName: "Rep",
    profileImageUrl: null,
    role: "sales",
    organizationId: 1,
    preferences: { language: "pt-BR" },
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

let mockNotifications: NotificationMock[] = [
  {
    id: 101,
    userId: "user_demo",
    type: "mention",
    title: "Você foi mencionado",
    message: "Demo, pode ver essa conversa?",
    entityType: "conversation",
    entityId: 12,
    isRead: false,
    createdAt: nowIso(),
  },
  {
    id: 102,
    userId: "user_demo",
    type: "deal_won",
    title: "Deal ganho",
    message: "Parabéns! Deal #42 foi marcado como ganho.",
    entityType: "deal",
    entityId: 42,
    isRead: true,
    createdAt: nowIso(),
  },
];

let mockSavedViews: SavedViewMock[] = [
  {
    id: 201,
    name: "Meus deals abertos",
    type: "pipeline",
    userId: "user_demo",
    organizationId: 1,
    filters: { status: "open" },
    isDefault: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: 202,
    name: "Inbox WhatsApp",
    type: "inbox",
    userId: "user_demo",
    organizationId: 1,
    filters: { channel: "whatsapp", status: "open" },
    isDefault: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

async function readJsonBody(init?: RequestInit): Promise<unknown> {
  if (!init?.body) return null;
  if (typeof init.body === "string") {
    try {
      return JSON.parse(init.body) as unknown;
    } catch {
      return null;
    }
  }
  return null;
}

export function installStorybookApiMock() {
  if (typeof window === "undefined") return;
  const key = "__ALMA_STORYBOOK_API_MOCK_INSTALLED__";
  if ((window as any)[key]) return;
  (window as any)[key] = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = parseUrl(input);
    const method = getMethod(input, init);

    if (!url.pathname.startsWith("/api/")) {
      return originalFetch(input as any, init);
    }

    // ---------------------------------------------------------------------
    // Users
    // ---------------------------------------------------------------------
    if (method === "GET" && url.pathname === "/api/users") {
      return jsonResponse({ success: true, data: mockUsers });
    }

    if (method === "GET" && url.pathname === "/api/auth/me") {
      return jsonResponse({ success: true, data: mockUsers[0] });
    }

    if (method === "PATCH" && url.pathname === "/api/users/me") {
      const body = (await readJsonBody(init)) as Partial<SafeUserMock> | null;
      mockUsers[0] = {
        ...mockUsers[0],
        preferences: (body?.preferences as SafeUserMock["preferences"]) ?? mockUsers[0].preferences,
        updatedAt: nowIso(),
      };
      return jsonResponse({ success: true, data: mockUsers[0] });
    }

    // ---------------------------------------------------------------------
    // Notifications
    // ---------------------------------------------------------------------
    if (method === "GET" && url.pathname === "/api/notifications") {
      return jsonResponse({ success: true, data: mockNotifications });
    }

    if (method === "GET" && url.pathname === "/api/notifications/unread-count") {
      const count = mockNotifications.filter((n) => !n.isRead).length;
      return jsonResponse({ success: true, data: { count } });
    }

    const notificationReadMatch = url.pathname.match(/^\/api\/notifications\/(\d+)\/read$/);
    if (notificationReadMatch && method === "PATCH") {
      const id = Number(notificationReadMatch[1]);
      mockNotifications = mockNotifications.map((n) => (n.id === id ? { ...n, isRead: true } : n));
      const updated = mockNotifications.find((n) => n.id === id) ?? null;
      return jsonResponse({ success: true, data: updated });
    }

    if (method === "POST" && url.pathname === "/api/notifications/mark-all-read") {
      mockNotifications = mockNotifications.map((n) => ({ ...n, isRead: true }));
      return jsonResponse({ success: true });
    }

    // ---------------------------------------------------------------------
    // Saved Views
    // ---------------------------------------------------------------------
    if (method === "GET" && url.pathname === "/api/saved-views") {
      const type = url.searchParams.get("type");
      const filtered = type ? mockSavedViews.filter((v) => v.type === type) : mockSavedViews;
      return jsonResponse({ success: true, data: filtered });
    }

    if (method === "POST" && url.pathname === "/api/saved-views") {
      const body = (await readJsonBody(init)) as Partial<SavedViewMock> | null;
      const nextId = Math.max(0, ...mockSavedViews.map((v) => v.id)) + 1;
      const created: SavedViewMock = {
        id: nextId,
        name: body?.name ?? "Nova view",
        type: (body?.type as SavedViewMock["type"]) ?? "pipeline",
        userId: mockUsers[0].id,
        organizationId: 1,
        filters: (body?.filters as SavedViewMock["filters"]) ?? {},
        isDefault: Boolean(body?.isDefault ?? false),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      mockSavedViews = [created, ...mockSavedViews];
      return jsonResponse({ success: true, data: created });
    }

    const savedViewDeleteMatch = url.pathname.match(/^\/api\/saved-views\/(\d+)$/);
    if (savedViewDeleteMatch && method === "DELETE") {
      const id = Number(savedViewDeleteMatch[1]);
      mockSavedViews = mockSavedViews.filter((v) => v.id !== id);
      return noContent();
    }

    // ---------------------------------------------------------------------
    // Global Search
    // ---------------------------------------------------------------------
    if (method === "GET" && url.pathname === "/api/search") {
      const q = url.searchParams.get("q") ?? "";
      const query = q.trim();
      return jsonResponse({
        success: true,
        data: {
          query,
          contacts: query
            ? [{ type: "contact", id: 1, title: `Contato: ${query}`, subtitle: "demo@alma.com", href: "/contacts/1" }]
            : [],
          deals: query
            ? [{ type: "deal", id: 42, title: `Deal: ${query}`, subtitle: "R$ 10.000", href: "/pipeline/1" }]
            : [],
          conversations: query
            ? [{ type: "conversation", id: 12, title: `Conversa: ${query}`, subtitle: "WhatsApp", href: "/inbox" }]
            : [],
        },
      });
    }

    console.warn("[StorybookApiMock] Unhandled request", { method, url: url.pathname + url.search });
    return jsonResponse(
      {
        success: false,
        error: { code: "NOT_IMPLEMENTED", message: "Mock endpoint not implemented in Storybook" },
      },
      { status: 501 }
    );
  };
}
