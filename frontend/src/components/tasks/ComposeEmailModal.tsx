import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Send, X, Mail, Plus } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface ComposeEmailModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onEmailSent?: () => void;
}

interface SendEmailRequest {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body_plain?: string;
  body_html?: string;
}

const ComposeEmailModal: React.FC<ComposeEmailModalProps> = ({
  isOpen,
  onOpenChange,
  onEmailSent
}) => {
  const [formData, setFormData] = useState({
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    body: ""
  });
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.to.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter at least one recipient email address.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.subject.trim()) {
      toast({
        title: "Validation Error", 
        description: "Please enter a subject for your email.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);

      // Parse email addresses (split by comma or semicolon)
      const parseEmails = (str: string): string[] => {
        return str.split(/[,;]/)
          .map(email => email.trim())
          .filter(email => email.length > 0);
      };

      const emailRequest: SendEmailRequest = {
        to: parseEmails(formData.to),
        subject: formData.subject,
        body_plain: formData.body || undefined
      };

      // Add CC if provided
      if (formData.cc.trim()) {
        emailRequest.cc = parseEmails(formData.cc);
      }

      // Add BCC if provided
      if (formData.bcc.trim()) {
        emailRequest.bcc = parseEmails(formData.bcc);
      }

      console.log('Sending email request:', emailRequest);

      const response = await fetch('/api/v1/gmail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailRequest)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to send email');
      }

      const result = await response.json();
      console.log('Email sent successfully:', result);

      toast({
        title: "Email Sent Successfully!",
        description: `Your email has been sent to ${emailRequest.to.join(', ')}.`,
      });

      // Reset form
      setFormData({
        to: "",
        cc: "",
        bcc: "",
        subject: "",
        body: ""
      });
      setShowCc(false);
      setShowBcc(false);

      // Close modal and notify parent
      onOpenChange(false);
      onEmailSent?.();

    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: "Failed to Send Email",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleClose = () => {
    if (!isLoading) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl bg-dark-secondary border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Mail className="h-5 w-5 text-violet" />
            Compose Email
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* To Field */}
          <div className="space-y-2">
            <Label htmlFor="to" className="text-white">
              To <span className="text-red-400">*</span>
            </Label>
            <Input
              id="to"
              type="email"
              placeholder="recipient@example.com, another@example.com"
              value={formData.to}
              onChange={(e) => handleInputChange('to', e.target.value)}
              className="bg-dark-tertiary border-white/20 text-white placeholder-white/50"
              required
            />
            <p className="text-xs text-white/60">
              Separate multiple emails with commas or semicolons
            </p>
          </div>

          {/* CC/BCC Toggle Buttons */}
          <div className="flex gap-2">
            {!showCc && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCc(true)}
                className="text-violet border-violet/50 hover:bg-violet/10"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add CC
              </Button>
            )}
            {!showBcc && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowBcc(true)}
                className="text-violet border-violet/50 hover:bg-violet/10"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add BCC
              </Button>
            )}
          </div>

          {/* CC Field */}
          {showCc && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="cc" className="text-white">CC</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCc(false);
                    handleInputChange('cc', '');
                  }}
                  className="h-4 w-4 p-0 text-white/50 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <Input
                id="cc"
                type="email"
                placeholder="cc@example.com"
                value={formData.cc}
                onChange={(e) => handleInputChange('cc', e.target.value)}
                className="bg-dark-tertiary border-white/20 text-white placeholder-white/50"
              />
            </div>
          )}

          {/* BCC Field */}
          {showBcc && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="bcc" className="text-white">BCC</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowBcc(false);
                    handleInputChange('bcc', '');
                  }}
                  className="h-4 w-4 p-0 text-white/50 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <Input
                id="bcc"
                type="email"
                placeholder="bcc@example.com"
                value={formData.bcc}
                onChange={(e) => handleInputChange('bcc', e.target.value)}
                className="bg-dark-tertiary border-white/20 text-white placeholder-white/50"
              />
            </div>
          )}

          {/* Subject Field */}
          <div className="space-y-2">
            <Label htmlFor="subject" className="text-white">
              Subject <span className="text-red-400">*</span>
            </Label>
            <Input
              id="subject"
              type="text"
              placeholder="Enter email subject"
              value={formData.subject}
              onChange={(e) => handleInputChange('subject', e.target.value)}
              className="bg-dark-tertiary border-white/20 text-white placeholder-white/50"
              required
            />
          </div>

          <Separator className="bg-white/10" />

          {/* Body Field */}
          <div className="space-y-2">
            <Label htmlFor="body" className="text-white">Message</Label>
            <Textarea
              id="body"
              placeholder="Type your message here..."
              value={formData.body}
              onChange={(e) => handleInputChange('body', e.target.value)}
              className="bg-dark-tertiary border-white/20 text-white placeholder-white/50 min-h-[200px] resize-none"
              rows={8}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="border-white/20 text-white hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !formData.to.trim() || !formData.subject.trim()}
              className="bg-violet hover:bg-violet-light text-white"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ComposeEmailModal; 