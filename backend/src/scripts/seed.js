const connectDatabase = require("../config/database");
const Application = require("../models/Application");
const Program = require("../models/Program");
const Student = require("../models/Student");
const University = require("../models/University");
const seedData = require("../data/seedData");
const logger = require("../utils/logger");

async function seedDatabase(options = {}) {
  const { force = false } = options;

  const universityCount = await University.countDocuments();
  const studentCount = await Student.countDocuments();

  if (!force && universityCount > 0 && studentCount > 0) {
    logger.info("Database already seeded. Skipping auto-seed.", {
      universities: universityCount,
      students: studentCount,
    });
    return {
      seeded: false,
      message: "Database already populated.",
      counts: { universities: universityCount, students: studentCount },
    };
  }

  logger.info("Seeding database...", { force });

  await Promise.all([
    Application.deleteMany({}),
    Program.deleteMany({}),
    Student.deleteMany({}),
    University.deleteMany({}),
  ]);

  const universities = await University.insertMany(seedData.universities);

  const universityByName = universities.reduce((accumulator, university) => {
    accumulator[university.name] = university;
    return accumulator;
  }, {});

  const programs = await Program.insertMany(
    seedData.programs.map((program) => ({
      ...program,
      university: universityByName[program.universityName]._id,
    }))
  );

  const programByTitle = programs.reduce((accumulator, program) => {
    accumulator[program.title] = program;
    return accumulator;
  }, {});

  const students = await Student.create(seedData.students);

  const studentByEmail = students.reduce((accumulator, student) => {
    accumulator[student.email] = student;
    return accumulator;
  }, {});

  const applications = seedData.applications.map((application) => {
    const student = studentByEmail[application.studentEmail];
    const program = programByTitle[application.programTitle];
    const university = universityByName[program.universityName];

    return {
      student: student._id,
      program: program._id,
      university: university._id,
      destinationCountry: program.country,
      intake: application.intake,
      status: application.status,
      timeline: application.timeline,
    };
  });

  await Application.insertMany(applications);

  logger.info("Seed completed successfully.", {
    universities: universities.length,
    programs: programs.length,
    students: students.length,
    applications: applications.length,
  });

  return {
    seeded: true,
    counts: {
      universities: universities.length,
      programs: programs.length,
      students: students.length,
      applications: applications.length,
    },
  };
}

if (require.main === module) {
  (async () => {
    try {
      await connectDatabase();
      const force = process.argv.includes("--force") || true;
      await seedDatabase({ force });
      console.log("Seed completed successfully.");
      process.exit(0);
    } catch (error) {
      console.error("Seed failed", error);
      process.exit(1);
    }
  })();
}

module.exports = { seedDatabase };
