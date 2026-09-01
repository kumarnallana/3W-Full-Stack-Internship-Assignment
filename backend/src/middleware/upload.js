import multer from "multer";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export const uploadPostImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
  fileFilter(request, file, callback) {
    if (!acceptedImageTypes.has(file.mimetype)) {
      const error = new Error("Choose a JPEG, PNG, or WebP image.");
      error.status = 422;
      callback(error);
      return;
    }
    callback(null, true);
  },
}).single("image");
