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
    formatted = formatted.replace(
        /<tool-result(?:\s+[^>]*)?>\s*([\s\S]*?)\s*<\/tool-result>/g,
        '\n**📤 Output**\n```\n$1\n```\n'
    );

    // System Reminder: Quote
    formatted = formatted.replace(
        /<system-reminder>(.*?)<\/system-reminder>/gs,
        '> ⚠️ *$1*\n'
    );

    return formatted;
};
