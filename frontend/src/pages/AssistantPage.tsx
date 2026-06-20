import { Card, PageHeader } from "../components/ui";
import { ChatPanel } from "../components/ChatPanel";

export function AssistantPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="AI Assistant"
        subtitle="Ask questions or run inventory actions in natural language"
      />
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden" >
        <div className="h-[70vh]">
          <ChatPanel />
        </div>
      </Card>
    </div>
  );
}
