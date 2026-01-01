export interface Project {
    name: string;
    last_updated: string | null;
    session_count: number;
    total_tokens?: number;
    total_turns?: number;
    total_files?: number;
}

export interface Tag {
    id: number;
    name: string;
    color: string;
}

export interface Session {
    id: string;
    project_name: string;
    file_path: string;
    start_time: string | null;
    tags?: Tag[];
    model?: string;
    total_tokens?: number;
    file_change_count?: number;
    input_tokens?: number;
    output_tokens?: number;
    turns?: number;
    branch?: string;
    token_usage_history?: string; // JSON string
}

export interface Message {
    id: number;
    session_id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: string;
}

export interface SearchResult extends Message {
    project_name: string;
}

export interface AnalyticsData {
    total_projects: number;
    total_sessions: number;
    total_messages: number;
    total_tokens: number;
    most_used_model: string;
    daily_activity: { date: string; count: number; sessions: number; projects: number }[];
    tag_stats: { name: string; color: string; sessions: number; messages: number }[];
    model_stats: { model: string; count: number }[];
    hourly_activity: { hour: number; count: number }[];
}

export interface ProjectDetails {
    name: string;
    path: string | null;
    last_updated: string | null;
    stats: {
        sessions: number;
        messages: number;
        tokens: number;
        last_active: string | null;
    };
    git: {
        is_repo: boolean;
        branch: string | null;
    };
    configs: {
        name: string;
        path: string;
    }[];
}
