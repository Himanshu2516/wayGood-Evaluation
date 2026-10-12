const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    documentType: {
      type: String,
      enum: [
        "passport",
        "transcripts",
        "ielts_score_card",
        "statement_of_purpose",
        "letter_of_recommendation",
        "resume_cv",
        "financial_statement",
        "other",
      ],
      default: "other",
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    mimeType: {
      type: String,
      default: "application/pdf",
    },
    fileData: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["uploaded", "verified", "rejected", "needs_revision"],
      default: "uploaded",
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: true }
);

const studentSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: ["student", "counselor", "admin"],
      default: "student",
    },
    preferredCountries: {
      type: [String],
      default: [],
    },
    budget: {
      type: Number,
      default: 0,
    },
    fieldOfStudy: {
      type: [String],
      default: [],
    },
    intake: {
      type: String,
      default: "",
    },
    ieltsScore: {
      type: Number,
      default: 0,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    currentEducation: {
      type: String,
      default: "",
      trim: true,
    },
    gpa: {
      type: String,
      default: "",
      trim: true,
    },
    documents: {
      type: [documentSchema],
      default: [],
    },
    targetCountries: {
      type: [String],
      default: [],
    },
    interestedFields: {
      type: [String],
      default: [],
    },
    preferredIntake: {
      type: String,
      default: "",
    },
    maxBudgetUsd: {
      type: Number,
      default: 0,
    },
    englishTest: {
      exam: {
        type: String,
        default: "IELTS",
      },
      score: {
        type: Number,
        default: 0,
      },
    },
    profileComplete: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        return ret;
      },
    },
    toObject: {
      transform(doc, ret) {
        delete ret.password;
        return ret;
      },
    },
  }
);

studentSchema.pre("save", async function preSave(next) {
  if (this.preferredCountries && this.preferredCountries.length > 0 && (!this.targetCountries || this.targetCountries.length === 0)) {
    this.targetCountries = [...this.preferredCountries];
  } else if (this.targetCountries && this.targetCountries.length > 0 && (!this.preferredCountries || this.preferredCountries.length === 0)) {
    this.preferredCountries = [...this.targetCountries];
  }

  if (this.budget !== undefined && this.budget > 0 && (!this.maxBudgetUsd || this.maxBudgetUsd === 0)) {
    this.maxBudgetUsd = this.budget;
  } else if (this.maxBudgetUsd !== undefined && this.maxBudgetUsd > 0 && (!this.budget || this.budget === 0)) {
    this.budget = this.maxBudgetUsd;
  }

  if (this.fieldOfStudy && this.fieldOfStudy.length > 0 && (!this.interestedFields || this.interestedFields.length === 0)) {
    this.interestedFields = [...this.fieldOfStudy];
  } else if (this.interestedFields && this.interestedFields.length > 0 && (!this.fieldOfStudy || this.fieldOfStudy.length === 0)) {
    this.fieldOfStudy = [...this.interestedFields];
  }

  if (this.intake && !this.preferredIntake) {
    this.preferredIntake = this.intake;
  } else if (this.preferredIntake && !this.intake) {
    this.intake = this.preferredIntake;
  }

  if (this.ieltsScore !== undefined && this.ieltsScore > 0 && (!this.englishTest?.score || this.englishTest.score === 0)) {
    if (!this.englishTest) this.englishTest = { exam: "IELTS", score: 0 };
    this.englishTest.score = this.ieltsScore;
  } else if (this.englishTest?.score && (!this.ieltsScore || this.ieltsScore === 0)) {
    this.ieltsScore = this.englishTest.score;
  }

  if (
    this.fullName &&
    this.email &&
    (this.preferredCountries?.length > 0 || this.targetCountries?.length > 0) &&
    (this.budget > 0 || this.maxBudgetUsd > 0)
  ) {
    this.profileComplete = true;
  }

  if (!this.isModified("password")) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, 10);
  next();
});

studentSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("Student", studentSchema);
