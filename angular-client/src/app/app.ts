import { Component, OnInit, ChangeDetectorRef, NgZone, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NeutralinoService } from './services/neutralino.service';
import { RulesService, LanguageRules } from './services/rules.service';
import { SettingsService, Settings } from './services/settings.service';
import { FileService } from './services/file.service';
import { OllamaService, ReviewResult, ReviewIssue } from './services/ollama.service';
import { UpdateService } from './services/update.service';
import { LogService } from './services/log.service';
import { AddinService, Addin, AddinPayload, SetFileData, SetFilesData } from './services/addin.service';
// Components
import { MenuBarComponent } from './components/menu-bar/menu-bar.component';
import { CodeEditorComponent, CodeLine } from './components/code-editor/code-editor.component';
import { SettingsModalComponent } from './components/settings-modal/settings-modal.component';
import { PasteModalComponent } from './components/paste-modal/paste-modal.component';
import { ThinkingModalComponent } from './components/thinking-modal/thinking-modal.component';
import { IssueTooltipComponent } from './components/issue-tooltip/issue-tooltip.component';
import { AddinDialogComponent } from './components/addin-dialog/addin-dialog.component';
import { data } from './mock-data';

// Interface for opened files
export interface OpenedFile {
  filePath: string;
  fileName: string;
  content: string;
  language: string;
  codeLines: CodeLine[];
  reviewResult: ReviewResult | null;
  isReviewing: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MenuBarComponent,
    CodeEditorComponent,
    SettingsModalComponent,
    PasteModalComponent,
    ThinkingModalComponent,
    IssueTooltipComponent,
    AddinDialogComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  // State
  currentFilePath: string | null = null;
  currentCode = '';
  currentLanguage = 'detect';
  isReviewing = false;

  // Available languages for selection
  availableLanguages: { label: string, value: string }[] = [{ label: "Auto Detect", value: "detect" }];
  isLanguageLocked = false;
  hasRules = false;

  // Review result
  reviewResult: ReviewResult | null = null;
  codeLines: CodeLine[] = [];

  // Multiple files support
  openedFiles: OpenedFile[] = [];

  // Settings
  settings: Settings = {
    host: 'http://localhost:11434',
    apiKey: '',
    model: '',
    thinkLevel: 'medium'
  };
  models: string[] = [];
  isGptOssModel = false;

  // Modal states
  showSettingsModal = false;
  showPasteModal = false;
  showThinkingModal = false;
  showAddinDialog = false;

  // Addin state
  loadedAddins: Addin[] = [];
  addinDialogTitle = '';
  addinDialogContent: HTMLElement | null = null;

  // Computed: Can paste only when no modals are open and in NewEmpty state (no file opened, no folder)
  get canPaste(): boolean {
    return !this.showSettingsModal &&
      !this.showPasteModal &&
      !this.showThinkingModal &&
      !this.currentFilePath &&
      this.openedFiles.length === 0;
  }

  // Form values
  pasteInput = '';
  connectionStatus = '';
  connectionStatusType: 'loading' | 'success' | 'error' | '' = '';
  showModelSection = false;

  // Status message
  statusMessage = '';

  // Tooltip
  showTooltip = false;
  tooltipIssues: ReviewIssue[] = [];
  tooltipStyle = { top: '0px', left: '0px' };

  // Thinking modal
  thinkingContent = '';
  thinkingStatus = 'Analyzing code...';

  constructor(
    private neutralinoService: NeutralinoService,
    private rulesService: RulesService,
    private settingsService: SettingsService,
    private fileService: FileService,
    private ollamaService: OllamaService,
    private updateService: UpdateService,
    private logService: LogService,
    private addinService: AddinService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    // Subscribe to addin send events
    this.addinService.onSend.subscribe((payload: AddinPayload) => {
      this.handleAddinPayload(payload);
    });
  }

