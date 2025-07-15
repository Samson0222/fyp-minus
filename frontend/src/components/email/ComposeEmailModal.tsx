import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ComposeEmailModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Callback fired after an email is sent successfully so the parent page can refresh its state.
   */
  onEmailSent?: () => void;
}

/**
 * Minimal replacement for the prior tasks/ComposeEmailModal.
 * Provides a simple UI for composing and sending an email via the `/api/v1/gmail/send` endpoint.
 * Retains the shadcn/ui design language to maintain consistent styling with the rest of the app.
 */
const ComposeEmailModal: React.FC<ComposeEmailModalProps> = ({
  isOpen,
  onOpenChange,
  onEmailSent,
}) => {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const resetForm = () => {
    setTo("");
    setSubject("");
    setBody("");
  };

  const handleSend = async () => {
    // Basic validation – ensure at least one recipient and a subject
    if (!to.trim()) {
      toast({
        title: "Recipient required",
        description: "Please enter at least one recipient email.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/v1/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to
            .split(/[,;\s]+/)
            .map((email: string) => email.trim())
            .filter(Boolean),
          subject,
          body_plain: body,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to send email");
      }

      toast({
        title: "Email sent!",
        description: "Your message has been delivered successfully.",
        duration: 3000,
      });

      // Refresh parent list
      onEmailSent?.();

      // Close modal and reset form
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error sending email",
        description: err.message || "Something went wrong.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background text-foreground">
        <DialogHeader>
          <DialogTitle>Compose Email</DialogTitle>
          <DialogDescription>
            Fill in the fields below to send a new email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="to">
              To
            </label>
            <Input
              id="to"
              placeholder="recipient@example.com, another@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="subject">
              Subject
            </label>
            <Input
              id="subject"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="body">
              Message
            </label>
            <Textarea
              id="body"
              placeholder="Type your message here..."
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? "Sending..." : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ComposeEmailModal; 