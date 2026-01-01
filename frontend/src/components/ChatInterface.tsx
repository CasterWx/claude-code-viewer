import { useRef, useEffect } from 'react';
import type { Message, Tag } from '../types';
import { Sparkles } from 'lucide-react';
import { MessageItem } from './MessageItem';
import { TagManager } from './TagManager';
import { ProjectDetails } from './ProjectDetails';

interface ChatInterfaceProps {
    sessionId?: string;
    initialTags?: Tag[];
    messages: Message[];
    loading: boolean;
    onTagsChange?: () => void;
    model?: string;
    totalTokens?: number;
    selectedProject?: string | null;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
    sessionId,
    initialTags = [],
    messages,
    loading,
    onTagsChange,
    model,
    totalTokens,
    selectedProject
}) => {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-white">
                <div className="animate-spin h-12 w-12 border-4 border-black border-t-primary-blue rounded-full mb-6"></div>
                <span className="text-lg font-bold font-mono uppercase tracking-widest">Loading...</span>
            </div>
        );
    }

    if (messages.length === 0) {
        if (selectedProject) {
            return <ProjectDetails projectName={selectedProject} />;
        }
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-dots">
                <div className="p-12 border-4 border-black bg-white shadow-hard-lg text-center transform -rotate-2">
                    <Sparkles size={64} className="mb-6 text-primary-yellow mx-auto" strokeWidth={2} />
                    <p className="text-2xl font-black uppercase tracking-tight mb-2">Ready to View</p>
                    <p className="text-gray-500 font-medium">请选择一个会话开始浏览</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
            {sessionId && (
                <div className="border-b-4 border-black p-4 flex items-center justify-between bg-gray-50 flex-shrink-0 z-10 shadow-sm">
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex flex-col gap-1">
                            <div className="font-mono text-sm font-bold bg-black text-white px-3 py-1 inline-block shadow-hard-sm transform -rotate-1">
                                {sessionId}
                            </div>
                            {(model || totalTokens) && (
                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mt-1 ml-1">
                                    {model && <span className="text-primary-blue">{model}</span>}
                                    {totalTokens && <span className="text-gray-500">• {totalTokens.toLocaleString()} TOKENS</span>}
                                </div>
                            )}
                        </div>
                        {onTagsChange && (
                            <div className="ml-4 pl-4 border-l-2 border-black/10">
                                <TagManager
                                    sessionId={sessionId}
                                    initialTags={initialTags}
                                    onTagsChange={onTagsChange}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
            <div className="flex-1 overflow-y-auto bg-white">
                <div className="max-w-4xl mx-auto py-8 px-6 space-y-8">
                    {messages.map((msg, idx) => (
                        <MessageItem key={idx} msg={msg} />
                    ))}
                    <div ref={bottomRef} className="h-4" />
                </div>
            </div>
        </div>
    );
};
