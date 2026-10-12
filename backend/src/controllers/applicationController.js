const mongoose = require("mongoose");
const Application = require("../models/Application");
const Program = require("../models/Program");
const { validStatusTransitions, applicationStatuses } = require("../config/constants");
const cacheService = require("../services/cacheService");
const asyncHandler = require("../utils/asyncHandler");
const HttpError = require("../utils/httpError");

const listApplications = asyncHandler(async (req, res) => {
  const { studentId, status } = req.query;
  const filters = {};

  if (req.user.role === "student") {
    filters.student = req.user._id;
  } else if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
    filters.student = studentId;
  }

  if (status && applicationStatuses.includes(status)) {
    filters.status = status;
  }

  const applications = await Application.find(filters)
    .populate("student", "fullName email role targetCountries preferredCountries")
    .populate("program", "title degreeLevel tuitionFeeUsd minimumIelts intakes")
    .populate("university", "name country city qsRanking popularScore")
    .populate("statusHistory.changedBy", "fullName email role")
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    success: true,
    message: "Applications retrieved successfully.",
    data: applications,
    meta: {
      count: applications.length,
    },
  });
});

const getApplicationById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new HttpError(400, "Invalid application ID format.");
  }

  const application = await Application.findById(id)
    .populate("student", "fullName email role")
    .populate("program", "title degreeLevel tuitionFeeUsd minimumIelts intakes")
    .populate("university", "name country city qsRanking popularScore")
    .populate("statusHistory.changedBy", "fullName email role");

  if (!application) {
    throw new HttpError(404, "Application not found.");
  }

  if (req.user.role === "student" && !application.student._id.equals(req.user._id)) {
    throw new HttpError(403, "Forbidden: You do not have permission to view this application.");
  }

  res.json({
    success: true,
    message: "Application retrieved successfully.",
    data: application,
  });
});

const createApplication = asyncHandler(async (req, res) => {
  const { programId, program: altProgramId, intake, note } = req.body;
  const targetProgramId = programId || altProgramId;

  if (!targetProgramId || !mongoose.Types.ObjectId.isValid(targetProgramId)) {
    throw new HttpError(400, "A valid programId is required.");
  }

  if (!intake || typeof intake !== "string" || !intake.trim()) {
    throw new HttpError(400, "intake is required (e.g. 'September', 'January').");
  }

  const studentId =
    req.user.role === "student"
      ? req.user._id
      : req.body.studentId && mongoose.Types.ObjectId.isValid(req.body.studentId)
      ? req.body.studentId
      : req.user._id;

  const program = await Program.findById(targetProgramId);
  if (!program) {
    throw new HttpError(404, "Target program not found.");
  }

  const normalizedIntake = intake.trim();

  const existingApplication = await Application.findOne({
    student: studentId,
    program: program._id,
    intake: normalizedIntake,
  });

  if (existingApplication) {
    throw new HttpError(
      409,
      `Duplicate application: You have already submitted an application for '${program.title}' for the ${normalizedIntake} intake.`
    );
  }

  try {
    const initialNote = note || "Application submitted.";
    const application = new Application({
      student: studentId,
      program: program._id,
      university: program.university,
      destinationCountry: program.country,
      intake: normalizedIntake,
      status: "submitted",
      statusHistory: [
        {
          status: "submitted",
          changedBy: req.user._id,
          changedByRole: req.user.role,
          note: initialNote,
          changedAt: new Date(),
        },
      ],
      timeline: [
        {
          status: "submitted",
          note: initialNote,
          changedAt: new Date(),
        },
      ],
    });

    await application.save();
    await cacheService.delete("dashboard:overview");

    const populatedApplication = await Application.findById(application._id)
      .populate("student", "fullName email role")
      .populate("program", "title degreeLevel tuitionFeeUsd")
      .populate("university", "name country city");

    res.status(201).json({
      success: true,
      message: "Application submitted successfully.",
      data: populatedApplication,
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new HttpError(
        409,
        `Duplicate application: You have already submitted an application for this program and intake.`
      );
    }
    throw error;
  }
});

const updateApplicationStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new HttpError(400, "Invalid application ID format.");
  }

  if (!status || !applicationStatuses.includes(status)) {
    throw new HttpError(
      400,
      `Invalid status '${status}'. Allowed statuses: ${applicationStatuses.join(", ")}`
    );
  }

  const application = await Application.findById(id);
  if (!application) {
    throw new HttpError(404, "Application not found.");
  }

  if (req.user.role === "student") {
    if (!application.student.equals(req.user._id)) {
      throw new HttpError(403, "Forbidden: You can only update your own applications.");
    }

    if (status !== "withdrawn") {
      throw new HttpError(
        403,
        "Forbidden: Students can only withdraw their application. Status advancements must be performed by a counselor or admin."
      );
    }
  } else if (!["counselor", "admin"].includes(req.user.role)) {
    throw new HttpError(
      403,
      "Forbidden: Status advancements must be performed by a counselor or admin."
    );
  }

  const allowedNextStatuses = validStatusTransitions[application.status] || [];
  if (!allowedNextStatuses.includes(status)) {
    throw new HttpError(
      400,
      `Invalid status transition from '${application.status}' to '${status}'. Allowed next states: ${
        allowedNextStatuses.length > 0 ? allowedNextStatuses.join(", ") : "None (terminal state)"
      }`
    );
  }

  const previousStatus = application.status;
  const historyNote = note || `Status transitioned from ${previousStatus} to ${status}.`;

  application.status = status;
  application.statusHistory.push({
    status,
    changedBy: req.user._id,
    changedByRole: req.user.role,
    note: historyNote,
    changedAt: new Date(),
  });
  application.timeline.push({
    status,
    note: historyNote,
    changedAt: new Date(),
  });

  await application.save();
  await cacheService.delete("dashboard:overview");

  const updated = await Application.findById(application._id)
    .populate("student", "fullName email role")
    .populate("program", "title degreeLevel tuitionFeeUsd")
    .populate("university", "name country city")
    .populate("statusHistory.changedBy", "fullName email role");

  res.json({
    success: true,
    message: `Application status transitioned from '${previousStatus}' to '${status}'.`,
    data: updated,
  });
});

const withdrawApplication = (req, res, next) => {
  req.body = req.body || {};
  req.body.status = "withdrawn";
  if (!req.body.note) req.body.note = "Application withdrawn by candidate.";
  return updateApplicationStatus(req, res, next);
};

module.exports = {
  listApplications,
  getApplicationById,
  createApplication,
  updateApplicationStatus,
  withdrawApplication,
};
