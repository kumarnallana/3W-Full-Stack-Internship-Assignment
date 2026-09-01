import multer from "multer";

export function notFound(request, response) {
  response.status(404).json({ message: `Route not found: ${request.method} ${request.path}` });
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) return next(error);

  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "Keep the image under 5 MB."
      : "The selected image could not be processed.";
    return response.status(422).json({ message });
  }

  if (error?.code === 11000) {
    return response.status(409).json({
      message: "An account with this email already exists.",
      fieldErrors: { email: "This email is already registered." },
    });
  }

  if (error?.name === "ValidationError") {
    const fieldErrors = Object.fromEntries(
      Object.entries(error.errors || {}).map(([field, value]) => [field, value.message]),
    );
    return response.status(422).json({ message: "Please correct the submitted information.", fieldErrors });
  }

  const status = Number(error?.status) || 500;
  const isServerError = status >= 500;
  if (isServerError) console.error(error);

  return response.status(status).json({
    message: isServerError ? "Something went wrong on the server." : error.message,
    ...(error?.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
  });
}
