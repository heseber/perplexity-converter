import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Interface for storing URL mappings
interface UrlMap {
	[key: string]: string;
}

export default class PerplexityConverter extends Plugin {

	async onload() {

		// Register the command
		this.addCommand({
			id: 'process-selected-text',
			name: 'Process Selected Text',
			editorCallback: (editor: Editor) => {
				// Get the selected text
				const selectedText = editor.getSelection();
				
				// Process the text
				const processedText = this.process_text(selectedText);
				
				// Replace the selection with processed text
				editor.replaceSelection(processedText);
			}
		});
	}

	onunload() {

	}

    // Dummy text processing function
    private process_text(text: string): string {

		// If no text was selected, return empty string
		if (!text) {
			return "";
		}

		// Get the lines in the text
		const lines: string[] = text.split('\n');

		// Define source section headers
		const sourceHeaders: string[] = ['Quellen', 'Sources', 'Citations:'];

		// Check for source section headers. If not found, return text unmodified.
		if (!lines.some(line => sourceHeaders.includes(line.trim()))) {
			return text;
		}

		// First pass: collect URLs from sources section
		const urls: UrlMap = {};
		let inSourcesSection: boolean = false;

		for (const line of lines) {
			
			if (sourceHeaders.includes(line)) {
				inSourcesSection = true;
				continue;
			}
			
			if (inSourcesSection && line) {
				// Find the number in brackets (part 1)
				const numberMatch: RegExpMatchArray | null = line.match(/\[(\d+)\]/);
				if (numberMatch) {
					const number: string = numberMatch[1];
					// Find the URL (part 3)
					const urlMatch: RegExpMatchArray | null = line.match(/(https?:\/\/\S+)/);
					if (urlMatch) {
						const url: string = urlMatch[1].trim();
						urls[number] = url;
					}
				}
			}
		}

		// Second pass: modify the lines
		const modifiedLines: string[] = [];
		inSourcesSection = false;

		for (const line of lines) {
			
			if (sourceHeaders.includes(line)) {
				inSourcesSection = true;
				modifiedLines.push(line);
				continue;
			}
			
			if (inSourcesSection && line) {
				// Process sources section
				const numberMatch: RegExpMatchArray | null = line.match(/\[(\d+)\]/);
				if (numberMatch) {
					const number: string = numberMatch[1];
					const urlMatch: RegExpMatchArray | null = line.match(/(https?:\/\/\S+)/);
					if (urlMatch) {
						const url: string = urlMatch[1].trim();
						const textStart: number = line.indexOf(']') + 1;
						const textEnd: number = line.indexOf('http');
						
						if (textStart > 0 && textEnd > 0) {
							const text: string = line.slice(textStart, textEnd).trim();
							
							// Only modify the line if there is text between number and URL
							if (text) {
								modifiedLines.push(`\\[${number}\\] [${text}](${url})`);
							} else {
								modifiedLines.push(`\\[${number}\\] ${url}`);
							}
							continue;
						}
					}
				}
				// Keep line unchanged if no text between number and URL or if parsing failed
				modifiedLines.push(line);
			} else {
				// Process lines before sources section
				let currentLine: string = line;
				
				for (const [number, url] of Object.entries(urls)) {
					currentLine = currentLine.replace(
						`[${number}]`,
						`[\`[${number}]\`](${url})`
					);
				}
				
				modifiedLines.push(currentLine);
			}
		}

        return modifiedLines.join('\n');
    }
	
}
