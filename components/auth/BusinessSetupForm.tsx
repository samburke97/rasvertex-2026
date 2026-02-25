// components/auth/BusinessSetupForm.tsx - Updated with reCAPTCHA v3
"use client";

import { useState, useMemo, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import Image from "next/image";
import ActionHeader from "@/components/layouts/headers/ActionHeader";
import TitleDescription from "@/components/ui/TitleDescription";
import TextInput from "@/components/ui/TextInput";
import Button from "@/components/ui/Button";
import PhoneInput from "@/components/ui/PhoneInput";
import styles from "./BusinessSetupForm.module.css";

interface BusinessSetupFormProps {
  email: string;
  onSetupComplete: () => void;
  isOAuth?: boolean;
}

interface FormData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  countryCode: string;
  mobile: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  countryCode?: string;
  mobile?: string;
  password?: string;
  confirmPassword?: string;
  recaptcha?: string;
  terms?: string;
}

export default function BusinessSetupForm({
  email,
  onSetupComplete,
  isOAuth = false,
}: BusinessSetupFormProps) {
  const { data: session, update } = useSession();
  const router = useRouter();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",

    dateOfBirth: "",
    countryCode: "",
    mobile: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const isOAuthUser = isOAuth;

  // Get reCAPTCHA token
  const getReCaptchaToken = async (action: string): Promise<string | null> => {
    if (!executeRecaptcha) {
      return null;
    }

    try {
      const token = await executeRecaptcha(action);
      return token;
    } catch (error) {
      console.error("reCAPTCHA execution failed:", error);
      return null;
    }
  };

  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);

    return () => {
      window.removeEventListener("resize", checkScreenSize);
    };
  }, []);

  // Keep only this useEffect for pre-populating OAuth data:
  useEffect(() => {
    if (isOAuth && session?.user) {
      const nameParts = session.user.name?.split(" ") || [];
      setFormData((prev) => ({
        ...prev,
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
      }));
    }
  }, [isOAuth, session]);

  const handleHeaderContinue = () => {
    handleSubmit();
  };

  const handleBack = () => {
    // Always go back to login during setup phase
    router.push("/login");
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleCountryCodeChange = (value: string) => {
    setFormData((prev) => ({ ...prev, countryCode: value }));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "Please enter your first name";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Please enter your last name";
    }

    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = "Date of birth is required";
    } else {
      const birthDate = new Date(formData.dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      if (
        age < 13 ||
        (age === 13 && monthDiff < 0) ||
        (age === 13 && monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        newErrors.dateOfBirth = "You must be at least 13 years old";
      }
    }

    if (!formData.mobile.trim()) {
      newErrors.mobile = "Mobile number is required";
    } else if (!/^\d{8,15}$/.test(formData.mobile.replace(/\s/g, ""))) {
      newErrors.mobile = "Please enter a valid mobile number";
    }

    if (!isOAuthUser) {
      if (!formData.password) {
        newErrors.password = "Password is required";
      } else if (formData.password.length < 8) {
        newErrors.password = "Password must be at least 8 characters";
      } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
        newErrors.password =
          "Password must contain at least one uppercase letter, one lowercase letter, and one number";
      }

      if (!formData.confirmPassword) {
        newErrors.confirmPassword = "Please confirm your password";
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }
    }

    if (!agreedToTerms) {
      newErrors.terms =
        "Please agree to the Terms of Service and Privacy Policy";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      // Generate reCAPTCHA token for account creation
      const recaptchaToken = await getReCaptchaToken(
        "business_account_creation"
      );

      if (!recaptchaToken) {
        setErrors({
          recaptcha: "reCAPTCHA verification failed. Please try again.",
        });
        setIsLoading(false);
        return;
      }

      const endpoint = isOAuthUser
        ? "/api/user/activate-profile"
        : "/api/auth/create-business-account";

      const payload = isOAuthUser
        ? {
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            dateOfBirth: formData.dateOfBirth,
            fullMobile: `${formData.countryCode} ${formData.mobile.trim()}`,
            recaptchaToken,
          }
        : {
            email,
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            dateOfBirth: formData.dateOfBirth,
            fullMobile: `${formData.countryCode} ${formData.mobile.trim()}`,
            password: formData.password,
            recaptchaToken,
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to complete setup");
      }

      if (isOAuthUser) {
        // CRITICAL FIX: Update the session after successful activation
        if (data.shouldUpdateSession) {
          try {
            await update(); // This refreshes the JWT token with latest user data

            // Small delay to ensure session is fully updated
            await new Promise((resolve) => setTimeout(resolve, 100));
          } catch (updateError) {
            // Continue anyway - the middleware will handle stale tokens
          }
        }

        onSetupComplete();
      } else {
        window.location.href = `/signup/verify-email?email=${encodeURIComponent(email)}`;
      }
    } catch (error) {
      if (error instanceof Error) {
        const errorMessage = error.message;

        // Handle specific error cases with better UX
        if (
          errorMessage.includes("USER_NOT_FOUND") ||
          errorMessage.includes("Session expired")
        ) {
          // Redirect to login after a short delay
          setTimeout(() => {
            window.location.href = "/login";
          }, 2000);
        } else if (
          errorMessage.includes("Email") ||
          errorMessage.includes("email")
        ) {
          setErrors({ firstName: errorMessage });
        } else if (
          errorMessage.includes("Password") ||
          errorMessage.includes("password")
        ) {
          setErrors({ password: errorMessage });
        } else if (
          errorMessage.includes("Mobile") ||
          errorMessage.includes("mobile")
        ) {
          setErrors({ mobile: errorMessage });
        } else if (
          errorMessage.includes("Date") ||
          errorMessage.includes("birth")
        ) {
          setErrors({ dateOfBirth: errorMessage });
        } else if (
          errorMessage.includes("reCAPTCHA") ||
          errorMessage.includes("captcha")
        ) {
          setErrors({ recaptcha: errorMessage });
        } else {
          setErrors({ password: errorMessage });
        }
      } else {
        setErrors({ password: "Something went wrong" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const hasBasicFields = useMemo(() => {
    const basicFields =
      formData.firstName.trim() &&
      formData.lastName.trim() &&
      formData.dateOfBirth &&
      formData.mobile.trim();

    if (isOAuthUser) {
      return basicFields && agreedToTerms;
    }

    return (
      basicFields &&
      formData.password &&
      formData.confirmPassword &&
      agreedToTerms
    );
  }, [formData, isOAuthUser, agreedToTerms]);

  const passwordRequirements = useMemo(() => {
    if (isOAuthUser || !formData.password) return null;

    const requirements = {
      length: formData.password.length >= 8,
      uppercase: /[A-Z]/.test(formData.password),
      lowercase: /[a-z]/.test(formData.password),
      number: /\d/.test(formData.password),
    };

    const allMet = Object.values(requirements).every(Boolean);
    return allMet ? null : requirements;
  }, [formData.password, isOAuthUser]);

  const getTitle = () => {
    if (isOAuthUser) {
      return "Complete Your Profile";
    }
    return "Create Business Account";
  };

  const getDescription = () => {
    if (isOAuthUser) {
      return "Just a few more details to complete your business account setup.";
    }
    return `Let's get you started! Please provide the following details to create your account for ${email}.`;
  };

  return (
    <div className={styles.container}>
      <ActionHeader
        secondaryAction={handleBack}
        primaryAction={isLargeScreen ? handleHeaderContinue : undefined}
        primaryLabel="Continue"
        secondaryLabel="Back"
        isProcessing={isLoading}
        processingLabel="Loading..."
        className={styles.header}
        constrained={false}
        variant="edit"
      />

      <div className={styles.content}>
        <div className={styles.formContainer}>
          <TitleDescription title={getTitle()} description={getDescription()} />

          <div className={styles.formFields}>
            <TextInput
              id="firstName"
              label="First Name"
              value={formData.firstName}
              onChange={(e) => handleInputChange("firstName", e.target.value)}
              placeholder="Enter your first name"
              error={errors.firstName}
              required
            />

            <TextInput
              id="lastName"
              label="Last Name"
              value={formData.lastName}
              onChange={(e) => handleInputChange("lastName", e.target.value)}
              placeholder="Enter your last name"
              error={errors.lastName}
              required
            />

            <TextInput
              id="dateOfBirth"
              label="Date of Birth"
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
              error={errors.dateOfBirth}
              placeholder="DD/MM/YYYY"
              required
            />

            <PhoneInput
              id="mobile"
              label="Mobile"
              value={formData.mobile}
              countryCode={formData.countryCode}
              onChange={(value) => handleInputChange("mobile", value)}
              onCountryChange={handleCountryCodeChange}
              placeholder="Enter your mobile number"
              error={errors.mobile}
              required
            />

            {!isOAuthUser && (
              <>
                <div className={styles.passwordField}>
                  <TextInput
                    id="password"
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) =>
                      handleInputChange("password", e.target.value)
                    }
                    placeholder="Enter Password"
                    error={errors.password}
                    required
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={styles.passwordToggle}
                      >
                        <Image
                          src={
                            showPassword
                              ? "/icons/utility-outline/shown.svg"
                              : "/icons/utility-outline/hidden.svg"
                          }
                          alt={showPassword ? "Hide password" : "Show password"}
                          width={20}
                          height={20}
                        />
                      </button>
                    }
                  />

                  {passwordRequirements && (
                    <div className={styles.passwordRequirements}>
                      <p>Password requirements:</p>
                      <ul>
                        <li
                          className={
                            passwordRequirements.length
                              ? styles.met
                              : styles.unmet
                          }
                        >
                          At least 8 characters
                        </li>
                        <li
                          className={
                            passwordRequirements.uppercase
                              ? styles.met
                              : styles.unmet
                          }
                        >
                          One uppercase letter
                        </li>
                        <li
                          className={
                            passwordRequirements.lowercase
                              ? styles.met
                              : styles.unmet
                          }
                        >
                          One lowercase letter
                        </li>
                        <li
                          className={
                            passwordRequirements.number
                              ? styles.met
                              : styles.unmet
                          }
                        >
                          One number
                        </li>
                      </ul>
                    </div>
                  )}
                </div>

                {/* ADD THIS NEW CONFIRM PASSWORD FIELD */}
                <div className={styles.passwordField}>
                  <TextInput
                    id="confirmPassword"
                    label="Confirm Password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      handleInputChange("confirmPassword", e.target.value)
                    }
                    placeholder="Confirm your password"
                    error={errors.confirmPassword}
                    required
                    rightIcon={
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className={styles.passwordToggle}
                      >
                        <Image
                          src={
                            showConfirmPassword
                              ? "/icons/utility-outline/shown.svg"
                              : "/icons/utility-outline/hidden.svg"
                          }
                          alt={
                            showConfirmPassword
                              ? "Hide password"
                              : "Show password"
                          }
                          width={20}
                          height={20}
                        />
                      </button>
                    }
                  />
                </div>
              </>
            )}
            <div className={styles.termsSection}>
              <div className={styles.checkboxContainer}>
                <input
                  type="checkbox"
                  id="agreedToTerms"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className={styles.checkbox}
                />
                <label htmlFor="agreedToTerms" className={styles.checkboxLabel}>
                  <span className={styles.checkmark}>
                    {agreedToTerms && (
                      <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                        <path
                          d="M1 4.5L4 7.5L11 1"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <span className={styles.agreementText}>
                    I agree to the{" "}
                    <a
                      href="/privacy-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.legalLink}
                    >
                      Privacy Policy
                    </a>
                    ,{" "}
                    <a
                      href="/terms-of-service"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.legalLink}
                    >
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a
                      href="/terms-of-business"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.legalLink}
                    >
                      Terms of Business
                    </a>
                    .
                  </span>
                </label>
              </div>

              {/* Terms error with red asterisk */}
              {errors.terms && (
                <div className={styles.errorText}>
                  <span style={{ color: "#ef4444" }}>*</span> {errors.terms}
                </div>
              )}
            </div>

            {/* Show reCAPTCHA error if any */}
            {errors.recaptcha && (
              <div className={styles.errorText}>{errors.recaptcha}</div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile continue button - fixed at bottom */}
      {!isLargeScreen && (
        <div className={styles.mobileButtonContainer}>
          <Button
            variant="primary-green"
            onClick={handleSubmit}
            disabled={isLoading || !hasBasicFields}
            fullWidth
          >
            {isLoading
              ? isOAuthUser
                ? "Completing Setup..."
                : "Creating Account..."
              : "Continue"}
          </Button>
        </div>
      )}
    </div>
  );
}
