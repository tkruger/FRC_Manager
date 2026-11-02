// Types shared by the change log (server) and its display (server and client)

export type EntityType = "order" | "task" | "meeting" | "member" | "expense" | "broadcast";
export interface FieldChange { field: string; from: string; to: string }
