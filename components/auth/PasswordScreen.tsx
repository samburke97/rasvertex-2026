"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { signIn, getSession } from "next-auth/react";
import Image from "next/image";
import AuthLayout from "@/components/layouts/AuthLayout";
import TitleDescription from "@/components/ui/TitleDescription";
import TextInput from "@/components/ui/TextInput";
import Button from "@/components/ui/Button";
import styles from "./PasswordScreen.module.css";

interface PasswordScreenProps {
  email: string;
  userName?: string;
  isNewUser: boolean;
  onPasswordComplete: () => void;
}

export default function PasswordScreen({
  email,
  userName,
  isNewUser,
  onPasswordComplete,
}: PasswordScreenProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<
    string | null
  >(null);

  const handleBack = () => {
    router.back();
  };

  const validatePassword = () => {
    let isValid = true;

    if (!password) {
      setPasswordError("Password is required");
      isValid = false;
    } else if (isNewUser) {
      // Enhanced validation for new users
      if (password.length < 12) {
        setPasswordError("Password must be at least 12 characters");
        isValid = false;
      } else if (!/(?=.*[a-z])/.test(password)) {
        setPasswordError("Password must contain at least one lowercase letter");
        isValid = false;
      } else if (!/(?=.*[A-Z])/.test(password)) {
        setPasswordError("Password must contain at least one uppercase letter");
        isValid = false;
      } else if (!/(?=.*\d)/.test(password)) {
        setPasswordError("Password must contain at least one number");
        isValid = false;
      } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        setPasswordError(
          "Password must contain at least one special character"
        );
        isValid = false;
      } else {
        setPasswordError(null);
      }
    } else {
      setPasswordError(null);
    }

    // Validate confirm password for new users
    if (isNewUser) {
      if (!confirmPassword) {
        setConfirmPasswordError("Please confirm your password");
        isValid = false;
      } else if (password !== confirmPassword) {
        setConfirmPasswordError("Passwords do not match");
        isValid = false;
      } else {
        setConfirmPasswordError(null);
      }
    }

    return isValid;
  };

  const handleSubmit = async () => {
    if (!validatePassword()) {
      return;
    }

    setIsLoading(true);

    try {
      const continueBusinessSetup =
        searchParams.get("continue_business_setup") === "true";

      if (isNewUser) {
        // Generate reCAPTCHA token for password setup
        if (!executeRecaptcha) {
          setPasswordError(
            "Security verification not available. Please try again."
          );
          setIsLoading(false);
          return;
        }

        const recaptchaToken = await executeRecaptcha("set_password");

        if (!recaptchaToken) {
          setPasswordError("Security verification failed. Please try again.");
          setIsLoading(false);
          return;
        }

        // For new users, save the password and continue to setup
        const response = await fetch("/api/auth/set-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            email,
            password,
            recaptchaToken,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setPasswordError(data.message || "Failed to set password");
          return;
        }

        onPasswordComplete();
      } else {
        // For existing users, use credentials sign-in (no reCAPTCHA needed for login)
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (result?.error) {
          setPasswordError("Invalid password. Please try again.");
          return;
        }

        if (result?.ok) {
          await getSession();

          if (continueBusinessSetup) {
            window.location.href = "/business/onboarding";
          } else {
            window.location.href = "/";
          }
        }
      }
    } catch (error) {
      setPasswordError(
        error instanceof Error ? error.message : "Something went wrong"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    router.push(`/password/forgot?email=${encodeURIComponent(email)}`);
  };

  const getTitle = () => {
    if (isNewUser) {
      return "Set Your Password";
    }
    return userName ? `How have you been?` : "Welcome back!";
  };

  const getDescription = () => {
    if (isNewUser) {
      return "Create a secure password for your account.";
    }
    return `Please enter your password to sign in to ${email}.`;
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (passwordError) {
      setPasswordError(null);
    }
  };

  const handleConfirmPasswordChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setConfirmPassword(e.target.value);
    if (confirmPasswordError) {
      setConfirmPasswordError(null);
    }
  };

  const passwordIcon = showPassword ? (
    <Image
      src="/icons/utility-outline/shown.svg"
      alt="Hide password"
      width={20}
      height={20}
    />
  ) : (
    <Image
      src="/icons/utility-outline/hidden.svg"
      alt="Show password"
      width={20}
      height={20}
    />
  );

  return (
    <AuthLayout showBackButton={true} onBackClick={handleBack}>
      <div className={styles.formWrapper}>
        <TitleDescription title={getTitle()} description={getDescription()} />

        <div className={styles.passwordForm}>
          <TextInput
            id="password"
            label="Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={handlePasswordChange}
            placeholder="Enter your password"
            error={passwordError}
            autoComplete={isNewUser ? "new-password" : "current-password"}
            rightIcon={
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={togglePasswordVisibility}
              >
                {passwordIcon}
              </button>
            }
            required
          />

          {isNewUser && (
            <TextInput
              id="confirmPassword"
              label="Confirm Password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              placeholder="Confirm your password"
              error={confirmPasswordError}
              autoComplete="new-password"
              rightIcon={
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={togglePasswordVisibility}
                >
                  {passwordIcon}
                </button>
              }
              required
            />
          )}
        </div>

        <Button
          variant="primary-green"
          onClick={handleSubmit}
          disabled={isLoading || !password || (isNewUser && !confirmPassword)}
          fullWidth
        >
          {isLoading
            ? isNewUser
              ? "Setting Password..."
              : "Signing In..."
            : isNewUser
              ? "Set Password"
              : "Sign In"}
        </Button>

        {!isNewUser && (
          <div className={styles.forgotPassword}>
            <button
              type="button"
              onClick={handleForgotPassword}
              className={styles.forgotPasswordLink}
            >
              Forgot your password?
            </button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
