import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface LinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (url: string, text?: string) => void;
  mode?: 'insert' | 'edit';
  initialUrl?: string;
  selectedText?: string;
  title?: string;
}

const LinkDialog: React.FC<LinkDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  mode = 'insert',
  initialUrl = '',
  selectedText = '',
  title = 'Add Link'
}) => {
  const [url, setUrl] = useState(initialUrl);
  const [text, setText] = useState(selectedText);

  useEffect(() => {
    if (isOpen) {
      setUrl(initialUrl);
      setText(selectedText);
    }
  }, [isOpen, initialUrl, selectedText]);

  const handleConfirm = () => {
    if (url.trim()) {
      // Ensure URL has protocol
      const cleanUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
      onConfirm(cleanUrl, text.trim() || cleanUrl);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const handleOpenLink = () => {
    if (url.trim()) {
      const cleanUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
      window.open(cleanUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-gray-100">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url" className="text-gray-200">
              URL
            </Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-400 focus:border-violet-500 focus:ring-violet-500"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="text" className="text-gray-200">
              Display Text
            </Label>
            <Input
              id="text"
              type="text"
              placeholder="Link text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-400 focus:border-violet-500 focus:ring-violet-500"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            {mode === 'edit' && (
              <Button
                variant="outline"
                onClick={handleOpenLink}
                className="border-gray-600 text-gray-300 hover:bg-gray-800"
                disabled={!url.trim()}
              >
                Open Link
              </Button>
            )}
            <Button
              onClick={handleConfirm}
              className="bg-violet-600 hover:bg-violet-700 text-white"
              disabled={!url.trim()}
            >
              {mode === 'edit' ? 'Update Link' : (selectedText ? 'Add Link' : 'Insert Link')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LinkDialog; 