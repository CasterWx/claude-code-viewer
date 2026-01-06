import { useState, useMemo } from 'react';
import { User, Sparkles, ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { formatMessageContent } from '../utils/formatMessage';
import type { Message } from '../types';

interface MessageItemProps {
    msg: Message;
}

// Image component with consistent styling and size tag
const ImagePreview: React.FC<{ src: string; alt: string; index: number }> = ({ src, alt, index }) => {
    const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
    
    return (
        <div className="my-4 flex flex-col relative max-w-sm w-full">
            <img
                src={src}
                alt={alt || `Image ${index + 1}`}
                className="w-full h-auto border-2 border-black shadow-hard-sm rounded-sm"
                style={{ 
                    maxWidth: '100%',
                    display: 'block',
                    objectFit: 'contain'
                }}
                loading="lazy"
                onLoad={(e) => {
                    const target = e.target as HTMLImageElement;
                    setDimensions({
                        width: target.naturalWidth,
                        height: target.naturalHeight
                    });
                }}
                onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                }}
            />
            {dimensions && (
                <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-mono font-bold px-2 py-1 rounded-sm border border-white/30 shadow-hard-sm">
                    {dimensions.width} × {dimensions.height}px
                </div>
            )}
        </div>
    );
};

// Shared img component for ReactMarkdown with size tag
const MarkdownImage: React.FC<any> = (props) => {
    const { src, alt, ...rest } = props;
    const imageSrc = typeof src === 'string' ? src : '';
    const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
    
    if (!imageSrc) return null;
    
    return (
        <div className="my-4 flex flex-col relative max-w-sm w-full">
            <img 
                src={imageSrc}
                alt={alt || 'Image'}
                {...rest}
                className="w-full h-auto border-2 border-black shadow-hard-sm rounded-sm"
                style={{ 
                    maxWidth: '100%',
                    display: 'block',
                    objectFit: 'contain'
                }}
                onLoad={(e) => {
                    const target = e.target as HTMLImageElement;
                    setDimensions({
                        width: target.naturalWidth,
                        height: target.naturalHeight
                    });
                }}
                onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                }}
            />
            {dimensions && (
                <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-mono font-bold px-2 py-1 rounded-sm border border-white/30 shadow-hard-sm">
                    {dimensions.width} × {dimensions.height}px
                </div>
            )}
        </div>
    );
};

const markdownImgComponent = {
    img: MarkdownImage
};

