// components/auth/EmailVerification.tsx - Updated to match design
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import TitleDescription from "@/components/ui/TitleDescription";
import Button from "@/components/ui/Button";
import styles from "./EmailVerification.module.css";

interface EmailVerificationProps {
  email: string;
  onVerificationComplete: () => void;
}

export default function EmailVerification({
  email,
  onVerificationComplete,
}: EmailVerificationProps) {
  const router = useRouter();
  const [code, setCode] = useState<string[]>(["", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleBack = () => {
    router.back();
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text");
    const digits = paste.replace(/\D/g, "").slice(0, 4);

    if (digits.length === 4) {
      const newCode = digits.split("");
      setCode(newCode);
      inputRefs.current[3]?.focus();
    }
  };

  const handleVerify = async () => {
    const verificationCode = code.join("");

    if (verificationCode.length !== 4) {
      setError("Please enter the complete 4-digit code");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const verifyResponse = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          code: verificationCode,
        }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(verifyData.message || "Verification failed");
      }

      if (verifyData.success) {
        // After successful email verification, create a session
        const sessionResponse = await fetch(
          "/api/auth/create-verified-session",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email }),
          }
        );

        if (sessionResponse.ok) {
          // Session created successfully, call completion handler
          onVerificationComplete();
        } else {
          // Session creation failed, but email is verified so still proceed
          onVerificationComplete();
        }
      } else {
        throw new Error(verifyData.message || "Verification failed");
      }
    } catch (error) {
      console.error("Verification error:", error);

      // Show shake animation
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 600);

      // Clear all inputs
      setCode(["", "", "", ""]);

      // Focus first input
      inputRefs.current[0]?.focus();

      setError(error instanceof Error ? error.message : "Verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = async () => {
    setIsResending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/send-verification-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to resend email");
      }

      // Clear the code inputs and reset focus
      setCode(["", "", "", ""]);
      inputRefs.current[0]?.focus();

      // Show success feedback
    } catch (error) {
      console.error("Resend error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to resend email. Please try again."
      );
    } finally {
      setIsResending(false);
    }
  };

  const isCodeComplete = code.every((digit) => digit !== "");

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.formContainer}>
          <TitleDescription
            title="Verify Email"
            description={`To verify your email (${email}), please enter the code we sent to your email.`}
          />

          <div className={styles.formSection}>
            <div
              className={`${styles.codeInputContainer} ${isShaking ? styles.shake : ""}`}
            >
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="\d"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  className={`${styles.codeInput} ${error ? styles.codeInputError : ""}`}
                  autoFocus={index === 0}
                  disabled={isLoading}
                  data-filled={digit !== ""}
                />
              ))}
            </div>

            {error && <div className={styles.errorMessage}>{error}</div>}

            <div className={styles.buttonContainer}>
              <Button
                variant="primary-green"
                onClick={handleVerify}
                disabled={!isCodeComplete || isLoading}
                fullWidth
              >
                {isLoading ? "Verifying..." : "Continue"}
              </Button>

              <Button
                variant="secondary"
                onClick={handleResendEmail}
                disabled={isResending || isLoading}
                fullWidth
              >
                {isResending ? "Sending..." : "Resend Email"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
