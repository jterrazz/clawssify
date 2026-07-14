export type ContentType = 'conversation' | 'note' | 'text' | 'tweet' | 'url';
export type Priority = 'normal' | 'urgent';
export type ImpactMode = 'auto' | 'bookmark' | 'deep' | 'standard';
export type ResolvedImpact = 'bookmark' | 'deep' | 'standard';

export interface IngestPayload {
    type: ContentType;
    content: string;
    tags?: string[];
    priority?: Priority;
    impact?: ImpactMode;
}

export interface IngestResponse {
    id: string;
    status: 'processing' | 'queued';
    message: string;
}
