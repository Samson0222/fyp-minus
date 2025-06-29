import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Link } from 'lucide-react';

const RichTextEditorDemo: React.FC = () => {
  // States that mirror the CreateTaskModal
  const [description, setDescription] = useState('');
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const descriptionRef = useRef<HTMLDivElement>(null);

  // Demonstration states
  const [issueLog, setIssueLog] = useState<string[]>([]);
  const [formValue, setFormValue] = useState('');

  // Simulate form sync (like in CreateTaskModal)
  useEffect(() => {
    setFormValue(description);
  }, [description]);

  const logIssue = (issue: string) => {
    setIssueLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${issue}`]);
  };

  const execCommand = (command: string) => {
    if (!descriptionRef.current) return;
    
    try {
      document.execCommand(command, false);
      updateActiveFormats();
      descriptionRef.current.focus();
    } catch (error) {
      logIssue(`execCommand failed for ${command}: ${error}`);
    }
  };

  const updateActiveFormats = () => {
    const formats = new Set<string>();
    
    try {
      if (document.queryCommandState('bold')) formats.add('bold');
      if (document.queryCommandState('italic')) formats.add('italic');
    } catch (error) {
      logIssue(`updateActiveFormats failed: ${error}`);
    }
    
    setActiveFormats(formats);
  };

  const handleDescriptionChange = () => {
    if (descriptionRef.current) {
      const newContent = descriptionRef.current.innerHTML;
      setDescription(newContent);
      
      // Check for state sync issues
      if (newContent !== formValue) {
        logIssue(`State sync issue: editor="${newContent.length} chars", form="${formValue.length} chars"`);
      }
    }
  };

  const createLink = () => {
    const selection = window.getSelection();
    if (selection && selection.toString()) {
      const selectedTextValue = selection.toString();
      setSelectedText(selectedTextValue);
      setShowLinkDialog(true);
      
      // This demonstrates the selection loss issue
      setTimeout(() => {
        const newSelection = window.getSelection();
        if (!newSelection || !newSelection.toString()) {
          logIssue(`Selection lost when dialog opened. Original: "${selectedTextValue}"`);
        }
      }, 100);
    } else {
      logIssue('No text selected for link creation');
    }
  };

  const resetEditor = () => {
    setDescription('');
    setActiveFormats(new Set());
    setFormValue('');
    if (descriptionRef.current) {
      descriptionRef.current.innerHTML = '';
    }
    logIssue('Editor reset - checking if content actually cleared');
    
    // Check if reset worked
    setTimeout(() => {
      if (descriptionRef.current && descriptionRef.current.innerHTML !== '') {
        logIssue(`Reset failed: Content still present: "${descriptionRef.current.innerHTML}"`);
      }
    }, 100);
  };

  const testFormattingSync = () => {
    logIssue('Testing formatting sync - select some text and click Bold, then click elsewhere');
  };

  const clearLog = () => {
    setIssueLog([]);
  };

  return (
    <div className="p-6 bg-gray-900 text-white space-y-6">
      <h2 className="text-2xl font-bold">Rich Text Editor Issues Demo</h2>
      
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 bg-gray-800 rounded">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${activeFormats.has('bold') ? 'bg-violet-600' : ''}`}
          onClick={() => execCommand('bold')}
        >
          <Bold className="h-4 w-4" />
        </Button>
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${activeFormats.has('italic') ? 'bg-violet-600' : ''}`}
          onClick={() => execCommand('italic')}
        >
          <Italic className="h-4 w-4" />
        </Button>
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={createLink}
        >
          <Link className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor */}
      <div
        ref={descriptionRef}
        contentEditable
        className="p-3 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-violet-500 min-h-[120px]"
        onInput={handleDescriptionChange}
        onKeyUp={updateActiveFormats}
        onMouseUp={updateActiveFormats}
        onFocus={updateActiveFormats}
        data-placeholder="Type some text here to test the editor..."
        style={{
          minHeight: '120px'
        }}
      />

      {/* Debug Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="font-semibold mb-2">State Information</h3>
          <div className="text-sm space-y-1">
            <div>Description Length: {description.length}</div>
            <div>Form Value Length: {formValue.length}</div>
            <div>Active Formats: {Array.from(activeFormats).join(', ') || 'None'}</div>
            <div>Selected Text: "{selectedText}"</div>
            <div>Link Dialog Open: {showLinkDialog ? 'Yes' : 'No'}</div>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <h3 className="font-semibold mb-2">Test Controls</h3>
          <div className="space-y-2">
            <Button onClick={testFormattingSync} size="sm" className="w-full">
              Test Formatting Sync
            </Button>
            <Button onClick={resetEditor} size="sm" className="w-full">
              Reset Editor
            </Button>
            <Button onClick={clearLog} size="sm" variant="outline" className="w-full">
              Clear Issue Log
            </Button>
          </div>
        </div>
      </div>

      {/* Issue Log */}
      <div className="bg-gray-800 p-4 rounded">
        <h3 className="font-semibold mb-2">Issue Log ({issueLog.length} issues)</h3>
        <div className="max-h-40 overflow-y-auto text-sm space-y-1">
          {issueLog.length === 0 ? (
            <div className="text-gray-400">No issues logged yet. Try interacting with the editor above.</div>
          ) : (
            issueLog.map((issue, index) => (
              <div key={index} className="text-red-300 font-mono text-xs">
                {issue}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Link Dialog */}
      {showLinkDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium mb-4">Create Link</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm block mb-2">Selected Text</label>
                <div className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm">
                  {selectedText || 'No text selected'}
                </div>
              </div>
              <div>
                <label className="text-sm block mb-2">URL</label>
                <input
                  type="text"
                  placeholder="https://example.com"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => {
                  setShowLinkDialog(false);
                  setLinkUrl('');
                  setSelectedText('');
                  logIssue('Link dialog closed - original selection was lost');
                }}
                className="flex-1"
              >
                Create Link
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowLinkDialog(false);
                  setLinkUrl('');
                  setSelectedText('');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded">
        <h3 className="font-semibold mb-2">How to Test Issues:</h3>
        <ol className="text-sm space-y-1 list-decimal list-inside">
          <li>Type some text in the editor</li>
          <li>Select part of the text and click Bold - notice the button state</li>
          <li>Click elsewhere, then back on the bold text - button state may be wrong</li>
          <li>Select text and click the Link button - see how selection is lost</li>
          <li>Add formatting, then click Reset - check if content is truly cleared</li>
          <li>Watch the Issue Log for problems</li>
        </ol>
      </div>
    </div>
  );
};

export default RichTextEditorDemo; 