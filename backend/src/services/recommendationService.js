const mongoose = require("mongoose");
const Program = require("../models/Program");
const Student = require("../models/Student");
const HttpError = require("../utils/httpError");
const { escapeRegex } = require("../utils/queryHelper");


async function buildProgramRecommendations(studentId, options = {}) {
  if (!mongoose.Types.ObjectId.isValid(studentId)) {
    throw new HttpError(400, "Invalid student ID format.");
  }

  const student = await Student.findById(studentId).lean();
  if (!student) {
    throw new HttpError(404, "Student not found.");
  }

  const preferredCountries = (
    student.preferredCountries?.length ? student.preferredCountries : student.targetCountries
  ) || [];

  const targetFields = (
    student.fieldOfStudy?.length ? student.fieldOfStudy : student.interestedFields
  ) || [];

  const studentBudget = Number(student.budget || student.maxBudgetUsd || 0);
  const studentIntake = String(student.intake || student.preferredIntake || "").trim();
  const studentIelts = Number(student.ieltsScore || student.englishTest?.score || 0);

  const limit = Math.min(Math.max(Number(options.limit) || 5, 1), 20);

  const hasCountries = preferredCountries.length > 0;
  const countryMatchExpr = hasCountries
    ? { $in: ["$country", preferredCountries] }
    : false;

  const countryPointsExpr = {
    $cond: [countryMatchExpr, 35, 0],
  };

  const countryReasonExpr = {
    $cond: [
      countryMatchExpr,
      { $concat: ["Preferred study destination: ", "$country"] },
      null,
    ],
  };

  const hasFields = targetFields.length > 0;
  let fieldMatchExpr = false;
  if (hasFields) {
    const fieldOrConditions = targetFields.map((f) => ({
      $regexMatch: {
        input: "$field",
        regex: escapeRegex(f),
        options: "i",
      },
    }));
    fieldMatchExpr = fieldOrConditions.length === 1 ? fieldOrConditions[0] : { $or: fieldOrConditions };
  }

  const fieldPointsExpr = {
    $cond: [fieldMatchExpr, 30, 0],
  };

  const fieldReasonExpr = {
    $cond: [
      fieldMatchExpr,
      { $concat: ["Academic field alignment: ", "$field"] },
      null,
    ],
  };

  const hasBudget = studentBudget > 0;
  const budgetMatchExpr = hasBudget
    ? {
        $and: [
          { $gt: ["$tuitionFeeUsd", 0] },
          { $lte: ["$tuitionFeeUsd", studentBudget] },
        ],
      }
    : false;

  const budgetPointsExpr = {
    $cond: [budgetMatchExpr, 20, 0],
  };

  const budgetReasonExpr = {
    $cond: [
      budgetMatchExpr,
      {
        $concat: [
          "Within tuition budget ($",
          { $toString: "$tuitionFeeUsd" },
          " <= $",
          studentBudget.toString(),
          ")",
        ],
      },
      null,
    ],
  };

  const hasIntake = Boolean(studentIntake);
  const intakeMatchExpr = hasIntake
    ? {
        $gt: [
          {
            $size: {
              $filter: {
                input: "$intakes",
                as: "intk",
                cond: {
                  $regexMatch: {
                    input: "$$intk",
                    regex: `^${escapeRegex(studentIntake)}$`,
                    options: "i",
                  },
                },
              },
            },
          },
          0,
        ],
      }
    : false;

  const intakePointsExpr = {
    $cond: [intakeMatchExpr, 10, 0],
  };

  const intakeReasonExpr = {
    $cond: [
      intakeMatchExpr,
      `Preferred intake available: ${studentIntake}`,
      null,
    ],
  };

  const hasIelts = studentIelts > 0;
  const ieltsMatchExpr = hasIelts
    ? { $lte: ["$minimumIelts", studentIelts] }
    : false;

  const ieltsPointsExpr = {
    $cond: [ieltsMatchExpr, 5, 0],
  };

  const ieltsReasonExpr = {
    $cond: [
      ieltsMatchExpr,
      {
        $concat: [
          "IELTS score meets requirement (",
          studentIelts.toString(),
          " >= ",
          { $toString: "$minimumIelts" },
          ")",
        ],
      },
      null,
    ],
  };

  const hasAnyPreference = hasCountries || hasFields || hasBudget || hasIntake || hasIelts;

  const pipeline = [
    {
      $lookup: {
        from: "universities",
        localField: "university",
        foreignField: "_id",
        as: "universityDetails",
      },
    },

    {
      $unwind: {
        path: "$universityDetails",
        preserveNullAndEmptyArrays: true,
      },
    },

    {
      $addFields: {
        score: {
          $add: [
            countryPointsExpr,
            fieldPointsExpr,
            budgetPointsExpr,
            intakePointsExpr,
            ieltsPointsExpr,
          ],
        },
        rawReasons: [
          countryReasonExpr,
          fieldReasonExpr,
          budgetReasonExpr,
          intakeReasonExpr,
          ieltsReasonExpr,
        ],
      },
    },

    {
      $addFields: {
        matchReasons: {
          $filter: {
            input: "$rawReasons",
            as: "reason",
            cond: { $ne: ["$$reason", null] },
          },
        },
      },
    },

    ...(hasAnyPreference
      ? [
          {
            $match: {
              score: { $gt: 0 },
            },
          },
        ]
      : []),

    {
      $sort: {
        score: -1,
        tuitionFeeUsd: 1,
        "universityDetails.qsRanking": 1,
      },
    },

    {
      $limit: limit,
    },

    {
      $project: {
        _id: 1,
        title: 1,
        country: 1,
        city: 1,
        field: 1,
        degreeLevel: 1,
        tuitionFeeUsd: 1,
        intakes: 1,
        minimumIelts: 1,
        scholarshipAvailable: 1,
        stem: 1,
        score: 1,
        matchReasons: {
          $cond: [
            { $gt: [{ $size: "$matchReasons" }, 0] },
            "$matchReasons",
            ["Popular program worldwide"],
          ],
        },
        university: {
          _id: "$universityDetails._id",
          name: "$universityDetails.name",
          country: "$universityDetails.country",
          city: "$universityDetails.city",
          qsRanking: "$universityDetails.qsRanking",
          popularScore: "$universityDetails.popularScore",
          partnerType: "$universityDetails.partnerType",
        },
      },
    },
  ];

  const recommendations = await Program.aggregate(pipeline);

  return {
    student: {
      id: student._id,
      fullName: student.fullName,
      preferredCountries,
      budget: studentBudget,
      fieldOfStudy: targetFields,
      intake: studentIntake,
      ieltsScore: studentIelts,
      profileComplete: student.profileComplete,
    },
    scoringBreakdown: {
      countryWeight: 35,
      fieldWeight: 30,
      budgetWeight: 20,
      intakeWeight: 10,
      ieltsWeight: 5,
      maxPossibleScore: 100,
    },
    recommendations,
  };
}

module.exports = {
  buildProgramRecommendations,
};
