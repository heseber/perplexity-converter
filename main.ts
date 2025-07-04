import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Interface for storing URL mappings
interface UrlMap {
	[key: string]: string;
}

// Interface for storing plugin settings
interface PerplexityConverterSettings {
	sourceHeaders: string[];
	autoSelectOnMobile: boolean;
}

// Default plugin settings
const DEFAULT_SETTINGS: PerplexityConverterSettings = {
	sourceHeaders: ['Quellen', 'Sources', 'Citations:'],
	autoSelectOnMobile: true
}

// Platform detection function
function isIOSOrIPadOS(): boolean {
	if (typeof navigator === 'undefined') return false;
	
	const userAgent = navigator.userAgent.toLowerCase();
	return userAgent.includes('iphone') || userAgent.includes('ipad') || userAgent.includes('ipod');
}

// The plugin class
export default class PerplexityConverter extends Plugin {
	settings: PerplexityConverterSettings;

	async onload() {
		await this.loadSettings();

		// Register the command
		this.addCommand({
			id: 'process-selected-text',
			name: 'Process selected text',
			editorCallback: (editor: Editor) => {
				// Get the selected text
				let selectedText = editor.getSelection();
				
				// If no text is selected and we're on iOS/iPadOS with auto-select enabled
				if (!selectedText && isIOSOrIPadOS() && this.settings.autoSelectOnMobile) {
					// Select all text in the editor
					const fullText = editor.getValue();
					if (fullText) {
						editor.setSelection({ line: 0, ch: 0 }, { line: editor.lineCount() - 1, ch: editor.getLine(editor.lineCount() - 1).length });
						selectedText = fullText;
					}
				}
				
				// Process the text
				const processedText = this.process_text(selectedText);
				
				// Replace the selection with processed text
				editor.replaceSelection(processedText);
			}
		});

		// This adds a settings tab so the user can configure the plugin settings
		this.addSettingTab(new PerplexityConverterSettingTab(this.app, this));
	}

	onunload() {

	}


    // Text processing function
    private process_text(text: string): string {

		// If no text was selected, return empty string
		if (!text) {
			return "";
		}

		// Get the lines in the text
		const lines: string[] = text.split('\n');

		// Check for source section headers. If not found, return text unmodified.
		if (!lines.some(line => this.settings.sourceHeaders.includes(line.trim()))) {
			return text;
		}

		// First pass: collect URLs from sources section
		const urls: UrlMap = {};
		let inSourcesSection: boolean = false;

		for (const line of lines) {
			
			if (this.settings.sourceHeaders.includes(line)) {
				inSourcesSection = true;
				continue;
			}
			
			if (inSourcesSection && line) {
				// Find the number in brackets
				const numberMatch: RegExpMatchArray | null = line.match(/\[(\d+)\]/);
				if (numberMatch) {
					const number: string = numberMatch[1];
					// Find the URL
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
			
			if (this.settings.sourceHeaders.includes(line)) {
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
							
							// If there was text preceding the URL, make the text a hyperlink with
							// the URL as the target. Otherwise, just leave the plain URL unmodified,
							// the URL will then be displayed as a clickable link by Obsidian.
							if (text) {
								modifiedLines.push(`\\[${number}\\] [${text}](${url})`);
							} else {
								modifiedLines.push(`\\[${number}\\] ${url}`);
							}
							continue;
						}
					}
				}
				// Keep line unchanged if no reference line was found
				modifiedLines.push(line);
			} else {
				// Process lines before sources section
				let currentLine: string = line;
				
				// Make the reference number a clickable link with the corresponding URL as target.
				for (const [number, url] of Object.entries(urls)) {
					currentLine = currentLine.replaceAll(
						`[${number}]`,
						`[\`[${number}]\`](${url})`
					);
				}
				
				modifiedLines.push(currentLine);
			}
		}

        return modifiedLines.join('\n');
    }
		
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
	
	async saveSettings() {
		await this.saveData(this.settings);
	}
}


// The plugin settings tab class
class PerplexityConverterSettingTab extends PluginSettingTab {
	plugin: PerplexityConverter;

	constructor(app: App, plugin: PerplexityConverter) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('References start line tags')
			.setDesc('Strings (complete lines) that indicate the start of the references section')
			.addTextArea(text => text
				.setPlaceholder('Enter your start line tags')
				.setValue(this.plugin.settings.sourceHeaders.join("\n"))
                .then(textArea => {
                    textArea.inputEl.addClass('reference-start-line-tags-textarea');
                })
				.onChange(async (value) => {
					this.plugin.settings.sourceHeaders = value.trimEnd().split('\n').filter(item => item.trim());
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto-select all text on mobile')
			.setDesc('When enabled, automatically selects all text in the note on iOS/iPadOS if no text is currently selected')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSelectOnMobile)
				.onChange(async (value) => {
					this.plugin.settings.autoSelectOnMobile = value;
					await this.plugin.saveSettings();
				}));
	}
}