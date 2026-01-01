import { useState } from 'react';
import { User, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { formatMessageContent } from '../utils/formatMessage';
import type { Message } from '../types';

interface MessageItemProps {
    msg: Message;
}

export const MessageItem: React.FC<MessageItemProps> = ({ msg }) => {
    const formattedContent = formatMessageContent(msg.content);
    const lineCount = formattedContent.split('\n').length;
    const isLong = lineCount > 30;
    const [isExpanded, setIsExpanded] = useState(!isLong);

    return (
        <div className={`group flex gap-6 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <div className={`w-10 h-10 border-2 border-black flex items-center justify-center flex-shrink-0 shadow-hard-sm ${msg.role === 'user'
                ? 'bg-primary-yellow text-black'
                : 'bg-primary-red text-white'
                }`}>
                {msg.role === 'user' ? <User size={20} strokeWidth={2.5} /> : <Sparkles size={20} strokeWidth={2.5} />}
            </div>

            {/* Message Content */}
            <div className={`max-w-[85%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`font-bold font-mono text-xs text-gray-500 mb-2 px-1 flex items-center gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                    }`}>
                    <span className="uppercase tracking-wider">{msg.role === 'user' ? 'YOU' : 'CLAUDE'}</span>
                    <span className="w-1.5 h-1.5 bg-black"></span>
                    <span>{new Date(msg.timestamp).toLocaleString(undefined, {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    })}</span>
                </div>

                <div className={`inline-block px-6 py-5 border-2 border-black text-[15px] leading-7 text-left max-w-full overflow-hidden shadow-hard-sm ${msg.role === 'user'
                    ? 'bg-primary-yellow/20 hover:bg-primary-yellow/30'
                    : 'bg-white'
                    }`}>
                    <div className={`prose prose-sm max-w-none 
                        prose-p:my-2 prose-headings:my-3 
                        prose-pre:bg-black prose-pre:text-white prose-pre:border-2 prose-pre:border-black prose-pre:rounded-none prose-pre:shadow-hard-sm
                        prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:border prose-code:border-black prose-code:text-black prose-code:font-mono prose-code:text-xs
                        break-words overflow-x-auto ${!isExpanded ? 'max-h-[800px] overflow-hidden relative' : ''
                        }`}>
                        <ReactMarkdown>
                            {isExpanded
                                ? formattedContent
                                : formattedContent.split('\n').slice(0, 30).join('\n') + '\n...'}
                        </ReactMarkdown>

                        {!isExpanded && (
                            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
                        )}
                    </div>

                    {isLong && (
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="mt-4 text-xs font-black uppercase tracking-widest text-primary-blue hover:text-black hover:underline flex items-center gap-1 transition-colors"
                        >
                            {isExpanded ? (
                                <>
                                    <ChevronUp size={14} strokeWidth={3} /> 收起 (Show less)
                                </>
                            ) : (
                                <>
                                    <ChevronDown size={14} strokeWidth={3} /> 展开剩余 {lineCount - 30} 行 (Show more)
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
