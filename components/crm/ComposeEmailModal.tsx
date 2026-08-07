"use client";
// components/crm/ComposeEmailModal.tsx
//
// Simple subject/body compose form. Sends from CRM_SENDER (currently a fixed
// "Sam <sam@rasvertex.com.au>" — no per-user auth exists yet to send as
// whoever's actually logged in, see lib/crm/email.ts).

import React, { useState } from "react";
import styles from "./ComposeEmailModal.module.css";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import TextInput from "@/components/ui/TextInput";
import TextArea from "@/components/ui/TextArea";

interface ComposeEmailModalProps {
  leadId: number;
  leadEmail: string;
  onClose: () => void;
  onSent: () => void;
}

export default function ComposeEmailModal({
  leadId,
  leadEmail,
  onClose,
  onSent,
}: ComposeEmailModalProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      setError("Subject and message are both required.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to send email");
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Email ${leadEmail}`}>
      <div className={styles.form}>
        <p className={styles.fromLine}>From: Sam &lt;sam@rasvertex.com.au&gt;</p>
        <TextInput
          id="compose-subject"
          label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          autoFocus
        />
        <TextArea
          id="compose-body"
          label="Message"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message…"
          rows={7}
        />
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSend} disabled={sending}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
