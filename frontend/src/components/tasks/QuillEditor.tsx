import React, { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Quill from 'quill';
import LinkDialog from './LinkDialog';

// Import Quill styles
import 'quill/dist/quill.snow.css';
import './quill-editor.css';

// Create a custom divider blot
const Block = Quill.import('blots/block');

class DividerBlot extends Block {
  static blotName = 'divider';
  static tagName = 'hr';

  static create() {
    const node = super.create();
    node.setAttribute('contenteditable', false);
    return node;
  }
}

Quill.register(DividerBlot);

interface QuillEditorProps {
  defaultValue?: string;
  value?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  theme?: 'snow' | 'bubble';
  className?: string;
  minHeight?: string;
  maxHeight?: string;
  expanded?: boolean;
}

const QuillEditor = forwardRef<Quill, QuillEditorProps>(({
  defaultValue = '',
  value,
  onChange,
  placeholder = 'Add a description...',
  readOnly = false,
  theme = 'snow',
  className = '',
  minHeight = '120px',
  maxHeight = '300px',
  expanded = false
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const [linkDialog, setLinkDialog] = useState<{
    isOpen: boolean;
    mode: 'insert' | 'edit';
    selectedText: string;
    initialUrl: string;
    range: any;
  }>({
    isOpen: false,
    mode: 'insert',
    selectedText: '',
    initialUrl: '',
    range: null
  });

  // Quill configuration to match the screenshots
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }], // Headers with "Standard text" as default
      ['bold', 'italic', 'underline', 'strike'], // Text formatting
      ['code-block'], // Code block
      ['link'], // Link
      [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'list': 'check' }], // Lists including checklist
      ['blockquote'], // Quote
      ['clean'] // Remove formatting
    ],
    clipboard: {
      // Clean up pasted content
      matchVisual: false,
    },
    keyboard: {
      bindings: {
        // Custom keyboard shortcuts
        'header-1': {
          key: '1',
          altKey: true,
          ctrlKey: true,
          handler: function(range: any, context: any) {
            this.quill.format('header', 1);
          }
        },
        'header-2': {
          key: '2',
          altKey: true,
          ctrlKey: true,
          handler: function(range: any, context: any) {
            this.quill.format('header', 2);
          }
        },
        'header-3': {
          key: '3',
          altKey: true,
          ctrlKey: true,
          handler: function(range: any, context: any) {
            this.quill.format('header', 3);
          }
        },
        'standard-text': {
          key: '0',
          altKey: true,
          ctrlKey: true,
          handler: function(range: any, context: any) {
            this.quill.format('header', false);
          }
        },
        'code-block': {
          key: '4',
          altKey: true,
          ctrlKey: true,
          handler: function(range: any, context: any) {
            this.quill.format('code-block', true);
          }
        },
        'blockquote': {
          key: '5',
          altKey: true,
          ctrlKey: true,
          handler: function(range: any, context: any) {
            this.quill.format('blockquote', true);
          }
        },
        'horizontal-rule': {
          key: '7',
          altKey: true,
          ctrlKey: true,
          handler: function(range: any, context: any) {
            // Insert horizontal rule (divider)
            const index = range ? range.index : this.quill.getLength();
            this.quill.insertText(index, '\n');
            this.quill.insertEmbed(index + 1, 'divider', true);
            this.quill.insertText(index + 2, '\n');
            this.quill.setSelection(index + 3);
          }
        }
      }
    }
  };

  const formats = [
    'header', 'bold', 'italic', 'underline', 'strike',
    'list', 'bullet', 'check', 'link', 'blockquote', 'code-block', 'divider'
  ];

  // Initialize Quill
  useLayoutEffect(() => {
    if (containerRef.current && !quillRef.current) {
      const quill = new Quill(containerRef.current, {
        theme,
        modules,
        formats,
        placeholder,
        readOnly,
      });

      quillRef.current = quill;

      // Set initial content
      if (defaultValue) {
        quill.clipboard.dangerouslyPasteHTML(defaultValue);
      }

      // Handle text changes
      quill.on('text-change', () => {
        const html = quill.root.innerHTML;
        const isEmpty = quill.getText().trim().length === 0;
        onChange?.(isEmpty ? '' : html);
      });

      // Expose quill instance via ref
      if (typeof ref === 'function') {
        ref(quill);
      } else if (ref) {
        ref.current = quill;
      }

      // Add tooltips to toolbar buttons
      addTooltips(quill);

      // Setup custom link handling
      setupLinkHandling(quill);
    }

    return () => {
      if (quillRef.current) {
        quillRef.current = null;
      }
    };
  }, []);

  // Function to add custom tooltips
  const addTooltips = (quill: Quill) => {
    const toolbar = quill.getModule('toolbar');
    if (toolbar && toolbar.container) {
      const buttons = toolbar.container.querySelectorAll('button, select');
      
      buttons.forEach((button: HTMLElement) => {
        if (button.classList.contains('ql-header')) {
          const value = button.getAttribute('value');
          switch (value) {
            case '1':
              button.setAttribute('title', 'Large header (Ctrl+Alt+1)');
              break;
            case '2':
              button.setAttribute('title', 'Medium header (Ctrl+Alt+2)');
              break;
            case '3':
              button.setAttribute('title', 'Small header (Ctrl+Alt+3)');
              break;
            default:
              button.setAttribute('title', 'Standard text (Ctrl+Alt+0)');
          }
        } else if (button.classList.contains('ql-bold')) {
          button.setAttribute('title', 'Bold (Ctrl+B)');
        } else if (button.classList.contains('ql-italic')) {
          button.setAttribute('title', 'Italic (Ctrl+I)');
        } else if (button.classList.contains('ql-underline')) {
          button.setAttribute('title', 'Underline (Ctrl+U)');
        } else if (button.classList.contains('ql-strike')) {
          button.setAttribute('title', 'Strikethrough');
        } else if (button.classList.contains('ql-code-block')) {
          button.setAttribute('title', 'Code block (Ctrl+Alt+4)');
        } else if (button.classList.contains('ql-link')) {
          button.setAttribute('title', 'Link (Ctrl+K)');
        } else if (button.classList.contains('ql-list')) {
          const value = button.getAttribute('value');
          if (value === 'ordered') {
            button.setAttribute('title', 'Numbered list');
          } else if (value === 'bullet') {
            button.setAttribute('title', 'Bullet list');
          } else if (value === 'check') {
            button.setAttribute('title', 'Checklist');
          }
        } else if (button.classList.contains('ql-blockquote')) {
          button.setAttribute('title', 'Quote (Ctrl+Alt+5)');
        } else if (button.classList.contains('ql-clean')) {
          button.setAttribute('title', 'Remove formatting');
        }
      });

      // Handle header dropdown
      const headerSelect = toolbar.container.querySelector('.ql-header');
      if (headerSelect) {
        headerSelect.setAttribute('title', 'Text format');
      }
    }
  };

  // Function to handle inserting and editing links without relying on Quill's tooltip
  const setupLinkHandling = (quill: Quill) => {
    // Helper to open our dialog
    const openLinkDialog = (
      mode: 'insert' | 'edit',
      range: any,
      url: string = '',
      text: string = ''
    ) => {
      setLinkDialog({
        isOpen: true,
        mode,
        selectedText: text,
        initialUrl: url,
        range,
      });
    };

    // Override toolbar handler for Ctrl+K / link button
    const toolbar = quill.getModule('toolbar') as any;
    if (toolbar) {
      toolbar.addHandler('link', (value: boolean) => {
        if (!value) {
          // unlink action
          const range = quill.getSelection();
          if (range) quill.format('link', false);
          return;
        }

        const range = quill.getSelection();
        if (!range) return;

        const selectedText = range.length > 0 ? quill.getText(range.index, range.length) : '';
        openLinkDialog('insert', range, '', selectedText);
      });
    }

    // Add keyboard shortcut Ctrl+K
    quill.keyboard.addBinding({ key: 'k', ctrlKey: true }, () => {
      const range = quill.getSelection();
      if (range) {
        const selectedText = range.length > 0 ? quill.getText(range.index, range.length) : '';
        openLinkDialog('insert', range, '', selectedText);
      }
    });

    // Click listener for editing existing links
    quill.root.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'A') {
        e.preventDefault();

        const blot = Quill.find(target) as any;
        if (!blot) return;

        const index = quill.getIndex(blot);
        const length = (target.textContent || '').length;
        const range = { index, length };

        openLinkDialog('edit', range, target.getAttribute('href') || '', target.textContent || '');
      }
    });
  };

  // Handle link dialog confirmation
  const handleLinkConfirm = (url: string, newText?: string) => {
    if (!quillRef.current || !linkDialog.range) {
      setLinkDialog({ isOpen: false, mode: 'insert', selectedText: '', initialUrl: '', range: null });
      return;
    }

    const quill = quillRef.current;
    const { index, length } = linkDialog.range;

    if (linkDialog.mode === 'insert') {
      if (length > 0) {
        // Replace selected text with (possibly changed) display text and link format
        const displayText = newText && newText.trim() ? newText : quill.getText(index, length);
        quill.deleteText(index, length);
        quill.insertText(index, displayText, 'link', url);
        quill.setSelection(index + displayText.length);
      } else {
        const displayText = newText && newText.trim() ? newText : url;
        quill.insertText(index, displayText, 'link', url);
        quill.setSelection(index + displayText.length);
      }
    } else {
      // Editing an existing link
      quill.formatText(index, length, 'link', url);

      if (newText && newText.trim() && newText.trim() !== quill.getText(index, length)) {
        // Replace the display text
        quill.deleteText(index, length);
        quill.insertText(index, newText.trim(), 'link', url);
        quill.setSelection(index + newText.trim().length);
      } else {
        quill.setSelection(index + length);
      }
    }

    setLinkDialog({ isOpen: false, mode: 'insert', selectedText: '', initialUrl: '', range: null });
  };

  // Handle link dialog close (cancel)
  const handleLinkClose = () => {
    setLinkDialog({ isOpen: false, mode: 'insert', selectedText: '', initialUrl: '', range: null });
  };

  // Handle controlled value changes
  useEffect(() => {
    if (quillRef.current && value !== undefined) {
      const currentContent = quillRef.current.root.innerHTML;
      if (currentContent !== value) {
        const selection = quillRef.current.getSelection();
        quillRef.current.clipboard.dangerouslyPasteHTML(value);
        if (selection) {
          quillRef.current.setSelection(selection);
        }
      }
    }
  }, [value]);

  // Handle readOnly changes
  useEffect(() => {
    if (quillRef.current) {
      quillRef.current.enable(!readOnly);
    }
  }, [readOnly]);

  // Update editor height based on expanded state
  useEffect(() => {
    if (containerRef.current) {
      const editor = containerRef.current.querySelector('.ql-editor') as HTMLElement;
      if (editor) {
        editor.style.minHeight = expanded ? '200px' : minHeight;
        editor.style.maxHeight = expanded ? '400px' : maxHeight;
      }
    }
  }, [expanded, minHeight, maxHeight]);

  return (
    <>
      <div 
        className={`quill-editor ${className}`}
        style={{
          width: '100%',
          maxWidth: '100%'
        }}
      >
        <div ref={containerRef} />
      </div>
      
      <LinkDialog
        isOpen={linkDialog.isOpen}
        onClose={handleLinkClose}
        onConfirm={handleLinkConfirm}
        mode={linkDialog.mode}
        selectedText={linkDialog.selectedText}
        initialUrl={linkDialog.initialUrl}
        title={linkDialog.mode === 'edit' ? 'Edit Link' : 'Insert Link'}
      />
    </>
  );
});

QuillEditor.displayName = 'QuillEditor';

export default QuillEditor; 