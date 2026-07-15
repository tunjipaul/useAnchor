import { ApiError } from "./api";

/**
 * Error categories for consistent handling across the app.
 * Used internally to map errors to appropriate user messages.
 */
export type ErrorCategory =
  | "validation"      // User input validation failed
  | "auth"            // Authentication or authorization failed
  | "network"         // Network connectivity issue
  | "server"          // Server error (5xx)
  | "client"          // Client error (4xx, but not auth)
  | "timeout"         // Request timeout
  | "parse"           // Response parsing error
  | "unknown";        // Unknown error

/**
 * Structured error context for internal logging and debugging.
 * Never displayed directly to users.
 */
export interface ErrorContext {
  category: ErrorCategory;
  originalError: unknown;
  apiError?: ApiError;
  endpoint?: string;
  statusCode?: number;
  isDevelopment: boolean;
  timestamp: Date;
}

/**
 * Categorizes errors for intelligent routing to appropriate user messages.
 * Maps API errors, validation errors, network issues, etc. to categories.
 */
function categorizeError(error: unknown): ErrorCategory {
  if (error instanceof ApiError) {
    // Network and CORS errors
    if (error.type === "network" || error.type === "cors") {
      return "network";
    }

    // HTTP status codes
    if (error.status !== undefined) {
      if (error.status === 401 || error.status === 403) return "auth";
      if (error.status >= 500) return "server";
      if (error.status >= 400) return "client";
    }

    // Specific error types
    if (error.type === "parse") return "parse";

    return "unknown";
  }

  if (error instanceof Error) {
    if (error.message.includes("timeout") || error.message.includes("abort"))
      return "timeout";
    if (error.message.includes("Network") || error.message.includes("fetch"))
      return "network";
  }

  return "unknown";
}

/**
 * Extracts validation errors from API response details.
 * Used to provide field-specific feedback to users.
 */
function extractValidationDetails(
  detail: unknown
): Record<string, string> | null {
  if (!Array.isArray(detail)) return null;

  const validationMap: Record<string, string> = {};

  for (const item of detail) {
    if (
      typeof item === "object" &&
      item !== null &&
      "msg" in item &&
      "loc" in item
    ) {
      const msg = (item as any).msg;
      const loc = (item as any).loc as unknown[];
      if (typeof msg === "string" && Array.isArray(loc) && loc.length > 0) {
        const field = String(loc[loc.length - 1]);
        validationMap[field] = msg;
      }
    }
  }

  return Object.keys(validationMap).length > 0 ? validationMap : null;
}

/**
 * Determines if an error should display detailed information to the user.
 * In production, most errors show generic messages.
 * In development, more details are shown.
 */
function shouldShowDetailedMessage(category: ErrorCategory): boolean {
  const isDev = import.meta.env.DEV;

  // In development, show more details for debugging
  if (isDev) return true;

  // In production, only show detailed messages for validation and auth errors
  return category === "validation" || category === "auth";
}

/**
 * Maps error categories to generic, user-friendly messages.
 * Never contains technical jargon, implementation details, or sensitive info.
 */
function getCategoryUserMessage(category: ErrorCategory): string {
  switch (category) {
    case "validation":
      return "Please check your input and try again.";
    case "auth":
      return "Your session has expired or you don't have permission for this action. Please sign in.";
    case "network":
      return "Unable to connect. Please check your internet connection and try again.";
    case "server":
      return "The server is temporarily unavailable. Please try again in a moment.";
    case "client":
      return "This action couldn't be completed. Please try again.";
    case "timeout":
      return "The request took too long. Please check your connection and try again.";
    case "parse":
      return "An unexpected response was received. Please try again.";
    case "unknown":
    default:
      return "Something went wrong. Please try again.";
  }
}

/**
 * Detects specific, recoverable error patterns and returns context-aware messages.
 * Maps known backend validation errors to helpful user messages.
 * Only used when detailed messages are appropriate.
 */
