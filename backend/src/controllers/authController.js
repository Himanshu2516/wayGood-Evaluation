const jwt = require("jsonwebtoken");

const env = require("../config/env");
const Student = require("../models/Student");
const cacheService = require("../services/cacheService");
const asyncHandler = require("../utils/asyncHandler");
const HttpError = require("../utils/httpError");

function generateToken(user) {
  return jwt.sign(
    {
      sub: user._id,
      email: user.email,
      role: user.role,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

function sanitizeUser(userDoc) {
  const user = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  delete user.password;
  return user;
}

const register = asyncHandler(async (req, res) => {
  const {
    fullName,
    email,
    password,
    role = "student",
    preferredCountries = [],
    budget = 0,
    fieldOfStudy = [],
    intake = "",
    ieltsScore = 0,
  } = req.body;

  const existingStudent = await Student.findOne({ email: email.toLowerCase() });
  if (existingStudent) {
    throw new HttpError(409, "An account with this email already exists.");
  }

  const student = new Student({
    fullName: fullName.trim(),
    email: email.toLowerCase().trim(),
    password,
    role,
    preferredCountries,
    budget,
    fieldOfStudy: Array.isArray(fieldOfStudy) ? fieldOfStudy : (fieldOfStudy ? [fieldOfStudy] : []),
    intake,
    ieltsScore,
  });

  await student.save();

  const token = generateToken(student);

  res.status(201).json({
    success: true,
    message: "User registered successfully.",
    data: {
      user: sanitizeUser(student),
      token,
    },
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const student = await Student.findOne({ email: email.toLowerCase().trim() }).select("+password");

  if (!student) {
    throw new HttpError(401, "Invalid email or password.");
  }

  const isMatch = await student.comparePassword(password);
  if (!isMatch) {
    throw new HttpError(401, "Invalid email or password.");
  }

  const token = generateToken(student);

  res.json({
    success: true,
    message: "Login successful.",
    data: {
      user: sanitizeUser(student),
      token,
    },
  });
});

const getProfile = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: "Profile retrieved successfully.",
    data: sanitizeUser(req.user),
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user._id);

  if (!student) {
    throw new HttpError(404, "User not found.");
  }

  const {
    fullName,
    preferredCountries,
    budget,
    fieldOfStudy,
    intake,
    ieltsScore,
    targetCountries,
    maxBudgetUsd,
    interestedFields,
    preferredIntake,
    role,
    password,
  } = req.body;

  if (fullName !== undefined) student.fullName = fullName.trim();
  if (role !== undefined) student.role = role;

  if (preferredCountries !== undefined) {
    student.preferredCountries = preferredCountries;
    student.targetCountries = preferredCountries;
  } else if (targetCountries !== undefined) {
    student.targetCountries = targetCountries;
    student.preferredCountries = targetCountries;
  }

  if (budget !== undefined) {
    student.budget = budget;
    student.maxBudgetUsd = budget;
  } else if (maxBudgetUsd !== undefined) {
    student.maxBudgetUsd = maxBudgetUsd;
    student.budget = maxBudgetUsd;
  }

  if (fieldOfStudy !== undefined) {
    const fields = Array.isArray(fieldOfStudy) ? fieldOfStudy : [fieldOfStudy];
    student.fieldOfStudy = fields;
    student.interestedFields = fields;
  } else if (interestedFields !== undefined) {
    student.interestedFields = interestedFields;
    student.fieldOfStudy = interestedFields;
  }

  if (intake !== undefined) {
    student.intake = intake;
    student.preferredIntake = intake;
  } else if (preferredIntake !== undefined) {
    student.preferredIntake = preferredIntake;
    student.intake = preferredIntake;
  }

  if (ieltsScore !== undefined) {
    student.ieltsScore = ieltsScore;
    if (!student.englishTest) student.englishTest = { exam: "IELTS", score: 0 };
    student.englishTest.score = ieltsScore;
  }

  if (req.body.phone !== undefined) {
    student.phone = String(req.body.phone).trim();
  }

  if (req.body.currentEducation !== undefined) {
    student.currentEducation = String(req.body.currentEducation).trim();
  }

  if (req.body.gpa !== undefined) {
    student.gpa = String(req.body.gpa).trim();
  }

  if (password && typeof password === "string" && password.length >= 8) {
    student.password = password;
  }

  await student.save();

  await cacheService.deletePattern(`recommendations:${student._id}:*`);
  await cacheService.deletePattern(`ai:*:${student._id}:*`);
  await cacheService.delete("dashboard:overview");

  res.json({
    success: true,
    message: "Profile updated successfully.",
    data: sanitizeUser(student),
  });
});

const uploadDocument = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user._id);

  if (!student) {
    throw new HttpError(404, "User not found.");
  }

  const {
    title,
    documentType = "other",
    fileName,
    fileSize = 0,
    mimeType = "application/pdf",
    fileData = "",
    notes = "",
  } = req.body;

  if (!title || !title.trim()) {
    throw new HttpError(400, "Document title is required.");
  }

  if (!fileName || !fileName.trim()) {
    throw new HttpError(400, "File name is required.");
  }

  const newDoc = {
    title: title.trim(),
    documentType,
    fileName: fileName.trim(),
    fileSize: Number(fileSize) || 0,
    mimeType: mimeType || "application/pdf",
    fileData: fileData || "",
    notes: (notes || "").trim(),
    status: "uploaded",
    uploadedAt: new Date(),
  };

  if (!Array.isArray(student.documents)) {
    student.documents = [];
  }

  student.documents.push(newDoc);
  await student.save();

  res.status(201).json({
    success: true,
    message: "Document uploaded successfully.",
    data: sanitizeUser(student),
  });
});

const deleteDocument = asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  const student = await Student.findById(req.user._id);

  if (!student) {
    throw new HttpError(404, "User not found.");
  }

  const prevCount = (student.documents || []).length;
  student.documents = (student.documents || []).filter(
    (doc) => doc._id && doc._id.toString() !== documentId
  );

  if (student.documents.length === prevCount) {
    throw new HttpError(404, "Document not found.");
  }

  await student.save();

  res.json({
    success: true,
    message: "Document deleted successfully.",
    data: sanitizeUser(student),
  });
});

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  uploadDocument,
  deleteDocument,
  me: getProfile,
};