export const MessageItem: React.FC<MessageItemProps> = ({ msg }) => {
    // Parse content and extract images
    const contentParts = useMemo(() => {
        const rawContent = formatMessageContent(msg.content);
        const parts: Array<string | { type: 'image'; src: string; index: number }> = [];
        // Match [IMAGE_START]...data...[IMAGE_END:index]
        const imageMarkerRegex = /\[IMAGE_START\](.*?)\[IMAGE_END:(\d+)\]/g;
        
        let lastIndex = 0;
        let match;
        
        while ((match = imageMarkerRegex.exec(rawContent)) !== null) {
            // Add text before image
            if (match.index > lastIndex) {
                parts.push(rawContent.substring(lastIndex, match.index));
            }
            
            // Add image data
            const imageSrc = match[1];
            const imageIndex = parseInt(match[2], 10);
            parts.push({ type: 'image', src: imageSrc, index: imageIndex });
            
            lastIndex = match.index + match[0].length;
        }
        
        // Add remaining text
        if (lastIndex < rawContent.length) {
            parts.push(rawContent.substring(lastIndex));
        }
        
        // If no images found, return original content as single part
        if (parts.length === 0) {
            parts.push(rawContent);
        }
        
        return parts;
    }, [msg.content]);
    
    const lineCount = contentParts.reduce((sum, part) => 
        sum + (typeof part === 'string' ? part.split('\n').length : 1), 0
    );
    const isLong = lineCount > 30;
    const [isExpanded, setIsExpanded] = useState(!isLong);

    return (
        <div className={`group flex gap-6 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <div className={`w-10 h-10 border-2 border-black flex items-center justify-center flex-shrink-0 shadow-hard-sm ${msg.role === 'user'
                ? 'bg-primary-yellow text-black'
                : msg.role === 'tool'
                    ? 'bg-gray-200 text-black'
                    : 'bg-primary-red text-white'
                }`}>
                {msg.role === 'user' ? <User size={20} strokeWidth={2.5} /> :
                    msg.role === 'tool' ? <Terminal size={20} strokeWidth={2.5} /> :
                        <Sparkles size={20} strokeWidth={2.5} />}
            </div>

            {/* Message Content */}
            <div className={`max-w-[85%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`font-bold font-mono text-xs text-gray-500 mb-2 px-1 flex items-center gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                    }`}>
                    <span className="uppercase tracking-wider">{
                        msg.role === 'user' ? 'YOU' :
                            msg.role === 'tool' ? 'TOOL OUTPUT' : 'CLAUDE'
                    }</span>
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

                <div className={`inline-block px-6 py-5 border-2 border-black text-[15px] leading-7 text-left w-full max-w-full overflow-hidden shadow-hard-sm ${msg.role === 'user'
                    ? 'bg-primary-yellow/20 hover:bg-primary-yellow/30'
                    : msg.role === 'tool'
                        ? 'bg-gray-50'
                        : 'bg-white'
                    }`}>
                    <div 
                        className={`prose prose-sm max-w-none 
                        prose-p:my-2 prose-headings:my-3 
                        prose-pre:bg-black prose-pre:text-white prose-pre:border-2 prose-pre:border-black prose-pre:rounded-none prose-pre:shadow-hard-sm
                        [&_pre_*]:!text-white [&_pre_*]:!bg-transparent
                        prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-sm prose-code:font-mono prose-code:text-xs prose-code:text-black
                        ${msg.role === 'user' ? 'prose-code:bg-black/10' : 'prose-code:bg-gray-100'}
                        prose-img:max-w-sm prose-img:h-auto prose-img:my-4 prose-img:mx-auto prose-img:block
                        break-words overflow-x-auto ${!isExpanded ? 'max-h-[800px] overflow-hidden relative' : ''}
                        `}>
                        {(() => {
                            // Handle expand/collapse for text parts
                            let textLineCount = 0;
                            const renderedParts: React.ReactNode[] = [];
                            let shouldStop = false;
                            
                            for (let idx = 0; idx < contentParts.length && !shouldStop; idx++) {
                                const part = contentParts[idx];
                                
                                if (typeof part === 'object' && part.type === 'image') {
                                    // Always show images
                                    renderedParts.push(
                                        <ImagePreview
                                            key={`image-${idx}`}
                                            src={part.src}
                                            alt={`Image ${part.index + 1}`}
                                            index={part.index}
                                        />
                                    );
                                } else {
                                    // Handle text content with expand/collapse
                                    const textContent = typeof part === 'string' ? part : '';
                                    const lines = textContent.split('\n');
                                    const currentLineCount = lines.length;
                                    
                                    if (!isExpanded && textLineCount + currentLineCount > 30) {
                                        // Show first 30 lines total across all text parts
                                        const linesToShow = 30 - textLineCount;
                                        if (linesToShow > 0) {
                                            const contentToRender = lines.slice(0, linesToShow).join('\n') + '\n...';
                                            renderedParts.push(
                                                <ReactMarkdown
                                                    key={`content-${idx}`}
                                                    rehypePlugins={[rehypeRaw]}
                                                    components={markdownImgComponent}
                                                >
                                                    {contentToRender}
                                                </ReactMarkdown>
                                            );
                                        }
                                        shouldStop = true;
                                    } else {
                                        // Show full content
                                        if (textContent.trim()) {
                                            renderedParts.push(
                                                <ReactMarkdown
                                                    key={`content-${idx}`}
                                                    rehypePlugins={[rehypeRaw]}
                                                    components={markdownImgComponent}
                                                >
                                                    {textContent}
                                                </ReactMarkdown>
                                            );
                                        }
                                        textLineCount += currentLineCount;
                                    }
                                }
                            }
                            
                            return renderedParts;
                        })()}

                        {!isExpanded && (
                            <div className={`absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t ${msg.role === 'user' ? 'from-primary-yellow/20' : 'from-white'} to-transparent`} />
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