  async ngOnInit() {
    console.log('Initializing app...');

    // Initialize Neutralino
    await this.neutralinoService.init();

    // Load settings
    try {
      this.settings = await this.settingsService.getSettings();
      console.log('Settings loaded:', this.settings);

      // Auto-fetch models if host is set
      if (this.settings.host) {
        await this.handleFetchModels();
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }

    // Load rules
    try {
      const languages = await this.rulesService.loadAllRules();
      languages.forEach(x => {
        this.availableLanguages.push({ label: x, value: x })
      })
      this.hasRules = languages.length > 0;
    } catch (error) {
      console.error('Failed to load rules:', error);
    }

    // Load addins
    await this.handleLoadAddins();

    this.cdr.detectChanges();
    console.log('App initialized successfully');
  }

  @HostListener('window:keydown', ['$event'])
  async handleKeyboardEvent(event: KeyboardEvent) {
    if (event.ctrlKey && this.canPaste) {
      switch (event.key) {
        case 'n':
          this.handleNewEmpty();
          break;
        case 'o':
          this.handleOpenFile();
          break;
      }
    }
  }

  // ========================================
  // Menu Handlers
  // ========================================
  handleNewEmpty() {
    this.currentFilePath = null;
    this.currentCode = '';
    this.currentLanguage = 'detect';
    this.isLanguageLocked = false;
    this.reviewResult = null;
    this.codeLines = [];
    this.openedFiles = [];
    this.hideTooltip();
    this.setStatus('Reset to empty state');
    this.cdr.detectChanges();
  }

  async handleOpenFile() {
    try {
      const result = await this.fileService.openFile();
      if (result) {
        this.currentFilePath = result.filePath;
        this.currentCode = result.content;
        this.reviewResult = null;
        this.openedFiles = []; // Clear multi-file mode

        // Set language based on file extension and lock it
        const matchedLang = this.availableLanguages.find(lang => lang.value === result.extension);
        if (matchedLang) {
          this.currentLanguage = matchedLang.value;
          this.isLanguageLocked = true;
        } else {
          this.currentLanguage = 'detect';
          this.isLanguageLocked = false;
        }

        this.updateCodeLines();
        this.setStatus('File loaded');
      }
    } catch (error) {
      console.error('Failed to open file:', error);
      this.setStatus('Failed to open file');
    }
    this.cdr.detectChanges();
  }

  async handleOpenFolder() {
    try {
      const files = await this.fileService.openFolder();
      if (files.length > 0) {
        // Clear single-file mode
        this.currentFilePath = null;
        this.currentCode = '';
        this.reviewResult = null;
        this.codeLines = [];

        // Populate openedFiles
        this.openedFiles = files.map(file => {
          const fileName = file.filePath.split(/[/\\]/).pop() || file.filePath;
          const matchedLang = this.availableLanguages.find(lang => lang.value === file.extension);
          const language = matchedLang ? matchedLang.value : 'detect';

          const lines = file.content.split(/\r?\n/);
          const codeLines: CodeLine[] = lines.map((content, index) => ({
            num: index + 1,
            content,
            isError: false,
            issues: undefined
          }));

          return {
            filePath: file.filePath,
            fileName,
            content: file.content,
            language,
            codeLines,
            reviewResult: null,
            isReviewing: false
          };
        });

        this.setStatus(`Loaded ${files.length} files`);
      }
    } catch (error) {
      console.error('Failed to open folder:', error);
      this.setStatus('Failed to open folder');
    } finally {
      this.cdr.detectChanges();
    }
  }

  handleExit() {
    this.neutralinoService.exit();
  }

  async handleCheckForUpdates() {
    this.setStatus('Checking for updates...');

    try {
      const updateInfo = await this.updateService.checkForUpdates();

      if (updateInfo.updateAvailable) {
        const confirmUpdate = confirm(
          `New version ${updateInfo.latestVersion} is available!\n` +
          `Do you want to download and install the update?`
        );

        if (confirmUpdate) {
          this.setStatus('Downloading update...');

          await this.updateService.downloadAndApplyUpdate(updateInfo.downloadUrl);
          // App will restart after update
        } else {
          this.setStatus('Update skipped');
        }
      } else {
        this.setStatus(`You are using the latest version.`);
      }
    } catch (error) {
      console.error('Update check failed:', error);
      this.setStatus('Failed to check for updates');
    }
  }

  openSettings() {
    this.showSettingsModal = true;
  }

  async handleOpenLatestLog() {
    const success = await this.logService.openLatestLog();
    if (!success) {
      this.setStatus('No log files found');
    }
  }

  closeSettings() {
    this.showSettingsModal = false;
  }

  // ========================================
  // Paste Modal
  // ========================================
  openPasteModal() {
    this.pasteInput = '';
    this.showPasteModal = true;
  }

  closePasteModal() {
    this.showPasteModal = false;
  }

  confirmPaste(code: string) {
    if (code.trim()) {
      this.currentFilePath = null;
      this.currentCode = code;
      this.reviewResult = null;
      this.updateCodeLines();
      this.setStatus('Code pasted');
    }
    this.closePasteModal();
  }

  // ========================================
  // Code Display
  // ========================================
  updateCodeLines() {
    const lines = this.currentCode.split(/\r?\n/);

    this.codeLines = lines.map((content, index) => {
      const num = index + 1;
      const issues = this.reviewResult?.issues.filter(i => i.line === num);
      const isError = !!(issues && issues.length > 0);
      return { num, content, isError, issues };
    });
  }

  // ========================================
  // Review
  // ========================================
  async handleReview() {
    if (this.openedFiles.length > 0)
      await this.handleMultiFileReview();
    else
      await this.handleSingleFileReview();
  }

  private async handleSingleFileReview() {
    if (!this.currentCode.trim()) {
      this.setStatus('Please paste or open a code file');
      return;
    }

    this.isReviewing = true;
    this.setStatus('Analyzing code...');

    // Open thinking modal
    this.thinkingContent = '';
    this.showThinkingModal = true;

    try {
      let language = this.currentLanguage;

      // Auto-detect language only if 'unknown' (Auto-detect) is selected
      if (this.currentLanguage === 'detect') {
        this.thinkingStatus = 'Detecting language...';
        const detectedLanguage = await this.ollamaService.detectLanguage(this.currentCode, this.settings);
        if (detectedLanguage)
          this.currentLanguage = detectedLanguage;
        else
          throw Error("Language is null");
      }

      // Get rules for language
      this.thinkingStatus = `Reviewing ${language} code...`;

      const result = await this.ollamaService.reviewCodeStream(
        this.codeLines.map(x => ({ num: x.num, content: x.content })),
        this.currentLanguage,
        this.settings,
        {
          onThinking: (thinking) => {
            this.thinkingContent = thinking;
            this.cdr.detectChanges();

          },
          onContent: (content) => {
            this.thinkingStatus = 'Generating response...';
          },
          onDone: () => {
            this.thinkingStatus = 'Done!';
          }
        }
      );

      this.reviewResult = result;
      this.showThinkingModal = false;

      if (result.error) {
        this.setStatus(`Error: ${result.error}`);
      } else {
        const issueCount = result.issues.length;
        const criticalCount = result.issues.filter(i => i.type === 'Critical').length;
        const warningCount = issueCount - criticalCount;

        if (issueCount === 0) {
          this.setStatus('✨ No issues found!');
        } else {
          this.setStatus(`Found ${issueCount} issues (${criticalCount} critical, ${warningCount} warnings)`);
        }
      }

      this.updateCodeLines();
    } catch (error) {
      this.showThinkingModal = false;
      if (error instanceof Error)
        switch (error.message) {
          case 'Request cancelled':
            this.setStatus('Review cancelled');
            break;
          case 'Language is null':
            this.setStatus('Language not detected');
            break;
          default:
            this.setStatus('See errors in console.');
            console.error(error.message);
        }
      else {
        this.setStatus('See errors in console.');
        console.error(error);
      }
    } finally {
      this.isReviewing = false;
    }
  }

  private async handleMultiFileReview() {
    this.isReviewing = true;
    this.thinkingContent = '';
    this.showThinkingModal = true;

    const totalFiles = this.openedFiles.length;
    let totalIssues = 0;

    try {
      for (let i = 0; i < this.openedFiles.length; i++) {
        const file = this.openedFiles[i];
        const progress = `File ${i + 1}/${totalFiles}: ${file.fileName}`
        file.isReviewing = true;
        this.cdr.detectChanges();

        this.thinkingStatus = progress;
        this.thinkingContent = `Processing: ${file.fileName}\n\n`;

        // Auto-detect language if needed
        let language = file.language;
        if (language === 'detect') {
          this.thinkingStatus = progress + " - Detecting language...";
          const detected = await this.ollamaService.detectLanguage(file.content, this.settings);
          if (detected) {
            language = detected;
            file.language = detected;
          }
        }

        // Review file
        this.thinkingStatus = progress + " - Reviewing...";

        const result = await this.ollamaService.reviewCodeStream(
          file.codeLines.map(x => ({ num: x.num, content: x.content })),
          language,
          this.settings,
          {
            onThinking: (thinking) => {
              this.thinkingContent = `${thinking}`;
            },
            onContent: () => {
              this.thinkingStatus = progress + " - Generating response...";
            },
            onDone: () => {
              this.thinkingStatus = progress + " - Done!";
            }
          }
        );

        // Update file with review result
        file.reviewResult = result;
        file.isReviewing = false;

        // Update codeLines with issues
        file.codeLines = file.codeLines.map(line => {
          const issues = result.issues.filter(issue => issue.line === line.num);
          return {
            ...line,
            isError: issues.length > 0,
            issues: issues.length > 0 ? issues : undefined
          };
        });

        totalIssues += result.issues.length;
        this.cdr.detectChanges();
      }

      this.showThinkingModal = false;

      if (totalIssues === 0) {
        this.setStatus(`All ${totalFiles} files reviewed - No issues found!`);
      } else {
        this.setStatus(`Reviewed ${totalFiles} files - Found ${totalIssues} issues`);
      }
    } catch (error) {
      this.showThinkingModal = false;
      // Reset reviewing state for all files
      this.openedFiles.forEach(f => f.isReviewing = false);

      if (error instanceof Error && error.message === 'Request cancelled') {
        this.setStatus('Review cancelled');
      } else {
        this.setStatus('See errors in console.');
        console.error(error);
      }
    } finally {
      this.isReviewing = false;
      this.cdr.detectChanges();
    }
  }

  cancelReview() {
    this.ollamaService.cancelRequest();
    this.showThinkingModal = false;
    this.isReviewing = false;
    this.setStatus('Review cancelled');
  }

  // ========================================
  // Tooltip
  // ========================================
  showIssueTooltip(data: { event: MouseEvent, issues: ReviewIssue[] }) {
    data.event.stopPropagation();
    this.tooltipIssues = data.issues;
    this.showTooltip = true;

    const rect = (data.event.target as HTMLElement).getBoundingClientRect();

    // Estimate tooltip height based on number of issues (each issue ~100-150px)
    const estimatedTooltipHeight = Math.max(150, data.issues.length * 120);
    const tooltipWidth = 400;
    const margin = 5;

    // Calculate left position (ensure not overflowing right edge)
    const left = Math.min(rect.left, window.innerWidth - tooltipWidth - margin);

    // Calculate top position
    let top = rect.bottom + margin;

    // If tooltip would overflow bottom, position it above the element instead
    if (top + estimatedTooltipHeight > window.innerHeight) {
      top = Math.max(margin, rect.top - estimatedTooltipHeight - margin);
    }

    this.tooltipStyle = {
      top: `${top}px`,
      left: `${left}px`
    };
  }

  hideTooltip() {
    this.showTooltip = false;
    this.tooltipIssues = [];
  }

  onDocumentClick(event: MouseEvent) {
    // Hide tooltip when clicking outside
    const target = event.target as HTMLElement;
    if (!target.closest('.error-tooltip') && !target.closest('.error-line')) {
      this.hideTooltip();
    }
  }

  // ========================================
  // Settings
  // ========================================
  async handleFetchModels() {
    const host = this.settings.host || 'http://127.0.0.1:11434';

    this.connectionStatus = `Connecting ${host}...`;
    this.connectionStatusType = 'loading';
    this.showModelSection = false;
    this.cdr.detectChanges();

    try {
      this.models = await this.ollamaService.getModels(host, this.settings.apiKey);

      this.connectionStatus = `${this.models.length} models were found.`;
      this.connectionStatusType = 'success';
      this.showModelSection = true;

      // Select saved model if exists
      if (this.settings.model && this.models.includes(this.settings.model)) {
        this.updateThinkUI();
      }
    } catch (error) {
      this.connectionStatus = 'Fetch error: ' + (error instanceof Error ? error.message : 'Unknown error');
      this.connectionStatusType = 'error';
    }
    this.cdr.detectChanges();
  }

  updateThinkUI() {
    this.isGptOssModel = this.settings.model.toLowerCase().includes('gpt-oss');
  }

  onModelChange() {
    this.updateThinkUI();
  }

  async handleSaveSettings(newSettings: Settings) {
    this.settings = newSettings;
    if (!this.settings.model) {
      this.setStatus('Please select a model');
      return;
    }

    try {
      await this.settingsService.saveSettings(this.settings);
      this.ngZone.run(() => {
        this.showSettingsModal = false;
        this.setStatus('Settings saved');
      });
    } catch (error) {
      this.ngZone.run(() => {
        this.setStatus('Failed to save settings');
      });
      console.error(error);
    }
  }

  onLanguageChange(language: string) {
    this.currentLanguage = language;
  }

  // ========================================
  // Status
  // ========================================
  private statusTimeout: ReturnType<typeof setTimeout> | null = null;
  isToastHiding = false;

  setStatus(message: string) {
    // Clear previous timeout
    if (this.statusTimeout) {
      clearTimeout(this.statusTimeout);
      this.statusTimeout = null;
    }

    this.isToastHiding = false;
    this.statusMessage = message;
    this.cdr.detectChanges();

    // Auto-hide after 3 seconds
    if (message) {
      this.statusTimeout = setTimeout(() => {
        // Start fade-out animation
        this.isToastHiding = true;
        this.cdr.detectChanges();

        // Remove toast after animation completes (300ms)
        setTimeout(() => {
          this.statusMessage = '';
          this.isToastHiding = false;
          this.cdr.detectChanges();
        }, 300);
      }, 3000);
    }
  }

  // ========================================
  // Addin Handlers
  // ========================================
  async handleLoadAddins() {
    try {
      this.loadedAddins = await this.addinService.loadAddins();
      console.log(`Loaded ${this.loadedAddins.length} addins`);
      if (this.loadedAddins.length > 0) {
        this.setStatus(`Loaded ${this.loadedAddins.length} addin(s)`);
      }
    } catch (error) {
      console.error('Failed to load addins:', error);
    }
    this.cdr.detectChanges();
  }

  handleAddinClick(addin: Addin) {
    const api = this.addinService.createApi(this.settings);
    const result = this.addinService.executeAddin(addin, api);

    switch (result.type) {
      case 'dialog':
        this.addinDialogTitle = addin.metadata.name;
        this.addinDialogContent = result.element;
        this.showAddinDialog = true;
        break;
      case 'action':
        this.setStatus(`${addin.metadata.name} executed`);
        break;
      case 'error':
        this.setStatus(`Error: ${result.message}`);
        break;
    }
    this.cdr.detectChanges();
  }

  handleAddinPayload(payload: AddinPayload) {
    this.ngZone.run(() => {
      switch (payload.action) {
        case 'setFile':
          this.handleAddinSetFile(payload.data);
          break;
        case 'setFiles':
          this.handleAddinSetFiles(payload.data);
          break;
      }
      // Close addin dialog after action
      this.showAddinDialog = false;
      this.cdr.detectChanges();
    });
  }

  private handleAddinSetFile(data: SetFileData) {
    this.currentFilePath = data.filePath || null;
    this.currentCode = data.content;
    this.currentLanguage = data.language || 'detect';
    this.isLanguageLocked = !!data.language;
    this.reviewResult = null;
    this.openedFiles = []; // Clear multi-file mode
    this.updateCodeLines();
    this.setStatus('Code set by addin');
  }

  private handleAddinSetFiles(data: SetFilesData) {
    // Clear single-file mode
    this.currentFilePath = null;
    this.currentCode = '';
    this.reviewResult = null;
    this.codeLines = [];

    // Populate openedFiles
    this.openedFiles = data.files.map(file => {
      const fileName = file.filePath.split(/[/\\]/).pop() || file.filePath;
      const language = file.language || 'detect';

      const lines = file.content.split(/\r?\n/);
      const codeLines: CodeLine[] = lines.map((content, index) => ({
        num: index + 1,
        content,
        isError: false,
        issues: undefined
      }));

      return {
        filePath: file.filePath,
        fileName,
        content: file.content,
        language,
        codeLines,
        reviewResult: null,
        isReviewing: false
      };
    });

    this.setStatus(`${data.files.length} files set by addin`);
  }

  closeAddinDialog() {
    this.showAddinDialog = false;
    this.addinDialogContent = null;
  }
}
