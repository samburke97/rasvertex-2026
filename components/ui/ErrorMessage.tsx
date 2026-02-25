"use client";

import React from "react";
import { AlertCircle, CheckCircle } from "lucide-react";

interface ErrorMessageProps {
  message: string;
  type?: "error" | "success";
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  type = "error",
}) => {
  const isSuccess = type === "success" || message.includes("Loaded");

  return (
    <div
      className={`mb-6 p-4 rounded-lg flex items-center gap-3 border shadow-sm ${
        isSuccess
          ? "bg-green-50 text-green-800 border-green-200"
          : "bg-red-50 text-red-800 border-red-200"
      }`}
    >
      {isSuccess ? (
        <CheckCircle className="w-5 h-5" />
      ) : (
        <AlertCircle className="w-5 h-5" />
      )}
      <span className="font-medium">{message}</span>
    </div>
  );
};

export default ErrorMessage;