function getSpecificUserMessage(
  error: ApiError,
  category: ErrorCategory
): string | null {
  if (!error.detail) return null;

  const detail =
    typeof error.detail === "string"
      ? error.detail
      : JSON.stringify(error.detail);

  // Authentication errors
  if (category === "auth") {
    if (detail.includes("expired") || detail.includes("revoked")) {
      return "Your session has expired. Please sign in again.";
    }
    if (detail.includes("invalid") || detail.includes("invalid_token")) {
      return "Your authentication credentials are invalid. Please sign in again.";
    }
    if (detail.includes("unauthorized")) {
      return "You don't have permission for this action.";
    }
    return null; // Fall back to generic auth message
  }

  // Validation errors - extract specific field issues
  if (category === "validation" && Array.isArray(error.detail)) {
    const validationErrors = extractValidationDetails(error.detail);
    if (validationErrors) {
      // Map known backend field names to user-friendly messages
      const userMessages: string[] = [];

      for (const [field, msg] of Object.entries(validationErrors)) {
        if (field.includes("phone")) {
          userMessages.push("Please enter a valid phone number (e.g., +234... or +1...).");
        } else if (field.includes("email")) {
          userMessages.push("Please enter a valid email address.");
        } else if (field.includes("password")) {
          userMessages.push("Password must be at least 8 characters.");
        } else if (field.includes("name")) {
          userMessages.push("Name must be at least 2 characters.");
        } else if (field.includes("code") || field.includes("token")) {
          if (msg.includes("expired")) {
            userMessages.push("This code has expired. Please request a new one.");
          } else {
            userMessages.push("Invalid code. Please check and try again.");
          }
        } else if (field.includes("session")) {
          if (msg.includes("already")) {
            userMessages.push(
              "You already have an active session. Please complete or end it first."
            );
          }
        } else if (field.includes("contact") || field.includes("duplicate")) {
          userMessages.push("This contact is already added.");
        } else {
          // For unknown field, use the backend message only if it's generic enough
          if (!msg.includes("database") && !msg.includes("constraint")) {
            userMessages.push(msg);
          }
        }
      }

      return userMessages.length > 0 ? userMessages.join(" ") : null;
    }
  }

  // Rate limiting
  if (category === "client" && error.status === 429) {
    return "Too many requests. Please wait a moment and try again.";
  }

  // Duplicate/conflict errors
  if (category === "client" && error.status === 409) {
    if (detail.includes("session")) {
      return "You already have an active session in progress.";
    }
    if (detail.includes("contact")) {
      return "This contact is already in your trusted circle.";
    }
    if (detail.includes("phone")) {
      return "This phone number is already registered.";
    }
    return "This item already exists.";
  }

  return null;
}

/**
 * Creates a detailed error context for development/debugging.
 * Logs full technical information to console in development mode only.
 */
function createErrorContext(
  error: unknown,
  category: ErrorCategory
): ErrorContext {
  const context: ErrorContext = {
    category,
    originalError: error,
    isDevelopment: import.meta.env.DEV,
    timestamp: new Date(),
  };

  if (error instanceof ApiError) {
    context.apiError = error;
    context.endpoint = error.endpoint;
    context.statusCode = error.status;
  }

  return context;
}

/**
 * Development-only logging for detailed error debugging.
 * Never called in production builds.
 */
function logErrorInDevelopment(context: ErrorContext): void {
  if (!import.meta.env.DEV) return;

  const timestamp = context.timestamp.toISOString();
  const prefix = `[useAnchor Error] ${timestamp}`;

  console.group(`${prefix} ${context.category.toUpperCase()}`);
  console.log("Category:", context.category);
  console.log("Endpoint:", context.endpoint || "N/A");
  console.log("Status:", context.statusCode || "N/A");

  if (context.apiError) {
    console.log("API Error Details:", {
      type: context.apiError.type,
      message: context.apiError.message,
      url: context.apiError.url,
      detail: context.apiError.detail,
      failedUrls: context.apiError.failedUrls,
      isFailoverExhausted: context.apiError.isFailoverExhausted,
    });
  }

  if (context.originalError instanceof Error) {
    console.log("Stack Trace:", context.originalError.stack);
  }

  console.log("Full Error Object:", context.originalError);
  console.groupEnd();
}

/**
 * Main error handler: Maps any error to a user-friendly message.
 * 
 * In PRODUCTION:
 * - Displays generic, non-technical messages
 * - Never shows sensitive details (stack traces, database errors, endpoints)
 * - Distinguishes between error types for context
 * 
 * In DEVELOPMENT:
 * - Shows detailed technical information in console
 * - Helps with debugging
 * 
 * @param error - The error to handle
 * @returns User-friendly error message safe to display in UI
 */
export function handleError(error: unknown): string {
  // Categorize the error
  const category = categorizeError(error);

  // Create error context for logging
  const errorContext = createErrorContext(error, category);

  // Log full details in development only
  logErrorInDevelopment(errorContext);

  // Determine if we should show detailed information
  const showDetailed = shouldShowDetailedMessage(category);

  // Try to get a specific, context-aware message
  let userMessage = null;
  if (showDetailed && error instanceof ApiError) {
    userMessage = getSpecificUserMessage(error, category);
  }

  // Fall back to category-based message
  if (!userMessage) {
    userMessage = getCategoryUserMessage(category);
  }

  return userMessage;
}

/**
 * Backward-compatible error handler for existing code.
 * Maps to the new centralized error handling system.
 * 
 * @deprecated Use handleError() instead for new code
 */
export function getFriendlyErrorMessage(
  error: unknown,
  fallback: string
): string {
  const message = handleError(error);
  return message || fallback;
}

/**
 * Full technical detail for console / dev UI.
 * Only use this in development environments for debugging.
 * 
 * @deprecated Use console logging in development instead
 */
export function getErrorDebugInfo(error: unknown): string {
  if (error instanceof ApiError) {
    const parts = [
      `[${error.type.toUpperCase()}]`,
      error.message,
      error.status ? `status=${error.status}` : null,
      `url=${error.url}`,
    ].filter(Boolean);
    return parts.join(" | ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * Extracts field-level validation errors for form-specific handling.
 * Useful for highlighting specific form fields with errors.
 * 
 * @param error - The error that may contain validation details
 * @returns Map of field names to user-friendly error messages, or null
 */
export function getValidationErrors(
  error: unknown
): Record<string, string> | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status !== 422 && error.status !== 400) return null;
  if (!Array.isArray(error.detail)) return null;

  return extractValidationDetails(error.detail);
}
