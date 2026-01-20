import { InboxProvider } from "@/contexts/InboxContext";
import { InboxContent } from "@/pages/inbox/InboxContent";

export default function InboxPage() {
  return (
    <InboxProvider>
      <InboxContent />
    </InboxProvider>
  );
}
