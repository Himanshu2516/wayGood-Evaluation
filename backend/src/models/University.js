const mongoose = require("mongoose");

const universitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      index: true,
    },
    city: {
      type: String,
      required: true,
      index: true,
    },
    partnerType: {
      type: String,
      enum: ["direct", "recruitment-partner", "institution-partner"],
      default: "direct",
      index: true,
    },
    qsRanking: {
      type: Number,
      index: true,
    },
    scholarshipAvailable: {
      type: Boolean,
      default: false,
      index: true,
    },
    popularScore: {
      type: Number,
      default: 0,
      index: true,
    },
    tags: [String],
    websiteUrl: String,
  },
  {
    timestamps: true,
  }
);

universitySchema.index({ popularScore: -1, qsRanking: 1 });
universitySchema.index({ country: 1, scholarshipAvailable: 1 });
universitySchema.index({ name: "text", country: "text", city: "text" });

module.exports = mongoose.model("University", universitySchema);
