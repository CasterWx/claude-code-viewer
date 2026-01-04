export const formatMessageContent = (content: string): string => {
    if (!content) return "";

    let formatted = content;

    // Command Name: Render as inline code
    formatted = formatted.replace(
        /<command-name>(.*?)<\/command-name>/g,
        '`$1`'
    );

    // Command Message: Render as blockquote with italic
    formatted = formatted.replace(
        /<command-message>(.*?)<\/command-message>/g,
        '> 🤖 *$1*\n'
    );

    // Stdout: Render as code block
    formatted = formatted.replace(
        /<local-command-stdout>(.*?)<\/local-command-stdout>/gs,
        '\n```\n$1\n```\n'
    );
    formatted = formatted.replace(
        /<stdout>(.*?)<\/stdout>/gs,
        '\n```\n$1\n```\n'
    );

    // Command Args: Render as code block, maybe?
    formatted = formatted.replace(
        /<command-args>(.*?)<\/command-args>/gs,
        '\n**Args**:\n```json\n$1\n```\n'
    );

    // Reasoning: Maybe collapsible? For now just quote.
    formatted = formatted.replace(
        /<reasoning>(.*?)<\/reasoning>/gs,
        '> **Reasoning**:\n> $1\n'
    );

    // Tool Use: Render as code block with header
    // Use non-greedy match for content
    formatted = formatted.replace(
        /<tool-use(?:\s+name="([^"]*)")?[^>]*>\s*([\s\S]*?)\s*<\/tool-use>/g,
        (_match, name, content) => {
            const toolName = name || 'Unknown Tool';

            try {
                const args = JSON.parse(content);

                // Custom formatting for known tools
                switch (toolName) {
                    case 'Bash':
                        if (args.command) {
                            // "Terminal-like" look: $ prompt
                            return `\n**🖥️ Terminal**\n\`\`\`bash\n$ ${args.command}\n\`\`\`\n`;
                        }
                        break;
                    case 'Write':
                        if (args.file_path) {
                            return `\n**Tool Use: ${toolName}**\n> Writing to \`${args.file_path}\`\n`;
                        }
                        break;
                    case 'TodoWrite':
                        if (args.todos) {
                            const todoList = args.todos.map((t: { status: string; content: string }) => {
                                const mark = t.status === 'completed' ? '✅' : t.status === 'in_progress' ? '🔄' : '⬜';
                                return `- ${mark} ${t.content}`;
                            }).join('\n');
                            return `\n**Tool Use: TodoWrite**\n${todoList}\n`;
                        }
                        if (args.file_path) {
                            return `\n**Tool Use: ${toolName}**\n> Writing to \`${args.file_path}\`\n`;
                        }
                        break;
                    case 'Read':
                        if (args.file_path) {
                            return `\n**Tool Use: Read**\n> Reading \`${args.file_path}\`\n`;
                        }
                        break;
                    case 'Edit':
                        if (args.file_path) {
                            return `\n**Tool Use: Edit**\n> Editing \`${args.file_path}\`\n`;
                        }
                        break;
                    case 'BashOutput':
                        return `\n**Tool Use: BashOutput**\n\`\`\`\n${args.output || ''}\n\`\`\`\n`;
                    case 'KillBash':
                        return `\n**Tool Use: KillBash**\n> Killing process\n`;
                    case 'Grep':
                        return `\n**Tool Use: Grep**\n> Searching for \`${args.pattern}\` in \`${args.path || '.'}\`\n`;
                    case 'Glob':
                        return `\n**Tool Use: Glob**\n> Finding files matching \`${args.pattern}\` in \`${args.path || '.'}\`\n`;
                }
            } catch {
                // Ignore parse errors, fall back to default
            }

            return `\n**Tool Use: \`${toolName}\`**\n\`\`\`json\n${content}\n\`\`\`\n`;
        }
    );

    // Tool Result: Render as blockquote or code block
    // Special handling for image data
    formatted = formatted.replace(
        /<tool-result(?:\s+[^>]*)?>\s*([\s\S]*?)\s*<\/tool-result>/g,
        (_match, content) => {
            // Try to parse as JSON to detect image data
            try {
                const parsed = JSON.parse(content.trim());
                const isArray = Array.isArray(parsed);
                const items = isArray ? parsed : [parsed];
                
                // Check if any item is an image
                const hasImage = items.some((item: any) => 
                    item && typeof item === 'object' && 
                    item.type === 'image' && 
                    item.source && 
                    item.source.type === 'base64' && 
                    item.source.data
                );
                
                if (hasImage) {
                    // Use special markers for images - will be rendered in React component
                    let result = '\n**📤 Output**\n\n';
                    
                    // Add image markers (will be replaced by React components)
                    items.forEach((item: any, index: number) => {
                        if (item && item.type === 'image' && item.source?.type === 'base64' && item.source?.data) {
                            let base64Data = String(item.source.data).trim();
                            
                            // Skip if data is empty or too short
                            if (!base64Data || base64Data.length < 10) {
                                return;
                            }
                            
                            // Prepare image data
                            let imageSrc: string;
                            if (base64Data.startsWith('data:')) {
                                imageSrc = base64Data;
                            } else {
                                // Use media_type from source if available, otherwise detect
                                let mimeType = item.source.media_type || 'image/png';
                                
                                // If no media_type, try to detect from base64 content
                                if (!item.source.media_type) {
                                    if (base64Data.startsWith('iVBORw0KGgo') || base64Data.startsWith('iVBORw0KG')) {
                                        mimeType = 'image/png';
                                    } else if (base64Data.startsWith('/9j/') || base64Data.startsWith('/9j')) {
                                        mimeType = 'image/jpeg';
                                    } else if (base64Data.startsWith('R0lGOD') || base64Data.startsWith('R0lGODlh')) {
                                        mimeType = 'image/gif';
                                    } else if (base64Data.startsWith('UklGR')) {
                                        mimeType = 'image/webp';
                                    }
                                }
                                
                                // Remove any existing data: prefix if present
                                base64Data = base64Data.replace(/^data:image\/[^;]+;base64,/, '');
                                
                                imageSrc = `data:${mimeType};base64,${base64Data}`;
                            }
                            
                            // Use special marker that React component will replace
                            // Format: [IMAGE_START]base64data[IMAGE_END:index]
                            // This avoids issues with colons in base64 data
                            result += `[IMAGE_START]${imageSrc}[IMAGE_END:${index}]\n\n`;
                        }
                    });
                    
                    // Add collapsible JSON code block
                    const jsonString = JSON.stringify(parsed, null, 2);
                    result += `<details class="json-code-details mt-2">
<summary class="cursor-pointer text-xs font-bold uppercase tracking-widest text-primary-blue hover:text-black hover:underline py-2 select-none">📄 查看 JSON 数据 (View JSON Data)</summary>
<div class="mt-2">

\`\`\`json
${jsonString}
\`\`\`

</div>
</details>`;
                    
                    return result;
                }
            } catch {
                // Not valid JSON or not image data, fall back to default
            }
            
            // Default: render as code block
            return '\n**📤 Output**\n```\n' + content + '\n```\n';
        }
    );

    // System Reminder: Quote
    formatted = formatted.replace(
        /<system-reminder>(.*?)<\/system-reminder>/gs,
        '> ⚠️ *$1*\n'
    );

    return formatted;
};
