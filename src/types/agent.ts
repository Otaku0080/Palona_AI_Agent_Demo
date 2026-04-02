export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" };

export interface AgentMessage {
  role: "user" | "assistant";
  content: string | ContentPart[];
}

export interface AgentRequest {
  messages: AgentMessage[];
  sessionId: string;
}

// Cart update annotation sent inside the AI stream
export interface CartUpdateAnnotation {
  type: "cart_update";
  action: "add";
  itemId: string;
  quantity: number;
  size?: string;
}
