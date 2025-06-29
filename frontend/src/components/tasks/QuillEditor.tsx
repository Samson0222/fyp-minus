import React, { forwardRef, useEffect, useLayoutEffect, useRef } from 'react';
import Quill from 'quill';

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

  // Function to setup better link handling
  const setupLinkHandling = (quill: Quill) => {
    // Add Ctrl+K shortcut for link
    quill.keyboard.addBinding({
      key: 'k',
      ctrlKey: true
    }, function(range: any, context: any) {
      const toolbar = quill.getModule('toolbar');
      if (toolbar && toolbar.handlers && toolbar.handlers.link) {
        toolbar.handlers.link.call(toolbar, true);
      }
    });
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
    <div 
      className={`quill-editor ${className}`}
      style={{
        width: '100%',
        maxWidth: '100%'
      }}
    >
      <div ref={containerRef} />
    </div>
  );
});

QuillEditor.displayName = 'QuillEditor';

export default QuillEditor; 