const mongoose = require("mongoose");
const { applicationStatuses } = require("../config/constants");

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: applicationStatuses,
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
    },
    changedByRole: {
      type: String,
      enum: ["student", "counselor", "admin"],
      default: "student",
    },
    note: {
      type: String,
      default: "",
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const applicationTimelineSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: applicationStatuses,
      required: true,
    },
    note: String,
    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const applicationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    program: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Program",
      required: true,
      index: true,
    },
    university: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "University",
      required: true,
    },
    destinationCountry: {
      type: String,
      required: true,
      index: true,
    },
    intake: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: applicationStatuses,
      default: "submitted",
      index: true,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
    timeline: {
      type: [applicationTimelineSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

applicationSchema.index({ student: 1, program: 1, intake: 1 }, { unique: true });
applicationSchema.index({ student: 1, status: 1 });
applicationSchema.index({ status: 1, createdAt: -1 });
applicationSchema.index({ destinationCountry: 1, status: 1 });

module.exports = mongoose.model("Application", applicationSchema);
